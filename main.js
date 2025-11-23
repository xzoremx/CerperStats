// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
let mainWindow;
// Estado de autenticación en memoria (fuente de verdad)
let currentUser = null;
// === Lista blanca de rutas (todas las vistas autorizadas) ===
const ROUTES = new Set([
  // Login, menú principal y selección
  'login.html',
  'menu.html',
  'procedure_select.html',
  'sessions_panel.html',
  'session_detail.html',
  'inputs_monoanalito.html',
  'inputs_multianalito.html',
  'results_general.html',
  'reports.html',
  // Flujo input_data
  'input_data/preinfo.html',
  'input_data/step_1_type.html',
  'input_data/step_2_parametro.html',
  'input_data/step_3_dato.html',
  'input_data/step_4_k.html',
  'input_data/step_5_sheet.html',
  // Evaluación y reporte
  'evaluation_select.html',
  'pdf_config.html',
  'postinfo.html',
  // Otros
  'index.html'
]);
// === Crear ventana principal ===
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    icon: path.join(__dirname, 'assets', 'logos', 'cerper_logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.loadFile('login.html'); // Pantalla inicial
}

// === Inicialización de la app ===
app.whenReady().then(() => {
  app.setAppUserModelId('com.cerper.cerperstats');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
// === Cerrar completamente al salir (excepto en macOS) ===
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Cierre limpio (no hay conexiones directas)
app.on('before-quit', async () => {});
// === Navegación segura controlada desde preload.js ===
ipcMain.handle('open-page', async (_event, page) => {
  if (!ROUTES.has(page)) {
    console.warn(`[CerperStats] Ruta no permitida: ${page}`);
    return { ok: false, error: 'Ruta no permitida' };
  }
  try {
    await mainWindow.loadFile(page);
    console.log(`[CerperStats] Página cargada: ${page}`);
    return { ok: true };
  } catch (err) {
    console.error(`[CerperStats] Error al cargar ${page}:`, err);
    return { ok: false, error: err.message };
  }
  });


// === Proxy REST (reemplaza acceso directo a PostgreSQL) ===
require('dotenv').config();

const DEFAULT_PROXY_RUN_URL = "http://localhost:4000/run-eval";
const PROXY_RUN_URL =
  process.env.CERPER_PROXY_URL ||
  process.env.CERPER_EVAL_URL ||
  DEFAULT_PROXY_RUN_URL;
const PROXY_TOKEN = process.env.CERPER_PROXY_TOKEN || "";
const PROXY_BASE_URL =
  PROXY_RUN_URL.replace(/\/run-eval\/?$/, "") || PROXY_RUN_URL;

const buildProxyHeaders = (additional = {}) => ({
  "Content-Type": "application/json",
  ...(PROXY_TOKEN ? { Authorization: `Bearer ${PROXY_TOKEN}` } : {}),
  ...additional,
});

async function proxyFetch(endpoint, options = {}) {
  const normalizedPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(normalizedPath, PROXY_BASE_URL);
  const response = await fetch(url, {
    ...options,
    headers: buildProxyHeaders(options.headers),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const err = new Error(
      `Proxy request failed: ${response.status} ${response.statusText} ${details}`
    );
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// === LOGIN DE USUARIO (bcryptjs) ===
const bcrypt = require("bcryptjs");
ipcMain.handle("db-login", async (_event, { username, password }) => {
  try {
    const payload = await proxyFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    currentUser = payload.user || null;
    return { ok: true, user: currentUser };
  } catch (err) {
    console.error("[PROXY] Error en login:", err);
    return { ok: false, error: err.message };
  }
});

// === Autenticación: obtener usuario actual ===
ipcMain.handle("auth-get-current-user", async () => {
  return { ok: true, user: currentUser };
});

// === Autenticación: logout ===
ipcMain.handle("auth-logout", async () => {
  currentUser = null;
  return { ok: true };
});
// === Lectura de laboratorios para el menú principal ===
ipcMain.handle("db-get-labs", async () => {
  try {
    const payload = await proxyFetch("/labs");
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error leyendo laboratorios:", err);
    return { ok: false, error: err.message };
  }
});
// === Lectura completa de un laboratorio por clave ===
ipcMain.handle("db-get-lab-by-key", async (event, labKey) => {
  try {
    const payload = await proxyFetch(`/labs/${encodeURIComponent(labKey)}`);
    return { ok: true, data: payload.data };
  } catch (err) {
    console.error("[PROXY] Error obteniendo laboratorio por clave:", err);
    return { ok: false, error: err.message };
  }
});
// === Lectura de módulos / configuraciones por laboratorio ===
ipcMain.handle("db-get-lab-modes", async (_e, labKey) => {
  try {
    const payload = await proxyFetch(`/labs/${encodeURIComponent(labKey)}/modes`);
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error leyendo lab modes:", err);
    return { ok: false, error: err.message };
  }
});
// === Creación de sesión activa ===
ipcMain.handle("db-insert-session", async (_event, data) => {
  try {
    const payload = await proxyFetch("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ok: true, session_id: payload.session_id };
  } catch (err) {
    console.error("[PROXY] Error insertando sesión:", err);
    return { ok: false, error: err.message };
  }
});
// === Inserción de inputs de análisis ===
ipcMain.handle("db-insert-inputs", async (event, { session_id, tipoAnalisis, datos }) => {
  try {
    await proxyFetch("/inputs", {
      method: "POST",
      body: JSON.stringify({ session_id, tipoAnalisis, datos }),
    });
    return { ok: true };
  } catch (err) {
    console.error("[PROXY] Error insertando inputs:", err);
    return { ok: false, error: err.message };
  }
});

// === Obtener inputs de la sesión ===
ipcMain.handle("db-get-inputs-by-session", async (event, { session_id, tipoAnalisis }) => {
  try {
    const query = new URLSearchParams();
    if (tipoAnalisis) query.set("tipo", tipoAnalisis);
    const payload = await proxyFetch(`/inputs/${session_id}${query.toString() ? `?${query}` : ''}`);
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error leyendo inputs por sesión:", err);
    return { ok: false, error: err.message };
  }
});
// === Limpiar inputs existentes de una sesión ===
ipcMain.handle("db-clear-inputs", async (event, { session_id, tipoAnalisis }) => {
  try {
    const query = new URLSearchParams();
    if (tipoAnalisis) query.set("tipo", tipoAnalisis);
    const payload = await proxyFetch(`/inputs/${session_id}${query.toString() ? `?${query}` : ''}`, {
      method: "DELETE",
    });
    return { ok: true, changes: payload.changes ?? 0 };
  } catch (err) {
    console.error("[PROXY] Error limpiando inputs:", err);
    return { ok: false, error: err.message };
  }
});
// === Cerrar sesión ===
ipcMain.handle("db-close-session", async (_event, session_id) => {
  try {
    await proxyFetch(`/sessions/${session_id}/close`, { method: "PATCH" });
    return { ok: true };
  } catch (err) {
    console.error("[PROXY] Error cerrando sesión:", err);
    return { ok: false, error: err.message };
  }
});

// === Eliminar sesión y sus inputs (rollback completo) ===
ipcMain.handle("db-delete-session-deep", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/sessions/${session_id}`, { method: "DELETE" });
    return { ok: true, deleted: payload.deleted || {} };
  } catch (err) {
    console.error("[PROXY] Error eliminando sesión profundamente:", err);
    return { ok: false, error: err.message };
  }
});


// === INFO DETALLADA DE SESIÓN ===
ipcMain.handle("db-get-session-info", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/sessions/${session_id}`);
    return { ok: true, data: payload.data };
  } catch (err) {
    console.error("[PROXY] Error al obtener sesión:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("db-get-sessions-by-role", async (_event, { rol, labDefault }) => {
  try {
    const params = new URLSearchParams();
    if (rol) params.set("rol", rol);
    if (labDefault) params.set("lab", labDefault);
    const query = params.toString();
    const payload = await proxyFetch(`/sessions${query ? `?${query}` : ""}`);
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error listando sesiones:", err);
    return { ok: false, error: err.message };
  }
});


// === Obtener evaluaciones disponibles según contexto ===
ipcMain.handle("db-get-evaluaciones", async (event, { lab_key, tipo_analisis, tipo_dato, modo_cualitativo }) => {
  try {
    const params = new URLSearchParams();
    if (lab_key) params.set("lab_key", lab_key);
    if (tipo_analisis) params.set("tipo_analisis", tipo_analisis);
    if (tipo_dato) params.set("tipo_dato", tipo_dato);
    if (modo_cualitativo) params.set("modo_cualitativo", modo_cualitativo);
    const query = params.toString();
    const payload = await proxyFetch(`/evaluaciones${query ? `?${query}` : ""}`);
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error obteniendo evaluaciones:", err);
    return { ok: false, error: err.message };
  }
});


// === Ejecutar evaluaciones seleccionadas (flujo HTTP remoto + guardado en results_general) ===
ipcMain.handle("db-run-evaluaciones", async (event, { session_id, catalog_ids }) => {
  try {
    console.log("[EVAL] Ejecutar evaluaciones:", { session_id, catalog_ids });
    const payload = await proxyFetch("/evaluaciones/run", {
      method: "POST",
      body: JSON.stringify({ session_id, catalog_ids }),
    });
    return { ok: true, count: payload.count || 0 };
  } catch (err) {
    console.error("[PROXY] Error ejecutando evaluaciones:", err);
    return { ok: false, error: err.message };
  }
});



// === Obtener pruebas con metadatos (usa la metadata calculada arriba) ===
ipcMain.handle("db-get-tests-with-metadata", async (event, session_id) => {
  try {
    const payload = await proxyFetch(`/sessions/${session_id}/tests-metadata`);
    return { ok: true, data: payload.data || [], meta: payload.meta };
  } catch (err) {
    console.error("[PROXY] Error en metadata unificada:", err);
    return { ok: false, error: err.message };
  }
});


