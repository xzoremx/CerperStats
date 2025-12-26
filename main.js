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
  'reports_browser.html',
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
app.on('before-quit', async () => { });
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

const DEFAULT_PROXY_RUN_URL = "http://localhost:4000/run-eval"; //fallback local 
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
const { spawn } = require('child_process');
const os = require('os');

/**
 * Generate PDF reports locally using Python subprocess
 * Body: { sessionId, config: { group_by, include_graphs, include_tables } }
 */
ipcMain.handle("generate-reports", async (_event, { sessionId, config }) => {
  try {
    console.log("[REPORTS] Starting report generation for session:", sessionId);

    // 1. Fetch results and graphs from server
    const [resultsRes, graphsRes, sessionRes] = await Promise.all([
      proxyFetch(`/evaluaciones/resultados/${sessionId}`),
      proxyFetch(`/evaluaciones/graficos/${sessionId}`),
      proxyFetch(`/sessions/${sessionId}`)
    ]);

    if (!resultsRes.data || resultsRes.data.length === 0) {
      return { ok: false, error: "no_results", message: "No hay resultados para generar reportes" };
    }

    // 2. Prepare input data for Python script
    const inputData = {
      session_id: sessionId,
      session_info: sessionRes.data || {},
      config: {
        group_by: config?.group_by || "unified",
        include_graphs: config?.include_graphs !== false,
        include_tables: config?.include_tables !== false
      },
      results: resultsRes.data || [],
      graphs: graphsRes.data || []
    };

    // 3. Create temporary files
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const inputJsonPath = path.join(tempDir, `cerper_report_input_${timestamp}.json`);
    const outputDir = path.join(tempDir, `cerper_reports_${timestamp}`);
    const logoPath = path.join(__dirname, 'assets', 'logos', 'cerper_logo.png');

    // Write input JSON
    fs.writeFileSync(inputJsonPath, JSON.stringify(inputData, null, 2), 'utf8');

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // 4. Execute report generator (prefer bundled .exe, fallback to Python script)
    const bundledExe = path.join(__dirname, 'modules', 'python', 'reports', 'dist', 'report_generator.exe');
    const pythonScript = path.join(__dirname, 'modules', 'python', 'reports', 'report_generator.py');

    // Determine which executable to use
    const useBundled = fs.existsSync(bundledExe);
    const executable = useBundled ? bundledExe : 'python';
    const args = useBundled
      ? [inputJsonPath, outputDir]
      : [pythonScript, inputJsonPath, outputDir];

    if (fs.existsSync(logoPath)) {
      args.push('--logo', logoPath);
    }

    console.log(`[REPORTS] Using ${useBundled ? 'bundled executable' : 'Python script'}`);

    const pythonResult = await new Promise((resolve, reject) => {
      const reportProcess = spawn(executable, args, {
        cwd: __dirname,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      reportProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      reportProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log("[REPORTS:Generator]", data.toString());
      });

      reportProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse output: ${stdout}`));
          }
        } else {
          reject(new Error(`Report generator failed with code ${code}: ${stderr}`));
        }
      });

      reportProcess.on('error', (err) => {
        reject(new Error(`Failed to start report generator: ${err.message}`));
      });
    });

    console.log("[REPORTS] Generated:", pythonResult.length, "PDFs");

    // 5. Upload each PDF to server
    const uploadedReports = [];
    const userId = currentUser?.id || null;

    for (const pdfInfo of pythonResult) {
      try {
        const pdfPath = pdfInfo.path;
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');

        // Determine tests included from results
        const testsIncluded = [...new Set(
          resultsRes.data
            .filter(r => {
              if (config.group_by === 'by_analito' && pdfInfo.analito) {
                return r.analito === pdfInfo.analito;
              }
              if (config.group_by === 'by_nivel' && pdfInfo.nivel) {
                return r.nivel === pdfInfo.nivel;
              }
              return true;
            })
            .map(r => r.catalog_id)
            .filter(Boolean)
        )];

        const uploadPayload = {
          session_id: sessionId,
          tipo_informe: config.group_by,
          version_informe: 'v1.0',
          plan_json: {
            ...config,
            analito: pdfInfo.analito,
            nivel: pdfInfo.nivel,
            generated_at: new Date().toISOString()
          },
          pdf_base64: pdfBase64,
          hash_documento: pdfInfo.hash,
          usuario_id: userId,
          tests_included: testsIncluded
        };

        const uploadResult = await proxyFetch('/reports', {
          method: 'POST',
          body: JSON.stringify(uploadPayload)
        });

        uploadedReports.push({
          report_id: uploadResult.report_id,
          filename: pdfInfo.filename,
          analito: pdfInfo.analito,
          nivel: pdfInfo.nivel,
          tests_count: pdfInfo.tests_count
        });

        // Clean up local PDF after upload
        try { fs.unlinkSync(pdfPath); } catch (_) { }
      } catch (uploadErr) {
        console.error("[REPORTS] Failed to upload PDF:", pdfInfo.filename, uploadErr);
      }
    }

    // 6. Cleanup temp files
    try {
      fs.unlinkSync(inputJsonPath);
      fs.rmdirSync(outputDir, { recursive: true });
    } catch (_) { }

    console.log("[REPORTS] Successfully uploaded:", uploadedReports.length, "reports");
    return { ok: true, reports: uploadedReports };
  } catch (err) {
    console.error("[REPORTS] Error generating reports:", err);
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
