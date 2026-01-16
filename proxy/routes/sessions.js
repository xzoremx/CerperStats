const express = require('express');
const router = express.Router();
const pool = require('../db');
const { CANONICAL_SESSION_STATES, normalizeSessionEstado, isCanonicalSessionEstado } = require('../lib/sessionEstado');
const { requireUser, normalizeRole, assertSessionAccess, normalizeLabs } = require('../lib/resourceAuth');

router.use(requireUser);

async function computeSessionMeta(sessionId) {
  const { rows: sessionRows } = await pool.query(
    `SELECT tipo_analisis, tipo_dato
     FROM sessions
     WHERE id = $1`,
    [sessionId]
  );
  const session = sessionRows[0];
  if (!session) {
    const err = new Error('session_not_found');
    err.statusCode = 404;
    throw err;
  }

  const tipo = session.tipo_analisis;
  const tipo_dato = session.tipo_dato;

  let datos = [];
  if (tipo === 'multi' || tipo === 'multianalito') {
    // Agrupar por parametro, analito y nivel para contar lecturas por nivel
    // Luego tomar el máximo de lecturas por nivel para cada combinación parametro/analito
    const { rows } = await pool.query(
      `SELECT parametro, analito,
              MAX(lecturas_por_nivel) AS n_lecturas
       FROM (
         SELECT parametro, analito, nivel,
                COUNT(DISTINCT lectura_idx) AS lecturas_por_nivel
         FROM inputs_multianalito
         WHERE session_id = $1 AND valido = true
         GROUP BY parametro, analito, nivel
       ) AS lecturas_por_nivel_grupo
       GROUP BY parametro, analito`,
      [sessionId]
    );
    datos = rows;
  } else {
    // Agrupar por parametro y nivel para contar lecturas por nivel
    // Luego tomar el máximo de lecturas por nivel para cada parámetro
    const { rows } = await pool.query(
      `SELECT parametro,
              MAX(lecturas_por_nivel) AS n_lecturas
       FROM (
         SELECT parametro, nivel,
                COUNT(DISTINCT lectura_idx) AS lecturas_por_nivel
         FROM inputs_monoanalito
         WHERE session_id = $1 AND valido = true
         GROUP BY parametro, nivel
       ) AS lecturas_por_nivel_grupo
       GROUP BY parametro`,
      [sessionId]
    );
    datos = rows;
  }

  const parametros = [...new Set(datos.map((d) => d.parametro))];
  const analitos = [...new Set(datos.map((d) => d.analito).filter(Boolean))];
  const lecturas = datos.map((d) => Number(d.n_lecturas || 0));
  const minLecturas = lecturas.length ? Math.min(...lecturas) : 0;
  const maxLecturas = lecturas.length ? Math.max(...lecturas) : 0;
  const promLecturas = lecturas.length
    ? lecturas.reduce((acc, val) => acc + val, 0) / lecturas.length
    : 0;

  return {
    session_id: sessionId,
    tipo_analisis: tipo,
    tipo_dato,
    n_parametros: parametros.length,
    parametros_unicos: parametros, // List of unique parameter labels
    n_analitos: analitos.length,
    min_lecturas: minLecturas,
    max_lecturas: maxLecturas,
    prom_lecturas: promLecturas,
  };
}

function isMultiAnalisis(tipo) {
  const normalized = String(tipo || "").trim().toLowerCase();
  return normalized === "multi" || normalized === "multianalito";
}

router.post('/', async (req, res) => {
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
  } = req.body || {};

  const user = req.user;
  const usuarioId = Number(user?.id);
  const role = normalizeRole(user?.rol);
  const allowedLabs = normalizeLabs(user?.default_labs);

  if (!lab_key || !usuarioId) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  if (role !== 'admin' && allowedLabs.length > 0 && !allowedLabs.includes(String(lab_key).trim())) {
    return res.status(403).json({ ok: false, error: 'forbidden_lab' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO sessions (
        lab_key, procedure, metodo, producto, ensayo, expediente, unidad,
        tipo_analisis, tipo_dato, modo_cualitativo, parametro, usuario_id,
        estado, creado_en, actualizado_en
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'activo', NOW(), NOW())
      RETURNING id`,
      [
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
        usuarioId,
      ]
    );
    const sessionId = rows[0]?.id;
    res.json({ ok: true, session_id: sessionId });
  } catch (err) {
    console.error('[API] Error insertando sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

// Create a new session from an existing one and copy its inputs (no results or reports).
// The new session keeps a reference to the original via `parent_session_id`.
router.post('/:sessionId/reuse', async (req, res) => {
  const parentSessionId = Number(req.params.sessionId);
  if (!parentSessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await assertSessionAccess(client, req.user, parentSessionId, { mutate: false });

    const { rows: parentRows } = await client.query(
      `SELECT
         lab_key, "procedure", metodo, producto, ensayo, expediente, unidad,
         tipo_analisis, tipo_dato, modo_cualitativo, parametro, usuario_id
       FROM sessions
       WHERE id = $1`,
      [parentSessionId]
    );

    const parent = parentRows[0];
    if (!parent) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    const newUsuarioId = Number(req.user?.id) || null;
    if (!newUsuarioId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'invalid_usuario_id' });
    }

    const { rows: newRows } = await client.query(
      `INSERT INTO sessions (
        lab_key, "procedure", metodo, producto, ensayo, expediente, unidad,
        tipo_analisis, tipo_dato, modo_cualitativo, parametro, usuario_id,
        parent_session_id, estado, creado_en, actualizado_en
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'activo', NOW(), NOW())
      RETURNING id`,
      [
        parent.lab_key,
        parent.procedure,
        parent.metodo,
        parent.producto,
        parent.ensayo,
        parent.expediente,
        parent.unidad,
        parent.tipo_analisis,
        parent.tipo_dato,
        parent.modo_cualitativo,
        parent.parametro,
        newUsuarioId,
        parentSessionId,
      ]
    );

    const newSessionId = newRows[0]?.id;
    if (!newSessionId) {
      await client.query('ROLLBACK');
      return res.status(500).json({ ok: false, error: 'db_error' });
    }

    const multi = isMultiAnalisis(parent.tipo_analisis);
    const copyQuery = multi
      ? `INSERT INTO inputs_multianalito (
           session_id, analito, parametro, nivel, lectura_idx, valor,
           unidad, tipo_dato, modo_cualitativo, valido, comentario
         )
         SELECT
           $1 AS session_id, analito, parametro, nivel, lectura_idx, valor,
           unidad, tipo_dato, modo_cualitativo, valido, comentario
         FROM inputs_multianalito
         WHERE session_id = $2 AND valido = true`
      : `INSERT INTO inputs_monoanalito (
           session_id, analito, parametro, nivel, lectura_idx, valor,
           unidad, tipo_dato, modo_cualitativo, valido, comentario
         )
         SELECT
           $1 AS session_id, analito, parametro, nivel, lectura_idx, valor,
           unidad, tipo_dato, modo_cualitativo, valido, comentario
         FROM inputs_monoanalito
         WHERE session_id = $2 AND valido = true`;

    const copyResult = await client.query(copyQuery, [newSessionId, parentSessionId]);

    await client.query('COMMIT');
    res.json({ ok: true, session_id: newSessionId, copied_inputs: copyResult.rowCount || 0 });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { }
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error reutilizando sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  } finally {
    client.release();
  }
});

router.patch('/:sessionId/status', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }

  const requestedRaw = String(req.body?.estado || '').trim();
  const requested = normalizeSessionEstado(requestedRaw);
  if (!requested || !isCanonicalSessionEstado(requested)) {
    return res.status(400).json({ ok: false, error: 'invalid_status', valid: CANONICAL_SESSION_STATES });
  }

  try {
    await assertSessionAccess(pool, req.user, sessionId, { mutate: true });

    const { rows } = await pool.query(
      `SELECT
         COALESCE(LOWER(estado), '') AS estado,
         EXISTS(SELECT 1 FROM reports r WHERE r.session_id = s.id) AS has_reports
       FROM sessions s
       WHERE s.id = $1`,
      [sessionId]
    );

    const row = rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    const hasReports = Boolean(row.has_reports);
    if ((requested === 'finalizada' || requested === 'suficiente') && !hasReports) {
      return res.status(400).json({ ok: false, error: 'missing_reports' });
    }
    if (requested === 'cancelada' && hasReports) {
      return res.status(400).json({ ok: false, error: 'has_reports' });
    }

    const result = await pool.query(
      `UPDATE sessions
       SET estado = $1,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [requested, sessionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error actualizando estado de sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.post('/cancel-incomplete', async (req, res) => {
  const usuarioId = Number(req.user?.id);
  if (!usuarioId) {
    return res.status(400).json({ ok: false, error: 'invalid_usuario_id' });
  }

  try {
    const result = await pool.query(
      `UPDATE sessions s
       SET estado = 'cancelada',
           actualizado_en = CURRENT_TIMESTAMP
       WHERE s.usuario_id = $1
         AND COALESCE(LOWER(s.estado), '') IN ('', 'activa', 'activo')
         AND NOT EXISTS (
           SELECT 1 FROM reports r WHERE r.session_id = s.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM inputs_monoanalito i WHERE i.session_id = s.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM inputs_multianalito i WHERE i.session_id = s.id
         )`,
      [usuarioId]
    );

    res.json({ ok: true, canceled: result.rowCount || 0 });
  } catch (err) {
    console.error('[API] Error cancelando sesiones incompletas', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/', async (req, res) => {
  const labQuery = req.query.lab;
  const labs =
    Array.isArray(labQuery)
      ? labQuery.map((v) => (v || '').toString().trim()).filter(Boolean)
      : labQuery
        ? [(labQuery || '').toString().trim()].filter(Boolean)
        : null;
  const labFilter = labs && labs.length ? labs : null;

  const user = req.user;
  const role = normalizeRole(user?.rol);
  const userId = Number(user?.id) || null;
  const allowedLabs = normalizeLabs(user?.default_labs);
  try {
    if (role === 'admin') {
      const { rows } = await pool.query(
        `SELECT
           s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo,
           s.estado, s.creado_en, s."procedure",
           COALESCE(u.nombre_completo, u.username) AS usuario,
           s.tipo_analisis, s.tipo_dato, s.modo_cualitativo
         FROM sessions s
         LEFT JOIN usuarios u ON s.usuario_id = u.id
         LEFT JOIN labs l ON l.lab_key = s.lab_key
         WHERE ($1::text[] IS NULL OR s.lab_key = ANY($1::text[]))
         ORDER BY s.creado_en DESC`,
        [labFilter]
      );
      return res.json({ ok: true, data: rows });
    }

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'missing_user' });
    }

    if (role === 'analista') {
      const { rows } = await pool.query(
        `SELECT
           s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo,
           s.estado, s.creado_en, s."procedure",
           COALESCE(u.nombre_completo, u.username) AS usuario,
           s.tipo_analisis, s.tipo_dato, s.modo_cualitativo
         FROM sessions s
         LEFT JOIN usuarios u ON s.usuario_id = u.id
         LEFT JOIN labs l ON l.lab_key = s.lab_key
         WHERE s.usuario_id = $1
         ORDER BY s.creado_en DESC`,
        [userId]
      );
      return res.json({ ok: true, data: rows });
    }

    // supervisor
    const requestedLabs = labFilter;
    const effectiveLabs =
      requestedLabs && requestedLabs.length
        ? requestedLabs.filter((lab) => allowedLabs.includes(lab))
        : allowedLabs;
    const labsParam = effectiveLabs && effectiveLabs.length ? effectiveLabs : null;

    const { rows } = await pool.query(
      `SELECT
         s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo,
         s.estado, s.creado_en, s."procedure",
         COALESCE(u.nombre_completo, u.username) AS usuario,
         s.tipo_analisis, s.tipo_dato, s.modo_cualitativo
       FROM sessions s
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       LEFT JOIN labs l ON l.lab_key = s.lab_key
       WHERE (
         s.usuario_id = $1
         OR ($2::text[] IS NOT NULL AND s.lab_key = ANY($2::text[]))
       )
       ORDER BY s.creado_en DESC`,
      [userId, labsParam]
    );
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[API] Error listando sesiones', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/:sessionId/tests-metadata', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }
  try {
    await assertSessionAccess(pool, req.user, sessionId, { mutate: false });
    const meta = await computeSessionMeta(sessionId);
    const { rows } = await pool.query(
      `SELECT 
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
       WHERE t.activo = true`,
      [meta.min_lecturas || 0, meta.n_parametros || 0, meta.tipo_dato || 'cuantitativo']
    );
    res.json({ ok: true, data: rows, meta });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error en metadata unificada', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/:sessionId', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }
  try {
    await assertSessionAccess(pool, req.user, sessionId, { mutate: false });
    const { rows } = await pool.query(
      `SELECT s.*, u.username AS usuario, l.nombre AS lab_nombre,
              (SELECT u2.username FROM usuarios u2 
               WHERE u2.rol = 'supervisor'
                 AND u2.default_lab IS NOT NULL
                 AND s.lab_key = ANY(u2.default_lab)
               LIMIT 1) AS supervisor_nombre
       FROM sessions s
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       LEFT JOIN labs l ON l.lab_key = s.lab_key
       WHERE s.id = $1`,
      [sessionId]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error obteniendo sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

// Lightweight endpoint to check if session has results (for validation before PDF config)
router.get('/:sessionId/results-status', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }
  try {
    await assertSessionAccess(pool, req.user, sessionId, { mutate: false });
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*)::int AS results_count,
         COUNT(DISTINCT catalog_id)::int AS tests_count,
         MAX(creado_en)::text AS last_run_at
       FROM results_general
       WHERE session_id = $1
         AND catalog_id IS NOT NULL`,
      [sessionId]
    );
    const data = rows[0] || { results_count: 0, tests_count: 0, last_run_at: null };
    res.json({
      ok: true,
      has_results: data.results_count > 0,
      results_count: data.results_count,
      tests_count: data.tests_count,
      last_run_at: data.last_run_at
    });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error checking results status', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.patch('/:sessionId/close', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }
  try {
    await assertSessionAccess(pool, req.user, sessionId, { mutate: true });
    const { rows } = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM reports r WHERE r.session_id = $1) AS has_reports`,
      [sessionId]
    );
    const hasReports = Boolean(rows[0]?.has_reports);
    if (hasReports) {
      return res.status(400).json({ ok: false, error: 'has_reports' });
    }
    const result = await pool.query(
      `UPDATE sessions
       SET estado = 'cancelada',
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }
    res.json({ ok: true });
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error cancelando sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.delete('/:sessionId', async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertSessionAccess(client, req.user, sessionId, { mutate: true });
    const rMono = await client.query(
      `DELETE FROM inputs_monoanalito WHERE session_id = $1`,
      [sessionId]
    );
    const rMulti = await client.query(
      `DELETE FROM inputs_multianalito WHERE session_id = $1`,
      [sessionId]
    );
    const rSess = await client.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    await client.query('COMMIT');
    res.json({
      ok: true,
      deleted: {
        inputs_monoanalito: rMono?.rowCount ?? 0,
        inputs_multianalito: rMulti?.rowCount ?? 0,
        sessions: rSess?.rowCount ?? 0,
      },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { }
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error('[API] Error eliminando sesión profundamente', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  } finally {
    client.release();
  }
});

module.exports = router;
