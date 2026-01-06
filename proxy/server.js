const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const labsRouter = require('./routes/labs');
const inputsRouter = require('./routes/inputs');
const sessionsRouter = require('./routes/sessions');
const evaluacionesRouter = require('./routes/evaluaciones');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const testsRouter = require('./routes/tests');
const runEvaluator = require('./lib/runEvaluator');

const SECRET_PATH = path.resolve(__dirname, '../secrets/token_secret.txt');
const SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'too_many_attempts', message: 'Demasiados intentos de login. Intente en 15 minutos.' },
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use('/auth', authLimiter, authRouter);
app.use('/labs', apiLimiter, verifyToken, labsRouter);
app.use('/inputs', apiLimiter, verifyToken, inputsRouter);
app.use('/sessions', apiLimiter, verifyToken, sessionsRouter);
app.use('/evaluaciones', apiLimiter, verifyToken, evaluacionesRouter);
app.use('/reports', apiLimiter, verifyToken, reportsRouter);
app.use('/tests', apiLimiter, verifyToken, testsRouter);

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    req.client = jwt.verify(token, SECRET);
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

