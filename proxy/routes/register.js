const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

const allowedSedes = ['Paita', 'Chimbote', 'Arequipa', 'Callao'];

function normalizeDefaultLabs(value) {
  if (value == null) return null;

  const raw = Array.isArray(value) ? value : [value];
  const labs = [];

  for (const entry of raw) {
    const lab = (entry || '').toString().trim();
    if (!lab) continue;
    if (!labs.includes(lab)) labs.push(lab);
    if (labs.length > 2) return { error: 'invalid_default_lab' };
  }

  return labs.length ? { labs } : null;
}

function getGenericRegisterResponse() {
  return {
    ok: true,
    message:
      'Registro recibido correctamente. Su cuenta debe ser aprobada por un administrador para poder ingresar.',
  };
}

async function syncUsuariosIdSequence() {
  const { rows } = await pool.query(
    "SELECT pg_get_serial_sequence('public.usuarios', 'id') AS seq"
  );
  const seq = rows?.[0]?.seq;
  if (!seq) return false;

  await pool.query(
    `SELECT setval($1::regclass, (SELECT COALESCE(MAX(id), 0) + 1 FROM public.usuarios), false)`,
    [seq]
  );

  return true;
}

// ============================================
// GET /register/labs - Listar laboratorios disponibles (público)
// (Se mantiene por compatibilidad con UIs existentes)
// ============================================
router.get('/labs', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT lab_key, nombre
      FROM labs
      ORDER BY nombre
    `);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[REGISTER] Error listando labs:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// POST /register - Registro de nuevo usuario (público)
// Seguridad: rol forzado a 'analista', activo=false, username lowercase.
// Respuesta genérica para evitar enumeración.
// ============================================
router.post('/', async (req, res) => {
  const { username, password, nombre_completo, sede, default_lab } = req.body || {};

  const lowerUsername = (username || '').toString().trim().toLowerCase();
  const normalizedDefaultLabs = normalizeDefaultLabs(default_lab);
  if (normalizedDefaultLabs?.error) {
    return res.status(400).json({ ok: false, error: normalizedDefaultLabs.error });
  }
  const defaultLabs = normalizedDefaultLabs?.labs || null;

  if (!lowerUsername || !password) {
    return res.status(400).json({ ok: false, error: 'username_password_required' });
  }

  if (lowerUsername.length < 3) {
    return res.status(400).json({ ok: false, error: 'username_too_short' });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'password_too_short' });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(lowerUsername)) {
    return res.status(400).json({ ok: false, error: 'invalid_username_format' });
  }

  if (!sede || !allowedSedes.includes(sede)) {
    return res.status(400).json({ ok: false, error: 'invalid_sede' });
  }

  if (defaultLabs) {
    try {
      const { rows } = await pool.query(
        `SELECT lab_key
         FROM labs
         WHERE lab_key = ANY($1::text[])`,
        [defaultLabs]
      );
      if (rows.length !== defaultLabs.length) {
        return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
      }
    } catch (err) {
      console.error('[REGISTER] Error validando laboratorio:', err);
      return res.status(500).json({ ok: false, error: 'registration_failed' });
    }
  }

  const userRol = 'analista';
  const userActivo = false;

  try {
    const saltRounds = 10;
    const hash_password = await bcrypt.hash(password, saltRounds);

    const insertUser = async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const result = await client.query(
          `
            INSERT INTO usuarios (username, hash_password, nombre_completo, sede, default_lab, rol, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `,
          [lowerUsername, hash_password, nombre_completo || null, sede, defaultLabs, userRol, userActivo]
        );

        await client.query(
          `
            INSERT INTO logs_sistema (usuario_id, accion, detalle)
            VALUES ($1, 'registro_usuario', 'Usuario registrado via formulario publico')
          `,
          [result.rows[0].id]
        );

        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw err;
      } finally {
        client.release();
      }
    };

    try {
      await insertUser();
    } catch (err) {
      // No enumerar usuarios: si el username ya existe (case-insensitive), responder éxito genérico.
      if (
        err?.code === '23505' &&
        (err?.constraint === 'usuarios_username_key' || err?.constraint === 'idx_usuarios_username_lower')
      ) {
        return res.status(201).json(getGenericRegisterResponse());
      }

      // Mitigación: secuencia desincronizada (usuarios_pkey)
      if (err?.code === '23505' && err?.constraint === 'usuarios_pkey') {
        const synced = await syncUsuariosIdSequence();
        if (synced) {
          await insertUser();
          return res.status(201).json(getGenericRegisterResponse());
        }
      }

      throw err;
    }

    console.log('[REGISTER] Nuevo registro recibido:', lowerUsername);
    return res.status(201).json(getGenericRegisterResponse());
  } catch (err) {
    console.error('[REGISTER] Error registrando usuario:', err);

    if (err?.code === '23514' && err?.constraint === 'check_sede') {
      return res.status(400).json({ ok: false, error: 'invalid_sede' });
    }

    if (err?.code === '23514' && err?.constraint === 'check_default_lab_max2') {
      return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
    }

    // Si es duplicado pero no tenemos constraint name por alguna razón, responder genérico.
    if (err?.code === '23505') {
      return res.status(201).json(getGenericRegisterResponse());
    }

    return res.status(500).json({ ok: false, error: 'registration_failed' });
  }
});

module.exports = router;
