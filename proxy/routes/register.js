const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();
router.use(express.json());

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
// ============================================
router.post('/', async (req, res) => {
  const { username, password, nombre_completo, email, rol, default_lab } = req.body || {};

  // Validaciones
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'username_password_required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ ok: false, error: 'username_too_short' });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'password_too_short' });
  }

  // Validar formato de username (solo letras, numeros, guiones y puntos)
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return res.status(400).json({ ok: false, error: 'invalid_username_format' });
  }

  // Validar rol (solo analista o supervisor permitidos en auto-registro)
  const allowedRoles = ['analista', 'supervisor'];
  const userRol = rol && allowedRoles.includes(rol) ? rol : 'analista';

  try {
    // Verificar si el username ya existe
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'username_exists' });
    }

    // Verificar si el email ya existe (si se proporciona)
    if (email) {
      const existingEmail = await pool.query(
        'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ ok: false, error: 'email_exists' });
      }
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hash_password = await bcrypt.hash(password, saltRounds);

    const insertUser = async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const result = await client.query(
          `
            INSERT INTO usuarios (username, hash_password, nombre_completo, email, default_lab, rol, activo)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id, username, nombre_completo, email, default_lab, rol, creado_en
          `,
          [username, hash_password, nombre_completo || null, email || null, default_lab || null, userRol]
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

    let result;
    try {
      result = await insertUser();
    } catch (err) {
      if (err?.code === '23505' && err?.constraint === 'usuarios_pkey') {
        const synced = await syncUsuariosIdSequence();
        if (synced) {
          result = await insertUser();
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    console.log('[REGISTER] Nuevo usuario registrado:', username);

    return res.status(201).json({
      ok: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        nombre_completo: result.rows[0].nombre_completo
      }
    });
  } catch (err) {
    console.error('[REGISTER] Error registrando usuario:', err);

    if (err?.code === '23505') {
      if (err?.constraint === 'usuarios_username_key') {
        return res.status(409).json({ ok: false, error: 'username_exists' });
      }

      if (err?.constraint === 'usuarios_pkey') {
        return res.status(500).json({ ok: false, error: 'db_sequence_out_of_sync' });
      }

      return res.status(409).json({ ok: false, error: 'duplicate_key' });
    }

    if (err?.code === '23503' && err?.constraint === 'fk_usuario_lab') {
      return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
    }

    return res.status(500).json({ ok: false, error: 'registration_failed' });
  }
});

module.exports = router;
