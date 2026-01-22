const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const labsRouter = require('./routes/labs');
const inputsRouter = require('./routes/inputs');
const sessionsRouter = require('./routes/sessions');
const evaluacionesRouter = require('./routes/evaluaciones');
const reportsRouter = require('./routes/reports');
const resultsRouter = require('./routes/results');
const authRouter = require('./routes/auth');
const testsRouter = require('./routes/tests');
const registerRouter = require('./routes/register');
const statsRouter = require('./routes/stats');
const runEvaluator = require('./lib/runEvaluator');

const SECRET_PATH = path.resolve(__dirname, '../secrets/token_secret.txt');
const SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim();

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: 'too_many_attempts', message: 'Demasiados intentos de login. Intente en 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'rate_limit_exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

app.set('trust proxy', 1);
app.locals.JWT_SECRET = SECRET;

// CORS configuration for Vercel frontend
app.use(cors({
  origin: [
    'https://cerperstats.vercel.app',
    'http://localhost:3000',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Servir archivos estáticos públicos (registro, etc.)
// Accesible en: http://tu-servidor:4000/
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (no auth required for monitoring)
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
    }
  });
});


// Token verification endpoint (needs token to verify it's valid)
// Must be defined BEFORE the general /auth router
app.get('/auth/verify', verifyToken, (req, res) => {
  // If we reach here, token is valid (verifyToken middleware passed)
  return res.json({
    ok: true,
    valid: true,
    client: req.client?.client || 'unknown',
    exp: req.client?.exp ? new Date(req.client.exp * 1000).toISOString() : null
  });
});

// Auth routes (login doesn't need token verification)
app.use('/auth', express.json({ limit: '5kb' }), authLimiter, authRouter);

// Public registration routes (no token required, rate limited)
// Limit payload size aggressively to mitigate abuse/DoS.
app.use('/register', express.json({ limit: '1kb' }), authLimiter, registerRouter);

// Default JSON body limit for the rest of the API.
app.use(express.json({ limit: '50mb' }));

app.use('/labs', apiLimiter, verifyToken, labsRouter);
app.use('/inputs', apiLimiter, verifyToken, inputsRouter);
app.use('/sessions', apiLimiter, verifyToken, sessionsRouter);
app.use('/evaluaciones', apiLimiter, verifyToken, evaluacionesRouter);
app.use('/reports', apiLimiter, verifyToken, reportsRouter);
app.use('/tests', apiLimiter, verifyToken, testsRouter);
app.use('/results', apiLimiter, verifyToken, resultsRouter);
app.use('/stats', apiLimiter, verifyToken, statsRouter);

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (!payload || typeof payload.client !== 'string' || !payload.client.trim()) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.client = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

app.post('/run-eval', verifyToken, async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.session_id) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  try {
    const json = await runEvaluator(payload);
    return res.json(json);
  } catch (err) {
    return res.status(500).json({
      error: err?.type || 'runner_error',
      details: err?.details || err?.message || 'runner_error',
    });
  }
});

const PORT = process.env.CERPER_PROXY_PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`[PROXY] Listening on ${PORT}`));

