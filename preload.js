const { contextBridge, ipcRenderer } = require('electron');

// === Auth session expired listeners ===
const authListeners = new Set();

ipcRenderer.on('auth:session-expired', (_event, data) => {
  console.warn('[AUTH] Sesión expirada:', data);
  authListeners.forEach(callback => {
    try {
      callback(data);
    } catch (e) {
      console.error('[AUTH] Error en listener:', e);
    }
  });
});

contextBridge.exposeInMainWorld('cerper', {
  openPage: (page) => ipcRenderer.invoke('open-page', page),
  getLabs: async () => {
    const res = await ipcRenderer.invoke("db-get-labs");
    if (!res.ok) throw new Error(res.error || "Error obteniendo laboratorios");
    return res.data;
  },
  login: (username, password) =>
    ipcRenderer.invoke("db-login", { username, password }),
  // Verificar validez del token (para uso al cargar páginas protegidas)
  verifyToken: () => ipcRenderer.invoke("auth-verify-token"),
  // Listener para sesión expirada
  onSessionExpired: (callback) => {
    authListeners.add(callback);
    // Retorna función para remover el listener
    return () => authListeners.delete(callback);
  },
  getLabByKey: (labKey) => ipcRenderer.invoke("db-get-lab-by-key", labKey),
  getLabModules: (labKey) => ipcRenderer.invoke("db-get-lab-modes", labKey),
  // Estadísticas
  getStatsDashboard: () => ipcRenderer.invoke("db-get-stats-dashboard"),
  getStatsUser: () => ipcRenderer.invoke("db-get-stats-user"),
  insertSession: (data) => ipcRenderer.invoke("db-insert-session", data),
  insertInputs: (session_id, tipoAnalisis, datos) =>
    ipcRenderer.invoke("db-insert-inputs", { session_id, tipoAnalisis, datos }),
  getInputsBySession: (session_id, tipoAnalisis) =>
    ipcRenderer.invoke("db-get-inputs-by-session", { session_id, tipoAnalisis }),
  clearInputs: (session_id, tipoAnalisis) =>
    ipcRenderer.invoke("db-clear-inputs", { session_id, tipoAnalisis }),
  clearResults: (session_id) =>
    ipcRenderer.invoke("db-clear-results", session_id),
  closeSession: (session_id) =>
    ipcRenderer.invoke("db-close-session", session_id),
  updateSessionStatus: (session_id, estado) =>
    ipcRenderer.invoke("db-update-session-status", { session_id, estado }),
  cancelIncompleteSessions: (usuario_id) =>
    ipcRenderer.invoke("db-cancel-incomplete-sessions", { usuario_id }),
  getSessionInfo: (session_id) =>
    ipcRenderer.invoke("db-get-session-info", session_id),
  getSessionResultsStatus: (session_id) =>
    ipcRenderer.invoke("db-get-session-results-status", session_id),
  getSessionsByRole: (args) =>
    ipcRenderer.invoke("db-get-sessions-by-role", args),
  getEvaluaciones: (args) => ipcRenderer.invoke("db-get-evaluaciones", args),
  getTestsWithMetadata: (session_id) =>
    ipcRenderer.invoke("db-get-tests-with-metadata", session_id),
  getTestsFormattingConfig: () =>
    ipcRenderer.invoke("db-get-tests-formatting-config"),
  // Parametrizable tests - user params CRUD
  getTestParamsSchema: (catalogId) =>
    ipcRenderer.invoke("db-get-test-params-schema", catalogId),
  getSessionTestParams: (sessionId, catalogId) =>
    ipcRenderer.invoke("db-get-session-test-params", { sessionId, catalogId }),
  getAllSessionTestParams: (sessionId) =>
    ipcRenderer.invoke("db-get-all-session-test-params", sessionId),
  saveSessionTestParams: ({ sessionId, catalogId, params }) =>
    ipcRenderer.invoke("db-save-session-test-params", { sessionId, catalogId, params }),
  deleteSessionTestParams: (sessionId, catalogId) =>
    ipcRenderer.invoke("db-delete-session-test-params", { sessionId, catalogId }),
  runEvaluations: (args) => ipcRenderer.invoke("db-run-evaluaciones", args),
  getEvaluacionesProgress: (session_id) =>
    ipcRenderer.invoke("db-get-evaluaciones-progress", session_id),
  getEvaluacionesGraficos: (session_id) =>
    ipcRenderer.invoke("db-get-evaluaciones-graficos", session_id),
  getResultadosPreliminares: (session_id) =>
    ipcRenderer.invoke("db-get-resultados-preliminares", session_id),
  deleteSessionDeep: (session_id) =>
    ipcRenderer.invoke("db-delete-session-deep", session_id),
  reuseSession: (session_id, usuario_id) =>
    ipcRenderer.invoke("db-reuse-session", { session_id, usuario_id }),
  getCurrentUser: () => ipcRenderer.invoke("auth-get-current-user"),
  logout: () => ipcRenderer.invoke("auth-logout"),
  // Control de ventana estilo Apple
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  // PDF Report Generation
  generateReports: (sessionId, config, requestId) =>
    ipcRenderer.invoke("generate-reports", { sessionId, config, requestId }),
  onReportsProgress: (callback) => {
    const handler = (_event, data) => {
      try {
        callback(data);
      } catch (e) {
        console.error("[REPORTS] Error en listener de progreso:", e);
      }
    };
    ipcRenderer.on("reports:progress", handler);
    return () => ipcRenderer.off("reports:progress", handler);
  },
  getSessionReports: (sessionId) =>
    ipcRenderer.invoke("get-session-reports", sessionId),
  downloadReportPdf: (reportId) =>
    ipcRenderer.invoke("download-report-pdf", reportId),
  deleteReport: (reportId) =>
    ipcRenderer.invoke("delete-report", reportId),
  saveReportToDb: (sessionId, report) =>
    ipcRenderer.invoke("save-report-to-db", { sessionId, report }),
  markReportsAsUrgent: (reportIds) =>
    ipcRenderer.invoke("mark-reports-as-urgent", reportIds),
  updateReportStatus: (reportId, estado) =>
    ipcRenderer.invoke("update-report-status", { reportId, estado }),
});

// Exponer configuración de iconos (leer archivos locales de forma segura)
contextBridge.exposeInMainWorld('iconConfig', {
  // Lucide-only mode: no trusted list nor public key required
  getTrustedIcons: async () => ({}),
  getIconPublicKey: () => ({})
});
