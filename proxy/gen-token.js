const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const secretPath = path.resolve(__dirname, '../secrets/token_secret.txt');
const secret = fs.readFileSync(secretPath, 'utf8').trim();

const payload = {
  client: process.argv[2] || 'electron-app',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 604800, // 7 días (7 * 24 * 60 * 60)
};

const token = jwt.sign(payload, secret);
console.log(token);
