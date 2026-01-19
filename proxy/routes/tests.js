const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireUser, assertSessionAccess } = require('../lib/resourceAuth');

router.use(requireUser);

// =====================================================
// Test Params CRUD (for parametrizable tests)
// =====================================================

/**
 * GET /tests/:catalogId/params-schema
 * Returns the user_input_schema for a parametrizable test
 */
router.get('/:catalogId/params-schema', async (req, res) => {
    const { catalogId } = req.params;

    if (!catalogId || isNaN(Number(catalogId))) {
        return res.status(400).json({ ok: false, error: 'invalid_catalog_id' });
    }

    try {
        const result = await pool.query(`
            SELECT
                tc.id AS catalog_id,
                tc.nombre_interno,
                tc.titulo,
                tm.parametros_json
            FROM tests_catalog tc
            LEFT JOIN test_modules tm ON tm.catalog_id = tc.id AND tm.activo = true
            WHERE tc.id = $1
        `, [catalogId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'test_not_found' });
        }

        const row = result.rows[0];
        const schema = row.parametros_json?.user_input_schema || null;

        return res.json({
            ok: true,
            data: {
                catalog_id: row.catalog_id,
                nombre_interno: row.nombre_interno,
                titulo: row.titulo,
                user_input_schema: schema,
                is_parametrizable: schema?.enabled === true
            }
        });
    } catch (err) {
        console.error('[TESTS] Error getting params schema:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /tests/session/:sessionId/params/:catalogId
 * Returns saved params for a test in a session
 */
router.get('/session/:sessionId/params/:catalogId', async (req, res) => {
    const { sessionId, catalogId } = req.params;

    if (!sessionId || isNaN(Number(sessionId))) {
        return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }
    if (!catalogId || isNaN(Number(catalogId))) {
        return res.status(400).json({ ok: false, error: 'invalid_catalog_id' });
    }

    try {
        await assertSessionAccess(pool, req.user, sessionId, { mutate: false });

        const result = await pool.query(`
            SELECT params_json, creado_en, actualizado_en
            FROM session_test_params
            WHERE session_id = $1 AND catalog_id = $2
        `, [sessionId, catalogId]);

        if (result.rows.length === 0) {
            return res.json({
                ok: true,
                data: null,
                has_params: false
            });
        }

        return res.json({
            ok: true,
            data: result.rows[0].params_json,
            has_params: true,
            creado_en: result.rows[0].creado_en,
            actualizado_en: result.rows[0].actualizado_en
        });
    } catch (err) {
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ ok: false, error: err.message });
        }
        console.error('[TESTS] Error getting test params:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /tests/session/:sessionId/params
 * Returns all saved params for a session (all tests)
 */
router.get('/session/:sessionId/params', async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId || isNaN(Number(sessionId))) {
        return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }

    try {
        await assertSessionAccess(pool, req.user, sessionId, { mutate: false });

        const result = await pool.query(`
            SELECT
                stp.catalog_id,
                stp.params_json,
                stp.creado_en,
                stp.actualizado_en,
                tc.nombre_interno,
                tc.titulo
            FROM session_test_params stp
            JOIN tests_catalog tc ON tc.id = stp.catalog_id
            WHERE stp.session_id = $1
        `, [sessionId]);

        return res.json({
            ok: true,
            data: result.rows
        });
    } catch (err) {
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ ok: false, error: err.message });
        }
        console.error('[TESTS] Error getting session params:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /tests/session/:sessionId/params/:catalogId
 * Save/update params for a test in a session
 * Body: { params: { ... } }
 */
router.post('/session/:sessionId/params/:catalogId', async (req, res) => {
    const { sessionId, catalogId } = req.params;
    const { params } = req.body || {};

    if (!sessionId || isNaN(Number(sessionId))) {
        return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }
    if (!catalogId || isNaN(Number(catalogId))) {
        return res.status(400).json({ ok: false, error: 'invalid_catalog_id' });
    }
    if (!params || typeof params !== 'object') {
        return res.status(400).json({ ok: false, error: 'invalid_params' });
    }

    try {
        await assertSessionAccess(pool, req.user, sessionId, { mutate: true });

        // Verify session exists
        const sessionCheck = await pool.query(
            'SELECT id FROM sessions WHERE id = $1',
            [sessionId]
        );
        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'session_not_found' });
        }

        // Verify test exists
        const testCheck = await pool.query(
            'SELECT id FROM tests_catalog WHERE id = $1',
            [catalogId]
        );
        if (testCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'test_not_found' });
        }

        // Upsert params
        const result = await pool.query(`
            INSERT INTO session_test_params (session_id, catalog_id, params_json)
            VALUES ($1, $2, $3)
            ON CONFLICT (session_id, catalog_id)
            DO UPDATE SET params_json = $3, actualizado_en = NOW()
            RETURNING id, params_json, creado_en, actualizado_en
        `, [sessionId, catalogId, JSON.stringify(params)]);

        console.log(`[TESTS] Saved params for session=${sessionId} catalog=${catalogId}:`, params);

        return res.json({
            ok: true,
            data: result.rows[0]
        });
    } catch (err) {
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ ok: false, error: err.message });
        }
        console.error('[TESTS] Error saving test params:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * DELETE /tests/session/:sessionId/params/:catalogId
 * Delete params for a test in a session
 */
router.delete('/session/:sessionId/params/:catalogId', async (req, res) => {
    const { sessionId, catalogId } = req.params;

    if (!sessionId || isNaN(Number(sessionId))) {
        return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }
    if (!catalogId || isNaN(Number(catalogId))) {
        return res.status(400).json({ ok: false, error: 'invalid_catalog_id' });
    }

    try {
        await assertSessionAccess(pool, req.user, sessionId, { mutate: true });

        const result = await pool.query(`
            DELETE FROM session_test_params
            WHERE session_id = $1 AND catalog_id = $2
            RETURNING id
        `, [sessionId, catalogId]);

        const deleted = result.rowCount > 0;
        console.log(`[TESTS] Deleted params for session=${sessionId} catalog=${catalogId}: ${deleted}`);

        return res.json({
            ok: true,
            deleted
        });
    } catch (err) {
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ ok: false, error: err.message });
        }
        console.error('[TESTS] Error deleting test params:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// =====================================================
// Formatting Config
// =====================================================

/**
 * GET /tests/formatting-config
 * Returns combined value_mappings and column_labels from all tests
 */
router.get('/formatting-config', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        id,
        nombre_interno,
        value_mappings,
        column_labels
      FROM tests_catalog
      WHERE value_mappings != '{}' OR column_labels != '{}'
    `);

        // Merge all value_mappings and column_labels into single objects
        const value_mappings = {};
        const column_labels = {};

        for (const row of result.rows) {
            // Merge value_mappings
            if (row.value_mappings && typeof row.value_mappings === 'object') {
                Object.assign(value_mappings, row.value_mappings);
            }
            // Merge column_labels (later entries override earlier ones)
            if (row.column_labels && typeof row.column_labels === 'object') {
                Object.assign(column_labels, row.column_labels);
            }
        }

        return res.json({
            ok: true,
            data: {
                value_mappings,
                column_labels
            }
        });
    } catch (err) {
        console.error('[TESTS] Error getting formatting config:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
