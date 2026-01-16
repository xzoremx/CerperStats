const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireUser, assertSessionAccess } = require('../lib/resourceAuth');

router.use(requireUser);

/**
 * DELETE /results/:sessionId
 * Invalida/elimina todos los resultados de una sesión.
 * Se usa cuando los inputs de la sesión son actualizados,
 * ya que los resultados anteriores fueron calculados con datos diferentes.
 */
router.delete('/:sessionId', async (req, res) => {
    const session_id = Number(req.params.sessionId);
    if (!session_id) {
        return res.status(400).json({ ok: false, error: 'missing_session_id' });
    }

    try {
        await assertSessionAccess(pool, req.user, session_id, { mutate: true });
        const result = await pool.query(
            `DELETE FROM results_general WHERE session_id = $1`,
            [session_id]
        );

        console.log(`[API] Resultados eliminados para sesión ${session_id}: ${result.rowCount} registros`);

        res.json({ ok: true, deleted: result.rowCount });
    } catch (err) {
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ ok: false, error: err.message });
        }
        console.error('[API] Error eliminando resultados', err);
        res.status(500).json({ ok: false, error: 'db_error' });
    }
});

module.exports = router;
