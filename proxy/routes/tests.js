const pool = require('../db');
const express = require('express');
const router = express.Router();

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
