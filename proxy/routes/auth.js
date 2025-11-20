const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();
router.use(express.json());

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'missing_credentials' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM usuarios
       WHERE username = $1
         AND activo = true
       LIMIT 1`,
      [username]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: 'invalid_user' });
    }
    if (!user.hash_password || user.hash_password.trim() === '') {
      return res.json({ ok: true, user });
    }
    const isValid = await bcrypt.compare(password, user.hash_password);
    if (!isValid) {
      await pool.query(
        `INSERT INTO logs_sistema (usuario_id, accion, detalle)
         VALUES (
           (SELECT id FROM usuarios WHERE username = $1),
           'login_fallido',
           'Contraseña incorrecta'
         )`,
        [username]
      );
      return res.status(401).json({ ok: false, error: 'invalid_password' });
    }
    await pool.query(
      `INSERT INTO logs_sistema (usuario_id, accion, detalle)
       VALUES ($1, 'login_exitoso', 'Inicio de sesión correcto.')`,
      [user.id]
    );
    return res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        default_lab: user.default_lab,
        nombre_completo: user.nombre_completo || null,
      },
    });
  } catch (err) {
    console.error('[API] Error en login', err);
    return res.status(500).json({ ok: false, error: 'db_error' });
  }
});

module.exports = router;
