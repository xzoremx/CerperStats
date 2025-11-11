#!/usr/bin/env node
/**
 * Vendorize scientific Python deps into modules/_common/vendor/<platform_tag>
 *
 * Usage examples:
 *   node tools/vendorize_deps.js           # auto-detect python + platform
 *   node tools/vendorize_deps.js --python C:\\Python312\\python.exe
 *   node tools/vendorize_deps.js --platform win_amd64 --packages "numpy scipy statsmodels pandas"
 *
 * This script will:
 *  - Create a temporary venv
 *  - pip install --only-binary=:all: <packages>
 *  - Copy site-packages into vendor/<platform_tag>
 */

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function parseArgs(argv){ const a={}; let k=null; argv.forEach(x=>{ if(x.startsWith('--')){k=x.slice(2); a[k]=true;} else if(k){a[k]=x;k=null;} else {(a._??=[]).push(x);} }); return a; }

function run(cmd, args, opts={}){
  console.log(`> ${cmd} ${args.join(' ')}`);
  cp.execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function detectPlatformTag(){
  const plat = process.platform;
  const arch = process.arch;
  if (plat === 'win32') return 'win_amd64';
  if (plat === 'darwin') return arch === 'arm64' ? 'mac_arm64' : 'mac_x86_64';
  if (plat === 'linux') return arch === 'arm64' ? 'linux_aarch64' : 'linux_x86_64';
  return 'vendor';
}

function pyBinFromVenv(venv){
  if (process.platform === 'win32') return path.join(venv, 'Scripts', 'python.exe');
  return path.join(venv, 'bin', 'python');
}

function pipBinFromVenv(venv){
  if (process.platform === 'win32') return path.join(venv, 'Scripts', 'pip.exe');
  return path.join(venv, 'bin', 'pip');
}

function findSitePackages(venv){
  if (process.platform === 'win32') return path.join(venv, 'Lib', 'site-packages');
  // best effort: find lib/pythonX.Y/site-packages
  const lib = path.join(venv, 'lib');
  const entries = fs.existsSync(lib) ? fs.readdirSync(lib) : [];
  const pyver = entries.find(e => e.startsWith('python'));
  if (!pyver) throw new Error('Cannot locate pythonX.Y directory under venv/lib');
  return path.join(lib, pyver, 'site-packages');
}

function copyRecursive(src, dst){
  if (!fs.existsSync(src)) throw new Error(`Missing source: ${src}`);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)){
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyRecursive(s, d); else fs.copyFileSync(s, d);
  }
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  const platformTag = args.platform || detectPlatformTag();
  const vendorRoot = path.join('modules', '_common', 'vendor', platformTag);
  const python = args.python || 'python';
  const packages = (args.packages || 'numpy scipy statsmodels pandas').split(/\s+/).filter(Boolean);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vendorize_'));
  const venv = path.join(tmp, 'venv');
  try {
    // create venv
    run(python, ['-m', 'venv', venv]);
    const py = pyBinFromVenv(venv);
    const pip = pipBinFromVenv(venv);
    // upgrade pip + install packages
    run(py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    run(pip, ['install', '--only-binary', ':all:', ...packages]);
    // copy site-packages into vendor
    const site = findSitePackages(venv);
    console.log(`Copying site-packages from ${site} to ${vendorRoot}`);
    fs.mkdirSync(vendorRoot, { recursive: true });
    copyRecursive(site, vendorRoot);
    console.log('Vendorization complete.');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch(_) {}
  }
}

main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });

