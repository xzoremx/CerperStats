const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const DEFAULT_CERT_PATH = '/etc/postgresql/certs/server.crt';
const certPath = path.resolve(process.env.CERPER_PG_SSL_CERT_PATH || DEFAULT_CERT_PATH);

function isTruthy(value) {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on' || v === 'require';
}

function isFalsy(value) {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off' || v === 'disable' || v === 'disabled';
}

function resolveSslConfig() {
  const envSsl = process.env.CERPER_PG_SSL;
  const pgSslMode = process.env.PGSSLMODE;

  const hasCert = fs.existsSync(certPath) && fs.statSync(certPath).isFile();

  // Precedencia: CERPER_PG_SSL > PGSSLMODE > auto (si hay cert, usar SSL; si no, no SSL)
  let useSsl = false;
  if (envSsl != null && String(envSsl).trim() !== '') {
    useSsl = isTruthy(envSsl) && !isFalsy(envSsl);
  } else if (pgSslMode != null && String(pgSslMode).trim() !== '') {
    useSsl = String(pgSslMode).trim().toLowerCase() !== 'disable';
  } else {
    useSsl = hasCert;
  }

  if (!useSsl) return false;

  return {
    // Si hay cert, verificamos; si no, permitimos SSL sin verificación (útil con proxies/CA corporativa).
    rejectUnauthorized: hasCert,
    ca: hasCert ? fs.readFileSync(certPath).toString() : undefined,
  };
}

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: resolveSslConfig(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error', err);
});

module.exports = pool;
