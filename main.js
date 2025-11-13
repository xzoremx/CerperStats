// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
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

// Cierre limpio de conexiones
app.on('before-quit', async () => {
  try { await pool?.end(); } catch (_) {}
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


// === Capa de base de datos (PostgreSQL) ===
require('dotenv').config();
const { Pool } = require('pg');

let pool;
let db;
async function initDB() {
  const cfg = {};
  const url = (process.env.DATABASE_URL || '').trim();
  if (url) {
    cfg.connectionString = url;
  } else {
    if (process.env.PGHOST) cfg.host = process.env.PGHOST;
    if (process.env.PGPORT) cfg.port = Number(process.env.PGPORT);
    if (process.env.PGUSER) cfg.user = process.env.PGUSER;
    if (process.env.PGPASSWORD) cfg.password = process.env.PGPASSWORD;
    if (process.env.PGDATABASE) cfg.database = process.env.PGDATABASE;
  }
  if (process.env.PGSSLMODE === 'require') cfg.ssl = { rejectUnauthorized: false };
  cfg.application_name = 'cerperstats';

  pool = new Pool(cfg);
  // Ping inicial para detectar errores de credenciales y confirmar destino
  try {
    const r = await pool.query("SELECT current_user, current_database() AS db, inet_server_addr()::text AS host, inet_server_port() AS port");
    const row = r.rows && r.rows[0];
    console.log(`[DB] Conectado a PostgreSQL host=${row?.host || 'local'} port=${row?.port || ''} db=${row?.db} user=${row?.current_user}`);
  } catch (err) {
    console.error('[DB] Error conectando a PostgreSQL:', err.message);
    throw err;
  }

  db = {
    async get(text, params = []) {
      const { rows } = await pool.query(text, params);
      return rows[0] || null;
    },
    async all(text, params = []) {
      const { rows } = await pool.query(text, params);
      return rows;
    },
    async run(text, params = []) {
      const res = await pool.query(text, params);
      return {
        changes: typeof res.rowCount === 'number' ? res.rowCount : 0,
        lastID: res.rows && res.rows[0] ? (res.rows[0].id ?? res.rows[0].lastid ?? null) : null,
      };
    }
  };
}
initDB();

// === LOGIN DE USUARIO (bcryptjs) ===
const bcrypt = require("bcryptjs");
ipcMain.handle("db-login", async (event, { username, password }) => {
  try {
    const user = await db.get(`
      SELECT * FROM usuarios 
      WHERE username = $1 
      AND activo = true 
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
        VALUES ((SELECT id FROM usuarios WHERE username = $1), 'login_fallido', 'Contraseña incorrecta');
      `, [username]);
      return { ok: false, error: "Contraseña incorrecta." };
    }
    // --- Registrar login exitoso
    await db.run(`
      INSERT INTO logs_sistema (usuario_id, accion, detalle)
      VALUES ($1, 'login_exitoso', 'Inicio de sesión correcto.');
    `, [user.id]);
    // Guardar usuario autenticado en memoria (mínimo necesario)
    currentUser = {
      id: user.id,
      username: user.username,
      rol: user.rol,
      default_lab: user.default_lab,
      nombre_completo: user.nombre_completo || null,
    };
    return { ok: true, user: currentUser };
  } catch (err) {
    console.error("[DB] Error en login:", err);
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
    const rows = await db.all(`
      SELECT lab_key AS key, nombre AS name, descripcion AS role, color
      FROM labs
      WHERE activo = true
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
      WHERE lab_key = $1
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
      WHERE lab_key = $1 AND activo = true
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'activo', NOW(), NOW())
      RETURNING id;
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
    // --- Generar placeholders dinámicos según cantidad de registros (Postgres $1..$n) ---
    const COLS_PER_ROW = 10;
    const placeholders = datos
      .map((_, idx) => {
        const base = idx * COLS_PER_ROW;
        const cols = Array.from({ length: COLS_PER_ROW }, (_, j) => `$${base + j + 1}`).join(', ');
        return `(${cols})`;
      })
      .join(', ');
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
      true,               // 9 (valido)
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

// === Obtener inputs de la sesión ===
ipcMain.handle("db-get-inputs-by-session", async (event, { session_id, tipoAnalisis }) => {
  try {
    let rows = [];
    if (tipoAnalisis === "multi" || tipoAnalisis === "multianalito") {
      rows = await db.all(`
        SELECT analito, parametro, lectura_idx, valor
        FROM inputs_multianalito
        WHERE session_id = $1
        AND valido = true
        ORDER BY parametro ASC, analito ASC, lectura_idx ASC;
      `, [session_id]);
    } else {
      rows = await db.all(`
        SELECT parametro, lectura_idx, valor
        FROM inputs_monoanalito
        WHERE session_id = $1
        AND valido = true
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
    const res = await db.run(`DELETE FROM ${table} WHERE session_id = $1`, [session_id]);
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
       WHERE id = $1;`,
      [session_id]
    );
    return { ok: true };
  } catch (err) {
    console.error("[DB] Error cerrando sesión:", err);
    return { ok: false, error: err.message };
  }
});

// === Eliminar sesión y sus inputs (rollback completo) ===
ipcMain.handle("db-delete-session-deep", async (event, session_id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rMono = await client.query(`DELETE FROM inputs_monoanalito WHERE session_id = $1;`, [session_id]);
    const rMulti = await client.query(`DELETE FROM inputs_multianalito WHERE session_id = $1;`, [session_id]);
    const rSess = await client.query(`DELETE FROM sessions WHERE id = $1;`, [session_id]);
    await client.query('COMMIT');
    return {
      ok: true,
      deleted: {
        inputs_monoanalito: rMono?.rowCount ?? 0,
        inputs_multianalito: rMulti?.rowCount ?? 0,
        sessions: rSess?.rowCount ?? 0,
      },
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error("[DB] Error eliminando sesión profundamente:", err);
    return { ok: false, error: err.message };
  } finally {
    client.release();
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
      WHERE s.id = $1;
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
      SELECT s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo, s.estado, s.creado_en, s."procedure",\n             u.username AS usuario
      FROM sessions s
      LEFT JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN labs l ON l.lab_key = s.lab_key
      WHERE ($1::text IS NULL OR s.lab_key = $1::text)
      ORDER BY s.creado_en DESC;
    `, [labDefault ?? null]);

    return { ok: true, data: rows };
  } catch (err) {
    console.error("[DB] Error listando sesiones:", err);
    return { ok: false, error: err.message };
  }
});


// === Obtener evaluaciones disponibles según contexto ===
ipcMain.handle("db-get-evaluaciones", async (event, { lab_key, tipo_analisis, tipo_dato, modo_cualitativo }) => {
  try {
    const rows = await db.all(`
      SELECT 
        t.id, t.nombre_interno, t.titulo, t.categoria, t.descripcion,
        -- Solo permitimos lucide. Sanitizamos el nombre dejando [a-z0-9-]
        CASE
          WHEN t.icon_lib IS NOT NULL AND btrim(t.icon_lib) <> '' THEN
            'lucide:' || NULLIF(
              regexp_replace(
                regexp_replace(lower(btrim(t.icon_lib)), '^lucide:', ''),
                '[^a-z0-9\-]', '', 'g'
              )
            , '')
          ELSE NULL
        END AS icon_lib_sanitized
      FROM tests_catalog t
      WHERE t.lab_key = $1
        AND t.tipo_analisis = $2
        AND t.tipo_dato = $3
        AND (t.modo_cualitativo IS NULL OR t.modo_cualitativo = $4)
        AND t.activo = true
      ORDER BY t.id ASC;
    `, [lab_key, tipo_analisis, tipo_dato, modo_cualitativo || null]);

    // Mapear a un icon_value seguro (solo lucide), con fallback
    const safe = rows.map(r => {
      let icon_value = r.icon_lib_sanitized && r.icon_lib_sanitized.startsWith('lucide:')
        ? r.icon_lib_sanitized
        : 'lucide:bar-chart-2';
      return { ...r, icon_value };
    });

    return { ok: true, data: safe };
  } catch (err) {
    console.error("[DB] Error obteniendo evaluaciones:", err);
    return { ok: false, error: err.message };
  }
});


// === Ejecutar evaluaciones seleccionadas (flujo con Python + guardado en results_general) ===
ipcMain.handle("db-run-evaluaciones", async (event, { session_id, catalog_ids }) => {
  try {
    console.log("[EVAL] Ejecutar evaluaciones:", { session_id, catalog_ids });

    // Obtener info de sesión (tipo y usuario)
    const session = await db.get(`
      SELECT tipo_analisis, lab_key, usuario_id
      FROM sessions
      WHERE id = $1;
    `, [session_id]);

    if (!session) throw new Error("Sesión no encontrada.");
    const { tipo_analisis, usuario_id } = session;

    // Obtener inputs de la sesión
    let rows = [];
    if (tipo_analisis === "multi" || tipo_analisis === "multianalito") {
      rows = await db.all(`
        SELECT analito, parametro, lectura_idx, valor,
               unidad, tipo_dato, modo_cualitativo, comentario
        FROM inputs_multianalito
        WHERE session_id = $1 AND valido = true
        ORDER BY parametro, analito, lectura_idx;
      `, [session_id]);
    } else {
      rows = await db.all(`
        SELECT analito, parametro, lectura_idx, valor,
               unidad, tipo_dato, modo_cualitativo, comentario
        FROM inputs_monoanalito
        WHERE session_id = $1 AND valido = true
        ORDER BY parametro, lectura_idx;
      `, [session_id]);
    }

    // Obtener módulos Python por asset (ruta relativa empaquetada)
    const testsRaw = await db.all(`
      SELECT t.id, t.nombre_interno, m.module_asset, m.graph_asset
      FROM tests_catalog t
      JOIN test_modules m ON m.catalog_id = t.id
      WHERE t.id IN (${catalog_ids.map((_, i) => `$${i + 1}`).join(",")})
        AND m.activo = true;
    `, catalog_ids);

    if (!testsRaw || testsRaw.length === 0)
      throw new Error("No se encontró código asociado a las evaluaciones seleccionadas.");
    const fs = require("fs");
    const os = require("os");
    const crypto = require("crypto");
    const baseModules = path.resolve(path.join(__dirname, 'modules'));

    let manifest = { entries: [] };
    try {
      const mfPath = path.join(baseModules, '_common', 'modules_manifest.json');
      const raw = fs.readFileSync(mfPath, 'utf8');
      manifest = JSON.parse(raw);
    } catch (e) {
      console.warn('[Modules] No se pudo cargar modules_manifest.json; no se verificará hash de assets.');
      manifest = { entries: [] };
    }
    const toPosix = (p) => String(p || '').replace(/\\/g, '/');
    const idxByAsset = new Map(
      (manifest.entries || []).map(e => [toPosix(e.module_asset || ''), e])
    );

    const sanitizeRel = (rel) => {
      const r = String(rel || '').trim();
      if (!r) return '';
      if (!/^[a-z0-9_\-\/\.]+$/i.test(r)) return '';
      const full = path.resolve(path.join(baseModules, r));
      if (!full.startsWith(baseModules)) return '';
      return { full, relPosix: toPosix(rel) };
    };
    const readUtf8 = (full) => {
      try { return fs.readFileSync(full, 'utf8'); } catch (_) { return ''; }
    };
    const sha256Hex = (buf) => crypto.createHash('sha256').update(buf, 'utf8').digest('hex');

    const verified = [];
    for (const t of testsRaw) {
      const modPath = sanitizeRel(t.module_asset);
      if (!modPath) {
        console.warn(`[Modules] Ruta inválida para módulo id=${t.id} (${t.nombre_interno}): ${t.module_asset}`);
        continue;
      }
      const mf = idxByAsset.get(modPath.relPosix);
      if (!mf) {
        console.warn(`[Modules] module_asset no listado en manifest: ${modPath.relPosix}`);
        continue;
      }
      if (mf.id && String(mf.id) !== String(t.id)) {
        console.warn(`[Modules] ID no coincide con manifest para ${modPath.relPosix} (mf.id=${mf.id} != ${t.id})`);
        continue;
      }
      if (mf.nombre_interno && mf.nombre_interno !== t.nombre_interno) {
        console.warn(`[Modules] nombre_interno no coincide con manifest para ${modPath.relPosix}`);
        continue;
      }
      const principal = readUtf8(modPath.full);
      if (!principal) {
        console.warn(`[Modules] No se pudo leer archivo de módulo: ${modPath.full}`);
        continue;
      }
      if (mf.sha256_module) {
        const h = sha256Hex(principal);
        if (h !== String(mf.sha256_module)) {
          console.warn(`[Modules] Hash mismatch para ${modPath.relPosix}. esperado=${mf.sha256_module} obtuvo=${h}`);
          continue;
        }
      }
      let grafico = '';
      if (t.graph_asset) {
        const grPath = sanitizeRel(t.graph_asset);
        if (!grPath) {
          console.warn(`[Modules] graph_asset inválido para id=${t.id} (${t.nombre_interno}): ${t.graph_asset}`);
          continue;
        }
        grafico = readUtf8(grPath.full);
        if (mf.sha256_graph) {
          const hg = sha256Hex(grafico);
          if (hg !== String(mf.sha256_graph)) {
            console.warn(`[Modules] Hash mismatch graph para ${grPath.relPosix}. esperado=${mf.sha256_graph} obtuvo=${hg}`);
            continue;
          }
        }
      }
      verified.push({ id: t.id, nombre_interno: t.nombre_interno, codigo_principal: principal, codigo_grafico: grafico });
    }
    if (verified.length === 0) {
      throw new Error("No se pudo cargar ningún módulo desde assets. Verifique module_asset/graph_asset y el manifiesto.");
    }

    // Crear JSON temporal con inputs + módulos verificados
    const tempData = {
      session_id,
      tipo_analisis,
      catalog_ids,
      df_ingreso: rows,
      tests: verified.map(t => ({ id: t.id, nombre_interno: t.nombre_interno, codigo_principal: t.codigo_principal, codigo_grafico: t.codigo_grafico })),
    };
    // Carpeta aislada como cwd del proceso Python
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cerper_eval_'));
    const tempPath = path.join(tempDir, `eval_${session_id}.json`);
    fs.writeFileSync(tempPath, JSON.stringify(tempData, null, 2), "utf8");

    // Ejecutar proceso Python con mayor aislamiento
    const PY_TIMEOUT_MS = 20000;
    const python = spawn(
      "python",
      [
        "-I", // modo aislado: ignora variables de entorno del usuario y sys.path externos
        "-B", // no escribir .pyc
        "./modules/_common/eval_runner_secure.py",
        tempPath,
      ],
      {
        cwd: tempDir,
        env: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
          HTTP_PROXY: "",
          HTTPS_PROXY: "",
          NO_PROXY: "*",
          PATH: process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32') : '',
          SystemRoot: process.env.SystemRoot || undefined,
        },
        windowsHide: true,
      }
    );

    return await new Promise((resolve) => {
      let output = "";
      let error = "";

      python.stdout.on("data", (d) => (output += d.toString()));
      python.stderr.on("data", (d) => (error += d.toString()));

      const killTimer = setTimeout(() => {
        try { python.kill(); } catch (_) {}
      }, PY_TIMEOUT_MS);

      python.on("close", async (code) => {
        clearTimeout(killTimer);
        try { fs.unlinkSync(tempPath); } catch (_) {}
        try { fs.rmdirSync(tempDir); } catch (_) {}

        if (code === 0) {
          try {
            const results = JSON.parse(output.trim());

            // Guardar resultados en results_general
            for (const r of results) {
              if (!r.ok) {
                console.warn(`[EVAL] Falló módulo ${r.nombre}: ${r.error}`);
                continue;
              }

              await db.run(`
                INSERT INTO results_general
                (session_id, catalog_id, resultado_pc, grafico_data, creado_en, usuario_id)
                VALUES ($1, $2, $3, $4, NOW(), $5);
              `, [
                session_id,
                r.catalog_id,
                r.resultado_pc,
                r.grafico_data || "",
                usuario_id
              ]);
              try {
                await db.run(`
                  INSERT INTO logs_sistema (usuario_id, accion, detalle)
                  VALUES ($1, 'modulo_ejecutado', $2);
                `, [usuario_id || null, `catalog_id=${r.catalog_id}`]);
              } catch (_) {}
            }

            console.log(`[EVAL] Resultados guardados correctamente (${results.length} módulos).`);
            resolve({ ok: true, count: results.length });

          } catch (err) {
            console.error("[EVAL] Error procesando salida Python:", err);
            resolve({ ok: false, error: "Error procesando salida Python" });
          }
        } else {
          console.error("[EVAL] Python error:", error || `Proceso finalizado con código ${code}`);
          resolve({ ok: false, error });
        }
      });
    });

  } catch (err) {
    console.error("[EVAL] Error ejecutando evaluaciones:", err);
    return { ok: false, error: err.message };
  }
});







// === Utilitario: calcular metadata de sesión (reutilizable) ===
async function computeSessionMeta(session_id) {
  const session = await db.get(`
    SELECT tipo_analisis, tipo_dato
    FROM sessions
    WHERE id = $1;
  `, [session_id]);
  if (!session) throw new Error("Sesión no encontrada.");

  const tipo = session.tipo_analisis;
  const tipo_dato = session.tipo_dato;

  let datos = [];
  if (tipo === "multi" || tipo === "multianalito") {
    datos = await db.all(`
      SELECT parametro, analito,
             COUNT(DISTINCT lectura_idx) AS n_lecturas
      FROM inputs_multianalito
      WHERE session_id = $1 AND valido = true
      GROUP BY parametro, analito;
    `, [session_id]);
  } else {
    datos = await db.all(`
      SELECT parametro,
             COUNT(lectura_idx) AS n_lecturas
      FROM inputs_monoanalito
      WHERE session_id = $1 AND valido = true
      GROUP BY parametro;
    `, [session_id]);
  }

  const parametros = [...new Set(datos.map(d => d.parametro))];
  const analitos = [...new Set(datos.map(d => d.analito).filter(Boolean))];
  const lecturas = datos.map(d => d.n_lecturas || 0);
  const minLecturas = lecturas.length ? Math.min(...lecturas) : 0;
  const maxLecturas = lecturas.length ? Math.max(...lecturas) : 0;
  const promLecturas = lecturas.length
    ? lecturas.reduce((a, b) => a + b, 0) / lecturas.length
    : 0;

  return {
    session_id,
    tipo_analisis: tipo,
    tipo_dato,
    n_parametros: parametros.length,
    n_analitos: analitos.length,
    min_lecturas: minLecturas,
    max_lecturas: maxLecturas,
    prom_lecturas: promLecturas,
  };
}

// === Calcular metadata de sesión ===
ipcMain.handle("db-get-session-metadata", async (event, session_id) => {
  try {
    const meta = await computeSessionMeta(session_id);

    const metadata = {
      ...meta,
      // Campos opcionales por ahora sin determinar
      cumple_normalidad: null,
      cumple_precision: null,
      cumple_veracidad: null,
      comentarios: null,
    };

    return { ok: true, data: metadata };

  } catch (err) {
    console.error("[DB] Error calculando metadata:", err);
    return { ok: false, error: err.message };
  }
});


// === Obtener pruebas con metadatos (usa la metadata calculada arriba) ===
ipcMain.handle("db-get-tests-with-metadata", async (event, session_id) => {
  try {
    // Usar la misma fuente de verdad para metadata
    const meta = await computeSessionMeta(session_id);

    // === Evaluar pruebas contra metadata ===
    const rows = await db.all(`
      SELECT 
        t.catalog_id AS id,
        CASE
          WHEN (t.requisitos_json->>'min_lecturas') IS NOT NULL
               AND $1 < (t.requisitos_json->>'min_lecturas')::int THEN 0
          WHEN (t.requisitos_json->>'min_parametros') IS NOT NULL
               AND $2 < (t.requisitos_json->>'min_parametros')::int THEN 0
          WHEN (t.requisitos_json->>'tipo_dato') IS NOT NULL
               AND (t.requisitos_json->>'tipo_dato') <> $3 THEN 0
          ELSE 1
        END AS aplicable,
        (t.requisitos_json->>'min_lecturas')::int AS min_lecturas,
        (t.requisitos_json->>'min_parametros')::int AS min_parametros,
        (t.requisitos_json->>'mensaje_no_aplicable') AS mensaje_no_aplicable
      FROM test_modules t
      WHERE t.activo = true;
    `, [
      meta.min_lecturas || 0,
      meta.n_parametros || 0,
      meta.tipo_dato || "cuantitativo"
    ]);

    return { ok: true, data: rows, meta };
  } catch (err) {
    console.error("[DB] Error en metadata unificada:", err);
    return { ok: false, error: err.message };
  }
});


