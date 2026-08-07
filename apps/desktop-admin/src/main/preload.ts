import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  gatewayFetch: (method: string, path: string, body?: string) =>
    ipcRenderer.invoke("gateway:fetch", method, path, body),
  getVersion: () => ipcRenderer.invoke("app:version"),
  getGatewayUrl: () => ipcRenderer.invoke("app:gateway-url"),
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
});
