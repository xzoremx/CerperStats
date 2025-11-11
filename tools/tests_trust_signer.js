#!/usr/bin/env node
/**
 * Generate and manage trusted test modules (hash + signature)
 *
 * Commands:
 *  gen-key --out-private modules/_common/tests_private.pem --out-public-json modules/_common/tests_public_key.json
 *  hash-db --db database/cerperstats.db --out modules/_common/trusted_tests.json [--ids 1,2,3]
 *  sign-db --db database/cerperstats.db --private modules/_common/tests_private.pem --out modules/_common/tests_signatures.json [--ids 1,2,3]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

function parseArgs(argv){ const a={}; let k=null; argv.forEach(x=>{ if(x.startsWith('--')){k=x.slice(2); a[k]=true;} else if(k){a[k]=x;k=null;} else {(a._??=[]).push(x);} }); return a; }
function ensureDirFor(f){ const d=path.dirname(f); if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }

function sha256Hex(txt){ return crypto.createHash('sha256').update(txt,'utf8').digest('hex'); }

async function genKey(args){
  const outPriv = args['out-private'] || 'modules/_common/tests_private.pem';
  const outPub = args['out-public-json'] || 'modules/_common/tests_public_key.json';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve:'P-256' });
  ensureDirFor(outPriv); fs.writeFileSync(outPriv, privateKey.export({type:'pkcs8', format:'pem'}),'utf8');
  const spki = publicKey.export({type:'spki', format:'der'});
  ensureDirFor(outPub); fs.writeFileSync(outPub, JSON.stringify({ spki_base64: Buffer.from(spki).toString('base64') }, null, 2));
  console.log('Generated key pair.');
}

function openDb(file){ return new sqlite3.Database(file); }
function fetchModules(db, ids){
  const where = (ids && ids.length) ? `WHERE t.id IN (${ids.map(()=>'?').join(',')})` : '';
  const sql = `SELECT t.id, t.nombre_interno, m.codigo_principal, m.codigo_grafico
               FROM tests_catalog t JOIN test_modules m ON m.catalog_id=t.id ${where} AND m.activo=1`;
  return new Promise((resolve,reject)=>{
    db.all(sql, ids||[], (err,rows)=>{ if(err) reject(err); else resolve(rows||[]); });
  });
}

async function hashDb(args){
  const dbPath = args['db'] || 'database/cerperstats.db';
  const out = args['out'] || 'modules/_common/trusted_tests.json';
  const ids = (args['ids']||'').split(',').filter(Boolean).map(x=>parseInt(x,10)).filter(Boolean);
  const db = openDb(dbPath);
  try {
    const rows = await fetchModules(db, ids);
    let obj={}; if(fs.existsSync(out)) try{obj=JSON.parse(fs.readFileSync(out,'utf8'));}catch(_){obj={}};
    for(const r of rows){ const data=(r.codigo_principal||'')+'\n---\n'+(r.codigo_grafico||''); const h=sha256Hex(data); obj[String(r.id)]=h; obj[r.nombre_interno]=h; }
    ensureDirFor(out); fs.writeFileSync(out, JSON.stringify(obj,null,2), 'utf8');
    console.log(`Trusted hashes updated in ${out} (${rows.length} modules).`);
  } finally { db.close(); }
}

async function signDb(args){
  const dbPath = args['db'] || 'database/cerperstats.db';
  const privPath = args['private'] || 'modules/_common/tests_private.pem';
  const out = args['out'] || 'modules/_common/tests_signatures.json';
  const ids = (args['ids']||'').split(',').filter(Boolean).map(x=>parseInt(x,10)).filter(Boolean);
  const priv = fs.readFileSync(privPath,'utf8');
  const db = openDb(dbPath);
  try {
    const rows = await fetchModules(db, ids);
    let obj={}; if(fs.existsSync(out)) try{obj=JSON.parse(fs.readFileSync(out,'utf8'));}catch(_){obj={}};
    for(const r of rows){
      const canonical = JSON.stringify({ principal: r.codigo_principal||'', grafico: r.codigo_grafico||'' });
      const sig = crypto.sign('sha256', Buffer.from(canonical,'utf8'), { key: priv, dsaEncoding:'der' }).toString('base64');
      obj[String(r.id)] = sig; obj[r.nombre_interno] = sig;
    }
    ensureDirFor(out); fs.writeFileSync(out, JSON.stringify(obj,null,2), 'utf8');
    console.log(`Signatures updated in ${out} (${rows.length} modules).`);
  } finally { db.close(); }
}

async function main(){
  const argv = process.argv.slice(2); if(!argv.length){ console.log('Usage: gen-key | hash-db | sign-db'); return; }
  const cmd = argv[0]; const args = parseArgs(argv.slice(1));
  if(cmd==='gen-key') return genKey(args);
  if(cmd==='hash-db') return hashDb(args);
  if(cmd==='sign-db') return signDb(args);
  console.log('Unknown command');
}

main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });

