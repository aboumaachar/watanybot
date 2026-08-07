/**
 * WatanyBot Debug Overlay — injected into the Electron renderer.
 *
 * Features:
 *  1. Console tab  — captures console.log/warn/error/info + uncaught errors
 *  2. Network tab  — intercepts fetch/XHR requests with status + timing
 *  3. Editor tab   — read/write project source files (hot-fix during testing)
 *  4. Files tab    — browse src/ tree and open files in the editor
 *  5. REPL input   — execute JS in the page context
 *  6. Resizable panel
 */
(function () {
  if (window.__watanyDebug) return; // already injected

  /* ================================================================ */
  /*  State                                                            */
  /* ================================================================ */
  const MAX_LOGS = 2000;
  const logs = [];
  const networkLog = [];
  let panelVisible = false;
  let activeTab = "console"; // console | network | editor | files
  let currentEditorFile = "";
  let currentEditorContent = "";
  let errorCount = 0;
  let warnCount = 0;
  let fileBrowserPath = "";
  const replHistory = [];
  let replHistoryIdx = -1;

  /* ================================================================ */
  /*  DOM construction                                                 */
  /* ================================================================ */
  function createPanel() {
    // Toggle button
    const toggle = document.createElement("button");
    toggle.id = "watany-debug-toggle";
    toggle.textContent = "🐛";
    toggle.title = "Toggle Debug Console (F12)";
    toggle.onclick = () => togglePanel();
    document.body.appendChild(toggle);

    // Panel
    const panel = document.createElement("div");
    panel.id = "watany-debug-panel";
    panel.classList.add("collapsed");
    panel.innerHTML = `
      <div id="watany-debug-resize"></div>
      <div id="watany-debug-toolbar">
        <button data-tab="console" class="active">Console <span class="badge" id="dbg-err-badge" style="display:none">0</span><span class="badge warn" id="dbg-warn-badge" style="display:none">0</span></button>
        <button data-tab="network">Network</button>
        <button data-tab="editor">Editor</button>
        <button data-tab="files">Files</button>
        <span class="spacer"></span>
        <button id="dbg-clear-btn" title="Clear (Ctrl+K)">🗑 Clear</button>
        <button id="dbg-export-btn" title="Export logs">📥 Export</button>
        <button id="dbg-close-btn" title="Close panel">✕</button>
      </div>
      <div id="watany-debug-content">
        <!-- console -->
        <div id="watany-debug-logs" data-panel="console"></div>
        <!-- network -->
        <div id="watany-debug-network" data-panel="network" style="display:none"></div>
        <!-- editor -->
        <div id="watany-debug-editor" data-panel="editor" style="display:none">
          <div class="editor-toolbar">
            <input id="dbg-editor-path" placeholder="src/components/ChatPage.tsx" />
            <button id="dbg-editor-open">Open</button>
            <button id="dbg-editor-save">💾 Save & Reload</button>
          </div>
          <textarea id="dbg-editor-textarea" spellcheck="false" placeholder="Open a file to edit..."></textarea>
        </div>
        <!-- files -->
        <div id="watany-debug-files" data-panel="files" style="display:none"></div>
      </div>
      <div id="watany-debug-repl" data-panel="console">
        <span class="prompt">❯</span>
        <input id="watany-debug-input" placeholder="Type JavaScript to execute..." autocomplete="off" spellcheck="false" />
      </div>
    `;
    document.body.appendChild(panel);

    // Wire events
    wireToolbar();
    wireRepl();
    wireResize();
    wireEditor();
    wireFileBrowser();
  }

  /* ================================================================ */
  /*  Toolbar                                                          */
  /* ================================================================ */
  function wireToolbar() {
    document.querySelectorAll("#watany-debug-toolbar button[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    document.getElementById("dbg-clear-btn").onclick = clearLogs;
    document.getElementById("dbg-export-btn").onclick = () => {
      const data = exportLogs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `watany-debug-${Date.now()}.json`;
      a.click();
    };
    document.getElementById("dbg-close-btn").onclick = () => togglePanel();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll("#watany-debug-toolbar button[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll("#watany-debug-content > [data-panel]").forEach((el) => {
      el.style.display = el.dataset.panel === tab ? "" : "none";
    });
    // Show/hide REPL
    const repl = document.getElementById("watany-debug-repl");
    if (repl) repl.style.display = tab === "console" ? "" : "none";
    // Auto-load files tab
    if (tab === "files") loadFileTree(fileBrowserPath);
    if (tab === "network") renderNetworkLog();
  }

  /* ================================================================ */
  /*  Console interception                                             */
  /* ================================================================ */
  const origConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };

  function intercept(level) {
    console[level] = function (...args) {
      origConsole[level](...args);
      addLog(level, args.map(stringify).join(" "), getCallerInfo());
    };
  }
  ["log", "warn", "error", "info"].forEach(intercept);

  // Uncaught errors
  window.addEventListener("error", (e) => {
    const loc = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "";
    addLog("error", `Uncaught: ${e.message}`, loc, { fixable: true, source: e.filename, line: e.lineno });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || e.reason?.toString() || String(e.reason);
    addLog("error", `Unhandled Promise: ${msg}`, "", { fixable: true });
  });

  /* ================================================================ */
  /*  Network interception                                             */
  /* ================================================================ */
  const origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    const method = init?.method || "GET";
    const start = performance.now();
    const entry = { method, url, status: "...", duration: 0, time: new Date().toISOString() };
    networkLog.push(entry);
    if (networkLog.length > 500) networkLog.shift();
    try {
      const resp = await origFetch(input, init);
      entry.status = resp.status;
      entry.duration = Math.round(performance.now() - start);
      if (!resp.ok) {
        addLog("network", `${method} ${url} → ${resp.status} (${entry.duration}ms)`, "fetch");
      }
      return resp;
    } catch (err) {
      entry.status = "ERR";
      entry.duration = Math.round(performance.now() - start);
      addLog("error", `Fetch failed: ${method} ${url} — ${err.message}`, "fetch");
      throw err;
    }
  };

  // XHR interception
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__dbg = { method, url, start: 0 };
    return XHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__dbg) {
      this.__dbg.start = performance.now();
      const entry = { method: this.__dbg.method, url: this.__dbg.url, status: "...", duration: 0, time: new Date().toISOString() };
      networkLog.push(entry);
      this.addEventListener("load", () => {
        entry.status = this.status;
        entry.duration = Math.round(performance.now() - this.__dbg.start);
      });
      this.addEventListener("error", () => {
        entry.status = "ERR";
        entry.duration = Math.round(performance.now() - this.__dbg.start);
      });
    }
    return XHRSend.apply(this, arguments);
  };

  /* ================================================================ */
  /*  Log management                                                   */
  /* ================================================================ */
  function addLog(level, message, source, meta) {
    const entry = {
      level,
      message,
      source: source || "",
      time: new Date().toISOString(),
      meta: meta || null,
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();

    if (level === "error") errorCount++;
    if (level === "warn") warnCount++;
    updateBadges();

    if (panelVisible && activeTab === "console") {
      appendLogDOM(entry);
    }
  }

  function appendLogDOM(entry) {
    const container = document.getElementById("watany-debug-logs");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `debug-log-entry ${entry.level}`;

    const ts = entry.time.split("T")[1]?.split(".")[0] || "";
    let html = `<span class="ts">${ts}</span>${escapeHtml(entry.message)}`;
    if (entry.source) html += `<span class="src">${escapeHtml(entry.source)}</span>`;

    // "Fix" button for errors
    if (entry.level === "error") {
      html += ` <button class="fix-btn" data-error="${escapeAttr(entry.message)}">🔧 Fix</button>`;
    }

    div.innerHTML = html;
    container.appendChild(div);

    // Wire fix button
    const fixBtn = div.querySelector(".fix-btn");
    if (fixBtn) {
      fixBtn.onclick = () => openErrorFixer(entry);
    }

    // Auto-scroll
    container.scrollTop = container.scrollHeight;
  }

  function renderAllLogs() {
    const container = document.getElementById("watany-debug-logs");
    if (!container) return;
    container.innerHTML = "";
    logs.forEach(appendLogDOM);
  }

  function clearLogs() {
    logs.length = 0;
    errorCount = 0;
    warnCount = 0;
    updateBadges();
    const container = document.getElementById("watany-debug-logs");
    if (container) container.innerHTML = "";
  }

  function exportLogs() {
    return { logs: [...logs], network: [...networkLog], timestamp: new Date().toISOString() };
  }

  function updateBadges() {
    const errBadge = document.getElementById("dbg-err-badge");
    const warnBadge = document.getElementById("dbg-warn-badge");
    if (errBadge) {
      errBadge.textContent = errorCount;
      errBadge.style.display = errorCount > 0 ? "" : "none";
    }
    if (warnBadge) {
      warnBadge.textContent = warnCount;
      warnBadge.style.display = warnCount > 0 ? "" : "none";
    }
  }

  /* ================================================================ */
  /*  Network log rendering                                            */
  /* ================================================================ */
  function renderNetworkLog() {
    const container = document.getElementById("watany-debug-network");
    if (!container) return;
    container.innerHTML = "";
    networkLog.forEach((e) => {
      const div = document.createElement("div");
      div.className = "net-entry";
      const statusClass = e.status === "ERR" || e.status >= 400 ? "status-err" : "status-ok";
      div.innerHTML = `
        <span class="method">${e.method}</span>
        <span class="${statusClass}">${e.status}</span>
        <span class="url" title="${escapeAttr(e.url)}">${escapeHtml(e.url)}</span>
        <span class="dur">${e.duration}ms</span>
      `;
      container.appendChild(div);
    });
  }

  /* ================================================================ */
  /*  REPL                                                             */
  /* ================================================================ */
  function wireRepl() {
    const input = document.getElementById("watany-debug-input");
    if (!input) return;
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        const code = input.value.trim();
        replHistory.push(code);
        replHistoryIdx = replHistory.length;
        addLog("info", `❯ ${code}`, "repl");
        input.value = "";
        try {
          // Use Electron IPC if available, otherwise eval directly
          if (window.electronDebug) {
            const res = await window.electronDebug.execute(code);
            if (res.success) {
              addLog("result", String(res.result), "repl");
            } else {
              addLog("error", res.error, "repl");
            }
          } else {
            const result = eval(code);
            addLog("result", stringify(result), "repl");
          }
        } catch (err) {
          addLog("error", err.message, "repl");
        }
      }
      // History navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (replHistoryIdx > 0) {
          replHistoryIdx--;
          input.value = replHistory[replHistoryIdx] || "";
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (replHistoryIdx < replHistory.length - 1) {
          replHistoryIdx++;
          input.value = replHistory[replHistoryIdx] || "";
        } else {
          replHistoryIdx = replHistory.length;
          input.value = "";
        }
      }
    });
  }

  /* ================================================================ */
  /*  File editor (hot-fix)                                            */
  /* ================================================================ */
  function wireEditor() {
    const openBtn = document.getElementById("dbg-editor-open");
    const saveBtn = document.getElementById("dbg-editor-save");
    const pathInput = document.getElementById("dbg-editor-path");
    const textarea = document.getElementById("dbg-editor-textarea");

    if (openBtn) {
      openBtn.onclick = async () => {
        const filePath = pathInput.value.trim();
        if (!filePath) return;
        await openFileInEditor(filePath);
      };
    }
    if (saveBtn) {
      saveBtn.onclick = async () => {
        if (!currentEditorFile) {
          addLog("warn", "No file open to save", "editor");
          return;
        }
        const content = textarea.value;
        if (window.electronDebug) {
          const res = await window.electronDebug.writeFile(currentEditorFile, content);
          if (res.success) {
            addLog("info", `✅ Saved ${currentEditorFile} — Vite will hot-reload`, "editor");
            // Vite HMR should pick up the change automatically
          } else {
            addLog("error", `Save failed: ${res.error}`, "editor");
          }
        } else {
          addLog("warn", "File saving requires Electron", "editor");
        }
      };
    }
    // Ctrl+S in editor
    if (textarea) {
      textarea.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          saveBtn?.click();
        }
        // Tab key inserts spaces
        if (e.key === "Tab") {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
      });
    }
  }

  async function openFileInEditor(filePath) {
    const pathInput = document.getElementById("dbg-editor-path");
    const textarea = document.getElementById("dbg-editor-textarea");
    if (!window.electronDebug) {
      addLog("warn", "File operations require Electron", "editor");
      return;
    }
    const res = await window.electronDebug.readFile(filePath);
    if (res.success) {
      currentEditorFile = filePath;
      currentEditorContent = res.content;
      if (textarea) textarea.value = res.content;
      if (pathInput) pathInput.value = filePath;
      switchTab("editor");
      addLog("info", `Opened ${filePath} (${res.content.length} chars)`, "editor");
    } else {
      addLog("error", `Cannot open: ${res.error}`, "editor");
    }
  }

  /* ================================================================ */
  /*  File browser                                                     */
  /* ================================================================ */
  function wireFileBrowser() {
    // Initial load handled by tab switch
  }

  async function loadFileTree(dir) {
    const container = document.getElementById("watany-debug-files");
    if (!container || !window.electronDebug) return;

    const res = await window.electronDebug.listFiles(dir || "");
    if (!res.success) {
      container.innerHTML = `<div style="color:#f38ba8;padding:10px">Error: ${res.error}</div>`;
      return;
    }

    container.innerHTML = "";

    // Back button
    if (dir) {
      const back = document.createElement("div");
      back.className = "file-entry dir";
      back.innerHTML = `<span class="icon">⬆</span> ..`;
      back.onclick = () => {
        fileBrowserPath = dir.split("/").slice(0, -1).join("/");
        loadFileTree(fileBrowserPath);
      };
      container.appendChild(back);
    }

    // Sort: dirs first, then files
    const sorted = res.files.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    sorted.forEach((f) => {
      const el = document.createElement("div");
      el.className = `file-entry ${f.isDir ? "dir" : "file"}`;
      el.innerHTML = `<span class="icon">${f.isDir ? "📁" : "📄"}</span> ${escapeHtml(f.name)}`;
      el.onclick = () => {
        if (f.isDir) {
          fileBrowserPath = f.path;
          loadFileTree(f.path);
        } else {
          openFileInEditor(f.path);
        }
      };
      container.appendChild(el);
    });
  }

  /* ================================================================ */
  /*  Error fixer                                                      */
  /* ================================================================ */
  function openErrorFixer(entry) {
    // Try to guess the source file from the error
    const msg = entry.message || "";
    const src = entry.source || "";
    let guessFile = "";

    // Try to extract file from stack or source
    const srcMatch = src.match(/src\/(.+?)(?::\d+)?$/);
    if (srcMatch) {
      guessFile = srcMatch[1];
    } else {
      // Look for common patterns like "at Component (App.tsx:42)"
      const fileMatch = msg.match(/(?:at\s+\w+\s+\(|at\s+)([\w\/\-\.]+\.(?:tsx?|jsx?|css))(?::(\d+))?/);
      if (fileMatch) guessFile = fileMatch[1];
    }

    // Switch to editor with the guessed file, or prompt
    switchTab("editor");
    const pathInput = document.getElementById("dbg-editor-path");
    if (pathInput) {
      pathInput.value = guessFile || "";
      pathInput.focus();
      pathInput.select();
    }

    // Pre-fill REPL with a helpful comment
    addLog("info", `🔧 Error to fix: ${msg}`, "fixer");
    if (guessFile) {
      addLog("info", `📂 Likely file: ${guessFile} — Opening...`, "fixer");
      if (guessFile) openFileInEditor(guessFile);
    } else {
      addLog("info", `Could not auto-detect file. Use the Files tab or type a path.`, "fixer");
    }
  }

  /* ================================================================ */
  /*  Resize                                                           */
  /* ================================================================ */
  function wireResize() {
    const handle = document.getElementById("watany-debug-resize");
    const panel = document.getElementById("watany-debug-panel");
    if (!handle || !panel) return;

    let startY, startH;
    handle.addEventListener("mousedown", (e) => {
      startY = e.clientY;
      startH = panel.offsetHeight;
      const onMove = (ev) => {
        const delta = startY - ev.clientY;
        panel.style.height = Math.max(150, Math.min(window.innerHeight - 50, startH + delta)) + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  /* ================================================================ */
  /*  Panel toggle                                                     */
  /* ================================================================ */
  function togglePanel() {
    panelVisible = !panelVisible;
    const panel = document.getElementById("watany-debug-panel");
    const toggle = document.getElementById("watany-debug-toggle");
    if (panel) panel.classList.toggle("collapsed", !panelVisible);
    if (toggle) toggle.classList.toggle("panel-open", panelVisible);
    if (panelVisible && activeTab === "console") renderAllLogs();
    if (panelVisible && activeTab === "network") renderNetworkLog();
  }

  /* ================================================================ */
  /*  Utilities                                                        */
  /* ================================================================ */
  function stringify(val) {
    if (val === undefined) return "undefined";
    if (val === null) return "null";
    if (typeof val === "object") {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  function getCallerInfo() {
    try {
      const stack = new Error().stack || "";
      const lines = stack.split("\n");
      // Skip Error, intercept wrapper, and this function
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("debug-overlay") || line.includes("<anonymous>")) continue;
        const match = line.match(/at\s+(.+?)\s+\((.+)\)/) || line.match(/at\s+(.+)/);
        if (match) return match[1].trim();
      }
    } catch {}
    return "";
  }

  function getNetworkLog() {
    return [...networkLog];
  }

  /* ================================================================ */
  /*  Keyboard shortcuts                                               */
  /* ================================================================ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearLogs();
    }
  });

  /* ================================================================ */
  /*  Init                                                             */
  /* ================================================================ */
  createPanel();
  addLog("info", "🐛 WatanyBot Debug Console ready. Press F12 to toggle.", "system");
  addLog("info", "Tabs: Console | Network | Editor | Files", "system");
  addLog("info", "Use the REPL below to execute JavaScript. Click 🔧 Fix on errors to open the source.", "system");

  /* ================================================================ */
  /*  Public API                                                       */
  /* ================================================================ */
  window.__watanyDebug = {
    togglePanel,
    clearLogs,
    exportLogs,
    getNetworkLog,
    addLog,
  };
})();

