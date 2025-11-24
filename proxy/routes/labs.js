const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lab_key, nombre, descripcion, color, icon_lucide
       FROM labs
       WHERE activo = true
       ORDER BY id`
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[API] Error leyendo labs', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/:labKey', async (req, res) => {
  const { labKey } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
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
         icon_lucide,
         activo
       FROM labs
       WHERE lab_key = $1
       LIMIT 1`,
      [labKey]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'lab_not_found' });
    }
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('[API] Error leyendo lab por key', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.get('/:labKey/modes', async (req, res) => {
  const { labKey } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT tipo_dato, modo_cualitativo, valores_permitidos
       FROM lab_data_modes
       WHERE lab_key = $1 AND activo = true
       ORDER BY id ASC`,
      [labKey]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[API] Error leyendo lab modes', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
