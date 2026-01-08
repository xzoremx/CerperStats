const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const runEvaluator = require('../lib/runEvaluator');

const router = express.Router();
const MANIFEST_PATH = path.resolve(__dirname, '../../modules/_common/modules_manifest.json');

// Progreso en memoria (polling desde el cliente): /evaluaciones/progress/:session_id
const progressStore = new Map();
const PROGRESS_TTL_MS = Number(process.env.CERPER_PROGRESS_TTL_MS || 15 * 60 * 1000);

function isoNow() {
  return new Date().toISOString();
}

function clampInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function computePercent(numerator, denominator) {
  const n = clampInt(numerator);
  const d = clampInt(denominator);
  if (d <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

function getProgressSnapshot(entry) {
  if (!entry) return null;
  const { _cleanupTimer, ...publicEntry } = entry;
  return publicEntry;
}

function initProgress(sessionId) {
  const key = String(sessionId);
  const existing = progressStore.get(key);
  if (existing && existing.status === 'running') return { ok: false, error: 'already_running' };
  if (existing?._cleanupTimer) clearTimeout(existing._cleanupTimer);

  const entry = {
    session_id: sessionId,
    status: 'running',
    message: 'inicializando',
    total_tasks: 0,
    processed_tasks: 0,
    saved_results: 0,
    failed_tasks: 0,
    percent_tasks: 0,
    percent_saved: 0,
    started_at: isoNow(),
    updated_at: isoNow(),
    finished_at: null,
    current: null,
  };

  progressStore.set(key, entry);
  return { ok: true, entry };
}

function updateProgress(sessionId, patch = {}) {
  const key = String(sessionId);
  const entry = progressStore.get(key);
  if (!entry) return null;

  Object.assign(entry, patch);

  entry.total_tasks = clampInt(entry.total_tasks);
  entry.processed_tasks = clampInt(entry.processed_tasks);
  entry.saved_results = clampInt(entry.saved_results);
  entry.failed_tasks = clampInt(entry.failed_tasks);

  if (entry.total_tasks > 0) {
    entry.processed_tasks = Math.min(entry.processed_tasks, entry.total_tasks);
    entry.saved_results = Math.min(entry.saved_results, entry.total_tasks);
    entry.failed_tasks = Math.min(entry.failed_tasks, entry.total_tasks);
  }

  entry.percent_tasks = computePercent(entry.processed_tasks, entry.total_tasks);
  entry.percent_saved = computePercent(entry.saved_results, entry.total_tasks);
  if (
    entry.total_tasks <= 0 &&
    (entry.status === 'completed' || entry.status === 'completed_with_errors')
  ) {
    entry.percent_tasks = 100;
    entry.percent_saved = 100;
  }
  entry.updated_at = isoNow();
  return entry;
}

function bumpProgress(sessionId, delta = {}) {
  const key = String(sessionId);
  const entry = progressStore.get(key);
  if (!entry) return null;
  return updateProgress(sessionId, {
    processed_tasks: entry.processed_tasks + (delta.processed_tasks || 0),
    saved_results: entry.saved_results + (delta.saved_results || 0),
    failed_tasks: entry.failed_tasks + (delta.failed_tasks || 0),
  });
}

function finishProgress(sessionId, status, patch = {}) {
  const key = String(sessionId);
  const entry = progressStore.get(key);
  if (!entry) return null;

  if (entry._cleanupTimer) clearTimeout(entry._cleanupTimer);

  const merged = updateProgress(sessionId, {
    ...patch,
    status,
    finished_at: isoNow(),
    current: null,
  });

  const timer = setTimeout(() => {
    progressStore.delete(key);
  }, PROGRESS_TTL_MS);
  if (typeof timer.unref === 'function') timer.unref();

  entry._cleanupTimer = timer;
  return merged;
}

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

router.get('/progress/:session_id', (req, res) => {
  const sessionId = String(req.params.session_id || '');
  if (!sessionId) return res.status(400).json({ ok: false, error: 'missing_session_id' });
  const entry = progressStore.get(sessionId);
  if (!entry) return res.status(404).json({ ok: false, error: 'progress_not_found' });
  return res.json({ ok: true, data: getProgressSnapshot(entry) });
});

// Obtener gráficos (grafico_data) usando results_general (últimos gráficos disponibles por prueba)
router.get('/graficos/:session_id', async (req, res) => {
  const sessionId = Number(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }

  const maxTestsRaw = Number(process.env.CERPER_GRAFICOS_MAX_TESTS || 500);
  const maxTests = Number.isFinite(maxTestsRaw) ? Math.max(1, Math.min(500, Math.trunc(maxTestsRaw))) : 500;

  try {
    const { rows: metaRows } = await pool.query(
      `SELECT MAX(creado_en)::text AS last_run_at
       FROM results_general
       WHERE session_id = $1
         AND catalog_id IS NOT NULL
         AND btrim(grafico_data) LIKE 'data:image/%;base64,%'`,
      [sessionId]
    );
    const lastRunAt = metaRows?.[0]?.last_run_at || null;

    const { rows: latestRows } = await pool.query(
      `WITH latest_tests AS (
         SELECT
           rg.catalog_id,
           MAX(rg.creado_en) AS last_creado_en
         FROM results_general rg
         WHERE rg.session_id = $1
           AND rg.catalog_id IS NOT NULL
           AND btrim(rg.grafico_data) LIKE 'data:image/%;base64,%'
         GROUP BY rg.catalog_id
         ORDER BY last_creado_en DESC
         LIMIT $2
       )
       SELECT DISTINCT ON (rg.catalog_id, rg.nivel, rg.analito)
         rg.catalog_id,
         rg.nivel,
         rg.analito,
         btrim(rg.grafico_data) AS grafico_data,
         rg.creado_en,
         rg.conclusion_status,
         tc.titulo AS test_titulo,
         tc.nombre_interno
       FROM results_general rg
       LEFT JOIN tests_catalog tc ON tc.id = rg.catalog_id
       JOIN latest_tests lt ON lt.catalog_id = rg.catalog_id
       WHERE rg.session_id = $1
         AND btrim(rg.grafico_data) LIKE 'data:image/%;base64,%'
       ORDER BY rg.catalog_id ASC, rg.nivel ASC, rg.analito ASC, rg.creado_en DESC`,
      [sessionId, maxTests]
    );

    const data = latestRows || [];
    const selectedCatalogIds = [...new Set(data.map((r) => Number(r.catalog_id)).filter((n) => Number.isFinite(n)))].sort(
      (a, b) => a - b
    );

    return res.json({
      ok: true,
      data,
      meta: {
        session_id: sessionId,
        last_run_at: data.length ? lastRunAt : null,
        selected_catalog_ids: selectedCatalogIds,
      },
    });
  } catch (err) {
    console.error('[API] Error obteniendo gráficos', err);
    return res.status(500).json({ ok: false, error: 'db_error' });
  }
});

// Obtener resultados preliminares (resultado_pc) para la vista de dataframes
router.get('/resultados/:session_id', async (req, res) => {
  const sessionId = Number(req.params.session_id);
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }

  const maxTestsRaw = Number(process.env.CERPER_RESULTADOS_MAX_TESTS || 500);
  const maxTests = Number.isFinite(maxTestsRaw) ? Math.max(1, Math.min(500, Math.trunc(maxTestsRaw))) : 500;

  try {
    const { rows: metaRows } = await pool.query(
      `SELECT MAX(creado_en)::text AS last_run_at
       FROM results_general
       WHERE session_id = $1
         AND catalog_id IS NOT NULL
         AND resultado_pc IS NOT NULL`,
      [sessionId]
    );
    const lastRunAt = metaRows?.[0]?.last_run_at || null;

    const { rows: latestRows } = await pool.query(
      `WITH latest_tests AS (
         SELECT
           rg.catalog_id,
           MAX(rg.creado_en) AS last_creado_en
         FROM results_general rg
         WHERE rg.session_id = $1
           AND rg.catalog_id IS NOT NULL
           AND rg.resultado_pc IS NOT NULL
         GROUP BY rg.catalog_id
         ORDER BY last_creado_en DESC
         LIMIT $2
       )
       SELECT DISTINCT ON (rg.catalog_id, rg.nivel, rg.analito)
         rg.id,
         rg.catalog_id,
         rg.nivel,
         rg.analito,
         rg.resultado_pc,
         rg.conclusion,
         rg.conclusion_status,
         rg.creado_en,
         tc.titulo AS test_titulo,
         tc.nombre_interno,
         tc.categoria,
         tc.descripcion
       FROM results_general rg
       LEFT JOIN tests_catalog tc ON tc.id = rg.catalog_id
       JOIN latest_tests lt ON lt.catalog_id = rg.catalog_id
       WHERE rg.session_id = $1
         AND rg.resultado_pc IS NOT NULL
       ORDER BY rg.catalog_id ASC, rg.nivel ASC, rg.analito ASC, rg.creado_en DESC`,
      [sessionId, maxTests]
    );

    const data = latestRows || [];
    const selectedCatalogIds = [...new Set(data.map((r) => Number(r.catalog_id)).filter((n) => Number.isFinite(n)))].sort(
      (a, b) => a - b
    );

    return res.json({
      ok: true,
      data,
      meta: {
        session_id: sessionId,
        last_run_at: data.length ? lastRunAt : null,
        selected_catalog_ids: selectedCatalogIds,
      },
    });
  } catch (err) {
    console.error('[API] Error obteniendo resultados', err);
    return res.status(500).json({ ok: false, error: 'db_error' });
  }
});

router.post('/run', async (req, res) => {
  console.log('[EVAL-ROUTE] POST /run recibido:', { session_id: req.body?.session_id, catalog_ids: req.body?.catalog_ids });

  const { session_id, catalog_ids } = req.body || {};
  if (!session_id || !Array.isArray(catalog_ids) || catalog_ids.length === 0) {
    console.log('[EVAL-ROUTE] Payload inválido');
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }

  const progressInit = initProgress(session_id);
  if (!progressInit.ok) {
    return res.status(409).json({ ok: false, error: progressInit.error });
  }
  updateProgress(session_id, { message: 'preparando_evaluacion', current: null });

  console.log(`[EVAL-ROUTE] Procesando sesión ${session_id} con ${catalog_ids.length} tests`);

  // === VALIDATION PHASE (synchronous - must complete before response) ===
  let session, tipo_analisis, usuario_id, dfIngresoConNivel, isMultianalito;
  let niveles, analitos, totalAnalitos, nivelesPorAnalito, verified, nivelesConDatos;

  try {
    const { rows: sessionRows } = await pool.query(
      `SELECT tipo_analisis, lab_key, usuario_id
       FROM sessions
       WHERE id = $1`,
      [session_id]
    );
    if (!sessionRows.length) {
      finishProgress(session_id, 'failed', { message: 'session_not_found' });
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }
    session = sessionRows[0];
    tipo_analisis = session.tipo_analisis;
    usuario_id = session.usuario_id;

    updateProgress(session_id, { message: 'cargando_inputs', tipo_analisis });

    // Auditoría de selección de catálogos en la sesión
    await pool.query(
      `INSERT INTO session_selected_tests (session_id, catalog_id, selected_at)
       SELECT $1, cid, NOW()
       FROM UNNEST($2::int[]) AS cid
       ON CONFLICT (session_id, catalog_id)
       DO UPDATE SET selected_at = EXCLUDED.selected_at`,
      [session_id, catalog_ids]
    );

    console.log(`[EVAL-ROUTE] Tipo análisis: ${tipo_analisis}, Usuario: ${usuario_id}`);

    // Obtener datos con nivel para identificar niveles únicos
    dfIngresoConNivel = [];
    console.log(`[EVAL-ROUTE] Consultando datos para sesión ${session_id}...`);
    if (tipo_analisis === 'multi' || tipo_analisis === 'multianalito') {
      const { rows } = await pool.query(
        `SELECT analito, parametro, nivel, lectura_idx, valor
         FROM inputs_multianalito
         WHERE session_id = $1 AND valido = true
         ORDER BY parametro, analito, nivel, lectura_idx`,
        [session_id]
      );
      dfIngresoConNivel = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT parametro, nivel, lectura_idx, valor
         FROM inputs_monoanalito
         WHERE session_id = $1 AND valido = true
         ORDER BY parametro, nivel, lectura_idx`,
        [session_id]
      );
      dfIngresoConNivel = rows;
    }

    console.log(`[EVAL-ROUTE] Total registros obtenidos: ${dfIngresoConNivel.length}`);

    // Determinar si es multianalito
    isMultianalito = (tipo_analisis === 'multi' || tipo_analisis === 'multianalito');

    // Obtener niveles únicos (convertir a número para asegurar tipo consistente)
    niveles = [...new Set(dfIngresoConNivel.map(d => Number(d.nivel) || 1))].sort((a, b) => a - b);
    if (niveles.length === 0) niveles.push(1);

    // Para multianalito: obtener analitos únicos y calcular total
    analitos = [];
    totalAnalitos = 0;
    nivelesPorAnalito = null;
    if (isMultianalito) {
      analitos = [...new Set(dfIngresoConNivel.map(d => d.analito).filter(Boolean))].sort();
      totalAnalitos = analitos.length;
      console.log(`[EVAL-ROUTE] Analitos detectados: ${analitos.join(', ')} (total: ${totalAnalitos})`);

      nivelesPorAnalito = new Map();
      for (const row of dfIngresoConNivel) {
        if (!row?.analito) continue;
        const key = row.analito;
        const lvl = Number(row.nivel) || 1;
        const set = nivelesPorAnalito.get(key) || new Set();
        set.add(lvl);
        nivelesPorAnalito.set(key, set);
      }
    }

    console.log(`[EVAL-ROUTE] Niveles detectados: ${niveles.join(', ')} (total: ${niveles.length})`);

    if (dfIngresoConNivel.length > 0) {
      const exampleFields = isMultianalito
        ? { nivel: dfIngresoConNivel[0].nivel, parametro: dfIngresoConNivel[0].parametro, analito: dfIngresoConNivel[0].analito }
        : { nivel: dfIngresoConNivel[0].nivel, parametro: dfIngresoConNivel[0].parametro };
      console.log(`[EVAL-ROUTE] Ejemplo de registro:`, exampleFields);
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
      finishProgress(session_id, 'failed', { message: 'tests_not_found' });
      return res.status(400).json({ ok: false, error: 'tests_not_found' });
    }

    const manifest = loadManifest();
    const byModuleId = new Map(
      (manifest.entries || [])
        .filter((entry) => entry && entry.module_id != null)
        .map((entry) => [String(entry.module_id), entry])
    );

    verified = [];
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
      finishProgress(session_id, 'failed', { message: 'modules_manifest_missing' });
      return res.status(400).json({ ok: false, error: 'modules_manifest_missing' });
    }

    // Inicializar totales de progreso (tareas = módulos × combinaciones con datos)
    nivelesConDatos = isMultianalito
      ? []
      : niveles.filter((nivel) => dfIngresoConNivel.some((d) => (Number(d.nivel) || 1) === nivel));

    const totalCombinaciones = isMultianalito
      ? analitos.reduce((sum, analito) => sum + (nivelesPorAnalito?.get(analito)?.size || 0), 0)
      : nivelesConDatos.length;

    const totalTasks = verified.length * totalCombinaciones;
    updateProgress(session_id, {
      message: 'ejecutando',
      total_tasks: totalTasks,
      processed_tasks: 0,
      saved_results: 0,
      failed_tasks: 0,
    });

  } catch (err) {
    console.error('[EVAL-ROUTE] Error en fase de validación:', err);
    finishProgress(session_id, 'failed', { message: 'validation_error' });
    return res.status(500).json({ ok: false, error: 'validation_error' });
  }

  // === RESPOND IMMEDIATELY - Background processing will continue ===
  res.json({ ok: true, status: 'started', session_id });
  console.log(`[EVAL-ROUTE] Respuesta enviada, iniciando procesamiento en background para sesión ${session_id}`);

  // === BACKGROUND PROCESSING (async, not awaited) ===
  (async () => {
    let totalResults = 0;

    try {
      if (isMultianalito) {
        // MULTIANALITO: Iterar por analito × nivel
        console.log(`[EVAL] Iniciando procesamiento MULTIANALITO: ${analitos.length} analitos × ${niveles.length} niveles`);

        for (const analito of analitos) {
          const nivelesDisponibles = [...(nivelesPorAnalito?.get(analito) || [])].sort((a, b) => a - b);
          for (const nivel of nivelesDisponibles) {
            console.log(`[EVAL] === INICIO PROCESAMIENTO: analito=${analito}, nivel=${nivel} ===`);
            updateProgress(session_id, { current: { analito, nivel }, message: 'ejecutando' });

            // Filtrar datos para este analito y nivel específicos
            const dfIngreso = dfIngresoConNivel
              .filter(d => d.analito === analito && (Number(d.nivel) || 1) === nivel)
              .map(d => {
                const { nivel: _, analito: __, ...rest } = d;
                return rest;
              });

            console.log(`[EVAL] Procesando analito=${analito}, nivel=${nivel}: ${dfIngreso.length} registros encontrados`);

            if (dfIngreso.length === 0) {
              console.warn(`[EVAL] No hay datos para analito=${analito}, nivel=${nivel}, saltando...`);
              continue;
            }

            const evalPayload = {
              session_id,
              tipo_analisis,
              catalog_ids,
              df_ingreso: dfIngreso,
              tests: verified,
              total_analitos: totalAnalitos, // Pasar cantidad total de analitos
              current_analito: analito, // Nombre del analito actual para etiquetas/tablas
            };

            let evaluatorOutput;
            try {
              console.log(`[EVAL] Ejecutando evaluador para analito=${analito}, nivel=${nivel}...`);
              evaluatorOutput = await runEvaluator(evalPayload);
              console.log(`[EVAL] Evaluador completado para analito=${analito}, nivel=${nivel}`);
            } catch (err) {
              console.error(`[EVAL] Error en analito=${analito}, nivel=${nivel}:`, err);
              console.error(`[EVAL] Continuando con siguiente combinación...`);
              bumpProgress(session_id, { processed_tasks: verified.length, failed_tasks: verified.length });
              continue;
            }

            const results = Array.isArray(evaluatorOutput)
              ? evaluatorOutput
              : Array.isArray(evaluatorOutput?.results)
                ? evaluatorOutput.results
                : null;

            if (!results) {
              console.error(`[EVAL] Output inválido para analito=${analito}, nivel=${nivel}, tipo: ${typeof evaluatorOutput}`);
              bumpProgress(session_id, { processed_tasks: verified.length, failed_tasks: verified.length });
              continue;
            }

            console.log(`[EVAL] analito=${analito}, nivel=${nivel}: ${results.length} resultados obtenidos`);

            // Guardar resultados con el analito y nivel correspondientes
            for (const r of results) {
              bumpProgress(session_id, { processed_tasks: 1 });
              if (!r.ok) {
                console.warn(`[EVAL] Falló módulo ${r.nombre || r.catalog_id} en analito=${analito}, nivel=${nivel}: ${r.error}`);
                bumpProgress(session_id, { failed_tasks: 1 });
                continue;
              }

              try {
                const insertResult = await pool.query(
                  `INSERT INTO results_general
                 (session_id, catalog_id, resultado_pc, grafico_data, creado_en, usuario_id, nivel, analito, conclusion, conclusion_status)
                 VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
                 RETURNING id, nivel, analito, conclusion, conclusion_status`,
                  [
                    session_id,
                    r.catalog_id,
                    r.resultado_pc,
                    r.grafico_data || '',
                    usuario_id,
                    nivel,
                    analito, // Usar el analito real
                    r.conclusion || null, // Conclusión del módulo Python
                    r.conclusion_status || null // Status de conclusión del módulo Python
                  ]
                );
                const insertedRow = insertResult.rows[0];
                console.log(`[EVAL] ✓ Resultado guardado: id=${insertedRow.id}, catalog_id=${r.catalog_id}, analito=${insertedRow.analito}, nivel=${insertedRow.nivel || nivel}`);
                bumpProgress(session_id, { saved_results: 1 });

                try {
                  await pool.query(
                    `INSERT INTO logs_sistema (usuario_id, accion, detalle)
                   VALUES ($1, 'modulo_ejecutado', $2)`,
                    [usuario_id || null, `catalog_id=${r.catalog_id}, analito=${analito}, nivel=${nivel}`]
                  );
                } catch (logErr) {
                  console.warn(`[EVAL] Error insertando log (no crítico):`, logErr.message);
                }

                totalResults++;
              } catch (insertErr) {
                console.error(`[EVAL] Error insertando resultado para catalog_id=${r.catalog_id}, analito=${analito}, nivel=${nivel}:`, insertErr.message);
                console.error(`[EVAL] Stack del error:`, insertErr.stack);
                bumpProgress(session_id, { failed_tasks: 1 });
              }
            }

            console.log(`[EVAL] === FIN PROCESAMIENTO: analito=${analito}, nivel=${nivel} (${totalResults} resultados guardados hasta ahora) ===`);
          }
        }

        console.log(`[EVAL] ==========================================`);
        console.log(`[EVAL] PROCESAMIENTO MULTIANALITO COMPLETADO: ${totalResults} módulos procesados en ${analitos.length} analitos × ${niveles.length} niveles`);
        console.log(`[EVAL] ==========================================`);

      } else {
        // MONOANALITO: Iterar solo por nivel
        console.log(`[EVAL] Iniciando procesamiento MONOANALITO: ${niveles.length} niveles: [${niveles.join(', ')}]`);

        for (const nivel of nivelesConDatos) {
          console.log(`[EVAL] === INICIO PROCESAMIENTO NIVEL ${nivel} ===`);
          updateProgress(session_id, { current: { nivel }, message: 'ejecutando' });

          // Filtrar datos para este nivel (convertir a número para comparación correcta)
          const dfIngreso = dfIngresoConNivel
            .filter(d => (Number(d.nivel) || 1) === nivel)
            .map(d => {
              const { nivel: _, ...rest } = d;
              return rest;
            });

          console.log(`[EVAL] Procesando nivel ${nivel}: ${dfIngreso.length} registros encontrados de ${dfIngresoConNivel.length} totales`);

          if (dfIngreso.length === 0) {
            console.warn(`[EVAL] No hay datos para nivel ${nivel}, saltando...`);
            continue;
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
            console.log(`[EVAL] Ejecutando evaluador para nivel ${nivel}...`);
            evaluatorOutput = await runEvaluator(evalPayload);
            console.log(`[EVAL] Evaluador completado para nivel ${nivel}`);
          } catch (err) {
            console.error(`[EVAL] Error en nivel ${nivel}:`, err);
            console.error(`[EVAL] Continuando con siguiente nivel...`);
            bumpProgress(session_id, { processed_tasks: verified.length, failed_tasks: verified.length });
            continue;
          }

          const results = Array.isArray(evaluatorOutput)
            ? evaluatorOutput
            : Array.isArray(evaluatorOutput?.results)
              ? evaluatorOutput.results
              : null;

          if (!results) {
            console.error(`[EVAL] Output inválido para nivel ${nivel}, tipo: ${typeof evaluatorOutput}`);
            bumpProgress(session_id, { processed_tasks: verified.length, failed_tasks: verified.length });
            continue;
          }

          console.log(`[EVAL] Nivel ${nivel}: ${results.length} resultados obtenidos`);

          // Guardar resultados con el nivel correspondiente
          for (const r of results) {
            bumpProgress(session_id, { processed_tasks: 1 });
            if (!r.ok) {
              console.warn(`[EVAL] Falló módulo ${r.nombre || r.catalog_id} en nivel ${nivel}: ${r.error}`);
              bumpProgress(session_id, { failed_tasks: 1 });
              continue;
            }

            try {
              const insertResult = await pool.query(
                `INSERT INTO results_general
               (session_id, catalog_id, resultado_pc, grafico_data, creado_en, usuario_id, nivel, analito, conclusion, conclusion_status)
               VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
               RETURNING id, nivel, conclusion, conclusion_status`,
                [
                  session_id,
                  r.catalog_id,
                  r.resultado_pc,
                  r.grafico_data || '',
                  usuario_id,
                  nivel,
                  'Analito', // Valor por defecto para monoanalito
                  r.conclusion || null, // Conclusión del módulo Python
                  r.conclusion_status || null // Status de conclusión del módulo Python
                ]
              );
              const insertedRow = insertResult.rows[0];
              console.log(`[EVAL] ✓ Resultado guardado: id=${insertedRow.id}, catalog_id=${r.catalog_id}, nivel=${insertedRow.nivel || nivel}`);
              bumpProgress(session_id, { saved_results: 1 });

              try {
                await pool.query(
                  `INSERT INTO logs_sistema (usuario_id, accion, detalle)
                 VALUES ($1, 'modulo_ejecutado', $2)`,
                  [usuario_id || null, `catalog_id=${r.catalog_id}, nivel=${nivel}`]
                );
              } catch (logErr) {
                console.warn(`[EVAL] Error insertando log (no crítico):`, logErr.message);
              }

              totalResults++;
            } catch (insertErr) {
              console.error(`[EVAL] Error insertando resultado para catalog_id=${r.catalog_id}, nivel=${nivel}:`, insertErr.message);
              console.error(`[EVAL] Stack del error:`, insertErr.stack);
              bumpProgress(session_id, { failed_tasks: 1 });
            }
          }

          console.log(`[EVAL] === FIN PROCESAMIENTO NIVEL ${nivel} (${totalResults} resultados guardados hasta ahora) ===`);
        }

        console.log(`[EVAL] ==========================================`);
        console.log(`[EVAL] PROCESAMIENTO MONOANALITO COMPLETADO: ${totalResults} módulos procesados en ${niveles.length} niveles`);
        console.log(`[EVAL] ==========================================`);
      }

      const finalEntry = progressStore.get(String(session_id));
      const incomplete =
        finalEntry && finalEntry.total_tasks > 0 && finalEntry.processed_tasks < finalEntry.total_tasks;
      const finalStatus =
        !finalEntry || incomplete || finalEntry.failed_tasks > 0 ? 'completed_with_errors' : 'completed';

      finishProgress(session_id, finalStatus, { message: finalStatus });

      console.log(`[EVAL-ROUTE] Background processing finished: ${totalResults} results, status=${finalStatus}`);
    } catch (err) {
      console.error('[EVAL-ROUTE] Error en procesamiento background:', err);
      finishProgress(session_id, 'failed', { message: 'failed' });
    }
  })();
});

module.exports = router;

