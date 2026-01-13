const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

const allowedSedes = ['Paita', 'Chimbote', 'Arequipa', 'Callao'];

function normalizeUsernamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildUsernameFromFullName(fullName) {
  const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return { error: 'invalid_full_name' };

  const firstName = tokens[0];
  const apellidoPaterno = tokens[tokens.length - 2];

  const initial = normalizeUsernamePart(firstName).slice(0, 1);
  const paternal = normalizeUsernamePart(apellidoPaterno);

  if (!initial || !paternal) return { error: 'invalid_username_generation' };

  return { username: `${initial}.${paternal}` };
}

function randomAnalistaUsername() {
  const n = Math.floor(100 + Math.random() * 900); // 100-999
  return `analista_${n}`;
}

function formatFullNameForStorage(fullName) {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

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

function getGenericRegisterResponse(username) {
  return {
    ok: true,
    data: { username },
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
// Seguridad: rol forzado a 'analista', activo=false.
// Username autogenerado desde nombre + apellidos.
// Respuesta genérica para evitar enumeración.
// ============================================
router.post('/', async (req, res) => {
  const { password, nombre_completo, sede, default_lab } = req.body || {};

  const cleanedFullName = (nombre_completo || '').toString().trim().replace(/\s+/g, ' ');
  const formattedFullName = formatFullNameForStorage(cleanedFullName);
  const usernamePlan = buildUsernameFromFullName(cleanedFullName);
  if (usernamePlan?.error === 'invalid_full_name') {
    return res.status(400).json({ ok: false, error: 'invalid_full_name' });
  }
  const baseUsername = usernamePlan?.username || null;

  const normalizedDefaultLabs = normalizeDefaultLabs(default_lab);
  if (normalizedDefaultLabs?.error) {
    return res.status(400).json({ ok: false, error: normalizedDefaultLabs.error });
  }
  const defaultLabs = normalizedDefaultLabs?.labs || null;

  if (!password) {
    return res.status(400).json({ ok: false, error: 'username_password_required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'password_too_short' });
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

    const insertUser = async (candidateUsername) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const result = await client.query(
          `
            INSERT INTO usuarios (username, hash_password, nombre_completo, sede, default_lab, rol, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `,
          [candidateUsername, hash_password, formattedFullName || null, sede, defaultLabs, userRol, userActivo]
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

    const isUsernameUniqueViolation = (err) =>
      err?.code === '23505' &&
      (err?.constraint === 'usuarios_username_key' || err?.constraint === 'idx_usuarios_username_lower');

    const tryRandomFallback = async () => {
      for (let attempts = 0; attempts < 50; attempts += 1) {
        const randomCandidate = randomAnalistaUsername();
        try {
          await insertUser(randomCandidate);
          return randomCandidate;
        } catch (err) {
          if (err?.code === '23505' && err?.constraint === 'usuarios_pkey') {
            const synced = await syncUsuariosIdSequence();
            if (synced) {
              try {
                await insertUser(randomCandidate);
                return randomCandidate;
              } catch (retryErr) {
                if (isUsernameUniqueViolation(retryErr)) continue;
                throw retryErr;
              }
            }
          }
          if (isUsernameUniqueViolation(err)) continue;
          throw err;
        }
      }
      return null;
    };

    let createdUsername = null;

    const initialCandidate = baseUsername || randomAnalistaUsername();
    try {
      await insertUser(initialCandidate);
      createdUsername = initialCandidate;
    } catch (err) {
      // Mitigación: secuencia desincronizada (usuarios_pkey)
      if (err?.code === '23505' && err?.constraint === 'usuarios_pkey') {
        const synced = await syncUsuariosIdSequence();
        if (synced) {
          try {
            await insertUser(initialCandidate);
            createdUsername = initialCandidate;
          } catch (err2) {
            // Si después de sincronizar el username colisiona, ir a fallback
            if (isUsernameUniqueViolation(err2)) {
              createdUsername = await tryRandomFallback();
            } else {
              throw err2;
            }
          }
        }
      } else if (isUsernameUniqueViolation(err)) {
        // Evitar leaking de colisiones: fallback a username aleatorio no derivado del nombre.
        createdUsername = await tryRandomFallback();
      } else {
        throw err;
      }
    }

    if (!createdUsername) {
      // Si llegamos acá fue por colisiones reiteradas, usar un fallback más amplio.
      for (let attempts = 0; attempts < 50; attempts += 1) {
        const randomCandidate = `analista_${Math.floor(100000 + Math.random() * 900000)}`;
        try {
          await insertUser(randomCandidate);
          createdUsername = randomCandidate;
          break;
        } catch (err) {
          if (err?.code === '23505' && err?.constraint === 'usuarios_pkey') {
            const synced = await syncUsuariosIdSequence();
            if (synced) {
              try {
                await insertUser(randomCandidate);
                createdUsername = randomCandidate;
                break;
              } catch (retryErr) {
                if (isUsernameUniqueViolation(retryErr)) continue;
                throw retryErr;
              }
            }
          }
          if (isUsernameUniqueViolation(err)) continue;
          throw err;
        }
      }
    }

    if (!createdUsername) {
      return res.status(500).json({ ok: false, error: 'registration_failed' });
    }

    console.log('[REGISTER] Nuevo registro recibido:', createdUsername);
    return res.status(201).json(getGenericRegisterResponse(createdUsername));
  } catch (err) {
    console.error('[REGISTER] Error registrando usuario:', err);

    if (err?.code === '23514' && err?.constraint === 'check_sede') {
      return res.status(400).json({ ok: false, error: 'invalid_sede' });
    }

    if (err?.code === '23514' && err?.constraint === 'check_default_lab_max2') {
      return res.status(400).json({ ok: false, error: 'invalid_default_lab' });
    }

    return res.status(500).json({ ok: false, error: 'registration_failed' });
  }
});

module.exports = router;
