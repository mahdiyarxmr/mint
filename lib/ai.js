/* Mint — AI image generation.
   Pluggable providers; Pollinations is the default because it needs no key.
   Persian prompts are translated to English first, because diffusion models
   (FLUX, SDXL) are trained almost entirely on English captions. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const png = require('./png');

const OUT_DIR = path.join(__dirname, '..', 'public', 'img', 'gen');
fs.mkdirSync(OUT_DIR, { recursive: true });

const config = require('./config');
/* Read through to the live config so an admin edit takes effect on the next
   request — no restart, no re-require. */
const CFG = new Proxy({}, {
  get: (_, k) => config.get(k),
  has: (_, k) => k in config.DEFAULTS,
  ownKeys: () => Object.keys(config.DEFAULTS),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const hasPersian = (s) => /[\u0600-\u06FF]/.test(s || '');

/* Providers lie about Content-Type (one Worker declares image/jpeg and sends
   PNG), so the extension comes from the magic bytes. */
function sniffExt(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E) return 'png';
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return 'jpg';
}

/* Actual pixel size, so the UI can say when a provider ignored the request. */
function readSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    let i = 2;
    while (i < buf.length - 1) {
      if (buf[i] !== 0xFF) break;
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xC2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  } catch { /* unknown */ }
  return null;
}

/* --------------------------------------------------------------- helpers */
async function withTimeout(p, ms, label) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await p(ctl.signal); }
  finally { clearTimeout(timer); }
}

/* Offline fallback glossary — only used when every network translator fails.
   Ordered longest-first so multi-word phrases win over their parts. */
const GLOSSARY = [
  // subjects
  ['اژدها', 'dragon'], ['گرگ', 'wolf'], ['ببر', 'tiger'], ['شیر', 'lion'],
  ['پلنگ', 'panther'], ['عقاب', 'eagle'], ['روباه', 'fox'], ['اسب', 'horse'],
  ['پرنده', 'bird'], ['گربه', 'cat'], ['جمجمه', 'skull'], ['ربات', 'robot'],
  ['رباط', 'robot'], ['سامورایی', 'samurai'], ['شوالیه', 'knight'],
  ['دختر', 'girl'], ['پسر', 'boy'], ['چهره', 'portrait'], ['هیولا', 'monster'],
  // places / scenery
  ['کهکشان', 'galaxy'], ['سیاره', 'planet'], ['فضا', 'outer space'],
  ['جنگل', 'forest'], ['کوهستان', 'mountains'], ['کوه', 'mountain'],
  ['دریا', 'ocean'], ['اقیانوس', 'ocean'], ['ساحل', 'beach'], ['رودخانه', 'river'],
  ['شهر', 'city'], ['بیابان', 'desert'], ['برف', 'snow'], ['باران', 'rain'],
  ['ابر', 'clouds'], ['آسمان', 'sky'], ['ماه', 'moon'], ['خورشید', 'sun'],
  ['ستاره', 'stars'], ['آتش', 'fire'], ['موج', 'waves'], ['گل', 'flowers'],
  ['درخت', 'tree'], ['مه', 'mist'], ['دود', 'smoke'], ['رعد', 'lightning'],
  // colour
  ['بنفش', 'purple'], ['آبی', 'blue'], ['قرمز', 'red'], ['سبز', 'green'],
  ['زرد', 'yellow'], ['نارنجی', 'orange'], ['صورتی', 'pink'], ['طلایی', 'gold'],
  ['نقره', 'silver'], ['مشکی', 'black'], ['سیاه', 'black'], ['سفید', 'white'],
  ['رنگین کمان', 'rainbow'], ['فیروزه', 'turquoise'],
  // style
  ['سایبرپانک', 'cyberpunk'], ['نئون', 'neon'], ['مینیمال', 'minimalist'],
  ['انتزاعی', 'abstract'], ['هندسی', 'geometric'], ['انیمه', 'anime'],
  ['فانتزی', 'fantasy'], ['رترو', 'retro'], ['واقع گرا', 'realistic'],
  ['نقاشی', 'painting'], ['آبرنگ', 'watercolour'], ['سه بعدی', '3D render'],
  ['پیکسلی', 'pixel art'], ['گرادیان', 'gradient'], ['الگو', 'pattern'],
  ['طرح', 'design'], ['پس زمینه', 'background'], ['بافت', 'texture'],
  // light / mood
  ['درخشان', 'glowing'], ['تاریک', 'dark'], ['روشن', 'bright'], ['شب', 'night'],
  ['غروب', 'sunset'], ['طلوع', 'sunrise'], ['سایه', 'shadow'], ['نور', 'light'],
  ['آرام', 'calm'], ['خشمگین', 'fierce'], ['زیبا', 'beautiful'], ['بزرگ', 'giant'],
].sort((a, b) => b[0].length - a[0].length);

function glossaryTranslate(text) {
  // strip ZWNJ (U+200C) first — it is not in the Arabic block and survives naïve filters
  let out = ' ' + String(text).replace(/\u200c/g, ' ') + ' ';
  for (const [fa, en] of GLOSSARY) out = out.split(fa).join(' ' + en + ' ');
  out = out.replace(/[\u0600-\u06FF\u200c]+/g, ' ')
           .replace(/\s+/g, ' ').trim();
  const words = [...new Set(out.split(' ').filter(Boolean))];
  return words.join(', ');
}

/* Persian → English.
   Chain, in order of quality:
     1. MyMemory   — free, keyless, reliable, accurate for short phrases
     2. Pollinations text — free but now returns 402 most of the time
     3. offline glossary  — always available, keyword-level
   Diffusion models weight early tokens heavily, so the result must stay
   subject-first and short. */

/* An OpenAI-compatible chat endpoint. Strictly better than a machine
   translator here: it renders Persian into the noun-and-adjective English that
   diffusion models were captioned in, instead of word-for-word grammar.

   The hard rule is brevity. Early tokens dominate a diffusion prompt, so an
   enthusiastic model that answers with three florid sentences makes worse
   images than MyMemory does. The system prompt caps it and sanitize() enforces
   the cap regardless of what comes back. */
const LLM_SYSTEM = [
  'You rewrite short design prompts for an image generator.',
  'Translate the user text to English if it is not already English.',
  'Reply with the prompt only: no quotes, no preamble, no explanation, no markdown.',
  'Use concrete visual nouns, colours, lighting and mood.',
  'Stay under 20 words. Never exceed one sentence.',
  'Do not mention the output device, canvas, aspect ratio, resolution or framing.',
  'Do not add words like "image of", "a picture showing", or any request for text in the image.',
].join(' ');

async function chat(messages, { maxTokens = 120, temperature = 0.4 } = {}) {
  const base = String(CFG.llmBase || '').replace(/\/+$/, '');
  if (!base) throw new Error('llm base URL missing');
  if (!CFG.llmKey) throw new Error('llm key missing');
  const res = await withTimeout((signal) => fetch(base + '/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CFG.llmKey },
    body: JSON.stringify({
      model: CFG.llmModel || 'gemini-3.7-flash',
      messages, max_tokens: maxTokens, temperature, stream: false,
    }),
  }), Math.min(CFG.timeout, 30000));

  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || '';
    } catch { /* body was not JSON */ }
    throw new Error(`llm ${res.status}${msg ? ': ' + String(msg).slice(0, 120) : ''}`);
  }
  const j = await res.json();
  const out = j?.choices?.[0]?.message?.content;
  if (!out || typeof out !== 'string') throw new Error('llm returned no content');
  return { text: out, model: j.model || CFG.llmModel, usage: j.usage || null };
}

/* Models ignore instructions sometimes. Trim whatever arrives back to something
   a diffusion model can actually use. */
function sanitizePrompt(raw, fallback) {
  let t = String(raw || '').trim();
  t = t.replace(/^```[a-z]*\s*|\s*```$/g, '').trim();          // fenced block
  t = t.replace(/^(here(?:'s| is)[^:]*:|prompt:|translation:)\s*/i, '');
  t = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || '';
  t = t.replace(/^["'«»\s]+|["'«»\s.]+$/g, '');
  if (/[\u0600-\u06FF]/.test(t)) return null;                  // it did not translate
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 28) t = words.slice(0, 28).join(' ');
  if (t.length < 3 || t.length > 260) return null;
  return t || fallback || null;
}

async function viaLLM(prompt) {
  const { text, model } = await chat([
    { role: 'system', content: LLM_SYSTEM },
    { role: 'user', content: prompt },
  ]);
  const clean = sanitizePrompt(text);
  if (!clean) throw new Error('llm output unusable');
  return { text: clean, model };
}

async function viaMyMemory(prompt) {
  const url = 'https://api.mymemory.translated.net/get?langpair=fa%7Cen&q=' +
              encodeURIComponent(prompt.slice(0, 480));
  const res = await withTimeout((signal) => fetch(url, { signal }), 15000);
  if (!res.ok) throw new Error('mymemory ' + res.status);
  const j = await res.json();
  const t = (j?.responseData?.translatedText || '').trim();
  if (!t || hasPersian(t) || /^NO QUERY|MYMEMORY WARNING|QUERY LENGTH/i.test(t)) {
    throw new Error('mymemory unusable');
  }
  return t;
}

async function viaPollinationsText(prompt) {
  const instruction =
    'Convert this Persian description into ONE English image-generation prompt. ' +
    'Start with the main subject, then visual details, then setting, then lighting and style. ' +
    'Short comma-separated phrases, max 30 words. Reply with ONLY the prompt. Persian: ' + prompt;
  const res = await withTimeout(
    (signal) => fetch('https://text.pollinations.ai/' + encodeURIComponent(instruction), { signal }),
    15000);
  if (!res.ok) throw new Error('pollinations-text ' + res.status);
  let t = (await res.text()).trim().replace(/^["'`]|["'`]$/g, '').replace(/\s+/g, ' ');
  t = t.split('\n')[0].slice(0, 300);
  if (!t || hasPersian(t) || t.startsWith('{')) throw new Error('pollinations-text unusable');
  return t;
}

async function toEnglish(prompt) {
  if (!hasPersian(prompt) || !CFG.translate) return { text: prompt, translated: false };
  let lastErr = null;
  const errors = [];
  const chain = [];
  if (CFG.llmKey && CFG.llmBase) chain.push(['llm', viaLLM]);
  chain.push(['mymemory', viaMyMemory], ['pollinations', viaPollinationsText]);
  for (const [name, fn] of chain) {
    try {
      const t = await fn(prompt);
      // Report what was skipped on the way here: an admin who has just pasted a
      // key needs to see that it was rejected, not silently bypassed.
      const skipped = errors.length ? errors.slice() : undefined;
      if (typeof t === 'string') return { text: t, translated: true, via: name, skipped };
      return { text: t.text, translated: true, via: name, model: t.model, skipped };
    } catch (e) {
      lastErr = `${name}: ${String(e.message).slice(0, 100)}`;
      errors.push(lastErr);
    }
  }
  const g = glossaryTranslate(prompt);
  return { text: g || prompt, translated: !!g, offline: true, via: 'glossary', lastErr,
           skipped: errors.length ? errors : undefined };
}

/* ------------------------------------------------- device-aware framing */
/* Kept deliberately SHORT. A long device brief drowns the subject: the model
   weights early tokens most, and a 200-character tail made every generation
   drift into generic scenery. Composition is steered by the aspect ratio
   (which we already control) far more than by words. */
const DEVICE_HINT = {
  phone: 'vertical composition',
  laptop: 'wide horizontal composition',
  pc: 'tall vertical composition',
  xbox: 'centred symmetric composition',
  playstation: 'centred symmetric composition',
  keyboard: 'ultra-wide panoramic composition',
  keycaps: 'seamless repeating pattern',
  wallpaper: 'cinematic wide composition',
};

/* Diffusion sizes must be multiples of 8; keep each device's real proportions. */
const DEVICE_SIZE = {
  phone: [768, 1536], laptop: [1280, 864], pc: [896, 1280],
  xbox: [1024, 768], playstation: [1024, 768], keyboard: [1408, 576],
  keycaps: [1024, 1024], wallpaper: [1280, 720],
};

function buildPrompt(englishPrompt, { device = 'phone', style = '' } = {}) {
  const subject = String(englishPrompt).trim().replace(/[.\s]+$/, '');
  const bits = [subject];
  if (style) bits.push(style.toLowerCase() + ' style');
  bits.push(DEVICE_HINT[device] || DEVICE_HINT.phone);
  bits.push('highly detailed digital art', 'no text');
  return bits.join(', ');
}

/* ------------------------------------------------------------ providers */
/* The public endpoint has no SLA and returns a sporadic 500, so retry —
   the last attempt swaps FLUX for the faster `turbo` model. */
async function viaPollinations(finalPrompt, [w, h], seed) {
  const m = CFG.model || 'flux';
  const attempts = [
    { model: m, seed },
    { model: m, seed: seed + 1 },
    { model: 'turbo', seed: seed + 2 },
  ];
  let last = 'unknown';
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const qs = new URLSearchParams({
      width: String(w), height: String(h), model: a.model,
      seed: String(a.seed), nologo: 'true', private: 'true', referrer: 'mint.design',
    });
    if (CFG.pollinationsToken) qs.set('token', CFG.pollinationsToken);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?${qs}`;
    try {
      const res = await withTimeout((signal) => fetch(url, { signal }), CFG.timeout);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1200) return buf;
        last = 'empty body';
      } else { last = 'HTTP ' + res.status; }
    } catch (e) { last = String(e.name === 'AbortError' ? 'timeout' : e.message); }
    if (i < attempts.length - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
  }
  throw new Error('pollinations: ' + last);
}

async function viaCloudflare(finalPrompt, [w, h]) {
  if (!CFG.cfAccount || !CFG.cfToken) throw new Error('cloudflare credentials missing');
  const model = CFG.model || '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${CFG.cfAccount}/ai/run/${model}`;
  const res = await withTimeout((signal) => fetch(url, {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + CFG.cfToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: finalPrompt, width: w, height: h, steps: 4 }),
  }), CFG.timeout);
  if (!res.ok) throw new Error('cloudflare ' + res.status);
  const j = await res.json();
  const b64 = j?.result?.image;
  if (!b64) throw new Error('cloudflare returned no image');
  return Buffer.from(b64, 'base64');
}

async function viaHuggingFace(finalPrompt) {
  if (!CFG.hfToken) throw new Error('HF_TOKEN missing');
  const model = CFG.model || 'black-forest-labs/FLUX.1-schnell';
  const res = await withTimeout((signal) => fetch(
    'https://router.huggingface.co/hf-inference/models/' + model, {
      method: 'POST', signal,
      headers: { Authorization: 'Bearer ' + CFG.hfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: finalPrompt }),
    }), CFG.timeout);
  if (!res.ok) throw new Error('huggingface ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

/* Any OpenAI-compatible /images/generations endpoint: OpenAI itself, Together,
   DeepInfra, Fireworks, Nano-GPT, a local Stable Diffusion gateway, and so on.
   One adapter covers whichever key the operator can actually get. */
async function viaOpenAI(finalPrompt, [w, h]) {
  if (!CFG.openaiKey) throw new Error('API key missing');
  const base = (CFG.openaiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await withTimeout((signal) => fetch(base + '/images/generations', {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + CFG.openaiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CFG.openaiModel || 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size: `${w}x${h}`,
      response_format: 'b64_json',
    }),
  }), CFG.timeout);
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 160);
    throw new Error(`openai ${res.status}: ${txt}`);
  }
  const j = await res.json();
  const d = j?.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) {
    const img = await withTimeout((signal) => fetch(d.url, { signal }), CFG.timeout);
    if (!img.ok) throw new Error('openai image fetch ' + img.status);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error('openai returned no image');
}

/* A self-hosted endpoint that takes { prompt, width, height } with a bearer
   token and answers with raw image bytes. This is the shape of the Cloudflare
   Worker in tools/worker.js. */
async function viaWorker(finalPrompt, [w, h], seed) {
  const url = CFG.workerUrl;
  if (!url) throw new Error('worker URL missing');
  const headers = { 'Content-Type': 'application/json' };
  if (CFG.workerKey) headers.Authorization = 'Bearer ' + CFG.workerKey;
  const res = await withTimeout((signal) => fetch(url, {
    method: 'POST', signal, headers,
    body: JSON.stringify({
      prompt: finalPrompt, width: w, height: h, seed,
      ...(CFG.model ? { model: CFG.model } : {}),
    }),
  }), CFG.timeout);

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 140); } catch { /* ignore */ }
    throw new Error(`worker ${res.status}${detail ? ': ' + detail : ''}`);
  }

  const ct = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  // Some endpoints answer with JSON { image: "<base64>" } instead of bytes.
  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(buf.toString('utf8'));
      const b64 = j.image || j.result?.image || j.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, 'base64');
      throw new Error('worker returned JSON without an image');
    } catch (e) { throw new Error(String(e.message).slice(0, 120)); }
  }
  return buf;
}

const PROVIDERS = {
  worker: viaWorker,
  pollinations: viaPollinations,
  cloudflare: viaCloudflare,
  huggingface: viaHuggingFace,
  openai: viaOpenAI,
};

/* ----------------------------------------------------------------- main */
async function generate({ prompt, device = 'phone', style = '', fallbackImages = [] }) {
  const t0 = Date.now();
  const { text: english, translated, offline, via } = await toEnglish(prompt);
  const finalPrompt = buildPrompt(english, { device, style });
  const size = DEVICE_SIZE[device] || DEVICE_SIZE.phone;
  const seed = crypto.randomInt(1, 999999999);

  const name = PROVIDERS[CFG.provider] ? CFG.provider : 'pollinations';
  try {
    let buf = await PROVIDERS[name](finalPrompt, size, seed);
    if (!buf || buf.length < 1200) throw new Error('empty image');

    /* Shape guarantee. Some endpoints ignore width/height and always answer a
       square; a phone case is 1:2. Centre-crop the pixels so the saved file
       really is the requested shape rather than leaning on CSS to hide it. */
    let reshaped = null;
    if (CFG.reshape !== false) {
      const fit = png.fitTo(buf, size[0], size[1]);
      if (fit.changed) { buf = fit.buf; reshaped = { w: fit.width, h: fit.height, from: fit.from }; }
    }
    const ext = sniffExt(buf);
    const file = `gen-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(OUT_DIR, file), buf);
    const got = readSize(buf);
    return {
      ok: true, url: '/img/gen/' + file, provider: name, device,
      size: got, wanted: { w: size[0], h: size[1] }, reshaped,
      exactShape: !!(got && Math.abs(got.w / got.h - size[0] / size[1]) < 0.02),
      prompt_en: finalPrompt, translated, offlineTranslate: !!offline, via,
      ms: Date.now() - t0, live: true,
    };
  } catch (err) {
    // Never hard-fail the UI: fall back to a curated local image.
    const pick = fallbackImages[crypto.randomInt(0, Math.max(1, fallbackImages.length))] || null;
    return {
      ok: true, url: pick, provider: 'offline-sample', device,
      prompt_en: finalPrompt, translated, offlineTranslate: !!offline, via,
      ms: Date.now() - t0, live: false, reason: String(err.message || err).slice(0, 160),
    };
  }
}

/* Housekeeping: keep the generated folder from growing without bound. */
function prune(max = 120) {
  try {
    const files = fs.readdirSync(OUT_DIR)
      .map(f => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(max).forEach(x => fs.unlinkSync(path.join(OUT_DIR, x.f)));
  } catch { /* ignore */ }
}

/* Admin "test connection": one tiny real generation, reporting the true reason. */
async function selftest() {
  const t0 = Date.now();
  const name = PROVIDERS[CFG.provider] ? CFG.provider : 'pollinations';
  try {
    const buf = await PROVIDERS[name]('a simple purple circle on black, minimal', [768, 1536],
                                      Math.floor(Math.random() * 1e6));
    if (!buf || buf.length < 1200) throw new Error('empty image');
    const got = readSize(buf);
    return { ok: true, provider: name, bytes: buf.length, ms: Date.now() - t0,
             size: got, format: sniffExt(buf),
             honoursSize: !!(got && Math.abs(got.w / got.h - 768 / 1536) < 0.02) };
  } catch (e) {
    return { ok: false, provider: name, ms: Date.now() - t0,
             reason: String(e.message || e).slice(0, 200) };
  }
}

async function testTranslate(sample = 'یک اژدهای بنفش کهکشانی') {
  const t0 = Date.now();
  const r = await toEnglish(sample);
  return { ...r, ms: Date.now() - t0 };
}

module.exports = { chat, viaLLM, sanitizePrompt, LLM_SYSTEM,
                   generate, toEnglish, buildPrompt, prune, CFG, DEVICE_SIZE,
                   hasPersian, selftest, testTranslate, PROVIDERS, sniffExt, readSize };
