const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectFile: () => ipcRenderer.invoke("select-file"),
  processFile: (filePath) => ipcRenderer.invoke("process-file", filePath),
  copyText: (text) => clipboard.writeText(String(text ?? "")),
});
