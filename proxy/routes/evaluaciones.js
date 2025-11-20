const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const runEvaluator = require('../lib/runEvaluator');

const router = express.Router();
const MANIFEST_PATH = path.resolve(__dirname, '../../modules/_common/modules_manifest.json');

function sanitizeEvals(rows) {
  return rows.map((r) => {
    const iconLib = r.icon_lib_sanitized || '';
    const iconValue =
      iconLib.startsWith('lucide:') && iconLib.length > 'lucide:'.length
        ? iconLib
        : 'lucide:bar-chart-2';
    return { ...r, icon_value: iconValue };
  });
}

router.get('/', async (req, res) => {
  const { lab_key, tipo_analisis, tipo_dato, modo_cualitativo } = req.query;
  if (!lab_key || !tipo_analisis || !tipo_dato) {
    return res.status(400).json({ ok: false, error: 'missing_filters' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT
         t.id, t.nombre_interno, t.titulo, t.categoria, t.descripcion,
         CASE
           WHEN t.icon_lib IS NOT NULL AND btrim(t.icon_lib) <> '' THEN
             'lucide:' || NULLIF(
               regexp_replace(
                 regexp_replace(lower(btrim(t.icon_lib)), '^lucide:', ''),
                 '[^a-z0-9\\-]', '', 'g'
               )
             , '')
           ELSE NULL
         END AS icon_lib_sanitized
       FROM tests_catalog t
       JOIN test_modules m ON m.catalog_id = t.id AND m.activo = true
       WHERE t.lab_key = $1
         AND t.tipo_analisis = $2
         AND t.tipo_dato = $3
         AND (t.modo_cualitativo IS NULL OR t.modo_cualitativo = $4)
       ORDER BY t.id ASC`,
      [lab_key, tipo_analisis, tipo_dato, modo_cualitativo || null]
    );
    res.json({ ok: true, data: sanitizeEvals(rows) });
  } catch (err) {
    console.error('[API] Error obteniendo evaluaciones', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

function loadManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { entries: [] };
  }
}

router.post('/run', async (req, res) => {
  const { session_id, catalog_ids } = req.body || {};
  if (!session_id || !Array.isArray(catalog_ids) || catalog_ids.length === 0) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
  try {
    const { rows: sessionRows } = await pool.query(
      `SELECT tipo_analisis, lab_key, usuario_id
       FROM sessions
       WHERE id = $1`,
      [session_id]
    );
    if (!sessionRows.length) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }
    const session = sessionRows[0];
    const tipo_analisis = session.tipo_analisis;
    const usuario_id = session.usuario_id;

    // Auditoría de selección de catálogos en la sesión
    await pool.query(
      `INSERT INTO session_selected_tests (session_id, catalog_id, selected_at)
       SELECT $1, cid, NOW()
       FROM UNNEST($2::int[]) AS cid
       ON CONFLICT (session_id, catalog_id) DO NOTHING`,
      [session_id, catalog_ids]
    );

    let dfIngreso = [];
    if (tipo_analisis === 'multi' || tipo_analisis === 'multianalito') {
      const { rows } = await pool.query(
        `SELECT analito, parametro, lectura_idx, valor
         FROM inputs_multianalito
         WHERE session_id = $1 AND valido = true
         ORDER BY parametro, analito, lectura_idx`,
        [session_id]
      );
      dfIngreso = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT parametro, lectura_idx, valor
         FROM inputs_monoanalito
         WHERE session_id = $1 AND valido = true
         ORDER BY parametro, lectura_idx`,
        [session_id]
      );
      dfIngreso = rows;
    }

    const placeholders = catalog_ids.map((_, idx) => `$${idx + 1}`).join(',');
    const { rows: testsRaw } = await pool.query(
      `SELECT t.id AS catalog_id,
              t.nombre_interno,
              m.module_id,
              m.version
       FROM tests_catalog t
       JOIN LATERAL (
         SELECT m2.id AS module_id, m2.version
         FROM test_modules m2
         WHERE m2.catalog_id = t.id AND m2.activo = true
         ORDER BY m2.fecha_publicacion DESC NULLS LAST, m2.id DESC
         LIMIT 1
       ) m ON true
       WHERE t.id IN (${placeholders})`,
      catalog_ids
    );
    if (!testsRaw.length) {
      return res.status(400).json({ ok: false, error: 'tests_not_found' });
    }

    const manifest = loadManifest();
    const byModuleId = new Map(
      (manifest.entries || [])
        .filter((entry) => entry && entry.module_id != null)
        .map((entry) => [String(entry.module_id), entry])
    );

    const verified = [];
    for (const t of testsRaw) {
      const manifestEntry = byModuleId.get(String(t.module_id));
      if (!manifestEntry) {
        console.warn(
          `[Modules] No hay entrada en manifest para module_id=${t.module_id} (catalog_id=${t.catalog_id})`
        );
        continue;
      }
      verified.push({
        module_id: t.module_id,
        catalog_id: t.catalog_id,
        nombre_interno: t.nombre_interno,
        version: t.version,
        runtime: manifestEntry.runtime || null,
      });
    }

    if (!verified.length) {
      return res.status(400).json({ ok: false, error: 'modules_manifest_missing' });
    }

    const evalPayload = {
      session_id,
      tipo_analisis,
      catalog_ids,
      df_ingreso: dfIngreso,
      tests: verified,
    };

    let evaluatorOutput;
    try {
      evaluatorOutput = await runEvaluator(evalPayload);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err?.type || 'runner_error',
        details: err?.details || err?.message || 'runner_error',
      });
    }

    const results = Array.isArray(evaluatorOutput)
      ? evaluatorOutput
      : Array.isArray(evaluatorOutput?.results)
        ? evaluatorOutput.results
        : null;

    if (!results) {
      return res.status(500).json({ ok: false, error: 'invalid_runner_output' });
    }

    for (const r of results) {
      if (!r.ok) {
        console.warn(`[EVAL] Falló módulo ${r.nombre}: ${r.error}`);
        continue;
      }
      await pool.query(
        `INSERT INTO results_general
         (session_id, catalog_id, resultado_pc, grafico_data, creado_en, usuario_id)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [session_id, r.catalog_id, r.resultado_pc, r.grafico_data || '', usuario_id]
      );
      try {
        await pool.query(
          `INSERT INTO logs_sistema (usuario_id, accion, detalle)
           VALUES ($1, 'modulo_ejecutado', $2)`,
          [usuario_id || null, `catalog_id=${r.catalog_id}`]
        );
      } catch (_) {}
    }

    console.log(`[EVAL] Resultados guardados correctamente (${results.length} módulos).`);
    res.json({ ok: true, count: results.length });
  } catch (err) {
    console.error('[API] Error ejecutando evaluaciones', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
