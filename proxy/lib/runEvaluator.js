const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..'); // /home/ubuntu/cerper-eval
const PYTHON_BIN = path.join(ROOT_DIR, '.env/bin/python');
const MAIN_SCRIPT = path.join(ROOT_DIR, 'modules/_common/main.py');
const WORKDIR = ROOT_DIR;


function cleanupTemp(tmpPath, tmpDir) {
  try {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch (_) {}
  try {
    if (tmpDir && fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  } catch (_) {}
}

async function runEvaluator(payload) {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval_'));
    const tmpPath = path.join(tmpDir, `eval_${Date.now()}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');

    const runner = spawn(PYTHON_BIN, [MAIN_SCRIPT, tmpPath], { cwd: WORKDIR });
    let stdout = '';
    let stderr = '';

    runner.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    runner.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    runner.on('close', (code) => {
      cleanupTemp(tmpPath, tmpDir);
      if (code !== 0) {
        const err = new Error('runner_error');
        err.type = 'runner_error';
        err.details = stderr.trim() || stdout.trim();
        return reject(err);
      }
      try {
        const json = JSON.parse(stdout);
        return resolve(json);
      } catch (parseErr) {
        parseErr.type = 'invalid_runner_output';
        parseErr.details = stdout;
        return reject(parseErr);
      }
    });
  });
}

module.exports = runEvaluator;
