// main.js
const { app, BrowserWindow, ipcMain, Menu, nativeImage, shell } = require('electron');
const { fileURLToPath } = require('url');
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
  'input_data/input_data_info.html',
  'input_data/input_data_sheet.html',
  // Evaluación y reporte
  'evaluation_select.html',
  'pdf_config.html',
  'postinfo.html',
  // Otros
  'index.html'
]);
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icons', 'app.ico');
const appIcon = nativeImage.createFromPath(APP_ICON_PATH);
const browserIcon = appIcon.isEmpty() ? APP_ICON_PATH : appIcon;
const APP_ROOT = path.resolve(__dirname);
const ALLOWED_LOCAL_FILES = new Set(
  Array.from(ROUTES).map(route => path.resolve(APP_ROOT, route))
);

// === Sistema de seguridad de URLs externas ===
/**
 * Gestor centralizado de seguridad para URLs externas
 * Implementa: whitelist de dominios, validación estricta de protocolos,
 * sanitización y logging estructurado
 */
class ExternalUrlSecurityManager {
  constructor() {
    // Whitelist de dominios permitidos (solo estos dominios pueden abrirse)
    this.allowedDomains = new Set([
      'api.whatsapp.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'unpkg.com', // Para Lucide icons CDN
    ]);

    // Protocolos permitidos (solo estos)
    this.allowedProtocols = new Set(['https:', 'http:', 'mailto:']);

    // Protocolos peligrosos explí­citamente bloqueados
    this.dangerousProtocols = new Set([
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'chrome-extension:',
      'chrome:',
      'edge:',
      'about:',
      'feed:',
    ]);

    // Caracteres peligrosos que indican intento de inyección
    this.dangerousChars = /[<>`]/;
    
    // Regex para validar formato de email básico
    this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }

  /**
   * Normaliza y extrae el dominio de una URL
   * @param {URL} parsedUrl - URL parseada
   * @returns {string|null} - Dominio normalizado o null
   */
  extractDomain(parsedUrl) {
    const hostname = parsedUrl.hostname;
    if (!hostname) return null;
    
    // Normalizar: remover www. y convertir a minúsculas
    return hostname.replace(/^www\./, '').toLowerCase();
  }

  /**
   * Valida una URL mailto
   * @param {URL} parsedUrl - URL parseada
   * @returns {boolean} - true si es válida
   */
  validateMailto(parsedUrl) {
    const email = parsedUrl.pathname || parsedUrl.toString().replace(/^mailto:/i, '');
    if (!email || !email.includes('@')) {
      return false;
    }
    // Validar formato básico de email
    return this.emailRegex.test(email.split('?')[0].split('&')[0]);
  }

  /**
   * Valida si una URL está en la whitelist de dominios
   * @param {URL} parsedUrl - URL parseada
   * @returns {boolean} - true si está permitida
   */
  isDomainAllowed(parsedUrl) {
    const domain = this.extractDomain(parsedUrl);
    if (!domain) return false;
    return this.allowedDomains.has(domain);
  }

  /**
   * Valida si una URL es segura para abrir externamente
   * @param {string} url - URL a validar
   * @returns {{safe: boolean, reason?: string}} - Resultado de la validación
   */
  validateUrl(url) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:120',message:'validateUrl called',data:{url:url?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Validación básica de tipo y formato
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:123',message:'validateUrl: invalid URL',data:{reason:'URL vacía o inválida'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { safe: false, reason: 'URL vacía o inválida' };
    }

    // Detectar caracteres peligrosos antes de parsear
    if (this.dangerousChars.test(url)) {
      return { safe: false, reason: 'Caracteres peligrosos detectados' };
    }

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol.toLowerCase();

      // Bloquear protocolos peligrosos
      if (this.dangerousProtocols.has(protocol)) {
        return { safe: false, reason: `Protocolo peligroso bloqueado: ${protocol}` };
      }

      // Solo permitir protocolos especí­ficos
      if (!this.allowedProtocols.has(protocol)) {
        return { safe: false, reason: `Protocolo no permitido: ${protocol}` };
      }

      // Validación especí­fica por protocolo
      if (protocol === 'mailto:') {
        if (!this.validateMailto(parsedUrl)) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:147',message:'validateUrl: mailto invalid format',data:{url:url?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          return { safe: false, reason: 'Formato de email inválido' };
        }
        // mailto está permitido si pasa la validación de formato
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:151',message:'validateUrl: mailto valid',data:{url:url?.substring(0,100),result:'safe:true,domain:undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return { safe: true };
      }

      // Para http/https, validar dominio contra whitelist
      if (protocol === 'http:' || protocol === 'https:') {
        const domain = this.extractDomain(parsedUrl);
        if (!this.isDomainAllowed(parsedUrl)) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:157',message:'validateUrl: domain not allowed',data:{domain,url:url?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          return { 
            safe: false, 
            reason: `Dominio no permitido: ${domain || 'desconocido'}` 
          };
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:163',message:'validateUrl: http/https valid',data:{domain,url:url?.substring(0,100),result:'safe:true,domain:'+domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return { safe: true, domain };
      }

      return { safe: false, reason: 'Validación no implementada para este protocolo' };
    } catch (err) {
      // Si no se puede parsear, no es segura
      return { safe: false, reason: `Error parseando URL: ${err.message}` };
    }
  }

  /**
   * Registra intento de acceso bloqueado (para auditorí­a)
   * @param {string} url - URL bloqueada
   * @param {string} reason - Razón del bloqueo
   */
  logBlockedAttempt(url, reason) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [CerperStats:URLSecurity] BLOQUEO:`, {
      url: url.substring(0, 100), // Limitar longitud en logs
      reason,
      type: 'external_url_attempt'
    });
  }

  /**
   * Registra acceso permitido (para auditorí­a)
   * @param {string} url - URL permitida
   * @param {string|null} domain - Dominio extraído (opcional, solo para http/https)
   */
  logAllowedAccess(url, domain) {
    const timestamp = new Date().toISOString();
    let domainInfo = domain;
    
    // Si no se proporciona dominio, intentar extraerlo (solo para http/https)
    if (!domainInfo && url && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        domainInfo = this.extractDomain(new URL(url));
      } catch (e) {
        domainInfo = 'unknown';
      }
    } else if (!domainInfo) {
      // Para mailto y otros protocolos sin dominio
      domainInfo = 'N/A';
    }
    
    console.log(`[${timestamp}] [CerperStats:URLSecurity] PERMITIDO:`, {
      domain: domainInfo,
      type: 'external_url_access'
    });
  }
}

// Instancia global del gestor de seguridad
const urlSecurityManager = new ExternalUrlSecurityManager();

/**
 * Función de validación pública (mantiene compatibilidad)
 * @param {string} url - URL a validar
 * @returns {boolean} - true si es segura
 */
function isSafeExternalUrl(url) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:211',message:'isSafeExternalUrl called',data:{url:url?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const result = urlSecurityManager.validateUrl(url);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:213',message:'isSafeExternalUrl result',data:{safe:result.safe,reason:result.reason,domain:result.domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (!result.safe) {
    urlSecurityManager.logBlockedAttempt(url, result.reason);
    return false;
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/70d7887b-1d0b-4aa4-922f-b796d4488d19',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:218',message:'calling logAllowedAccess',data:{url:url?.substring(0,100),domain:result.domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  urlSecurityManager.logAllowedAccess(url, result.domain);
  return true;
}

function openExternalIfSafe(url, event) {
  if (event) event.preventDefault();
  if (!isSafeExternalUrl(url)) return;

  shell.openExternal(url).catch(err => {
    console.error('[CerperStats] Error abriendo URL externa:', url, err);
  });
}

function isAllowedLocalFileNavigation(navigationUrl) {
  try {
    const filePath = fileURLToPath(navigationUrl);
    const normalizedPath = path.normalize(filePath);
    const insideApp =
      normalizedPath === APP_ROOT || normalizedPath.startsWith(APP_ROOT + path.sep);
    if (!insideApp) return false;
    return ALLOWED_LOCAL_FILES.has(normalizedPath);
  } catch {
    return false;
  }
}
// === Crear ventana principal ===
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    icon: browserIcon,
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
  Menu.setApplicationMenu(null);
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

  // Interceptar enlaces externos y abrirlos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  // Interceptar navegación a URLs externas (cuando se hace clic en un enlace)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const protocol = parsedUrl.protocol.toLowerCase();
      
      if (protocol === 'file:') {
        if (!isAllowedLocalFileNavigation(navigationUrl)) {
          event.preventDefault();
          console.warn('[CerperStats] Navegacion file:// bloqueada:', navigationUrl);
        }
        return;
      }

      // Solo interceptar URLs externas (http, https, mailto)
      if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
        openExternalIfSafe(navigationUrl, event);
        return;
      }
      // Bloquear cualquier otro protocolo
      event.preventDefault();
      console.warn('[CerperStats] Protocolo de navegacion no permitido:', protocol);
    } catch (err) {
      // Si no se puede parsear la URL, prevenir navegación por seguridad
      event.preventDefault();
      console.warn('[CerperStats] Error parseando URL, navegación bloqueada:', navigationUrl, err.message);
    }
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

