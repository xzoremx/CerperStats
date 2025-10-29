const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page),
  getLabs: async () => {
    const res = await ipcRenderer.invoke("db-get-labs");
    if (!res.ok) throw new Error(res.error || "Error obteniendo laboratorios");
    return res.data;
  },
  getLabModules: (labKey) => ipcRenderer.invoke("db-get-lab-modes", labKey),
  insertInputs: (session_id, tipoAnalisis, datos) =>
    ipcRenderer.invoke("db-insert-inputs", { session_id, tipoAnalisis, datos }),
});
