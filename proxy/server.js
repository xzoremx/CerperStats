const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SECRET_PATH = path.resolve(__dirname, '../secrets/token_secret.txt');
const SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim();

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

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

app.post('/run-eval', verifyToken, (req, res) => {
  const payload = req.body;
  if (!payload || !payload.session_id) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const tmpDir = fs.mkdtempSync('/tmp/eval_');
  const tmpPath = path.join(tmpDir, `eval_${Date.now()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');

  const runner = spawn('../.env/bin/python', [
    '../modules/_common/main.py',
    tmpPath,
  ], { cwd: process.cwd() });

  let stdout = '';
  let stderr = '';
  runner.stdout.on('data', (chunk) => { stdout += chunk; });
  runner.stderr.on('data', (chunk) => { stderr += chunk; });

  runner.on('close', (code) => {
    fs.unlinkSync(tmpPath);
    fs.rmdirSync(tmpDir);
    if (code !== 0) {
      return res.status(500).json({ error: 'runner_error', details: stderr });
    }
    try {
      const json = JSON.parse(stdout);
      return res.json(json);
    } catch (err) {
      return res.status(500).json({ error: 'invalid_runner_output', details: stdout });
    }
  });
});

const PORT = process.env.CERPER_PROXY_PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`[PROXY] Listening on ${PORT}`));

