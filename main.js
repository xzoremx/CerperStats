// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

// === Lista blanca de rutas (todas las vistas autorizadas) ===
const ROUTES = new Set([
  // Menú principal y selección
  'menu.html',
  'procedure_select.html',

  // Flujo input_data
  'input_data/preinfo.html',
  'input_data/step_1_type.html',
  'input_data/step_2_parametro.html',
  'input_data/step_3_dato.html',
  'input_data/step_4_k.html',
  'input_data/step_5_sheet.html',

  // Evaluación y reporte
  'evaluation_select.html',
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
    },
  });

  mainWindow.loadFile('menu.html'); // Pantalla inicial
  // mainWindow.webContents.openDevTools(); // ← activar solo para depurar
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

// === IPC: guardar DataFrame temporal (mejorado) ===
ipcMain.handle('save-dataframe-temp', async (_event, labName, jsonStr) => {
  return new Promise((resolve) => {
    try {
      // ---  Validaciones iniciales ---
      if (!labName || typeof labName !== 'string') {
        return resolve({ ok: false, error: 'Laboratorio no especificado.' });
      }
      if (!jsonStr || jsonStr.trim() === '') {
        return resolve({ ok: false, error: 'JSON vacío o inválido.' });
      }

      // --- Localización del script Python ---
      const scriptPath = path.join(__dirname, 'modules', '_common', 'save_dataframe_temp.py');
      const exists = require('fs').existsSync(scriptPath);
      if (!exists) {
        return resolve({ ok: false, error: `No se encontró el script Python en: ${scriptPath}` });
      }

      // --- Determinar ejecutable de Python ---
      const localVenv = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
      const pythonExec = require('fs').existsSync(localVenv)
        ? localVenv
        : process.env.CERPER_PYTHON_PATH || 'python';

      console.log(`[CerperStats] Ejecutando Python: ${pythonExec}`);
      console.log(`[CerperStats] Script: ${scriptPath}`);
      console.log(`[CerperStats] Laboratorio: ${labName}`);

      // --- Lanzar proceso Python ---
      const py = spawn(pythonExec, [scriptPath, labName], { stdio: ['pipe', 'pipe', 'pipe'] });

      let stdoutData = '';
      let stderrData = '';

      py.stdout.on('data', (chunk) => {
        const msg = chunk.toString();
        stdoutData += msg;
        console.log('[PYTHON OUT]', msg.trim());
      });

      py.stderr.on('data', (chunk) => {
        const msg = chunk.toString();
        stderrData += msg;
        console.error('[PYTHON ERR]', msg.trim());
      });

      // --- Error de lanzamiento (cuando python no existe) ---
      py.on('error', (err) => {
        console.error('[CerperStats] Error al iniciar Python:', err);
        return resolve({
          ok: false,
          error: `No se pudo iniciar Python: ${err.message}`,
          hint: 'Verifica que Python esté instalado o define CERPER_PYTHON_PATH.',
        });
      });

      // --- Cierre del proceso ---
      py.on('close', (code) => {
        console.log(`[CerperStats] Proceso Python finalizó con código ${code}`);

        // Si no hubo salida estándar y sí errores
        if (!stdoutData && stderrData) {
          return resolve({
            ok: false,
            error: 'Python devolvió un error.',
            details: stderrData.trim(),
            exitCode: code,
          });
        }

        // Intentar parsear JSON
        try {
          const parsed = JSON.parse(stdoutData);
          resolve({
            ok: true,
            message: 'DataFrame temporal guardado correctamente.',
            ...parsed,
            exitCode: code,
          });
        } catch (err) {
          console.error('[CerperStats] Error parseando salida Python:', err);
          resolve({
            ok: false,
            error: 'No se pudo interpretar la respuesta de Python.',
            raw: stdoutData.trim(),
            stderr: stderrData.trim(),
            exitCode: code,
          });
        }
      });

      // --- Enviar el JSON a Python ---
      py.stdin.write(jsonStr);
      py.stdin.end();

      // Failsafe: si tarda demasiado, cortar (20 s)
      setTimeout(() => {
        try {
          py.kill();
          resolve({ ok: false, error: 'El proceso Python excedió el tiempo límite (20s).' });
        } catch (_) {}
      }, 20000);
    } catch (err) {
      console.error('[CerperStats] Error general en save-dataframe-temp:', err);
      resolve({ ok: false, error: err.message || String(err) });
    }
  });
});

