const jwt = require('jsonwebtoken');

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin' || role === 'supervisor' || role === 'analista') return role;
  return 'analista';
}

function normalizeLabs(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .slice(0, 2);
  }
  const raw = String(value || '').trim();
  return raw ? [raw] : [];
}

function extractBearerToken(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith('bearer ')) return raw.slice(7).trim() || null;
  return raw;
}

function requireUser(req, res, next) {
  const token = extractBearerToken(req.headers['x-user-token']);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing_user_token' });
  }

  const secret = req.app?.locals?.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || payload.type !== 'user') {
      return res.status(401).json({ ok: false, error: 'invalid_user_token' });
    }

    const userId = Number(payload.user_id);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'invalid_user_token' });
    }

    req.user = {
      id: userId,
      rol: normalizeRole(payload.rol),
      default_labs: normalizeLabs(payload.default_labs),
    };

    return next();
  } catch (_err) {
    return res.status(401).json({ ok: false, error: 'invalid_user_token' });
  }
}

function canAccessSession(user, sessionRow) {
  if (!user) return false;
  const role = normalizeRole(user.rol);
  if (role === 'admin') return true;

  const sessionUserId = Number(sessionRow?.usuario_id);
  if (sessionUserId && sessionUserId === Number(user.id)) return true;

  if (role === 'supervisor') {
    const labKey = String(sessionRow?.lab_key || '').trim();
    return Boolean(labKey) && Array.isArray(user.default_labs) && user.default_labs.includes(labKey);
  }

  return false;
}

function canMutateSession(user, sessionRow) {
  if (!user) return false;
  const role = normalizeRole(user.rol);
  if (role === 'admin') return true;
  return Number(sessionRow?.usuario_id) === Number(user.id);
}

async function assertSessionAccess(db, user, sessionId, { mutate = false } = {}) {
  const id = Number(sessionId);
  if (!id) {
    const err = new Error('invalid_session_id');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT id, usuario_id, lab_key
     FROM sessions
     WHERE id = $1`,
    [id]
  );
  const session = rows[0];
  if (!session) {
    const err = new Error('session_not_found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = mutate ? canMutateSession(user, session) : canAccessSession(user, session);
  if (!allowed) {
    const err = new Error('forbidden');
    err.statusCode = 403;
    throw err;
  }

  return session;
}

async function assertReportAccess(db, user, reportId, { mutate = false } = {}) {
  const id = Number(reportId);
  if (!id) {
    const err = new Error('invalid_report_id');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.query(
    `SELECT r.id, r.session_id, s.usuario_id, s.lab_key
     FROM reports r
     JOIN sessions s ON s.id = r.session_id
     WHERE r.id = $1`,
    [id]
  );
  const report = rows[0];
  if (!report) {
    const err = new Error('report_not_found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = mutate ? canMutateSession(user, report) : canAccessSession(user, report);
  if (!allowed) {
    const err = new Error('forbidden');
    err.statusCode = 403;
    throw err;
  }

  return report;
}

module.exports = {
  requireUser,
  normalizeRole,
  normalizeLabs,
  canAccessSession,
  canMutateSession,
  assertSessionAccess,
  assertReportAccess,
};

