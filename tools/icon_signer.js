#!/usr/bin/env node
/**
 * Icon signer & trust helper
 * - gen-key: creates ECDSA P-256 key pair (pkcs8 PEM private, SPKI base64 public JSON)
 * - sign: signs canonical {svg,css,js} JSON and produces `signed:{...}` payload
 * - trust: computes SHA-256 of raw SVG and updates trusted_icons.json
 *
 * Usage:
 *   node tools/icon_signer.js gen-key --out-private icon_signing_private.pem --out-public-json js/security/icon_public_key.json
 *   node tools/icon_signer.js sign --private icon_signing_private.pem --svg path.svg [--css path.css] [--js path.js] --out icon_value_signed.txt
 *   node tools/icon_signer.js trust --svg path.svg --trusted-json js/security/trusted_icons.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = {};
  let key = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { key = a.slice(2); args[key] = true; }
    else if (key) { args[key] = a; key = null; }
    else if (!args._) { args._ = [a]; }
    else { args._.push(a); }
  }
  return args;
}

function ensureDirFor(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(file, obj) {
  ensureDirFor(file);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function cmdGenKey(args) {
  const outPriv = args['out-private'] || 'icon_signing_private.pem';
  const outPubJson = args['out-public-json'] || 'js/security/icon_public_key.json';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  ensureDirFor(outPriv);
  fs.writeFileSync(outPriv, pem, 'utf8');
  writeJSON(outPubJson, { note: 'ECDSA P-256 public key (SPKI base64)', spki_base64: Buffer.from(spki).toString('base64') });
  console.log(`Generated:\n- Private PEM: ${outPriv}\n- Public JSON: ${outPubJson}`);
}

function readTextMaybe(file) {
  return file ? fs.readFileSync(file, 'utf8') : '';
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function cmdSign(args) {
  const privPath = args['private'];
  const outPath = args['out'] || 'icon_value_signed.txt';
  if (!privPath) throw new Error('--private is required');
  const svg = readTextMaybe(args['svg']);
  if (!svg) throw new Error('--svg is required and must not be empty');
  const css = readTextMaybe(args['css']);
  const js = readTextMaybe(args['js']);
  const canonical = JSON.stringify({ svg, css, js });
  const keyPem = fs.readFileSync(privPath, 'utf8');
  const sig = crypto.sign('sha256', Buffer.from(canonical, 'utf8'), { key: keyPem, dsaEncoding: 'der' }).toString('base64');
  const payload = 'signed:' + JSON.stringify({ svg, css, js, sig });
  ensureDirFor(outPath);
  fs.writeFileSync(outPath, payload, 'utf8');
  console.log(`Signed payload written: ${outPath}`);
  console.log(`SHA256(raw SVG): ${sha256Hex(svg)}`);
}

function cmdTrust(args) {
  const svgPath = args['svg'];
  const trustedPath = args['trusted-json'] || 'js/security/trusted_icons.json';
  if (!svgPath) throw new Error('--svg is required');
  const svg = fs.readFileSync(svgPath, 'utf8');
  const h = sha256Hex(svg);
  let obj = {};
  if (fs.existsSync(trustedPath)) {
    try { obj = JSON.parse(fs.readFileSync(trustedPath, 'utf8')); } catch (_) {}
  }
  obj[h] = true;
  writeJSON(trustedPath, obj);
  console.log(`Trusted hash added to ${trustedPath}: ${h}`);
}

function usage() {
  console.log(`Usage:
  node tools/icon_signer.js gen-key --out-private icon_signing_private.pem --out-public-json js/security/icon_public_key.json
  node tools/icon_signer.js sign --private icon_signing_private.pem --svg icon.svg [--css icon.css] [--js icon.js] --out icon_value_signed.txt
  node tools/icon_signer.js trust --svg icon.svg --trusted-json js/security/trusted_icons.json
`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) return usage();
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  try {
    if (cmd === 'gen-key') cmdGenKey(args);
    else if (cmd === 'sign') cmdSign(args);
    else if (cmd === 'trust') cmdTrust(args);
    else usage();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

