/**
 * Mint image endpoint — Cloudflare Worker
 * ---------------------------------------
 * Drop-in replacement for free-image-generation-api.*.workers.dev.
 *
 * What changed vs. the first version
 *   1. width / height are honoured. The first version always returned
 *      1024x1024, which breaks device-shaped artwork (a phone case needs 1:2,
 *      a keyboard needs 2.4:1).
 *   2. The model is chosen from the requested shape:
 *        square  -> flux-1-schnell   (best quality, but 1024x1024 only)
 *        other   -> sdxl-lightning   (accepts width/height, 4 steps, fast)
 *      A caller may force one with "model".
 *   3. Content-Type is sniffed from the bytes instead of hard-coded, so the
 *      header stops claiming image/jpeg over PNG data.
 *   4. The key lives in an environment secret, not in the source.
 *   5. CORS + OPTIONS, so a browser can call it directly.
 *   6. GET /health returns JSON without spending Neurons.
 *
 * Deploy
 *   wrangler secret put API_KEY          <- paste a fresh long random key
 *   wrangler deploy
 *
 * wrangler.toml
 *   name = "free-image-generation-api"
 *   main = "src/worker.js"
 *   compatibility_date = "2026-01-01"
 *   [ai]
 *   binding = "AI"
 *
 * Request
 *   POST /
 *   Authorization: Bearer <API_KEY>
 *   { "prompt": "...", "width": 768, "height": 1536, "seed": 12345,
 *     "steps": 4, "negative_prompt": "...", "model": "sdxl" }
 *
 * Response
 *   200 raw image bytes (image/png or image/jpeg, whichever the model made)
 *   Header X-Image-Size: 768x1536 and X-Model: <id used>
 */

const MODELS = {
  flux: '@cf/black-forest-labs/flux-1-schnell',
  sdxl: '@cf/bytedance/stable-diffusion-xl-lightning',
  sdxlbase: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  dreamshaper: '@cf/lykon/dreamshaper-8-lcm',
};

const MAX_PROMPT = 1500;
const MIN_PX = 256;
const MAX_PX = 2048;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });

/* Workers AI rejects sizes that are not multiples of 8. */
const snap = (n, fallback) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.round(v / 8) * 8));
};

/* Trust the bytes, not the model's documentation. */
function contentType(bytes) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length > 12 &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

/* Constant-time-ish compare so the key cannot be probed byte by byte. */
function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    if (request.method === 'GET') {
      return json({
        ok: true,
        service: 'mint-image',
        usage: 'POST / with Authorization: Bearer <key> and {"prompt","width","height"}',
        models: Object.keys(MODELS),
        maxPrompt: MAX_PROMPT,
        sizeRange: [MIN_PX, MAX_PX],
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    /* ---- auth ---------------------------------------------------------- */
    const secret = env.API_KEY;
    if (!secret) return json({ error: 'server_misconfigured', detail: 'API_KEY secret is not set' }, 500);

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!sameKey(token, secret)) {
      return json({ error: 'unauthorized' }, 401);
    }

    /* ---- body ---------------------------------------------------------- */
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }

    const prompt = String(body.prompt || '').trim();
    if (!prompt) return json({ error: 'prompt_required' }, 400);
    if (prompt.length > MAX_PROMPT) return json({ error: 'prompt_too_long', max: MAX_PROMPT }, 400);

    const width = snap(body.width, 1024);
    const height = snap(body.height, 1024);
    const square = width === height;

    /* ---- model choice --------------------------------------------------- */
    const asked = String(body.model || '').toLowerCase();
    let key = MODELS[asked] ? asked : (square ? 'flux' : 'sdxl');
    // flux cannot resize; never let it serve a non-square request.
    if (key === 'flux' && !square) key = 'sdxl';
    const model = MODELS[key];

    /* ---- inputs --------------------------------------------------------- */
    const seed = Number.isFinite(Number(body.seed))
      ? Math.abs(Math.trunc(Number(body.seed))) % 4294967295
      : Math.floor(Math.random() * 4294967295);

    const inputs = key === 'flux'
      ? { prompt, seed, steps: Math.min(8, Math.max(1, Number(body.steps) || 4)) }
      : {
          prompt,
          width,
          height,
          seed,
          num_steps: Math.min(20, Math.max(1, Number(body.steps) || (key === 'sdxl' ? 4 : 20))),
          negative_prompt: String(body.negative_prompt || 'blurry, low quality, watermark, text, signature'),
          ...(body.guidance ? { guidance: Number(body.guidance) } : {}),
        };

    /* ---- run ------------------------------------------------------------ */
    let out;
    try {
      out = await env.AI.run(model, inputs);
    } catch (err) {
      return json({ error: 'inference_failed', model, detail: String(err).slice(0, 300) }, 502);
    }

    /* flux answers { image: "<base64>" }; the SD family answers a byte stream. */
    let bytes;
    if (out && typeof out === 'object' && typeof out.image === 'string') {
      const bin = atob(out.image);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (out instanceof ReadableStream) {
      bytes = new Uint8Array(await new Response(out).arrayBuffer());
    } else if (out instanceof ArrayBuffer) {
      bytes = new Uint8Array(out);
    } else {
      return json({ error: 'unexpected_model_output', model, got: typeof out }, 502);
    }

    if (bytes.length < 1024) {
      return json({ error: 'empty_image', model, bytes: bytes.length }, 502);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType(bytes),
        'Content-Length': String(bytes.length),
        'Cache-Control': 'no-store',
        'X-Model': model,
        'X-Image-Size': key === 'flux' ? '1024x1024' : `${width}x${height}`,
        'X-Seed': String(seed),
        ...CORS,
      },
    });
  },
};
