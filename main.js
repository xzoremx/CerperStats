// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
let mainWindow;
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
// === LOGIN DE USUARIO (bcryptjs) ===
const bcrypt = require("bcryptjs");
ipcMain.handle("db-login", async (event, { username, password }) => {
  try {
    const user = await db.get(`
      SELECT * FROM usuarios 
      WHERE username = ? 
      AND activo = 1 
      LIMIT 1;
    `, [username]);
    if (!user) {
      return { ok: false, error: "Usuario no encontrado o inactivo." };
    }
    // --- Si el usuario no tiene hash (primeros casos locales)
    if (!user.hash_password || user.hash_password.trim() === "") {
      return { ok: true, user };
    }
    // --- Verificar contraseña con bcrypt
    const isValid = await bcrypt.compare(password, user.hash_password);
    if (!isValid) {
      await db.run(`
        INSERT INTO logs_sistema (usuario_id, accion, detalle)
        VALUES ((SELECT id FROM usuarios WHERE username = ?), 'login_fallido', 'Contraseña incorrecta');
      `, [username]);
      return { ok: false, error: "Contraseña incorrecta." };
    }
    // --- Registrar login exitoso
    await db.run(`
      INSERT INTO logs_sistema (usuario_id, accion, detalle)
      VALUES (?, 'login_exitoso', 'Inicio de sesión correcto.');
    `, [user.id]);
    return { ok: true, user };
  } catch (err) {
    console.error("[DB] Error en login:", err);
    return { ok: false, error: err.message };
  }
});
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
// === Creación de sesión activa ===
ipcMain.handle("db-insert-session", async (event, data) => {
  try {
    const {
      lab_key,
      procedure,
      metodo,
      producto,
      ensayo,
      expediente,
      unidad,
      tipo_analisis,
      tipo_dato,
      modo_cualitativo,
      parametro,
      usuario
    } = data;
    const result = await db.run(`
      INSERT INTO sessions (
        lab_key, procedure, metodo, producto, ensayo, expediente, unidad,
        tipo_analisis, tipo_dato, modo_cualitativo, parametro, usuario_id,
        estado, creado_en, actualizado_en
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', datetime('now'), datetime('now'))
    `, [
      lab_key, procedure, metodo, producto, ensayo, expediente, unidad,
      tipo_analisis, tipo_dato, modo_cualitativo, parametro, usuario
    ]);
    return { ok: true, session_id: result.lastID };
  } catch (err) {
    console.error("[DB] Error insertando sesión:", err);
    return { ok: false, error: err.message };
  }
});
// === Inserción de inputs de análisis ===
ipcMain.handle("db-insert-inputs", async (event, { session_id, tipoAnalisis, datos }) => {
  try {
    const table =
      tipoAnalisis === "multi"
        ? "inputs_multianalito"
        : "inputs_monoanalito";
    // --- Generar placeholders dinámicos según cantidad de registros ---
    const placeholders = datos
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    // --- Mapear los valores exactamente según las columnas existentes ---
    const values = datos.flatMap(d => [
      session_id,         // 1
      d.analito,          // 2
      d.parametro,        // 3
      d.lectura_idx,      // 4
      d.valor,            // 5
      d.unidad,           // 6
      d.tipo_dato,        // 7
      d.modo_cualitativo, // 8
      1,                  // 9 (valido)
      d.comentario        // 10
    ]);
    // --- Ejecutar la inserción ---
    await db.run(
      `INSERT INTO ${table} (
        session_id, analito, parametro, lectura_idx, valor,
        unidad, tipo_dato, modo_cualitativo, valido, comentario
      )
      VALUES ${placeholders}`,
      values
    );
    return { ok: true };
  } catch (err) {
    console.error("[DB] Error insertando inputs:", err);
    return { ok: false, error: err.message };
  }
});
// === Obtener evaluaciones disponibles según contexto ===
ipcMain.handle("db-get-evaluaciones", async (event, { lab_key, tipo_analisis, tipo_dato, modo_cualitativo }) => {
  try {
    const rows = await db.all(`
      SELECT id, nombre_interno, titulo, categoria, descripcion
      FROM tests_catalog
      WHERE lab_key = ?
        AND tipo_analisis = ?
        AND tipo_dato = ?
        AND (modo_cualitativo IS NULL OR modo_cualitativo = ?)
        AND activo = 1
      ORDER BY id ASC;
    `, [lab_key, tipo_analisis, tipo_dato, modo_cualitativo || null]);
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[DB] Error obteniendo evaluaciones:", err);
    return { ok: false, error: err.message };
  }
});
ipcMain.handle("db-get-inputs-by-session", async (event, { session_id, tipoAnalisis }) => {
  try {
    let rows = [];
    if (tipoAnalisis === "multi" || tipoAnalisis === "multianalito") {
      rows = await db.all(`
        SELECT analito, parametro, lectura_idx, valor
        FROM inputs_multianalito
        WHERE session_id = ?
        AND valido = 1
        ORDER BY parametro ASC, analito ASC, lectura_idx ASC;
      `, [session_id]);
    } else {
      rows = await db.all(`
        SELECT parametro, lectura_idx, valor
        FROM inputs_monoanalito
        WHERE session_id = ?
        AND valido = 1
        ORDER BY parametro ASC, lectura_idx ASC;
      `, [session_id]);
    }
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[DB] Error leyendo inputs por sesión:", err);
    return { ok: false, error: err.message };
  }
});
// === Limpiar inputs existentes de una sesión ===
ipcMain.handle("db-clear-inputs", async (event, { session_id, tipoAnalisis }) => {
  try {
    const table =
      (tipoAnalisis === "multi" || tipoAnalisis === "multianalito")
        ? "inputs_multianalito"
        : "inputs_monoanalito";
    const res = await db.run(`DELETE FROM ${table} WHERE session_id = ?`, [session_id]);
    return { ok: true, changes: res?.changes ?? 0 };
  } catch (err) {
    console.error("[DB] Error limpiando inputs:", err);
    return { ok: false, error: err.message };
  }
});
// === Cerrar sesión ===
ipcMain.handle("db-close-session", async (event, session_id) => {
  try {
    await db.run(
      `UPDATE sessions 
       SET estado = 'cerrada', 
           actualizado_en = CURRENT_TIMESTAMP 
       WHERE id = ?;`,
      [session_id]
    );
    return { ok: true };
  } catch (err) {
    console.error("[DB] Error cerrando sesión:", err);
    return { ok: false, error: err.message };
  }
});
// === INFO DETALLADA DE SESIÓN ===
ipcMain.handle("db-get-session-info", async (event, session_id) => {
  try {
    const row = await db.get(`
      SELECT s.*, u.username AS usuario, l.nombre AS lab_nombre
      FROM sessions s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN labs l ON l.lab_key = s.lab_key
      WHERE s.id = ?;
    `, [session_id]);
    if (!row) return { ok: false, error: "Sesión no encontrada." };
    return { ok: true, data: row };
  } catch (err) {
    console.error("[DB] Error al obtener sesión:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("db-get-sessions-by-role", async (event, { rol, labDefault }) => {
  try {
    if (rol === 'analista') return { ok: true, data: [] };

    const rows = await db.all(`
      SELECT s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo, s.estado, s.creado_en,
             u.username AS usuario
      FROM sessions s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN labs l ON l.lab_key = s.lab_key
      WHERE (? IS NULL OR s.lab_key = ?)
      ORDER BY s.creado_en DESC;
    `, [labDefault || null, labDefault || null]);

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[DB] Error listando sesiones:", err);
    return { ok: false, error: err.message };
  }
});
