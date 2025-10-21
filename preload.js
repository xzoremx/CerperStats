const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page),
  saveDataframeTemp: (labName, jsonStr) => ipcRenderer.invoke('save-dataframe-temp', labName, jsonStr)
});
