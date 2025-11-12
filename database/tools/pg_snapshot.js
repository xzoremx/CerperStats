#!/usr/bin/env node
/**
 * Manual, git-like snapshots for PostgreSQL using pg_dump.
 * - Creates a custom-format dump (.dump) for fast restore
 * - Creates a schema-only SQL for diff/review in Git
 * - Writes metadata.json (timestamp, tag, git commit, conn info)
 *
 * Usage examples:
 *   node database/tools/pg_snapshot.js --tag 
 *   node database/tools/pg_snapshot.js --dsn postgresql://cerper_app:secret@127.0.0.1:5432/cerperstats --tag fix-icons
 *   node database/tools/pg_snapshot.js --help
 */

require("dotenv").config();
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv){
  const out = { _: [] };
  let key = null;
  for (const a of argv) {
    if (key) { out[key] = a; key = null; continue; }
    if (a.startsWith('--')) { key = a.slice(2); out[key] = true; continue; }
    out._.push(a);
  }
  return out;
}

function run(cmd, args, opts={}) {
  return cp.execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function slugify(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/^-+|-+$/g,'') || 'snapshot';
}

function nowStamp(){
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function parseDsn(dsn){
  try {
    const u = new URL(dsn);
    if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') throw new Error('Invalid DSN protocol');
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      db: u.pathname.replace(/^\//,'')
    };
  } catch (e) {
    throw new Error('Invalid DSN. Example: postgresql://user:pass@host:5432/dbname');
  }
}

function gitCommit() {
  try { return cp.execSync('git rev-parse HEAD', { stdio: ['ignore','pipe','ignore'] }).toString().trim(); } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
 if (args.help || args.h) {
    console.log(`Usage:
  PGPASSWORD=secret node database/tools/pg_snapshot.js --host 127.0.0.1 --port 5432 --db cerperstats --user cerper_app --tag pre-migration
  node database/tools/pg_snapshot.js --dsn postgresql://user:pass@host:5432/cerperstats --tag label
  node database/tools/pg_snapshot.js --tag label   (lee credenciales de .env)
Env:
  PGPASSWORD  Password for --user (ignored if provided in DSN)
  DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER used if flags missing
Outputs:
  database/db_snapshots/<ts>__<tag>.dump
  database/db_snapshots/<ts>__<tag>__schema.sql
  database/db_snapshots/<ts>__<tag>__meta.json`);
    process.exit(0);
  }

  // Build connection info with precedence: CLI flags > --dsn > env (.env) > PG* vars
  let conn = { host: args.host, port: args.port, db: args.db, user: args.user };

  // From explicit DSN flag
  if (args.dsn) {
    const p = parseDsn(args.dsn);
    conn = { host: p.host, port: p.port, db: p.db, user: p.user };
    if (p.password && !process.env.PGPASSWORD) process.env.PGPASSWORD = p.password;
  }

  // Fill missing pieces from env DATABASE_URL
  if ((!conn.host || !conn.db || !conn.user) && process.env.DATABASE_URL) {
    try {
      const p = parseDsn(process.env.DATABASE_URL);
      conn = {
        host: conn.host || p.host,
        port: conn.port || p.port,
        db:   conn.db   || p.db,
        user: conn.user || p.user,
      };
      if (p.password && !process.env.PGPASSWORD) process.env.PGPASSWORD = p.password;
    } catch (_) {
      // ignore, fallback to PG* vars
    }
  }

  // Fill remaining from PG* environment vars
  if (!conn.host || !conn.db || !conn.user) {
    conn = {
      host: conn.host || process.env.PGHOST,
      port: conn.port || process.env.PGPORT,
      db:   conn.db   || process.env.PGDATABASE,
      user: conn.user || process.env.PGUSER,
    };
  }

  // Defaults
  if (!conn.port) conn.port = '5432';

  if (!conn.host || !conn.db || !conn.user) {
    console.error('Missing connection info. Provide --dsn or --host/--db/--user, or set DATABASE_URL / PGHOST/PGDATABASE/PGUSER in .env');
    process.exit(1);
  }

  const tag = slugify(args.tag || 'snapshot');
  const ts = nowStamp();
  // Write snapshots under database/db_snapshots regardless of CWD
  const outDir = path.join(__dirname, '..', 'db_snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${ts}__${tag}`;
  const dumpPath = path.join(outDir, `${base}.dump`);
  const schemaPath = path.join(outDir, `${base}__schema.sql`);
  const metaPath = path.join(outDir, `${base}__meta.json`);

  // Custom format dump
  const dumpArgs = ['-Fc', '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.db, '-f', dumpPath];
  run('pg_dump', dumpArgs, { env: process.env });

  // Schema-only SQL for diffs
  const schemaArgs = ['-s', '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.db, '-f', schemaPath];
  run('pg_dump', schemaArgs, { env: process.env });

  // Metadata
  const meta = {
    timestamp: new Date().toISOString(),
    tag,
    git_commit: gitCommit(),
    connection: { host: conn.host, port: conn.port, db: conn.db, user: conn.user },
    files: { dump: path.relative(process.cwd(), dumpPath), schema: path.relative(process.cwd(), schemaPath) }
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log('Snapshot created:\n -', dumpPath, '\n -', schemaPath, '\n -', metaPath);
}

main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
