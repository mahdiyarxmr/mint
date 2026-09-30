/**
 * Minimal PNG reader/writer — no dependencies, Node zlib only.
 *
 * Why this exists: some providers ignore the requested width/height and always
 * answer 1024x1024. A phone case needs 1:2, a keyboard needs 2.4:1. Rather than
 * ship a square image and let CSS hide the mismatch, we centre-crop the pixels
 * to the target ratio so the file on disk really is the shape it claims to be.
 *
 * Scope: 8-bit truecolour PNGs (colour type 2 and 6), non-interlaced. That is
 * what every Workers AI / diffusion endpoint emits. Anything else is returned
 * untouched, which is safe: the caller keeps the original bytes.
 */
'use strict';
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Header only — cheap, used to decide whether a crop is needed at all. */
function info(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(SIG)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    depth: buf[24],
    colour: buf[25],
    interlace: buf[28],
  };
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Inflate IDAT and undo the per-scanline filters. Returns raw pixel rows. */
function decode(buf) {
  const head = info(buf);
  if (!head || head.depth !== 8 || head.interlace !== 0) return null;
  const bpp = CHANNELS[head.colour];
  if (!bpp || (head.colour !== 2 && head.colour !== 6)) return null;

  const parts = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') parts.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!parts.length) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(parts));
  } catch {
    return null;
  }

  const stride = head.width * bpp;
  if (raw.length < (stride + 1) * head.height) return null;

  const px = Buffer.alloc(stride * head.height);
  for (let y = 0; y < head.height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[up + x] : 0;
      const c = x >= bpp && y > 0 ? px[up + x - bpp] : 0;
      const v = raw[src + x];
      let out;
      switch (filter) {
        case 0: out = v; break;
        case 1: out = v + a; break;
        case 2: out = v + b; break;
        case 3: out = v + ((a + b) >> 1); break;
        case 4: out = v + paeth(a, b, c); break;
        default: return null;
      }
      px[dst + x] = out & 0xff;
    }
  }
  return { ...head, bpp, stride, px };
}

/** Re-encode raw pixels. Filter 0 everywhere; zlib does the real work. */
function encode(px, width, height, colour) {
  const bpp = CHANNELS[colour];
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colour;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Centre-crop to the widest rectangle of ratio w/h that fits, the same framing
 * CSS object-fit:cover would pick, but baked into the file.
 * Returns the original buffer unchanged when it already matches, when the
 * format is unsupported, or when anything goes wrong.
 */
function fitTo(buf, wantW, wantH, tolerance = 0.02) {
  const head = info(buf);
  if (!head || !wantW || !wantH) return { buf, changed: false, reason: 'not-png' };

  const have = head.width / head.height;
  const want = wantW / wantH;
  if (Math.abs(have - want) <= tolerance) {
    return { buf, changed: false, reason: 'already-correct', width: head.width, height: head.height };
  }

  const img = decode(buf);
  if (!img) return { buf, changed: false, reason: 'unsupported-png' };

  let cw = img.width;
  let ch = img.height;
  if (have > want) cw = Math.max(1, Math.round(img.height * want));
  else ch = Math.max(1, Math.round(img.width / want));

  const x0 = Math.floor((img.width - cw) / 2);
  const y0 = Math.floor((img.height - ch) / 2);

  const outStride = cw * img.bpp;
  const out = Buffer.alloc(outStride * ch);
  for (let y = 0; y < ch; y++) {
    const from = (y0 + y) * img.stride + x0 * img.bpp;
    img.px.copy(out, y * outStride, from, from + outStride);
  }

  let encoded;
  try {
    encoded = encode(out, cw, ch, img.colour);
  } catch {
    return { buf, changed: false, reason: 'encode-failed' };
  }
  return { buf: encoded, changed: true, reason: 'cropped', width: cw, height: ch,
           from: { width: img.width, height: img.height } };
}

module.exports = { info, decode, encode, fitTo, crc32 };
