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


// === Capa de base de datos ===
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");


// Conexión global
let db;
async function initDB() {
  db = await open({
    filename: "./database/cerperstats.db",
    driver: sqlite3.Database
  });
  console.log("[DB] Conectado a cerperstats.db");
}
initDB();

// === Lectura de laboratorios para el menú principal ===
ipcMain.handle("db-get-labs", async () => {
  try {
    const rows = await db.all(`
      SELECT lab_key AS key, nombre AS name, descripcion AS role, color
      FROM labs
      WHERE activo = 1
      ORDER BY id ASC;
    `);
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[DB] Error leyendo laboratorios:", err);
    return { ok: false, error: err.message };
  }
});

// === Lectura completa de un laboratorio por clave ===
ipcMain.handle("db-get-lab-by-key", async (event, labKey) => {
  try {
    const row = await db.get(`
      SELECT
        id,
        lab_key,
        nombre,
        descripcion,
        metodo_default,
        producto_default,
        ensayo_default,
        unidad_default,
        expediente_demo,
        color,
        activo
      FROM labs
      WHERE lab_key = ?
      LIMIT 1;
    `, [labKey]);

    if (row) {
      return { ok: true, data: row };
    } else {
      return { ok: false, error: `No se encontró laboratorio con key: ${labKey}` };
    }
  } catch (err) {
    console.error("[DB] Error obteniendo laboratorio por clave:", err);
    return { ok: false, error: err.message };
  }
});


// === Lectura de módulos / configuraciones por laboratorio ===
ipcMain.handle("db-get-lab-modes", async (_e, labKey) => {
  try {
    const rows = await db.all(`
      SELECT tipo_dato, modo_cualitativo, valores_permitidos
      FROM lab_data_modes
      WHERE lab_key = ? AND activo = 1
      ORDER BY id ASC;
    `, [labKey]);
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});




// === Inserción de inputs de análisis ===
ipcMain.handle("db-insert-inputs", async (event, { session_id, tipoAnalisis, datos }) => {
  try {
    const table = tipoAnalisis === "multi" ? "inputs_multianalito" : "inputs_monoanalito";
    const placeholders = datos.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = datos.flatMap(d => [
      session_id, d.analito, d.parametro, d.lectura_idx, d.valor,
      d.unidad || null, d.tipo_dato || "cuantitativo", 1, d.comentario || null
    ]);
    await db.run(
      `INSERT INTO ${table} (session_id, analito, parametro, lectura_idx, valor, unidad, tipo_dato, valido, comentario)
       VALUES ${placeholders}`, values
    );
    return { ok: true };
  } catch (err) {
    console.error("[DB] Error insertando inputs:", err);
    return { ok: false, error: err.message };
  }
});



