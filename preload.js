const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page),
  getLabs: async () => {
    const res = await ipcRenderer.invoke("db-get-labs");
    if (!res.ok) throw new Error(res.error || "Error obteniendo laboratorios");
    return res.data;
  },
  getLabByKey: (labKey) => ipcRenderer.invoke("db-get-lab-by-key", labKey),
  getLabModules: (labKey) => ipcRenderer.invoke("db-get-lab-modes", labKey),
  insertSession: (data) => ipcRenderer.invoke("db-insert-session", data),
  insertInputs: (session_id, tipoAnalisis, datos) =>
    ipcRenderer.invoke("db-insert-inputs", { session_id, tipoAnalisis, datos }),
  getInputsBySession: (session_id, tipoAnalisis) =>
    ipcRenderer.invoke("db-get-inputs-by-session", { session_id, tipoAnalisis }),
  clearInputs: (session_id, tipoAnalisis) =>
    ipcRenderer.invoke("db-clear-inputs", { session_id, tipoAnalisis }),
  closeSession: (session_id) =>
  ipcRenderer.invoke("db-close-session", session_id),
});
