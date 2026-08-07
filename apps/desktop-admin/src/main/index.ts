import { app, BrowserWindow, ipcMain, shell, globalShortcut, Menu, dialog } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";

const isDev = !app.isPackaged;
// Prefer IPv4 loopback to avoid systems where `localhost` resolves to ::1 and
// the backend is only bound to IPv4 (avoids ECONNREFUSED ::1:8010 errors).
const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:8010";

console.log("[WatanyBot Admin] Starting…", { isDev, __dirname, pid: process.pid });

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, "preload.js");
  console.log("[WatanyBot Admin] Preload:", preloadPath);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "WatanyBot Admin",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Try port 5177 first (when 5176 is in use), fallback to 5176
    const devUrl = "http://localhost:5177";
    console.log("[WatanyBot Admin] Loading dev URL:", devUrl);
    win.loadURL(devUrl).catch((err) => {
      console.error("[WatanyBot Admin] Failed to load dev URL on 5177, trying 5176:", err.message);
      const fallbackUrl = "http://localhost:5176";
      win.loadURL(fallbackUrl).catch((err2) => {
        console.error("[WatanyBot Admin] Failed to load fallback URL:", err2.message);
        // Final fallback: load file
        const filePath = path.join(__dirname, "../renderer/index.html");
        if (fs.existsSync(filePath)) {
          win.loadFile(filePath);
        }
      });
    });
    win.webContents.openDevTools({ mode: "bottom" });

    // Forward renderer console messages to the main process terminal (dev-only helper)
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log(`[renderer console] level=${level} line=${line} src=${sourceId} msg=${message}`);
    });

    // Capture renderer load/finish and uncaught exceptions for easier debugging
    win.webContents.on("did-finish-load", () => {
      console.log("[WatanyBot Admin] renderer finished loading (dev)");
    });
    win.webContents.on("render-process-gone", (evt, details) => {
      console.error("[WatanyBot Admin] renderer process gone:", details);
    });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

/* ── IPC: Gateway API proxy ─────────────────────────────────── */

function gatewayFetch(
  method: string,
  urlPath: string,
  body?: string
): Promise<{ status: number; data: any }> {
  // Try the requested host, but if it fails with ECONNREFUSED on IPv6 (::1)
  // retry automatically using the IPv4 loopback (127.0.0.1).
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, GATEWAY_URL);

    const makeRequest = (hostname: string, isRetry = false) => {
      const opts: http.RequestOptions = {
        hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { "Content-Type": "application/json" },
      };

      const req = http.request(opts, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: raw });
          }
        });
      });

      req.on("error", (err: any) => {
        // If initial attempt used IPv6/localhost and we got ECONNREFUSED,
        // retry once with IPv4 loopback.
        if (!isRetry && (hostname === "::1" || hostname === "localhost") && err && err.code === "ECONNREFUSED") {
          return makeRequest("127.0.0.1", true);
        }
        reject(err);
      });

      if (body) req.write(body);
      req.end();
    };

    makeRequest(url.hostname);
  });
}

ipcMain.handle(
  "gateway:fetch",
  async (_event, method: string, urlPath: string, body?: string) => {
    return gatewayFetch(method, urlPath, body);
  }
);

ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:gateway-url", () => GATEWAY_URL);

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

/* ── App lifecycle ──────────────────────────────────────────── */

app.whenReady().then(() => {
  /* ── Application Menu with Reload ─────────────────────────── */
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => BrowserWindow.getFocusedWindow()?.webContents.reload() },
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => BrowserWindow.getFocusedWindow()?.webContents.reloadIgnoringCache() },
        { label: "Refresh (F5)", accelerator: "F5", click: () => BrowserWindow.getFocusedWindow()?.webContents.reload() },
        { label: "Hard Refresh", accelerator: "Shift+F5", click: () => BrowserWindow.getFocusedWindow()?.webContents.reloadIgnoringCache() },
        { type: "separator" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  createWindow();

  // DEV SELF‑TEST: exercise the `gatewayFetch` IPC path on startup so we can
  // verify IPv4-fallback and connectivity. This runs only in development.
  if (isDev) {
    gatewayFetch("GET", "/api/admin/overview")
      .then((res) => {
        console.log("[WatanyBot Admin] gatewayFetch test (dev):", res);
        try {
          fs.writeFileSync(path.join(process.cwd(), "gateway_fetch_test.json"), JSON.stringify(res, null, 2), "utf8");
        } catch (e) {
          console.error("[WatanyBot Admin] failed to write gateway_fetch_test.json:", e);
        }
      })
      .catch((err) => {
        console.error("[WatanyBot Admin] gatewayFetch test error:", err);
        try {
          fs.writeFileSync(path.join(process.cwd(), "gateway_fetch_test.json"), JSON.stringify({ error: String(err) }, null, 2), "utf8");
        } catch (e) {
          console.error("[WatanyBot Admin] failed to write gateway_fetch_test.json:", e);
        }
      });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
