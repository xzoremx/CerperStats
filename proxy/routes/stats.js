const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireUser } = require('../lib/resourceAuth');

/**
 * GET /stats/dashboard
 * Estadísticas globales para el dashboard principal (menu.html)
 * Requiere autenticación.
 */
router.get('/dashboard', requireUser, async (req, res) => {
  try {
    const queries = await Promise.all([
      // Total de informes generados
      pool.query(`SELECT COUNT(*) as count FROM reports`),
      // Total de pruebas estadísticas activas
      pool.query(`SELECT COUNT(*) as count FROM tests_catalog WHERE activo = true`),
      // Total de laboratorios activos
      pool.query(`SELECT COUNT(*) as count FROM labs WHERE activo = true`),
      // Total de usuarios activos
      pool.query(`SELECT COUNT(*) as count FROM usuarios WHERE activo = true`),
      // Total de plantillas de informe (tipos únicos)
      pool.query(`SELECT COUNT(DISTINCT tipo_informe) as count FROM reports`)
    ]);

    const [reportsRes, testsRes, labsRes, usersRes, templatesRes] = queries;

    res.json({
      ok: true,
      data: {
        informes_generados: parseInt(reportsRes.rows[0].count, 10),
        pruebas_estadisticas: parseInt(testsRes.rows[0].count, 10),
        laboratorios: parseInt(labsRes.rows[0].count, 10),
        usuarios: parseInt(usersRes.rows[0].count, 10),
        plantillas_informe: parseInt(templatesRes.rows[0].count, 10)
      }
    });
  } catch (err) {
    console.error('[API] Error obteniendo stats dashboard:', err);
    res.status(500).json({ ok: false, error: 'db_error' });
  }
});

/**
 * GET /stats/user
 * Estadísticas filtradas según rol del usuario (procedure_select.html)
 * - admin: stats de todos los laboratorios
 * - supervisor: stats de sus laboratorios asignados (default_labs)
 * - analista: stats solo de sus propias sesiones
 * Requiere autenticación.
 */
router.get('/user', requireUser, async (req, res) => {
  const { id: userId, rol, default_labs } = req.user;

  try {
    let sessionsQuery, reusedQuery, reprocessedQuery;

    if (rol === 'admin') {
      // Admin: todas las sesiones de todos los labs
      sessionsQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions WHERE estado != 'cancelada'`
      );
      reusedQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions WHERE parent_session_id IS NOT NULL`
      );
      // Informes reprocesados: version_informe es string como 'v1.0', 'v2.0', etc.
      // Contamos reportes que no sean versión inicial (v1.0 o v1)
      reprocessedQuery = pool.query(
        `SELECT COUNT(*) as count FROM reports
         WHERE version_informe IS NOT NULL
         AND version_informe NOT IN ('v1.0', 'v1', '1.0', '1')`
      );
    } else if (rol === 'supervisor' && default_labs.length > 0) {
      // Supervisor: sesiones de sus laboratorios asignados
      sessionsQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions
         WHERE lab_key = ANY($1) AND estado != 'cancelada'`,
        [default_labs]
      );
      reusedQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions
         WHERE lab_key = ANY($1) AND parent_session_id IS NOT NULL`,
        [default_labs]
      );
      reprocessedQuery = pool.query(
        `SELECT COUNT(*) as count FROM reports r
         JOIN sessions s ON r.session_id = s.id
         WHERE s.lab_key = ANY($1)
         AND r.version_informe IS NOT NULL
         AND r.version_informe NOT IN ('v1.0', 'v1', '1.0', '1')`,
        [default_labs]
      );
    } else {
      // Analista (o supervisor sin labs): solo sus propias sesiones
      sessionsQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions
         WHERE usuario_id = $1 AND estado != 'cancelada'`,
        [userId]
      );
      reusedQuery = pool.query(
        `SELECT COUNT(*) as count FROM sessions
         WHERE usuario_id = $1 AND parent_session_id IS NOT NULL`,
        [userId]
      );
      reprocessedQuery = pool.query(
        `SELECT COUNT(*) as count FROM reports r
         JOIN sessions s ON r.session_id = s.id
         WHERE s.usuario_id = $1
         AND r.version_informe IS NOT NULL
         AND r.version_informe NOT IN ('v1.0', 'v1', '1.0', '1')`,
        [userId]
      );
    }

    const [sessionsRes, reusedRes, reprocessedRes] = await Promise.all([
      sessionsQuery,
      reusedQuery,
      reprocessedQuery
    ]);

    res.json({
      ok: true,
      data: {
        sesiones_guardadas: parseInt(sessionsRes.rows[0].count, 10),
        sesiones_reevaluadas: parseInt(reusedRes.rows[0].count, 10),
        informes_reprocesados: parseInt(reprocessedRes.rows[0].count, 10)
      }
    });
  } catch (err) {
    console.error('[API] Error obteniendo stats de usuario:', err.message, err.stack);
    console.error('[API] User context:', { userId, rol, default_labs });
    res.status(500).json({ ok: false, error: 'db_error', detail: err.message });
  }
});

module.exports = router;
