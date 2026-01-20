const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

function normalizeDefaultLabs(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  const raw = String(value).trim();
  if (!raw) return [];
  return [raw];
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'missing_credentials' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM usuarios
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: 'invalid_user' });
    }
    if (!user.hash_password || user.hash_password.trim() === '') {
      await pool.query(
        `INSERT INTO logs_sistema (usuario_id, accion, detalle)
         VALUES ($1, 'login_fallido', 'Usuario sin contraseña configurada')`,
        [user.id]
      );
      return res.status(401).json({ ok: false, error: 'password_not_configured' });
    }
    const isValid = await bcrypt.compare(password, user.hash_password);
    if (!isValid) {
      await pool.query(
        `INSERT INTO logs_sistema (usuario_id, accion, detalle)
         VALUES (
           (SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1)),
           'login_fallido',
           'Contraseña incorrecta'
         )`,
        [username]
      );
      return res.status(401).json({ ok: false, error: 'invalid_password' });
    }

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        error: 'account_inactive',
        message: 'Su cuenta aún no ha sido activada por un administrador.',
      });
    }

    await pool.query(
      `INSERT INTO logs_sistema (usuario_id, accion, detalle)
       VALUES ($1, 'login_exitoso', 'Inicio de sesión correcto.')`,
      [user.id]
    );

    const defaultLabs = normalizeDefaultLabs(user.default_lab);
    const primaryDefaultLab = defaultLabs[0] || null;
    const secret = req.app?.locals?.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, error: 'server_misconfigured' });
    }

    const userToken = jwt.sign(
      {
        type: 'user',
        user_id: user.id,
        rol: user.rol,
        default_labs: defaultLabs,
      },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      user_token: userToken,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        // Keep legacy behavior: the "primary" default lab is the first element.
        default_lab: primaryDefaultLab,
        // New: optional list (max 2) for supervisors session review filters.
        default_labs: defaultLabs,
        nombre_completo: user.nombre_completo || null,
      },
    });
  } catch (err) {
    console.error('[API] Error en login', err);
    return res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
