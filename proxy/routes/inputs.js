const express = require('express');
const router = express.Router();
const pool = require('../db');

function resolveInputTable(tipoAnalisis) {
  const normalized = (tipoAnalisis || '').toLowerCase();
  return normalized === 'multi' || normalized === 'multianalito'
    ? 'inputs_multianalito'
    : 'inputs_monoanalito';
}

router.post('/', async (req, res) => {
  const { session_id, tipoAnalisis, datos } = req.body || {};
  if (!session_id || !Array.isArray(datos)) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
  const table = resolveInputTable(tipoAnalisis);
  const COLS_PER_ROW = 10;
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
        session_id, analito, parametro, lectura_idx, valor,
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
  const table = resolveInputTable(tipoAnalisis);
  try {
    const rows = await pool.query(
      tipoAnalisis === 'multi' || tipoAnalisis === 'multianalito'
        ? `SELECT analito, parametro, lectura_idx, valor
           FROM inputs_multianalito
           WHERE session_id = $1 AND valido = true
           ORDER BY parametro ASC, analito ASC, lectura_idx ASC`
        : `SELECT parametro, lectura_idx, valor
           FROM inputs_monoanalito
           WHERE session_id = $1 AND valido = true
           ORDER BY parametro ASC, lectura_idx ASC`,
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
  const table = resolveInputTable(tipoAnalisis);
  try {
    const result = await pool.query(`DELETE FROM ${table} WHERE session_id = $1`, [session_id]);
    res.json({ ok: true, changes: result.rowCount });
  } catch (err) {
    console.error('[API] Error borrando inputs', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
