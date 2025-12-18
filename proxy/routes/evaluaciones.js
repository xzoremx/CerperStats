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
  console.log('[EVAL-ROUTE] POST /run recibido:', { session_id: req.body?.session_id, catalog_ids: req.body?.catalog_ids });
  
  const { session_id, catalog_ids } = req.body || {};
  if (!session_id || !Array.isArray(catalog_ids) || catalog_ids.length === 0) {
    console.log('[EVAL-ROUTE] Payload inválido');
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
  
  console.log(`[EVAL-ROUTE] Procesando sesión ${session_id} con ${catalog_ids.length} tests`);
  
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

    console.log(`[EVAL-ROUTE] Tipo análisis: ${tipo_analisis}, Usuario: ${usuario_id}`);
    
    // Obtener datos con nivel para identificar niveles únicos
    let dfIngresoConNivel = [];
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
    
    // Obtener niveles únicos (convertir a número para asegurar tipo consistente)
    const niveles = [...new Set(dfIngresoConNivel.map(d => Number(d.nivel) || 1))].sort((a, b) => a - b);
    if (niveles.length === 0) niveles.push(1);

    console.log(`[EVAL-ROUTE] Niveles detectados: ${niveles.join(', ')} (total: ${niveles.length})`);
    
    if (dfIngresoConNivel.length > 0) {
      console.log(`[EVAL-ROUTE] Ejemplo de registro (primeros 3 niveles):`, 
        dfIngresoConNivel.slice(0, 3).map(d => ({ nivel: d.nivel, parametro: d.parametro }))
      );
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

    // Iterar sobre cada nivel y procesar por separado
    let totalResults = 0;
    console.log(`[EVAL] Iniciando procesamiento de ${niveles.length} niveles: [${niveles.join(', ')}]`);
    
    for (const nivel of niveles) {
      console.log(`[EVAL] === INICIO PROCESAMIENTO NIVEL ${nivel} ===`);
      
      // Filtrar datos para este nivel (convertir a número para comparación correcta)
      const dfIngreso = dfIngresoConNivel
        .filter(d => Number(d.nivel) === nivel)
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
        continue; // Continuar con siguiente nivel
      }

      const results = Array.isArray(evaluatorOutput)
        ? evaluatorOutput
        : Array.isArray(evaluatorOutput?.results)
          ? evaluatorOutput.results
          : null;

      if (!results) {
        console.error(`[EVAL] Output inválido para nivel ${nivel}, tipo: ${typeof evaluatorOutput}`);
        continue;
      }

      console.log(`[EVAL] Nivel ${nivel}: ${results.length} resultados obtenidos`);

      // Guardar resultados con el nivel correspondiente
      for (const r of results) {
        if (!r.ok) {
          console.warn(`[EVAL] Falló módulo ${r.nombre || r.catalog_id} en nivel ${nivel}: ${r.error}`);
          continue;
        }
        
        try {
          // Insertar resultado en results_general con el nivel correspondiente
          const insertResult = await pool.query(
            `INSERT INTO results_general
             (session_id, catalog_id, resultado_pc, grafico_data, creado_en, usuario_id, nivel, analito)
             VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
             RETURNING id, nivel`,
            [
              session_id,
              r.catalog_id,
              r.resultado_pc,
              r.grafico_data || '',
              usuario_id,
              nivel,
              null // analito es null por ahora (no viene en los resultados del módulo)
            ]
          );
          const insertedRow = insertResult.rows[0];
          console.log(`[EVAL] ✓ Resultado guardado: id=${insertedRow.id}, catalog_id=${r.catalog_id}, nivel=${insertedRow.nivel || nivel}`);
          
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
          // Continuar con siguiente resultado en lugar de fallar todo el nivel
        }
      }
      
      console.log(`[EVAL] === FIN PROCESAMIENTO NIVEL ${nivel} (${totalResults} resultados guardados hasta ahora) ===`);
    }

    console.log(`[EVAL] ==========================================`);
    console.log(`[EVAL] PROCESAMIENTO COMPLETADO: ${totalResults} módulos procesados en ${niveles.length} niveles`);
    console.log(`[EVAL] ==========================================`);
    res.json({ ok: true, count: totalResults, niveles: niveles.length });
  } catch (err) {
    console.error('[API] Error ejecutando evaluaciones', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
