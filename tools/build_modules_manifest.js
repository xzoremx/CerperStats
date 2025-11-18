#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function walk(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_common' || entry.name === 'node_modules' || entry.name === 'venv') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const modulesDir = args.modules || 'modules';
  const outFile = args.out || path.join(modulesDir, '_common', 'modules_manifest.json');
  const mapFile = args.map || null;

  let mapping = {};
  if (mapFile && fs.existsSync(mapFile)) {
    try {
      mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    } catch {
      mapping = {};
    }
  }

  const files = walk(modulesDir);
  const byDir = new Map();
  for (const file of files) {
    const rel = path.relative(modulesDir, file).replace(/\\/g, '/');
    if (!rel.startsWith('python/')) continue;
    const base = path.dirname(rel);
    const name = path.basename(rel).toLowerCase();
    if (!byDir.has(base)) byDir.set(base, {});
    const rec = byDir.get(base);
    if (name === 'principal.py') rec.main = rel;
    if (name === 'graph.py') rec.graph = rel;
  }

  const entries = [];
  for (const [dir, rec] of byDir.entries()) {
    if (!rec.main) continue;
    const entry = {
      id: (mapping[dir] && mapping[dir].id) || null,
      module_id: (mapping[dir] && mapping[dir].module_id) || null,
      nombre_interno: (mapping[dir] && mapping[dir].nombre_interno) || null,
      version: (mapping[dir] && mapping[dir].version) || null,
      module_asset: rec.main,
      script_grafico: rec.graph || null,
      graph_asset: rec.graph || null,
      runtime: (mapping[dir] && mapping[dir].runtime) || null,
      sha256_module: '',
      sha256_script_grafico: '',
      sha256_graph: '',
    };
    try {
      entry.sha256_module = sha256Hex(fs.readFileSync(path.join(modulesDir, rec.main), 'utf8'));
    } catch {
      entry.sha256_module = '';
    }
    if (rec.graph) {
      try {
        const ghex = sha256Hex(fs.readFileSync(path.join(modulesDir, rec.graph), 'utf8'));
        entry.sha256_script_grafico = ghex;
        entry.sha256_graph = ghex;
      } catch {}
    }
    entries.push(entry);
  }

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    entries,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifest written: ${outFile}\nEntries: ${entries.length}`);
}

if (require.main === module) main();
