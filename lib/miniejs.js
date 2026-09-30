/**
 * miniejs — an EJS-compatible renderer for the subset Mint's 33 views use.
 *
 * Tags
 *   <% code %>        run a statement
 *   <%= value %>      print, HTML-escaped
 *   <%- value %>      print raw
 *   <%# note %>       comment, dropped
 *   <%% / %%>         a literal delimiter
 * Whitespace control (`<%_`, `-%>`, `_%>`) is honoured too, so a view that
 * starts using it later will not silently change output.
 *
 * Locals are exposed as bare identifiers via `with`, exactly like EJS, which is
 * why views can say `<%= title %>` and test `typeof noChrome === 'undefined'`.
 *
 * include('../partials/head', { extra: 1 })
 *   resolves relative to the including file, inherits that file's locals, and
 *   returns a string — used as `<%- include(...) %>`, the EJS 3 convention.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' };
function escapeXML(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

const cache = new Map();

function resolveView(name, { root, from }) {
  let p = String(name);
  if (!path.extname(p)) p += '.ejs';
  const candidates = p.startsWith('/')
    ? [path.join(root, p)]
    : [from ? path.resolve(path.dirname(from), p) : null, path.resolve(root, p)].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const tried = candidates.map((c) => path.relative(root, c)).join(', ');
  throw new Error(`view not found: ${name} (looked in ${tried})`);
}

/** Turn template text into the body of a JS function. */
function compileSource(text) {
  let src = "let __o='';\n";
  const push = (s) => {
    if (!s) return;
    src += '__o+=' + JSON.stringify(s) + ';\n';
  };

  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('<%', i);
    if (open === -1) { push(text.slice(i)); break; }
    push(text.slice(i, open));

    if (text.startsWith('<%%', open)) { push('<%'); i = open + 3; continue; }

    let p = open + 2;
    let mode = '';
    if ('=-#_'.includes(text[p])) { mode = text[p]; p += 1; }

    // find the matching close, skipping %%>
    let close = p;
    for (;;) {
      close = text.indexOf('%>', close);
      if (close === -1) throw new Error('unclosed <% tag');
      if (text[close - 1] === '%') { close += 2; continue; }
      break;
    }

    let code = text.slice(p, close);
    let after = close + 2;
    let trimNewline = false;
    if (code.endsWith('-') || code.endsWith('_')) { code = code.slice(0, -1); trimNewline = true; }
    if (mode === '_') code = code.replace(/^\s+/, '');
    code = code.replace(/%%>/g, '%>');

    if (mode === '#') {
      /* comment */
    } else if (mode === '=') {
      src += '__o+=__esc(' + (code.trim() || 'undefined') + ');\n';
    } else if (mode === '-') {
      src += '__o+=((__t)=>__t==null?"":__t)(' + (code.trim() || 'undefined') + ');\n';
    } else {
      src += code + '\n';
    }

    if (trimNewline) {
      if (text[after] === '\n') after += 1;
      else if (text[after] === '\r' && text[after + 1] === '\n') after += 2;
    }
    i = after;
  }

  src += 'return __o;';
  return src;
}

function compile(file, opts) {
  const key = file;
  const stat = fs.statSync(file);
  const hit = cache.get(key);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.fn;

  const text = fs.readFileSync(file, 'utf8');
  const body = compileSource(text);
  let fn;
  try {
    // sloppy mode on purpose: `with` is how EJS exposes locals as bare names
    // the third parameter is literally named `include` so that `with(locals)`
    // falls through to it and views can call include(...) the way EJS allows
    fn = new Function('locals', '__esc', 'include',
      'with(locals){\n' + body + '\n}');
  } catch (e) {
    throw new Error(`template compile failed in ${path.relative(opts.root, file)}: ${e.message}`);
  }
  cache.set(key, { fn, mtimeMs: stat.mtimeMs });
  return fn;
}

/**
 * @param {string} name   view name, e.g. 'pages/admin'
 * @param {object} data   locals
 * @param {object} opts   { root, cache }
 */
function render(name, data, opts) {
  const root = opts.root;
  const file = resolveView(name, { root, from: opts.from });
  const fn = compile(file, { root });

  const locals = Object.assign(Object.create(null), data || {});
  locals.locals = locals;

  const include = (childName, childData) => {
    const merged = Object.assign(Object.create(null), locals, childData || {});
    delete merged.locals;
    return render(childName, merged, { root, from: file });
  };

  try {
    return fn(locals, escapeXML, include);
  } catch (e) {
    e.message = `${path.relative(root, file)}: ${e.message}`;
    throw e;
  }
}

/** Build the function app.set('render', …) expects. */
function engine({ root, cache: useCache = true }) {
  if (!useCache) cache.clear();
  return function renderView(name, data) {
    if (!useCache) cache.clear();
    return render(name, data, { root });
  };
}

module.exports = { engine, render, compileSource, escapeXML, clearCache: () => cache.clear() };
