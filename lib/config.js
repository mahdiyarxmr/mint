/* Mint — runtime settings the admin can change from the panel.
   Precedence: data/config.json  >  environment variable  >  built-in default.
   Saved to disk and applied immediately, with no restart. */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'config.json');

/* key: [default, kind, secret?]  — `secret` values are masked in API responses */
const SCHEMA = {
  // ---- image generation
  provider:        [process.env.MINT_IMAGE_PROVIDER || 'pollinations', 'string'],
  model:           [process.env.MINT_IMAGE_MODEL || '', 'string'],
  pollinationsToken: [process.env.POLLINATIONS_TOKEN || '', 'string', true],
  cfAccount:       [process.env.CF_ACCOUNT_ID || '', 'string'],
  cfToken:         [process.env.CF_API_TOKEN || '', 'string', true],
  hfToken:         [process.env.HF_TOKEN || '', 'string', true],
  openaiBase:      [process.env.OPENAI_IMAGE_BASE || '', 'string'],
  openaiKey:       [process.env.OPENAI_API_KEY || '', 'string', true],
  openaiModel:     [process.env.OPENAI_IMAGE_MODEL || 'dall-e-3', 'string'],
  workerUrl:       [process.env.MINT_WORKER_URL || '', 'string'],
  workerKey:       [process.env.MINT_WORKER_KEY || '', 'string', true],
  timeout:         [+(process.env.MINT_AI_TIMEOUT || 90000), 'int'],
  llmBase:         [process.env.MINT_LLM_BASE || 'https://codecraftapi.com/v1', 'string'],
  llmKey:          [process.env.MINT_LLM_KEY || '', 'string', true],
  llmModel:        [process.env.MINT_LLM_MODEL || 'gemini-3.7-flash', 'string'],
  reshape:         [process.env.MINT_AI_RESHAPE !== '0', 'bool'],
  translate:       [process.env.MINT_AI_TRANSLATE !== 'off', 'bool'],

  // ---- economy
  coinValue:       [1000, 'int'],   // Toman per coin
  aiCreditCost:    [4, 'int'],      // credits per generation
  aiCoinCost:      [5, 'int'],      // coins per generation once credits run out
  signupCoins:     [50, 'int'],
  signupCredits:   [20, 'int'],

  // ---- limits
  aiRateMax:       [12, 'int'],     // generations per window
  aiRateWindow:    [60000, 'int'],
  maxPerRequest:   [2, 'int'],      // images per generate call
};

const DEFAULTS = Object.fromEntries(Object.entries(SCHEMA).map(([k, v]) => [k, v[0]]));
const SECRETS = new Set(Object.entries(SCHEMA).filter(([, v]) => v[2]).map(([k]) => k));

let current = { ...DEFAULTS };

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const k of Object.keys(DEFAULTS)) {
      if (k in saved) current[k] = saved[k];
    }
  } catch { /* first run — defaults stand */ }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(current, null, 2));
  } catch (e) { console.error('config save failed:', e.message); }
}

const coerce = (kind, v) => {
  if (kind === 'int') return Math.trunc(Number(v)) || 0;
  if (kind === 'bool') return v === true || v === 'true' || v === 'on' || v === 1;
  return String(v == null ? '' : v);
};

function set(patch) {
  const changed = [];
  // Accept __clear here as well as on the route, so a direct set() behaves the
  // same as a POST /api/admin/config. Silently ignoring it was a trap.
  const wipe = (patch || {}).__clear;
  for (const k of (Array.isArray(wipe) ? wipe : wipe ? [wipe] : [])) {
    if (k in SCHEMA && current[k] !== DEFAULTS[k]) { current[k] = DEFAULTS[k]; changed.push(k); }
  }
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in SCHEMA)) continue;
    // an empty secret means "leave it alone" — the UI never echoes the real value back
    if (SECRETS.has(k) && v === '') continue;
    const next = coerce(SCHEMA[k][1], v);
    if (current[k] !== next) { current[k] = next; changed.push(k); }
  }
  if (changed.length) persist();
  return changed;
}

/** Clear a secret explicitly (the UI sends this instead of an empty string). */
function clear(key) {
  if (key in SCHEMA && SECRETS.has(key)) { current[key] = ''; persist(); return true; }
  return false;
}

const get = (k) => current[k];
const all = () => ({ ...current });

/** Safe for the browser: secrets become a masked hint, never the value. */
function publicView() {
  const out = {};
  for (const k of Object.keys(current)) {
    if (SECRETS.has(k)) {
      const v = String(current[k] || '');
      out[k] = v ? '••••••••' + v.slice(-4) : '';
      out[k + 'Set'] = !!v;
    } else out[k] = current[k];
  }
  return out;
}

function reset() { current = { ...DEFAULTS }; persist(); }

load();

module.exports = { get, set, all, clear, publicView, reset, DEFAULTS, SECRETS, SCHEMA };
