const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page)
});
