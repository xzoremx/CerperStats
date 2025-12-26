const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

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
  getTestsWithMetadata: (session_id) =>
    ipcRenderer.invoke("db-get-tests-with-metadata", session_id),
  runEvaluations: (args) => ipcRenderer.invoke("db-run-evaluaciones", args),
  getEvaluacionesProgress: (session_id) =>
    ipcRenderer.invoke("db-get-evaluaciones-progress", session_id),
  getEvaluacionesGraficos: (session_id) =>
    ipcRenderer.invoke("db-get-evaluaciones-graficos", session_id),
  getResultadosPreliminares: (session_id) =>
    ipcRenderer.invoke("db-get-resultados-preliminares", session_id),
  deleteSessionDeep: (session_id) =>
    ipcRenderer.invoke("db-delete-session-deep", session_id),
  getCurrentUser: () => ipcRenderer.invoke("auth-get-current-user"),
  logout: () => ipcRenderer.invoke("auth-logout"),
  // Control de ventana estilo Apple
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  // PDF Report Generation
  generateReports: (sessionId, config) =>
    ipcRenderer.invoke("generate-reports", { sessionId, config }),
  getSessionReports: (sessionId) =>
    ipcRenderer.invoke("get-session-reports", sessionId),
  downloadReportPdf: (reportId) =>
    ipcRenderer.invoke("download-report-pdf", reportId),
  deleteReport: (reportId) =>
    ipcRenderer.invoke("delete-report", reportId),
});

// Exponer configuración de iconos (leer archivos locales de forma segura)
contextBridge.exposeInMainWorld('iconConfig', {
  // Lucide-only mode: no trusted list nor public key required
  getTrustedIcons: async () => ({}),
  getIconPublicKey: () => ({})
});
