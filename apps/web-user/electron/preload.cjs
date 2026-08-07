/**
 * Electron preload script – exposes safe IPC bridge to the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronDebug", {
  // Execute JS fix in the page context
  execute: (code) => ipcRenderer.invoke("debug:execute", code),
  // Source file operations
  readFile: (filePath) => ipcRenderer.invoke("debug:read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("debug:write-file", filePath, content),
  listFiles: (dir) => ipcRenderer.invoke("debug:list-files", dir),
  // Network log
  getNetworkLog: () => ipcRenderer.invoke("debug:get-network-log"),
});
