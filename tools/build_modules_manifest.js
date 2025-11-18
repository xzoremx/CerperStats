#!/usr/bin/env node
/**
 * Build modules manifest (assets + hashes)
 * Scans modules/ for module directories containing main.py (and optional graph.py)
 * Optionally merges ID/nombre_interno mappings from a map JSON.
 *
 * Usage:
 *   node tools/build_modules_manifest.js --modules modules --out modules/_common/modules_manifest.json [--map modules/_common/modules_map.json]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv){
  const args = {};
  for (let i=0;i<argv.length;i++){
    const a = argv[i];
    if (a.startsWith('--')) { const k=a.slice(2); const v=argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true; args[k]=v; }
  }
  return args;
}

function sha256Hex(s){ return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function walk(dir){
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    // Excluir carpetas no relevantes / entornos
    if (
      e.name === '_common' ||
      e.name === 'vendor' ||
      e.name === 'node_modules' ||
      e.name === 'venv' ||
      e.name.startsWith('.') // .env, .venv, etc.
    ) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function main(){
  const args = parseArgs(process.argv.slice(2));
  const modulesDir = args.modules || 'modules';
  const outFile = args.out || path.join(modulesDir, '_common', 'modules_manifest.json');
  const mapFile = args.map || null;

  let mapping = {};
  if (mapFile && fs.existsSync(mapFile)){
    try { mapping = JSON.parse(fs.readFileSync(mapFile,'utf8')); } catch(_) { mapping = {}; }
  }
  const files = walk(modulesDir);
  const entries = [];
  // HeurÃ­stica: cada carpeta con module.py se considera un mÃ³dulo; si hay graph.py lo aÃ±adimos
  const byDir = new Map();
  for (const f of files){
    const rel = path.relative(modulesDir, f).replace(/\\/g,'/');
    // Filtrar rutas vendorizadas/entornos y limitar a python/
    if (
      rel.startsWith('_common/') ||
      rel.startsWith('vendor/') ||
      rel.startsWith('.env/') ||
      rel.includes('/site-packages/') ||
      rel.includes('/dist-packages/') ||
      rel.includes('/Lib/site-packages/')
    ) continue;
    if (!rel.startsWith('python/')) continue;
    const base = path.dirname(rel);
    const name = path.basename(rel);
    if (!byDir.has(base)) byDir.set(base, {});
    const rec = byDir.get(base);
    if (name.toLowerCase() === 'principal.py') rec.main = rel;
    if (name.toLowerCase() === 'graph.py') rec.graph = rel;
  }
  for (const [dir, rec] of byDir.entries()){
    if (!rec.main) continue;
    const entry = {
      // catalog-level identifier (tests_catalog.id)
      id: (mapping[dir] && mapping[dir].id) || null,
      // module-level identifier (test_modules.id)
      module_id: (mapping[dir] && mapping[dir].module_id) || null,
      nombre_interno: (mapping[dir] && mapping[dir].nombre_interno) || null,
      version: (mapping[dir] && mapping[dir].version) || null,
      module_asset: rec.main,
      // Nuevo nombre preferido para el script de grÃ¡fico
      script_grafico: rec.graph || null,
      // Campo legacy para compatibilidad
      graph_asset: rec.graph || null,
      runtime: (mapping[dir] && mapping[dir].runtime) || null,
      sha256_module: '',
      // Nuevo nombre preferido para el hash del script de grÃ¡fico
      sha256_script_grafico: '',
      // Campo legacy
      sha256_graph: ''
    };
    try { entry.sha256_module = sha256Hex(fs.readFileSync(path.join(modulesDir, rec.main), 'utf8')); } catch(_) {}
    if (rec.graph){
      try {
        const ghex = sha256Hex(fs.readFileSync(path.join(modulesDir, rec.graph), 'utf8'));
        entry.sha256_script_grafico = ghex;
        entry.sha256_graph = ghex; // legacy
      } catch(_) {}
    }
    entries.push(entry);
  }
  const out = { version: 1, generated_at: new Date().toISOString(), entries };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Manifest written: ${outFile}\nEntries: ${entries.length}`);
}

if (require.main === module) main();

