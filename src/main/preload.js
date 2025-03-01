const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  readFile: async (filePath, options) => {
    return await ipcRenderer.invoke('read-file', filePath, options);
  },
  writeFile: async (filePath, data) => {
    await ipcRenderer.invoke('write-file', filePath, data);
  },
  // Nya metoder för export
  exportToExcel: async (data, filename) => {
    return await ipcRenderer.invoke('export-to-excel', data, filename);
  },
  exportToCSV: async (data, filename) => {
    return await ipcRenderer.invoke('export-to-csv', data, filename);
  },
  showSaveDialog: async (options) => {
    return await ipcRenderer.invoke('show-save-dialog', options);
  }
});