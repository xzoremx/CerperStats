const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /reports
 * Upload and save a generated PDF report
 * Body: {
 *   session_id: number,
 *   tipo_informe: string ('by_analito' | 'by_nivel' | 'by_analito_nivel' | 'unified'),
 *   version_informe: string,
 *   plan_json: object,
 *   pdf_base64: string,
 *   hash_documento: string,
 *   observaciones: string,
 *   usuario_id: number,
 *   tests_included: number[] (catalog_ids)
 * }
 */
router.post('/', async (req, res) => {
    const {
        session_id,
        tipo_informe,
        version_informe,
        plan_json,
        pdf_base64,
        hash_documento,
        observaciones,
        usuario_id,
        tests_included
    } = req.body || {};

    if (!session_id || !pdf_base64) {
        return res.status(400).json({ ok: false, error: 'invalid_payload', message: 'session_id and pdf_base64 are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Decode base64 to binary
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');

        // Insert report
        const { rows } = await client.query(
            `INSERT INTO reports (
        session_id, catalog_id, tipo_informe, version_informe, estado,
        plan_json, pdf_data, hash_documento, observaciones, usuario_id,
        creado_en, actualizado_en
      )
      VALUES ($1, NULL, $2, $3, 'generado', $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id`,
            [
                session_id,
                tipo_informe || 'resultado',
                version_informe || 'v1.0',
                plan_json ? JSON.stringify(plan_json) : null,
                pdfBuffer,
                hash_documento,
                observaciones,
                usuario_id
            ]
        );

        const reportId = rows[0]?.id;

        // Insert links to tests if provided
        if (reportId && Array.isArray(tests_included) && tests_included.length > 0) {
            const linkValues = tests_included.map((catalogId, idx) =>
                `($1, $${idx + 2}, $${tests_included.length + 2})`
            ).join(', ');

            await client.query(
                `INSERT INTO reports_tests_link (report_id, catalog_id, session_id)
         VALUES ${linkValues}
         ON CONFLICT DO NOTHING`,
                [reportId, ...tests_included, session_id]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true, report_id: reportId });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { }
        console.error('[API] Error saving report:', err);
        res.status(500).json({ ok: false, error: 'db_error', message: err.message });
    } finally {
        client.release();
    }
});

/**
 * GET /reports/session/:sessionId
 * List all reports for a session (metadata only, no PDF data)
 */
router.get('/session/:sessionId', async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    if (!sessionId) {
        return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT 
         r.id,
         r.session_id,
         r.tipo_informe,
         r.version_informe,
         r.estado,
         r.hash_documento,
         r.observaciones,
         r.creado_en,
         r.actualizado_en,
         r.plan_json,
         LENGTH(r.pdf_data) AS pdf_size_bytes,
         u.username AS usuario,
         COALESCE(
           (SELECT array_agg(rtl.catalog_id)
            FROM reports_tests_link rtl
            WHERE rtl.report_id = r.id),
           '{}'::integer[]
         ) AS tests_included
       FROM reports r
       LEFT JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.session_id = $1
       ORDER BY r.creado_en DESC`,
            [sessionId]
        );

        res.json({ ok: true, data: rows });
    } catch (err) {
        console.error('[API] Error listing reports:', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    }
});

/**
 * GET /reports/:reportId
 * Get report metadata (no PDF data)
 */
router.get('/:reportId', async (req, res) => {
    const reportId = Number(req.params.reportId);
    if (!reportId) {
        return res.status(400).json({ ok: false, error: 'invalid_report_id' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT 
         r.id,
         r.session_id,
         r.tipo_informe,
         r.version_informe,
         r.estado,
         r.hash_documento,
         r.observaciones,
         r.creado_en,
         r.actualizado_en,
         r.plan_json,
         LENGTH(r.pdf_data) AS pdf_size_bytes,
         u.username AS usuario
       FROM reports r
       LEFT JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.id = $1`,
            [reportId]
        );

        if (!rows.length) {
            return res.status(404).json({ ok: false, error: 'report_not_found' });
        }

        res.json({ ok: true, data: rows[0] });
    } catch (err) {
        console.error('[API] Error getting report:', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    }
});

/**
 * GET /reports/:reportId/pdf
 * Download the PDF file
 */
router.get('/:reportId/pdf', async (req, res) => {
    const reportId = Number(req.params.reportId);
    if (!reportId) {
        return res.status(400).json({ ok: false, error: 'invalid_report_id' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT pdf_data, tipo_informe, session_id, creado_en
       FROM reports
       WHERE id = $1`,
            [reportId]
        );

        if (!rows.length || !rows[0].pdf_data) {
            return res.status(404).json({ ok: false, error: 'report_not_found' });
        }

        const report = rows[0];
        const filename = `reporte_${report.tipo_informe}_session_${report.session_id}_${reportId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', report.pdf_data.length);
        res.send(report.pdf_data);
    } catch (err) {
        console.error('[API] Error downloading PDF:', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    }
});

/**
 * DELETE /reports/:reportId
 * Delete a report
 */
router.delete('/:reportId', async (req, res) => {
    const reportId = Number(req.params.reportId);
    if (!reportId) {
        return res.status(400).json({ ok: false, error: 'invalid_report_id' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete links first
        await client.query(
            'DELETE FROM reports_tests_link WHERE report_id = $1',
            [reportId]
        );

        // Delete report
        const result = await client.query(
            'DELETE FROM reports WHERE id = $1',
            [reportId]
        );

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'report_not_found' });
        }

        res.json({ ok: true, deleted: result.rowCount });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) { }
        console.error('[API] Error deleting report:', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    } finally {
        client.release();
    }
});

/**
 * PATCH /reports/:reportId/status
 * Update report status (e.g., 'generado' -> 'firmado' -> 'obsoleto')
 */
router.patch('/:reportId/status', async (req, res) => {
    const reportId = Number(req.params.reportId);
    const { estado } = req.body || {};

    if (!reportId) {
        return res.status(400).json({ ok: false, error: 'invalid_report_id' });
    }

    const validStates = ['generado', 'firmado', 'obsoleto'];
    if (!validStates.includes(estado)) {
        return res.status(400).json({ ok: false, error: 'invalid_status', valid: validStates });
    }

    try {
        const result = await pool.query(
            `UPDATE reports SET estado = $1, actualizado_en = NOW() WHERE id = $2`,
            [estado, reportId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, error: 'report_not_found' });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[API] Error updating report status:', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    }
});

module.exports = router;
