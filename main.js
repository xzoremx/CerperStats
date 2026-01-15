// main.js
const { app, BrowserWindow, ipcMain, Menu, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { registerExternalUrlSecurity } = require('./js/security/external_url_security');
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
  'results_general.html',
  'reports.html',
  // Flujo input_data
  'input_data/input_data_info.html',
  'input_data/input_data_sheet.html',
  // Evaluación y reporte
  'evaluation_select.html',
  'evaluation_results.html',
  'pdf_config.html'
]);
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icons', 'app.ico');
const appIcon = nativeImage.createFromPath(APP_ICON_PATH);
const browserIcon = appIcon.isEmpty() ? APP_ICON_PATH : appIcon;
const APP_ROOT = path.resolve(__dirname);
const ALLOWED_LOCAL_FILES = new Set(
  Array.from(ROUTES).map(route => path.resolve(APP_ROOT, route))
);
// === CSS global para scrollbar glass y estilos modernos ===
const GLOBAL_STYLES = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, 'css', 'global.css'), 'utf8');
  } catch (err) {
    console.error('[GLOBAL_CSS] Error leyendo css/global.css:', err);
    return '';
  }
})();

// === JavaScript para funcionalidad de la barra de título ===
const APPLE_TITLEBAR_JS = `
  (function() {
    if (document.getElementById('apple-titlebar')) return;
    
    // Ajustar body si tiene min-height: 100vh
    const bodyStyle = window.getComputedStyle(document.body);
    if (bodyStyle.minHeight === '100vh' || bodyStyle.minHeight === '100%') {
      document.body.style.minHeight = 'calc(100vh - 40px)';
    }
    
    const titlebar = document.createElement('div');
    titlebar.id = 'apple-titlebar';
    titlebar.innerHTML = '<div id="apple-titlebar-buttons"><button class="apple-titlebar-button close" id="apple-btn-close" title="Cerrar">×</button><button class="apple-titlebar-button minimize" id="apple-btn-minimize" title="Minimizar">−</button><button class="apple-titlebar-button maximize" id="apple-btn-maximize" title="Maximizar">□</button></div><div id="apple-titlebar-title">CerperStats</div>';
    document.body.insertBefore(titlebar, document.body.firstChild);
    
    const closeBtn = document.getElementById('apple-btn-close');
    const minimizeBtn = document.getElementById('apple-btn-minimize');
    const maximizeBtn = document.getElementById('apple-btn-maximize');
    
    if (closeBtn && window.cerper) {
      closeBtn.addEventListener('click', () => {
        window.cerper.windowClose();
      });
    }
    
    if (minimizeBtn && window.cerper) {
      minimizeBtn.addEventListener('click', () => {
        window.cerper.windowMinimize();
      });
    }
    
    if (maximizeBtn && window.cerper) {
      maximizeBtn.addEventListener('click', () => {
        window.cerper.windowMaximize();
      });
      
      // Actualizar ícono cuando se maximiza/restaura
      setInterval(async () => {
        try {
          const isMaximized = await window.cerper.windowIsMaximized();
          maximizeBtn.textContent = isMaximized ? '❐' : '□';
        } catch (e) {}
      }, 500);
    }
    
    // Actualizar título de la ventana
    const titleElement = document.getElementById('apple-titlebar-title');
    if (titleElement) {
      const pageTitle = document.title || 'CerperStats';
      titleElement.textContent = pageTitle.replace(' - CerperStats', '').replace(' | CerperStats', '');
    }
  })();
`;

// === Crear ventana principal ===
function createWindow() {
  // === Optimizaciones de Chromium para mejor rendimiento ===
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    icon: browserIcon,
    frame: false,
    show: false,
    backgroundColor: '#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      hardwareAcceleration: true, // Activar aceleración de hardware
      enableBlinkFeatures: 'CSSBackdropFilter', // Para glass effects optimizados
    },
  });
  Menu.setApplicationMenu(null);

  // Mostrar ventana solo cuando esté lista (evita flash blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Inyectar estilos y barra de título cuando se carga cualquier página
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(GLOBAL_STYLES);
    mainWindow.webContents.executeJavaScript(APPLE_TITLEBAR_JS);
  });

  mainWindow.loadFile('login.html'); // Pantalla inicial

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isCmdOrCtrl = input.control || input.meta;
    if (!isCmdOrCtrl) return;
    const key = String(input.key || '').toLowerCase();

    if (key === 'r') {
      event.preventDefault();
      if (input.shift) mainWindow.webContents.reloadIgnoringCache();
      else mainWindow.webContents.reload();
    } else if (key === 'i' && input.shift) {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  // === Sistema de seguridad de URLs externas ===
  registerExternalUrlSecurity(mainWindow.webContents, {
    appRoot: APP_ROOT,
    allowedLocalFiles: ALLOWED_LOCAL_FILES,
  });
}

// === Inicialización de la app ===
app.whenReady().then(() => {
  app.setAppUserModelId('com.cerper.cerperstats');
  if (process.platform === 'win32') {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '',
        iconPath: APP_ICON_PATH,
        iconIndex: 0,
        title: 'Abrir CerperStats',
        description: 'Abrir CerperStats',
      },
    ]);
  }
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
let quitting = false;
app.on('before-quit', async (event) => {
  if (quitting) return;
  quitting = true;

  // Try to cancel incomplete sessions (no PDFs saved) so they are not resumable.
  // Don't block app exit for too long if the server is unreachable.
  event.preventDefault();
  try {
    const userId = Number(currentUser?.id);
    if (userId) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      try {
        await proxyFetch('/sessions/cancel-incomplete', {
          method: 'POST',
          body: JSON.stringify({ usuario_id: userId }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (err) {
    console.warn('[SESSIONS] No se pudo cancelar sesiones incompletas al salir:', err?.message || err);
  } finally {
    app.quit();
  }
});
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
// In dev: use dotenv; in packaged: use embedded config (generated at build time)
let CERPER_PROXY_URL, CERPER_EVAL_URL, CERPER_PROXY_TOKEN;

if (app.isPackaged) {
  // Use embedded config (config/embedded-env.js is bundled into the asar)
  try {
    const embeddedConfig = require('./config/embedded-env.js');
    CERPER_PROXY_URL = embeddedConfig.CERPER_PROXY_URL;
    CERPER_EVAL_URL = embeddedConfig.CERPER_EVAL_URL;
    CERPER_PROXY_TOKEN = embeddedConfig.CERPER_PROXY_TOKEN;
    console.log('[CONFIG] Loaded embedded config');
  } catch (e) {
    console.error('[CONFIG] Failed to load embedded config:', e.message);
  }
} else {
  // Development: use dotenv from project root
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  CERPER_PROXY_URL = process.env.CERPER_PROXY_URL;
  CERPER_EVAL_URL = process.env.CERPER_EVAL_URL;
  CERPER_PROXY_TOKEN = process.env.CERPER_PROXY_TOKEN;
}

const DEFAULT_PROXY_RUN_URL = "http://localhost:4000/run-eval"; // fallback local
const PROXY_RUN_URL = CERPER_PROXY_URL || CERPER_EVAL_URL || DEFAULT_PROXY_RUN_URL;
const PROXY_TOKEN = CERPER_PROXY_TOKEN || "";
const PROXY_BASE_URL = PROXY_RUN_URL.replace(/\/run-eval\/?$/, "") || PROXY_RUN_URL;

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

    // Detectar token expirado o inválido (401 Unauthorized)
    if (response.status === 401) {
      console.warn('[AUTH] Token inválido o expirado - notificando al renderer');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:session-expired', {
          reason: 'token_expired',
          message: 'La sesión ha expirado. Por favor, inicie sesión nuevamente.'
        });
      }
    }

    throw err;
  }
  return response.json();
}

// === Verificar validez del token del proxy ===
ipcMain.handle("auth-verify-token", async () => {
  try {
    // Intenta hacer una llamada simple al proxy para verificar el token
    await proxyFetch("/auth/verify", { method: "GET" });
    return { ok: true, valid: true };
  } catch (err) {
    if (err.status === 401) {
      return { ok: true, valid: false, reason: 'token_expired' };
    }
    // Otros errores (red, servidor caído, etc.)
    return { ok: false, error: err.message };
  }
});

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

// === Limpiar resultados de una sesión (usado cuando se actualizan inputs) ===
ipcMain.handle("db-clear-results", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/results/${session_id}`, {
      method: "DELETE",
    });
    console.log(`[PROXY] Resultados eliminados para sesión ${session_id}: ${payload.deleted ?? 0}`);
    return { ok: true, deleted: payload.deleted ?? 0 };
  } catch (err) {
    console.error("[PROXY] Error limpiando resultados:", err);
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

// === Actualizar estado de sesión ===
ipcMain.handle("db-update-session-status", async (_event, { session_id, estado }) => {
  const id = Number(session_id);
  const next = String(estado || "").trim();
  if (!id || !next) return { ok: false, error: "invalid_payload" };

  try {
    await proxyFetch(`/sessions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ estado: next }),
    });
    return { ok: true };
  } catch (err) {
    console.error("[PROXY] Error actualizando estado de sesión:", err);
    return { ok: false, error: err.message };
  }
});

// === Cancelar sesiones incompletas (sin PDFs) ===
ipcMain.handle("db-cancel-incomplete-sessions", async (_event, { usuario_id }) => {
  const userId = Number(usuario_id);
  if (!userId) return { ok: false, error: "invalid_payload" };

  try {
    const payload = await proxyFetch(`/sessions/cancel-incomplete`, {
      method: "POST",
      body: JSON.stringify({ usuario_id: userId }),
    });
    return { ok: true, canceled: payload.canceled ?? 0 };
  } catch (err) {
    console.error("[PROXY] Error cancelando sesiones incompletas:", err);
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

// === Estado de resultados (validación ligera para Continuar) ===
ipcMain.handle("db-get-session-results-status", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/sessions/${session_id}/results-status`);
    return { ok: true, ...payload };
  } catch (err) {
    console.error("[PROXY] Error al verificar estado de resultados:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("db-get-sessions-by-role", async (_event, { rol, labDefault }) => {
  try {
    const params = new URLSearchParams();
    if (rol) params.set("rol", rol);
    if (Array.isArray(labDefault)) {
      labDefault
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .forEach((lab) => params.append("lab", lab));
    } else if (labDefault) {
      params.set("lab", String(labDefault).trim());
    }
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

// === Progreso de evaluaciones (polling desde renderer) ===
ipcMain.handle("db-get-evaluaciones-progress", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/evaluaciones/progress/${session_id}`);
    return { ok: true, data: payload.data };
  } catch (err) {
    const status = err?.status;
    if (status === 404) {
      return { ok: false, error: "progress_not_found", status };
    }
    console.error("[PROXY] Error obteniendo progreso:", err);
    return { ok: false, error: err.message, status: status || 500 };
  }
});

// === Gráficos de la última corrida de evaluaciones ===
ipcMain.handle("db-get-evaluaciones-graficos", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/evaluaciones/graficos/${session_id}`);
    return { ok: true, data: payload.data || [], meta: payload.meta };
  } catch (err) {
    const status = err?.status;
    console.error("[PROXY] Error obteniendo gráficos:", err);
    return { ok: false, error: err.message, status: status || 500 };
  }
});

// === Resultados preliminares (dataframes) ===
ipcMain.handle("db-get-resultados-preliminares", async (_event, session_id) => {
  try {
    const payload = await proxyFetch(`/evaluaciones/resultados/${session_id}`);
    return { ok: true, data: payload.data || [], meta: payload.meta };
  } catch (err) {
    const status = err?.status;
    console.error("[PROXY] Error obteniendo resultados preliminares:", err);
    return { ok: false, error: err.message, status: status || 500 };
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

// === Configuración dinámica de formateo (dataframes) ===
ipcMain.handle("db-get-tests-formatting-config", async () => {
  try {
    const payload = await proxyFetch("/tests/formatting-config");
    return { ok: true, data: payload.data || { value_mappings: {}, column_labels: {} } };
  } catch (err) {
    console.error("[PROXY] Error obteniendo formatting config:", err);
    return { ok: false, error: err.message };
  }
});

// === Control de ventana estilo Apple ===
ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
  return { ok: true };
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return { ok: true };
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
  return { ok: true };
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// === PDF Report Generation ===
const os = require('os');
const { PDFDocument } = require('pdf-lib');
const { generatePDF } = require('./modules/reports/pdf_generator');
const { ReportDataProvider } = require('./modules/reports/report_data_provider');

/**
 * Generate PDF reports:
 * 1. Fetch data from backend (via proxy server)
 * 2. Transform data with JavaScript (no Python needed)
 * 3. Render PDF with Puppeteer locally
 */
ipcMain.handle("generate-reports", async (_event, { sessionId, config }) => {
  try {
    console.log("[REPORTS] Starting report generation for session:", sessionId);

    // 1. Fetch results, graphs, session info, and formatting config from server
    const [resultsRes, graphsRes, sessionRes, formattingRes] = await Promise.all([
      proxyFetch(`/evaluaciones/resultados/${sessionId}`),
      proxyFetch(`/evaluaciones/graficos/${sessionId}`),
      proxyFetch(`/sessions/${sessionId}`),
      proxyFetch(`/tests/formatting-config`)
    ]);

    if (!resultsRes.data || resultsRes.data.length === 0) {
      return { ok: false, error: "no_results", message: "No hay resultados para generar reportes" };
    }

    // 2. Setup paths
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const outputDir = path.join(tempDir, `cerper_reports_${timestamp}`);
    // Logo is in modules/reports/assets/logo_informe.png
    // In packaged app: use extraResources path; in dev: use __dirname
    const isPackaged = app.isPackaged;
    const logoPath = isPackaged
      ? path.join(process.resourcesPath, 'modules', 'reports', 'assets', 'logo_informe.png')
      : path.join(__dirname, 'modules', 'reports', 'assets', 'logo_informe.png');

    fs.mkdirSync(outputDir, { recursive: true });

    // 3. Use JavaScript Data Provider
    const formattingConfig = formattingRes?.data || { value_mappings: {}, column_labels: {} };
    const dataProvider = new ReportDataProvider(
      {
        session_id: sessionId,
        session_info: sessionRes.data || {},
        results: resultsRes.data || [],
        graphs: graphsRes.data || []
      },
      {
        group_by: config?.group_by || 'unified',
        include_graphs: config?.include_graphs !== false,
        include_tables: config?.include_tables !== false,
        execution_date: config?.execution_date || null,
        // Preserve null if not 'analista', otherwise use array (empty or with names)
        analyst_names: config?.analyst_names ?? [],
        logo_path: logoPath,
        // Formatting config from tests_catalog
        value_mappings: formattingConfig.value_mappings || {},
        column_labels: formattingConfig.column_labels || {}
      }
    );

    const reportsData = dataProvider.getReportData();
    console.log("[REPORTS] JS Data Provider prepared", reportsData.length, "reports. Rendering PDFs...");

    // 5. Render PDFs with Puppeteer
    const generatedReports = [];

    for (const reportItem of reportsData) {
      try {
        const { filename, data, _metadata } = reportItem;
        const pdfPath = path.join(outputDir, filename);

        // --- PUPPETEER GENERATION ---
        // Split into cover page (without header, with footer) and content (with header and footer)
        const coverData = { cover: data.cover, logo_path: data.logo_path };
        const contentData = {
          sections: data.sections,
          logo_path: data.logo_path,
          tipo_analisis: data.tipo_analisis || null,
          dynamic_css: data.dynamic_css || ''
        };

        // Generate cover page PDF (without header/footer)
        const coverPath = path.join(outputDir, `cover_${filename}`);
        await generatePDF(coverData, coverPath, {
          includeHeaderFooter: false,
          templateType: 'cover'
        });

        // Get cover page count to offset content page numbers
        const coverPdfTemp = await PDFDocument.load(fs.readFileSync(coverPath));
        const coverPageCount = coverPdfTemp.getPageCount();

        // Generate content PDF (with header and footer)
        const contentPath = path.join(outputDir, `content_${filename}`);
        await generatePDF(contentData, contentPath, {
          includeHeaderFooter: true,
          templateType: 'content'
        });

        // Combine both PDFs
        const coverBuffer = fs.readFileSync(coverPath);
        const contentBuffer = fs.readFileSync(contentPath);

        const mergedPdf = await PDFDocument.create();
        const coverPdf = await PDFDocument.load(coverBuffer);
        const contentPdf = await PDFDocument.load(contentBuffer);

        // Copy all pages from cover PDF
        const coverPageIndices = Array.from({ length: coverPageCount }, (_, i) => i);
        const coverPages = await mergedPdf.copyPages(coverPdf, coverPageIndices);
        coverPages.forEach(page => mergedPdf.addPage(page));

        // Copy all pages from content PDF
        const contentPageCount = contentPdf.getPageCount();
        const contentPageIndices = Array.from({ length: contentPageCount }, (_, i) => i);
        const contentPages = await mergedPdf.copyPages(contentPdf, contentPageIndices);
        contentPages.forEach(page => mergedPdf.addPage(page));

        // Note: Both PDFs have footers with "Página X | CerperStats"
        // Cover PDF: "Página 1"
        // Content PDF: "Página 1", "Página 2", "Página 3", etc.
        // When combined, the sequence will be: Cover (Página 1), Content (Página 1, 2, 3...)
        // This creates a visual sequence of 1, 1, 2, 3... which is not ideal
        // However, updating the footer text after PDF generation is complex with pdf-lib
        // The footer text is rendered as static text by Puppeteer and can't be easily modified

        const mergedPdfBytes = await mergedPdf.save();
        fs.writeFileSync(pdfPath, mergedPdfBytes);

        // Clean up temporary PDFs
        try { fs.unlinkSync(coverPath); } catch (_) { }
        try { fs.unlinkSync(contentPath); } catch (_) { }
        // ----------------------------

        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfSizeBytes = pdfBuffer.length;

        // Simplified tests included logic
        const testsIncluded = [...new Set(
          resultsRes.data.map(r => r.catalog_id).filter(Boolean)
        )];

        // Extract analito and nivel from metadata (set by ReportDataProvider)
        const analito = _metadata?.analito || null;
        const nivel = _metadata?.nivel != null ? _metadata.nivel : null;

        generatedReports.push({
          temp_id: `temp_${Date.now()}_${generatedReports.length}`,
          filename: filename,
          analito: analito,
          nivel: nivel,
          tests_count: data.sections ? data.sections.reduce((acc, s) => acc + s.tests.length, 0) : 0,
          hash: require('crypto').createHash('sha256').update(pdfBuffer).digest('hex'),
          pdf_base64: pdfBase64,
          pdf_size_bytes: pdfSizeBytes,
          tipo_informe: config.group_by,
          plan_json: {
            ...config,
            analito: analito,
            nivel: nivel,
            generated_at: new Date().toISOString()
          },
          tests_included: testsIncluded,
          saved: false
        });

        // Clean up local PDF file
        try { fs.unlinkSync(pdfPath); } catch (_) { }
      } catch (renderErr) {
        console.error("[REPORTS] Failed to render PDF:", reportItem.filename, renderErr);
      }
    }

    // 4. Cleanup temp directory
    try {
      fs.rmdirSync(outputDir, { recursive: true });
    } catch (_) { }

    console.log("[REPORTS] Successfully generated:", generatedReports.length, "reports");
    return { ok: true, reports: generatedReports };
  } catch (err) {
    console.error("[REPORTS] Error generating reports:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Save a single report to database (explicit user action)
 * Body: { sessionId, report: { pdf_base64, tipo_informe, plan_json, hash, tests_included } }
 */
ipcMain.handle("save-report-to-db", async (_event, { sessionId, report }) => {
  try {
    console.log("[REPORTS] Saving report to DB for session:", sessionId);

    const uploadPayload = {
      session_id: sessionId,
      tipo_informe: report.tipo_informe || 'unified',
      version_informe: 'v1.0',
      plan_json: report.plan_json || {},
      pdf_base64: report.pdf_base64,
      hash_documento: report.hash || '',
      usuario_id: currentUser?.id || null,
      tests_included: report.tests_included || [],
      observaciones: report.observaciones || null,
      estado: report.estado || 'generado'
    };

    const uploadResult = await proxyFetch('/reports', {
      method: 'POST',
      body: JSON.stringify(uploadPayload)
    });

    console.log("[REPORTS] Saved to DB with ID:", uploadResult.report_id);
    return {
      ok: true,
      report_id: uploadResult.report_id,
      message: "Reporte guardado exitosamente"
    };
  } catch (err) {
    console.error("[REPORTS] Error saving to DB:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Get list of reports for a session
 */
ipcMain.handle("get-session-reports", async (_event, sessionId) => {
  try {
    const payload = await proxyFetch(`/reports/session/${sessionId}`);
    return { ok: true, data: payload.data || [] };
  } catch (err) {
    console.error("[PROXY] Error listing reports:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Download a report PDF (returns base64)
 */
ipcMain.handle("download-report-pdf", async (_event, reportId) => {
  try {
    const url = new URL(`/reports/${reportId}/pdf`, PROXY_BASE_URL);
    const response = await fetch(url, {
      headers: buildProxyHeaders()
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { ok: true, pdf_base64: base64, report_id: reportId };
  } catch (err) {
    console.error("[PROXY] Error downloading report:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Delete a report
 */
ipcMain.handle("delete-report", async (_event, reportId) => {
  try {
    await proxyFetch(`/reports/${reportId}`, { method: 'DELETE' });
    return { ok: true };
  } catch (err) {
    console.error("[PROXY] Error deleting report:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Mark multiple reports as urgent/important (set estado to 'a_revisar')
 */
ipcMain.handle("mark-reports-as-urgent", async (_event, reportIds) => {
  try {
    const result = await proxyFetch('/reports/bulk/urgent', {
      method: 'PATCH',
      body: JSON.stringify({
        report_ids: reportIds
      })
    });
    return { ok: true, updated: result.updated || reportIds.length };
  } catch (err) {
    console.error("[PROXY] Error marking reports as urgent:", err);
    return { ok: false, error: err.message };
  }
});

/**
 * Update a report status (e.g. aprobado / rechazado / archivado)
 */
ipcMain.handle("update-report-status", async (_event, { reportId, estado }) => {
  const id = Number(reportId);
  const status = String(estado || "").trim();
  if (!id || !status) return { ok: false, error: "invalid_payload" };

  try {
    await proxyFetch(`/reports/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ estado: status }),
    });
    return { ok: true };
  } catch (err) {
    console.error("[PROXY] Error updating report status:", err);
    return { ok: false, error: err.message };
  }
});
