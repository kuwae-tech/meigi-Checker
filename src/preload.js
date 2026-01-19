const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  parseExcel: (filePath) => ipcRenderer.invoke('parse-excel', filePath),
  copyText: (text) => ipcRenderer.invoke('copy-text', text)
});
