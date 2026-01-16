const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireUser, assertSessionAccess } = require('../lib/resourceAuth');

router.use(requireUser);

/**
 * SEGURIDAD: Whitelist explícita de tablas permitidas.
 * Este mapeo previene SQL injection al garantizar que solo se usen
 * nombres de tabla predefinidos. Cualquier valor no reconocido
 * lanza un error en lugar de usar un fallback.
 * 
 * @see docs/SECURITY_ANALYSIS.md - Sección 2.4
 */
const ALLOWED_INPUT_TABLES = Object.freeze({
  'mono': 'inputs_monoanalito',
  'monoanalito': 'inputs_monoanalito',
  'multi': 'inputs_multianalito',
  'multianalito': 'inputs_multianalito',
});

function resolveInputTable(tipoAnalisis) {
  const normalized = (tipoAnalisis || '').toLowerCase();
  const table = ALLOWED_INPUT_TABLES[normalized];

  if (!table) {
    throw new Error(`Tipo de análisis no válido: "${tipoAnalisis}". Valores permitidos: ${Object.keys(ALLOWED_INPUT_TABLES).join(', ')}`);
  }

  return table;
}

router.post('/', async (req, res) => {
  const { session_id, tipoAnalisis, datos } = req.body || {};
  if (!session_id || !Array.isArray(datos)) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  let table;
  try {
    table = resolveInputTable(tipoAnalisis);
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'invalid_tipo_analisis', message: err.message });
  }

  try {
    await assertSessionAccess(pool, req.user, session_id, { mutate: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'db_error' });
  }

  const COLS_PER_ROW = 11; // agrega nivel
  try {
    const placeholders = datos
      .map((_, index) => {
        const base = index * COLS_PER_ROW;
        const cols = Array.from({ length: COLS_PER_ROW }, (_, j) => `$${base + j + 1}`).join(', ');
        return `(${cols})`;
      })
      .join(', ');
    const values = datos.flatMap((row) => [
      session_id,
      row.analito ?? null,
      row.parametro ?? null,
      row.nivel ?? 1,
      row.lectura_idx ?? null,
      row.valor ?? null,
      row.unidad ?? null,
      row.tipo_dato ?? null,
      row.modo_cualitativo ?? null,
      true,
      row.comentario ?? null,
    ]);

    await pool.query(
      `INSERT INTO ${table} (
        session_id, analito, parametro, nivel, lectura_idx, valor,
        unidad, tipo_dato, modo_cualitativo, valido, comentario
      )
      VALUES ${placeholders}`,
      values
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] Error insertando inputs', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/:sessionId', async (req, res) => {
  const session_id = Number(req.params.sessionId);
  const tipoAnalisis = req.query.tipo;
  if (!session_id) {
    return res.status(400).json({ ok: false, error: 'missing_session_id' });
  }

  let table;
  try {
    table = resolveInputTable(tipoAnalisis);
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'invalid_tipo_analisis', message: err.message });
  }

  try {
    await assertSessionAccess(pool, req.user, session_id, { mutate: false });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'db_error' });
  }

  try {
    const isMulti = table === 'inputs_multianalito';
    const rows = await pool.query(
      isMulti
        ? `SELECT analito, parametro, nivel, lectura_idx, valor
           FROM inputs_multianalito
           WHERE session_id = $1 AND valido = true
           ORDER BY parametro ASC, analito ASC, nivel ASC, lectura_idx ASC`
        : `SELECT parametro, analito, nivel, lectura_idx, valor
           FROM inputs_monoanalito
           WHERE session_id = $1 AND valido = true
           ORDER BY parametro ASC, nivel ASC, lectura_idx ASC`,
      [session_id]
    );
    res.json({ ok: true, data: rows.rows });
  } catch (err) {
    console.error('[API] Error leyendo inputs', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.delete('/:sessionId', async (req, res) => {
  const session_id = Number(req.params.sessionId);
  const tipoAnalisis = req.query.tipo;
  if (!session_id) {
    return res.status(400).json({ ok: false, error: 'missing_session_id' });
  }

  let table;
  try {
    table = resolveInputTable(tipoAnalisis);
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'invalid_tipo_analisis', message: err.message });
  }

  try {
    await assertSessionAccess(pool, req.user, session_id, { mutate: true });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'db_error' });
  }

  try {
    const result = await pool.query(`DELETE FROM ${table} WHERE session_id = $1`, [session_id]);
    res.json({ ok: true, changes: result.rowCount });
  } catch (err) {
    console.error('[API] Error borrando inputs', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
