/**
 * WatanyBot Electron Main Process
 * Provides a desktop preview with built-in debug console and error-fix panel.
 */
const { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

/** @type {BrowserWindow | null} */
let mainWindow = null;
let devToolsOpen = false;
const DEV_URL = "http://127.0.0.1:5174";

/* ------------------------------------------------------------------ */
/*  Window creation                                                    */
/* ------------------------------------------------------------------ */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "WatanyBot — Electron Preview",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  // Load the Vite dev server
  mainWindow.loadURL(DEV_URL).catch((err) => {
    console.error("Failed to load dev server. Is Vite running on port 5174?", err);
    mainWindow.loadFile(path.join(__dirname, "error.html"));
  });

  // Inject the debug overlay once the page is ready
  mainWindow.webContents.on("did-finish-load", () => {
    injectDebugOverlay(mainWindow);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  buildMenu();
}

/* ------------------------------------------------------------------ */
/*  Debug overlay injection                                            */
/* ------------------------------------------------------------------ */
function injectDebugOverlay(win) {
  const overlayCSS = fs.readFileSync(path.join(__dirname, "debug-overlay.css"), "utf-8");
  const overlayJS = fs.readFileSync(path.join(__dirname, "debug-overlay.js"), "utf-8");

  win.webContents.insertCSS(overlayCSS);
  win.webContents.executeJavaScript(overlayJS).catch((e) => {
    console.error("Error injecting debug overlay:", e);
  });
}

/* ------------------------------------------------------------------ */
/*  Application menu                                                   */
/* ------------------------------------------------------------------ */
function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Reload App",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Debug",
      submenu: [
        {
          label: "Toggle Debug Console",
          accelerator: "F12",
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              "window.__watanyDebug?.togglePanel()"
            );
          },
        },
        {
          label: "Toggle DevTools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => {
            if (mainWindow) {
              if (devToolsOpen) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools({ mode: "bottom" });
              }
              devToolsOpen = !devToolsOpen;
            }
          },
        },
        { type: "separator" },
        {
          label: "Clear Console",
          accelerator: "CmdOrCtrl+K",
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              "window.__watanyDebug?.clearLogs()"
            );
          },
        },
        {
          label: "Export Logs",
          click: async () => {
            if (!mainWindow) return;
            const logs = await mainWindow.webContents.executeJavaScript(
              "window.__watanyDebug?.exportLogs()"
            );
            if (logs) {
              const { filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: `watany-debug-${Date.now()}.json`,
                filters: [{ name: "JSON", extensions: ["json"] }],
              });
              if (filePath) {
                fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
              }
            }
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/*  IPC handlers for debug console                                     */
/* ------------------------------------------------------------------ */

// Execute arbitrary JS in the renderer (from the debug console "fix" feature)
ipcMain.handle("debug:execute", async (_event, code) => {
  if (!mainWindow) return { error: "No window" };
  try {
    const result = await mainWindow.webContents.executeJavaScript(code, true);
    return { success: true, result: String(result) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Read a source file for the "quick-fix" editor
ipcMain.handle("debug:read-file", async (_event, filePath) => {
  try {
    // Resolve relative to web-user/src
    const base = path.join(__dirname, "..", "src");
    const resolved = path.resolve(base, filePath);
    // Security: only allow reading from project src
    if (!resolved.startsWith(base)) {
      return { error: "Access denied: outside project src" };
    }
    const content = fs.readFileSync(resolved, "utf-8");
    return { success: true, content, path: resolved };
  } catch (err) {
    return { error: err.message };
  }
});

// Write a source file (hot-fix in dev)
ipcMain.handle("debug:write-file", async (_event, filePath, content) => {
  try {
    const base = path.join(__dirname, "..", "src");
    const resolved = path.resolve(base, filePath);
    if (!resolved.startsWith(base)) {
      return { error: "Access denied: outside project src" };
    }
    fs.writeFileSync(resolved, content, "utf-8");
    return { success: true, path: resolved };
  } catch (err) {
    return { error: err.message };
  }
});

// List source files for the file picker
ipcMain.handle("debug:list-files", async (_event, dir) => {
  try {
    const base = path.join(__dirname, "..", "src");
    const target = dir ? path.resolve(base, dir) : base;
    if (!target.startsWith(base)) {
      return { error: "Access denied" };
    }
    const entries = fs.readdirSync(target, { withFileTypes: true });
    return {
      success: true,
      files: entries.map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.relative(base, path.join(target, e.name)).replace(/\\/g, "/"),
      })),
    };
  } catch (err) {
    return { error: err.message };
  }
});

// Get Vite compilation errors from the terminal output
ipcMain.handle("debug:get-network-log", async () => {
  if (!mainWindow) return [];
  const log = await mainWindow.webContents.executeJavaScript(
    "window.__watanyDebug?.getNetworkLog() || []"
  );
  return log;
});

/* ------------------------------------------------------------------ */
/*  App lifecycle                                                      */
/* ------------------------------------------------------------------ */
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
