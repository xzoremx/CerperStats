const express = require('express');
const router = express.Router();
const pool = require('../db');

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
    usuario,
  } = req.body || {};

  if (!lab_key || !usuario) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
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
        usuario,
      ]
    );
    const sessionId = rows[0]?.id;
    res.json({ ok: true, session_id: sessionId });
  } catch (err) {
    console.error('[API] Error insertando sesión', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/', async (req, res) => {
  const rol = (req.query.rol || '').toLowerCase();
  const labQuery = req.query.lab;
  const labs =
    Array.isArray(labQuery)
      ? labQuery.map((v) => (v || '').toString().trim()).filter(Boolean)
      : labQuery
        ? [(labQuery || '').toString().trim()].filter(Boolean)
        : null;
  const labFilter = labs && labs.length ? labs : null;
  try {
    if (rol === 'analista') {
      return res.json({ ok: true, data: [] });
    }
    const { rows } = await pool.query(
      `SELECT
         s.id, s.lab_key, l.nombre AS lab_nombre, s.producto, s.metodo,
         s.estado, s.creado_en, s."procedure", u.username AS usuario,
         s.tipo_analisis, s.tipo_dato, s.modo_cualitativo
       FROM sessions s
       LEFT JOIN usuarios u ON s.usuario_id = u.id
       LEFT JOIN labs l ON l.lab_key = s.lab_key
       WHERE ($1::text[] IS NULL OR s.lab_key = ANY($1::text[]))
       ORDER BY s.creado_en DESC`,
      [labFilter]
    );
    res.json({ ok: true, data: rows });
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
    if (err.statusCode === 404) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
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
    const result = await pool.query(
      `UPDATE sessions
       SET estado = 'cerrada',
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] Error cerrando sesión', err);
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
    console.error('[API] Error eliminando sesión profundamente', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  } finally {
    client.release();
  }
});

module.exports = router;
