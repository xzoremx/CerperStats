#!/usr/bin/env node
/**
 * Restore the latest PostgreSQL snapshot from database/db_snapshots.
 * - Defaults to the most recent <ts>__<tag>.dump
 * - Can filter by --tag TAG or specify --file path/to/file.dump
 * - Reads connection from --dsn or env (.env: DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
 * - Uses safe defaults: --clean --if-exists --no-owner --no-privileges
 *
 * Usage examples:
 *   node database/tools/pg_restore_latest.js --tag test
 *   node database/tools/pg_restore_latest.js --file database/db_snapshots/20250101_101010__prod.dump
 *   node database/tools/pg_restore_latest.js --dsn postgresql://user:pass@127.0.0.1:5432/cerperstats
 *   node database/tools/pg_restore_latest.js --help
 */
require('dotenv').config();
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

function resolveConn(args) {
  let conn = { host: args.host, port: args.port, db: args.db, user: args.user };
  if (args.dsn) {
    const p = parseDsn(args.dsn);
    conn = { host: p.host, port: p.port, db: p.db, user: p.user };
    if (p.password && !process.env.PGPASSWORD) process.env.PGPASSWORD = p.password;
  }
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
    } catch (_) {}
  }
  if (!conn.host || !conn.db || !conn.user) {
    conn = {
      host: conn.host || process.env.PGHOST,
      port: conn.port || process.env.PGPORT,
      db:   conn.db   || process.env.PGDATABASE,
      user: conn.user || process.env.PGUSER,
    };
  }
  if (!conn.port) conn.port = '5432';
  if (!conn.host || !conn.db || !conn.user) {
    throw new Error('Missing connection info. Provide --dsn or --host/--db/--user, or set DATABASE_URL / PGHOST/PGDATABASE/PGUSER in .env');
  }
  return conn;
}

function findLatestDump(dir, tag) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const dumps = files.filter(f => f.toLowerCase().endsWith('.dump'));
  if (tag) {
    const t = String(tag).toLowerCase();
    // match __<tag>.dump at the end
    const suffix = `__${t}.dump`;
    return dumps
      .filter(f => f.toLowerCase().endsWith(suffix))
      .sort()
      .pop() || null;
  }
  return dumps.sort().pop() || null;
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(`Usage:
  node database/tools/pg_restore_latest.js [--tag TAG | --file PATH] [--dsn DSN]
  node database/tools/pg_restore_latest.js --help
Env:
  DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER used if flags missing
Defaults:
  --clean --if-exists --no-owner --no-privileges
Notes:
  Without --file, restores the most recent .dump in database/db_snapshots (optionally filtered by --tag)`);
    process.exit(0);
  }

  const outDir = path.join(__dirname, '..', 'db_snapshots');
  let dumpPath = null;
  if (args.file) {
    dumpPath = path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file);
    if (!fs.existsSync(dumpPath)) {
      console.error('File not found:', dumpPath);
      process.exit(1);
    }
  } else {
    const fname = findLatestDump(outDir, args.tag === true ? null : args.tag);
    if (!fname) {
      console.error('No .dump snapshots found in', outDir);
      process.exit(1);
    }
    dumpPath = path.join(outDir, fname);
  }

  const conn = resolveConn(args);

  const restoreArgs = [
    '--clean',
    '--if-exists',
  ];
  if (!args['with-owner']) restoreArgs.push('--no-owner');
  if (!args['with-privileges']) restoreArgs.push('--no-privileges');
  if (args.jobs) restoreArgs.push('-j', String(args.jobs));

  // Connection
  restoreArgs.push('-h', conn.host, '-p', String(conn.port), '-U', conn.user);

  // Target DB: with -C, connect to postgres; otherwise to conn.db
  if (args.create || args.C) {
    restoreArgs.push('-C');
    const target = args.target || 'postgres';
    restoreArgs.push('-d', target);
  } else {
    restoreArgs.push('-d', conn.db);
  }

  restoreArgs.push(dumpPath);

  console.log('Restoring snapshot from:', dumpPath);
  run('pg_restore', restoreArgs, { env: process.env });
}

main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });

