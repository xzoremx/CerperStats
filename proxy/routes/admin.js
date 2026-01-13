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

// Middleware: verificar que el usuario autenticado sea admin
// Nota: Este middleware asume que verifyToken ya fue aplicado y req.client existe
const requireAdmin = async (req, res, next) => {
  // Para el panel admin, usamos autenticación básica con credenciales de admin
  const authHeader = req.headers['x-admin-auth'];

  if (!authHeader) {
    return res.status(401).json({ ok: false, error: 'admin_auth_required' });
  }

  try {
    // Formato: username:password en base64
    const decoded = Buffer.from(authHeader, 'base64').toString('utf8');
    const [username, password] = decoded.split(':');

    if (!username || !password) {
      return res.status(401).json({ ok: false, error: 'invalid_admin_credentials' });
    }

    // Verificar que el usuario existe, está activo y es admin
    const { rows } = await pool.query(
      `SELECT id, username, hash_password, rol
       FROM usuarios
       WHERE LOWER(username) = LOWER($1) AND activo = true AND rol = 'admin'
       LIMIT 1`,
      [username]
    );

    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'not_admin' });
    }

    if (!admin.hash_password) {
      return res.status(401).json({ ok: false, error: 'admin_password_not_set' });
    }

    const isValid = await bcrypt.compare(password, admin.hash_password);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'invalid_admin_password' });
    }

    req.adminUser = admin;
    next();
  } catch (err) {
    console.error('[ADMIN] Auth error:', err);
    return res.status(500).json({ ok: false, error: 'auth_error' });
  }
};

// ============================================
// GET /admin/users - Listar todos los usuarios
// ============================================
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, username, nombre_completo, rol, sede, default_lab, activo, creado_en, actualizado_en
      FROM usuarios
      ORDER BY creado_en DESC
    `);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[ADMIN] Error listando usuarios:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// GET /admin/labs - Listar laboratorios para el select
// ============================================
router.get('/labs', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT lab_key, nombre
      FROM labs
      ORDER BY nombre
    `);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[ADMIN] Error listando labs:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// POST /admin/users - Crear nuevo usuario
// ============================================
router.post('/users', requireAdmin, async (req, res) => {
  const { username, password, nombre_completo, rol, sede, default_lab } = req.body || {};

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

  const validRoles = ['admin', 'supervisor', 'analista'];
  const userRol = rol && validRoles.includes(rol) ? rol : 'analista';

  if (sede !== undefined && sede !== null && sede !== '' && !allowedSedes.includes(sede)) {
    return res.status(400).json({ ok: false, error: 'invalid_sede' });
  }

  const normalizedDefaultLabs = normalizeDefaultLabs(default_lab);
  if (normalizedDefaultLabs?.error) {
    return res.status(400).json({ ok: false, error: normalizedDefaultLabs.error });
  }
  const defaultLabs = normalizedDefaultLabs?.labs || null;

  try {
    // Verificar si el username ya existe
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE username = $1',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'username_exists' });
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hash_password = await bcrypt.hash(password, saltRounds);

    if (defaultLabs) {
      const { rows } = await pool.query(
        `SELECT lab_key
         FROM labs
         WHERE lab_key = ANY($1::text[])`,
        [defaultLabs]
      );
      if (rows.length !== defaultLabs.length) {
        return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
      }
    }

    // Insertar usuario
    const result = await pool.query(`
      INSERT INTO usuarios (username, hash_password, nombre_completo, rol, sede, default_lab, activo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, username, nombre_completo, rol, sede, default_lab, activo, creado_en
    `, [username, hash_password, nombre_completo || null, userRol, sede || null, defaultLabs]);

    // Log de la acción
    await pool.query(`
      INSERT INTO logs_sistema (usuario_id, accion, detalle)
      VALUES ($1, 'usuario_creado', $2)
    `, [req.adminUser.id, `Creado usuario: ${username} (rol: ${userRol})`]);

    return res.status(201).json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN] Error creando usuario:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// PUT /admin/users/:id - Actualizar usuario
// ============================================
router.put('/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { nombre_completo, rol, sede, default_lab, activo, password } = req.body || {};

  if (isNaN(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid_user_id' });
  }

  try {
    // Verificar que el usuario existe
    const existing = await pool.query('SELECT id, username FROM usuarios WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nombre_completo !== undefined) {
      updates.push(`nombre_completo = $${paramIndex++}`);
      values.push(nombre_completo || null);
    }

    if (rol !== undefined) {
      const validRoles = ['admin', 'supervisor', 'analista'];
      if (validRoles.includes(rol)) {
        updates.push(`rol = $${paramIndex++}`);
        values.push(rol);
      }
    }

    if (sede !== undefined) {
      if (sede === null || sede === '') {
        updates.push(`sede = $${paramIndex++}`);
        values.push(null);
      } else if (allowedSedes.includes(sede)) {
        updates.push(`sede = $${paramIndex++}`);
        values.push(sede);
      } else {
        return res.status(400).json({ ok: false, error: 'invalid_sede' });
      }
    }

    if (default_lab !== undefined) {
      const normalized = normalizeDefaultLabs(default_lab);
      if (normalized?.error) {
        return res.status(400).json({ ok: false, error: normalized.error });
      }
      const defaultLabs = normalized?.labs || null;

      if (defaultLabs) {
        const { rows } = await pool.query(
          `SELECT lab_key
           FROM labs
           WHERE lab_key = ANY($1::text[])`,
          [defaultLabs]
        );
        if (rows.length !== defaultLabs.length) {
          return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
        }
      }

      updates.push(`default_lab = $${paramIndex++}`);
      values.push(defaultLabs);
    }

    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      values.push(Boolean(activo));
    }

    // Si se proporciona nueva contraseña
    if (password && password.length >= 6) {
      const hash_password = await bcrypt.hash(password, 10);
      updates.push(`hash_password = $${paramIndex++}`);
      values.push(hash_password);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'no_fields_to_update' });
    }

    values.push(userId);
    const result = await pool.query(`
      UPDATE usuarios
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, nombre_completo, rol, sede, default_lab, activo, actualizado_en
    `, values);

    // Log de la acción
    await pool.query(`
      INSERT INTO logs_sistema (usuario_id, accion, detalle)
      VALUES ($1, 'usuario_actualizado', $2)
    `, [req.adminUser.id, `Actualizado usuario ID: ${userId}`]);

    return res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN] Error actualizando usuario:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// DELETE /admin/users/:id - Eliminar usuario (soft delete)
// ============================================
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid_user_id' });
  }

  // No permitir que un admin se elimine a sí mismo
  if (userId === req.adminUser.id) {
    return res.status(400).json({ ok: false, error: 'cannot_delete_self' });
  }

  try {
    // Soft delete: marcar como inactivo
    const result = await pool.query(`
      UPDATE usuarios
      SET activo = false
      WHERE id = $1
      RETURNING id, username
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    // Log de la acción
    await pool.query(`
      INSERT INTO logs_sistema (usuario_id, accion, detalle)
      VALUES ($1, 'usuario_desactivado', $2)
    `, [req.adminUser.id, `Desactivado usuario: ${result.rows[0].username}`]);

    return res.json({ ok: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN] Error eliminando usuario:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
