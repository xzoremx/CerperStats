const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page),
  getLabs: async () => {
    const res = await ipcRenderer.invoke("db-get-labs");
    if (!res.ok) throw new Error(res.error || "Error obteniendo laboratorios");
    return res.data;
  },
  login: (username, password) =>
  ipcRenderer.invoke("db-login", { username, password }),
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
  getSessionInfo: (session_id) =>
  ipcRenderer.invoke("db-get-session-info", session_id),
  getSessionsByRole: (args) =>
  ipcRenderer.invoke("db-get-sessions-by-role", args),
  getEvaluaciones: (args) => ipcRenderer.invoke("db-get-evaluaciones", args),
  getSessionMetadata: (session_id) =>
  ipcRenderer.invoke("db-get-session-metadata", session_id),
  getTestsWithMetadata: (session_id) =>
  ipcRenderer.invoke("db-get-tests-with-metadata", session_id),
  runEvaluations: (args) => ipcRenderer.invoke("db-run-evaluaciones", args),
  deleteSessionDeep: (session_id) =>
    ipcRenderer.invoke("db-delete-session-deep", session_id),
});
