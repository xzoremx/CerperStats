const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const certPath = path.resolve('/etc/postgresql/certs/server.crt');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false,
    ca:
      fs.existsSync(certPath) && fs.statSync(certPath).isFile()
        ? fs.readFileSync(certPath).toString()
        : undefined,
  },
});

pool.on('error', (err) => {
  console.error('[DB] Pool error', err);
});

module.exports = pool;
