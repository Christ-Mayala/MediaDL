const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const outPath = path.join(rootDir, 'src', 'assets', 'env.js');

function parseEnv(raw) {
  const result = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  });
  return result;
}

let apiBaseUrl = process.env.API_BASE_URL || 'https://dryapi.onrender.com';
if (!process.env.API_BASE_URL && fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = parseEnv(raw);
  if (env.API_BASE_URL) {
    apiBaseUrl = env.API_BASE_URL;
  }
}

const content = `(function (w) {
  w.__env = w.__env || {};
  w.__env.API_BASE_URL = ${JSON.stringify(apiBaseUrl)};
})(window);
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content, 'utf8');
console.log('[env] wrote', outPath);
