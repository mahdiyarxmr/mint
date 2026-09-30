/**
 * miniweb — the slice of Express that Mint actually uses, on node:http only.
 *
 * Written so the project has zero npm dependencies: a registry outage, a paid
 * mirror out of credit, or an offline machine can no longer stop the app from
 * starting. The API deliberately mirrors Express so server.js reads the same.
 *
 * Supported
 *   app.use([path,] fn)          middleware, plus 4-arg (err, req, res, next)
 *   app.get/post(path, ...fns)   with :params
 *   app.set(k, v) / app.settings
 *   app.listen(port, host, cb)
 *   static(dir, { maxAge })      json()      urlencoded({ extended })
 *   req: query params body path originalUrl url method headers ip
 *   res: status json send redirect render setHeader getHeader end locals type
 *
 * Not supported, because nothing here needs it: routers, param middleware,
 * content negotiation, ETags, ranges, streaming uploads, view engine lookup by
 * extension (the renderer is wired in directly).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const mimeFor = (f) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/* '1h' / '30s' / 3600000 -> seconds, for Cache-Control */
function maxAgeSeconds(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Math.floor(v / 1000);
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(String(v).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 'ms'];
  return Math.floor(n * mult);
}

/* '/api/admin/user/:id/edit' -> matcher */
function compileRoute(pattern) {
  if (pattern instanceof RegExp) return { test: (p) => pattern.exec(p) && {}, keys: [] };
  const keys = [];
  const src = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  const re = new RegExp('^' + src + '/?$');
  return {
    keys,
    test(p) {
      const m = re.exec(p);
      if (!m) return null;
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return params;
    },
  };
}

/* ------------------------------------------------------------------ body */
function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* a=1&b=2&x[]=3 — extended mode also folds a[b]=c into nested objects */
function parseQuery(str, extended = true) {
  const out = Object.create(null);
  if (!str) return out;
  for (const pair of String(str).split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const rawK = i === -1 ? pair : pair.slice(0, i);
    const rawV = i === -1 ? '' : pair.slice(i + 1);
    let k, v;
    try { k = decodeURIComponent(rawK.replace(/\+/g, ' ')); } catch { k = rawK; }
    try { v = decodeURIComponent(rawV.replace(/\+/g, ' ')); } catch { v = rawV; }
    if (!extended) { out[k] = v; continue; }
    const m = /^([^[]+)\[([^\]]*)\]$/.exec(k);
    if (m) {
      const [, base, sub] = m;
      if (sub === '') { (out[base] = out[base] || []).push(v); }
      else { (out[base] = out[base] || Object.create(null))[sub] = v; }
    } else if (k in out) {
      out[k] = Array.isArray(out[k]) ? out[k].concat(v) : [out[k], v];
    } else {
      out[k] = v;
    }
  }
  return out;
}

function json() {
  return async function jsonBody(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json') || req._bodyParsed) return next();
    try {
      const raw = (await readBody(req)).toString('utf8');
      req.body = raw ? JSON.parse(raw) : {};
      req._bodyParsed = true;
      next();
    } catch (e) {
      res.status(400).json({ error: 'bad_json', detail: String(e.message).slice(0, 120) });
    }
  };
}

function urlencoded({ extended = true } = {}) {
  return async function urlencodedBody(req, res, next) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/x-www-form-urlencoded') || req._bodyParsed) return next();
    try {
      const raw = (await readBody(req)).toString('utf8');
      req.body = parseQuery(raw, extended);
      req._bodyParsed = true;
      next();
    } catch (e) { next(e); }
  };
}

/* ---------------------------------------------------------------- static */
function staticDir(root, { maxAge = 0, index = false } = {}) {
  const base = path.resolve(root);
  const secs = maxAgeSeconds(maxAge);
  return function serveStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let rel;
    try { rel = decodeURIComponent(req.path); } catch { return next(); }
    // resolve, then confirm the result is still inside root: blocks ../ and
    // absolute paths alike without trying to sanitise the string
    const target = path.resolve(base, '.' + path.sep + rel);
    if (target !== base && !target.startsWith(base + path.sep)) return next();
    let st;
    try { st = fs.statSync(target); } catch { return next(); }
    if (st.isDirectory()) {
      if (!index) return next();
      return serveStatic({ ...req, path: path.posix.join(rel, 'index.html') }, res, next);
    }
    if (!st.isFile()) return next();

    const etag = `W/"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
    res.setHeader('Content-Type', mimeFor(target));
    res.setHeader('Content-Length', st.size);
    res.setHeader('Last-Modified', st.mtime.toUTCString());
    res.setHeader('ETag', etag);
    // An upstream middleware that deliberately set a cache policy wins: the
    // service worker must be served no-cache or the app can pin itself to an
    // old build forever.
    if (secs != null && !res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', `public, max-age=${secs}`);
    }

    const inm = req.headers['if-none-match'];
    const ims = req.headers['if-modified-since'];
    if (inm === etag || (ims && new Date(ims) >= new Date(Math.floor(st.mtimeMs / 1000) * 1000))) {
      res.statusCode = 304;
      return res.end();
    }
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => next()).pipe(res);
  };
}

/* ------------------------------------------------------------------- app */
function createApp() {
  const stack = [];
  const settings = Object.create(null);

  function app(req, res) { handle(req, res); }

  app.settings = settings;
  app.set = (k, v) => { settings[k] = v; return app; };
  app.enable = (k) => app.set(k, true);
  app.disable = (k) => app.set(k, false);

  app.use = function use(a, b) {
    if (typeof a === 'function') stack.push({ method: null, route: null, fn: a, arity: a.length });
    else stack.push({ method: null, route: compileRoute(a), prefix: a, fn: b, arity: b.length });
    return app;
  };

  for (const m of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
    app[m] = function route(pattern, ...fns) {
      // app.get('setting') with no handler is the Express getter
      if (m === 'get' && fns.length === 0) return settings[pattern];
      const route = compileRoute(pattern);
      for (const fn of fns) {
        stack.push({ method: m.toUpperCase(), route, fn, arity: fn.length });
      }
      return app;
    };
  }

  app.listen = function listen(port, host, cb) {
    if (typeof host === 'function') { cb = host; host = undefined; }
    const server = http.createServer(app);
    server.listen(port, host || '0.0.0.0', cb);
    return server;
  };

  function handle(req, res) {
    decorate(req, res, app);
    let i = 0;
    let errored = null;

    const next = (err) => {
      if (err) errored = err;
      while (i < stack.length) {
        const layer = stack[i++];
        const isErrorHandler = layer.arity === 4;
        if (errored && !isErrorHandler) continue;
        if (!errored && isErrorHandler) continue;
        if (layer.method && layer.method !== req.method) continue;
        if (layer.route) {
          const params = layer.route.test(req.path);
          if (!params) continue;
          req.params = params;
        }
        try {
          const out = errored
            ? layer.fn(errored, req, res, (e) => { errored = e || errored; next(); })
            : layer.fn(req, res, next);
          if (out && typeof out.then === 'function') out.catch(next);
        } catch (e) {
          if (errored) { fallback(res, e); return; }
          errored = e;
          return next();
        }
        return;
      }
      if (errored) return fallback(res, errored);
      if (!res.writableEnded) { res.statusCode = 404; res.end('Not Found'); }
    };

    next();
  }

  function fallback(res, err) {
    if (res.writableEnded) return;
    process.stderr.write('[miniweb] unhandled: ' + (err && err.stack || err) + '\n');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }

  return app;
}

function decorate(req, res, app) {
  const host = req.headers.host || 'localhost';
  let parsed;
  try { parsed = new URL(req.url, 'http://' + host); }
  catch { parsed = new URL('/', 'http://localhost'); }

  req.originalUrl = req.url;
  req.path = parsed.pathname;
  req.query = parseQuery(parsed.search.replace(/^\?/, ''), true);
  req.params = {};
  if (req.body === undefined) req.body = {};
  if (!req.ip) {
    const fwd = req.headers['x-forwarded-for'];
    req.ip = (fwd ? String(fwd).split(',')[0].trim() : '') ||
             (req.socket && req.socket.remoteAddress) || '';
  }
  req.get = (h) => req.headers[String(h).toLowerCase()];

  res.locals = res.locals || Object.create(null);

  res.status = (code) => { res.statusCode = code; return res; };

  res.type = (t) => {
    res.setHeader('Content-Type', t.includes('/') ? t : (MIME['.' + t] || t));
    return res;
  };

  res.send = (body) => {
    if (res.writableEnded) return res;
    if (Buffer.isBuffer(body)) {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', body.length);
      res.end(body);
      return res;
    }
    if (body && typeof body === 'object') return res.json(body);
    const s = body == null ? '' : String(body);
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(s));
    res.end(s);
    return res;
  };

  res.json = (obj) => {
    if (res.writableEnded) return res;
    const s = JSON.stringify(obj);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(s));
    res.end(s);
    return res;
  };

  res.redirect = (a, b) => {
    const [code, url] = typeof a === 'number' ? [a, b] : [302, a];
    res.statusCode = code;
    res.setHeader('Location', url);
    // Express also writes a short body, and some clients surface it. Match the
    // same content negotiation: html when the client asks for it, else text.
    const accept = String(req.headers.accept || '');
    const reason = http.STATUS_CODES[code] || 'Redirecting';
    let body;
    if (/\btext\/html\b/.test(accept)) {
      const safe = escapeHtml(url);
      body = `<p>${reason}. Redirecting to <a href="${safe}">${safe}</a></p>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else {
      body = `${reason}. Redirecting to ${url}`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(req.method === 'HEAD' ? undefined : body);
    return res;
  };

  res.render = (view, data, cb) => {
    const engine = app.settings.render;
    if (typeof engine !== 'function') {
      throw new Error("no renderer: app.set('render', fn) is required");
    }
    const merged = Object.assign(Object.create(null), res.locals, data || {});
    let html;
    try {
      html = engine(view, merged);
    } catch (e) {
      if (cb) return cb(e);
      throw e;
    }
    if (cb) return cb(null, html);
    return res.send(html);
  };
}

module.exports = createApp;
module.exports.static = staticDir;
module.exports.json = json;
module.exports.urlencoded = urlencoded;
module.exports.escapeHtml = escapeHtml;
module.exports.parseQuery = parseQuery;
module.exports.mimeFor = mimeFor;
