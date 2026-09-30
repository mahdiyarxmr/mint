// Mint — server-rendered multi-page app
// architecture/routing.md: public / authenticated / commerce / admin route groups,
// named routes, rate limiting on auth, uploads, AI, exports and expensive search.

/* Load .env with no dependency — any key already in the environment wins. */
try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8')
    .split('\n').forEach(line => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch { /* no .env — anonymous Pollinations tier is used */ }

const path = require('path');
/* No npm dependencies: these two are the slice of express and ejs this app uses,
   implemented on Node built-ins in lib/. See README "Zero dependencies". */
const express = require('./lib/miniweb');
const miniejs = require('./lib/miniejs');
const db = require('./data/catalog');
const { icon, brandMark, brandWord } = require('./data/icons');
const deviceLib = require('./data/devices');
const { LOCALES, translator, formatters } = require('./data/i18n');
const store = require('./lib/store');
const ai = require('./lib/ai');
const config = require('./lib/config');

const app = express();
const PORT = process.env.PORT || 3000;

const VIEWS = path.join(__dirname, 'views');
app.set('views', VIEWS);
app.set('render', miniejs.engine({ root: VIEWS }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
/* The service worker must never be served stale or the app can pin itself to an
   old build; everything else keeps the one-hour cache. */
app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path === '/manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// --- locale + view globals --------------------------------------------------
// localization/languages.md: fa is the default locale; dir is derived, never hardcoded.
const SUPPORTED = Object.keys(LOCALES);

app.use((req, res, next) => {
  let lang = req.query.lang;
  if (SUPPORTED.includes(lang)) {
    res.setHeader('Set-Cookie', `mint_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
  } else {
    const m = /(?:^|;\s*)mint_lang=(fa|en)/.exec(req.headers.cookie || '');
    lang = m ? m[1] : 'fa';
  }

  const f = formatters(lang);
  res.locals.lang = lang;
  res.locals.dir = LOCALES[lang].dir;
  res.locals.rtl = LOCALES[lang].dir === 'rtl';
  res.locals.locales = LOCALES;
  res.locals.t = translator(lang);
  res.locals.num = f.num;
  res.locals.money = f.money;
  // localised field picker: L(item,'title') -> title_fa when the locale is fa
  res.locals.L = (o, field) => (lang === 'fa' && o[field + '_fa']) ? o[field + '_fa'] : o[field];
  res.locals.tag = (g) => lang === 'fa' ? (db.styleTagFa[g] || g) : g;
  // same page in a given language — used by the two-state language switch
  res.locals.langHref = (code) => {
    const q = new URLSearchParams(req.query);
    q.set('lang', code);
    return req.path + '?' + q.toString();
  };

  // ---- session ----------------------------------------------------------
  const sid = (/(?:^|;\s*)mint_sid=([a-f0-9]+)/.exec(req.headers.cookie || '') || [])[1];
  const me = store.sessionUser(sid);
  req.me = me; req.sid = sid;

  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.me = me;
  res.locals.authed = !!me;
  res.locals.isAdmin = !!me && me.role === 'admin';
  // the profile/dashboard pages render whoever is signed in, else the demo persona
  res.locals.user = me ? { ...db.user, ...me } : db.user;
  res.locals.coinValue = store.COIN_VALUE;
  res.locals.coinsFor = store.coinsFor;
  res.locals.planActive = store.planActive;
  res.locals.announcements = store.activeAnnouncements();
  res.locals.icon = icon;
  res.locals.brandMark = brandMark;
  res.locals.brandWord = brandWord;
  res.locals.db = db;
  res.locals.allDevices = deviceLib.devices;
  next();
});

const page = (view, title, extra = {}) => (req, res) =>
  res.render('pages/' + view, { title, ...extra });

const wantsJson = (req) => req.path.startsWith('/api/');
function requireAuth(req, res, next) {
  if (req.me) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'auth_required' });
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}
function requireAdmin(req, res, next) {
  if (req.me && req.me.role === 'admin') return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'forbidden' });
  return res.status(403).render('pages/403', { title: 'Forbidden' });
}
const setSid = (res, sid) =>
  res.setHeader('Set-Cookie', `mint_sid=${sid}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);

// --- naive in-memory rate limiter (architecture/routing.md) -----------------
const buckets = new Map();
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = name + ':' + req.ip;
    const now = Date.now();
    const b = buckets.get(key) || { n: 0, reset: now + windowMs };
    if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
    b.n++; buckets.set(key, b);
    if (b.n > max) {
      return res.status(429).json({ error: 'rate_limited', retry_after_ms: b.reset - now });
    }
    next();
  };
}

/* ========================= PUBLIC ROUTES ================================= */

app.get('/', (req, res) => res.render('pages/home', {
  title: 'Design Your Digital World',
  templates: db.templates.slice(0, 5),
  plans: db.plans,
  bare: true,
}));

app.get('/templates', (req, res) => {
  const cat = req.query.cat || 'all';
  const q = (req.query.q || '').toLowerCase().trim();
  const sort = req.query.sort || 'popular';
  let list = db.templates.filter(t => cat === 'all' || t.category === cat);
  if (q) list = list.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.catLabel.toLowerCase().includes(q) ||
    t.tags.some(g => g.toLowerCase().includes(q)));
  if (sort === 'new') list = [...list].reverse();
  if (sort === 'likes') list = [...list].sort((a, b) => b.likes - a.likes);
  else if (sort === 'popular') list = [...list].sort((a, b) => b.uses - a.uses);
  res.render('pages/templates', {
    title: 'Templates', categories: db.categories, list, cat, q, sort,
  });
});

app.get('/explore', (req, res) => {
  const activeTag = req.query.tag || 'All';
  const list = activeTag === 'All' ? db.templates : db.templates.filter(t => t.tags.includes(activeTag));
  res.render('pages/explore', { title: 'Explore', list, activeTag, tags: ['All', ...db.styleTags] });
});

app.get('/marketplace', (req, res) => {
  const kind = req.query.kind || 'All';
  const q = (req.query.q || '').toLowerCase().trim();
  let list = db.products.filter(p =>
    kind === 'All' ||
    (kind === 'PSD Files' && p.kind === 'PSD File') ||
    (kind === 'Bundles' && p.kind === 'Bundle') ||
    (kind === 'Assets' && p.kind === 'Assets'));
  if (q) list = list.filter(p => p.title.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q));
  res.render('pages/marketplace', {
    title: 'Marketplace', list, kind, q,
    kinds: ['All', 'PSD Files', 'Bundles', 'Assets'],
  });
});

app.get('/pricing', page('pricing', 'Pricing', { plans: db.plans }));
app.get('/help', page('help', 'Help Center', { faqs: db.faqs }));
app.get('/legal', (req, res) => res.render('pages/legal', {
  title: 'Legal', doc: req.query.doc || 'terms',
}));
app.get('/login', (req, res) => {
  if (req.me) return res.redirect('/dashboard');
  res.render('pages/auth', {
    title: 'Sign In', mode: req.query.mode === 'signup' ? 'signup' : 'login', bare: true, noChrome: true,
    error: req.query.error || '', next: req.query.next || '/dashboard', prefill: req.query.u || '',
  });
});

app.post('/login', rateLimit('login', 20, 60_000), (req, res) => {
  const { login = '', password = '', next: nx = '/dashboard' } = req.body || {};
  const u = store.findByLogin(login);
  const back = (code) => res.redirect('/login?error=' + code + '&u=' + encodeURIComponent(login) +
                                      '&next=' + encodeURIComponent(nx));
  if (!u || !store.verify(password, u.salt, u.hash)) return back('bad');
  if (u.banned) return back('banned');
  setSid(res, store.startSession(u.id));
  res.redirect(nx.startsWith('/') ? nx : '/dashboard');
});

app.post('/signup', rateLimit('signup', 10, 60_000), (req, res) => {
  const { username = '', email = '', password = '' } = req.body || {};
  const back = (c) => res.redirect('/login?mode=signup&error=' + c + '&u=' + encodeURIComponent(username));
  if (username.trim().length < 3) return back('username');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return back('email');
  if (String(password).length < 8) return back('password');
  if (store.findByLogin(username) || store.findByLogin(email)) return back('taken');
  const u = store.createUser({ username, email, password,
    coins: config.get('signupCoins'), credits: config.get('signupCredits') });
  setSid(res, store.startSession(u.id));
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  store.endSession(req.sid);
  res.setHeader('Set-Cookie', 'mint_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.redirect('/');
});

/* ==================== AUTHENTICATED / CREATOR ============================ */

app.get('/dashboard', requireAuth, page('dashboard', 'Dashboard', {
  designs: db.recentDesigns, quests: db.quests, shell: 'app',
}));
app.get('/projects', requireAuth, page('projects', 'My Designs', {
  designs: db.recentDesigns, shell: 'app',
}));
app.get('/editor', requireAuth, (req, res) => res.render('pages/editor', {
  title: 'Editor',
  panels: db.editorPanels, tools: db.editorTools, palette: db.palette,
  templates: db.templates, bare: true,
  devices: deviceLib.devices,
  device: deviceLib.byId(req.query.device),
}));
app.get('/ai-studio', requireAuth, (req, res) => res.render('pages/ai-studio', {
  title: 'AI Studio', styles: db.aiStyles, history: db.aiHistory, bare: true,
}));
app.get('/profile', requireAuth, page('profile', 'Profile', {
  designs: db.recentDesigns, achievements: db.achievements,
}));
app.get('/collections', requireAuth, page('collections', 'Collections', {
  collections: db.collections, shell: 'app',
}));
app.get('/achievements', requireAuth, page('achievements', 'Achievements', {
  achievements: db.achievements, quests: db.quests, shell: 'app',
}));
app.get('/leaderboard', page('leaderboard', 'Leaderboard', {
  rows: db.leaderboard, shell: 'app',
}));
app.get('/notifications', requireAuth, page('notifications', 'Notifications', {
  items: db.notifications, shell: 'app',
}));
app.get('/downloads', requireAuth, page('downloads', 'Downloads', {
  items: db.downloads, shell: 'app',
}));
app.get('/purchases', requireAuth, page('purchases', 'Purchases', {
  items: db.purchases, shell: 'app',
}));
app.get('/settings', requireAuth, (req, res) => res.render('pages/settings', {
  title: 'Settings', tab: req.query.tab || 'account', plans: db.plans, shell: 'app',
}));

/* ============================== ADMIN ==================================== */

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const q = req.query.q || '';
  res.render('pages/admin', {
    title: 'Admin', products: db.products, templates: db.templates,
    tab: ['users', 'announce', 'settings'].includes(req.query.tab) ? req.query.tab : 'overview',
    q, userList: store.searchUsers(q).map(store.publicUser),
    allUsers: store.users.length,
    anns: store.announcements,
    cfg: config.publicView(),
    providers: Object.keys(ai.PROVIDERS),
    aiCfg: {
      provider: config.get('provider'),
      keyed: !!(config.get('pollinationsToken') || (config.get('cfAccount') && config.get('cfToken')) ||
                config.get('hfToken') || config.get('openaiKey')),
      translate: config.get('translate'),
      site: 'https://pollinations.ai',
    },
  });
});

/* =============================== API ===================================== */
// api/endpoints.md groups. Mocked, but with real shapes, states and errors.

app.post('/api/ai/generate', requireAuth, rateLimit('ai', 12, 60_000), async (req, res) => {
  const { prompt = '', style = '', device = 'phone', count = 2 } = req.body || {};
  if (!prompt.trim()) {
    return res.status(422).json({ error: 'validation_failed', field: 'prompt',
      message: res.locals.t('ai.needPrompt') });
  }
  const dev = deviceLib.devices.some(d => d.id === device) ? device : 'phone';
  const n = Math.min(Math.max(+count || 1, 1), config.get('maxPerRequest'));

  // Pay: AI credits first, coins as the fallback.
  const charges = [];
  for (let i = 0; i < n; i++) {
    const c = store.chargeGeneration(req.me);
    if (!c.ok) {
      if (!charges.length) {
        return res.status(402).json({
          error: 'insufficient_credits', credits: req.me.credits, coins: req.me.coins,
          coinCost: store.AI_COIN_COST, message: res.locals.t('ai.noCredits'),
        });
      }
      break;
    }
    charges.push(c);
  }

  const pool = ['tpl-cyber-dragon', 'tpl-minimal-purple', 'tpl-anime-girl',
                'tpl-forest-vibes', 'tpl-neon-galaxy', 'tpl-purple-core']
                .map(x => '/img/' + x + '.webp');

  const jobs = charges.map(() => ai.generate({ prompt, style, device: dev, fallbackImages: pool }));
  const out = await Promise.all(jobs);
  ai.prune();

  const last = charges[charges.length - 1];
  res.json({
    ok: true,
    credits_spent: charges.reduce((a, c) => a + (c.paidWith === 'credits' ? c.spent : 0), 0),
    coins_spent: charges.reduce((a, c) => a + (c.paidWith === 'coins' ? c.spent : 0), 0),
    paid_with: last.paidWith,
    credits_left: req.me.credits, coins_left: req.me.coins,
    device: dev, ratio: deviceLib.byId(dev).w / deviceLib.byId(dev).h,
    live: out.some(o => o.live),
    provider: out[0].provider,
    translated: out[0].translated,
    prompt_en: out[0].prompt_en,
    results: out.map((o, i) => ({
      id: 'g' + Date.now() + i, img: o.url, prompt, style, device: dev, live: o.live,
    })),
  });
});

/* ------------------------------- coins / checkout ----------------------- */
app.post('/api/coins/buy', requireAuth, (req, res) => {
  const item = db.products.find(p => p.id === String(req.body?.id || ''));
  if (!item) return res.status(404).json({ error: 'not_found' });
  const r = store.buyWithCoins(req.me, item);
  if (!r.ok) {
    return res.status(402).json({ error: 'insufficient_coins', need: r.need, coins: r.coins,
      message: res.locals.t('coins.short') });
  }
  res.json({ ok: true, coins_left: r.coins, spent: r.cost,
             title: res.locals.L(item, 'title'), message: res.locals.t('coins.bought') });
});

app.get('/api/coins/me', requireAuth, (req, res) =>
  res.json({ coins: req.me.coins, credits: req.me.credits,
             plan: req.me.plan, planActive: store.planActive(req.me) }));

/* ---------------------------------- admin ------------------------------- */
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) =>
  res.json({ ok: true, users: store.searchUsers(req.query.q || '').map(store.publicUser) }));

app.post('/api/admin/user/:id', requireAuth, requireAdmin, (req, res) => {
  const u = store.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const { action, amount, plan, days, itemId } = req.body || {};
  switch (action) {
    case 'coins':   store.grantCoins(u, +amount || 0); break;
    case 'credits': store.grantCredits(u, +amount || 0); break;
    case 'plan':    store.grantPlan(u, plan || 'pro', +days || 30); break;
    case 'gift': {
      const item = db.products.find(p => p.id === itemId);
      if (!item) return res.status(404).json({ error: 'item_not_found' });
      store.giftItem(u, item, req.me.username);
      break;
    }
    case 'ban':     u.banned = true;  store.save(); break;
    case 'unban':   u.banned = false; store.save(); break;
    case 'role':    u.role = u.role === 'admin' ? 'user' : 'admin'; store.save(); break;
    default: return res.status(422).json({ error: 'unknown_action' });
  }
  res.json({ ok: true, user: store.publicUser(u) });
});

/* ---- settings: read, write, and live-test the image provider -------------- */
app.get('/api/admin/config', requireAuth, requireAdmin, (req, res) =>
  res.json({ ok: true, config: config.publicView(), defaults: config.DEFAULTS,
             providers: Object.keys(ai.PROVIDERS) }));

app.post('/api/admin/config', requireAuth, requireAdmin, (req, res) => {
  const { __clear, ...patch } = req.body || {};
  if (__clear) config.clear(__clear);
  const changed = config.set(patch);
  res.json({ ok: true, changed, config: config.publicView() });
});

app.post('/api/admin/config/reset', requireAuth, requireAdmin, (req, res) => {
  config.reset();
  res.json({ ok: true, config: config.publicView() });
});

app.post('/api/admin/ai/test', requireAuth, requireAdmin, async (req, res) => {
  const [img, tr] = await Promise.all([ai.selftest(), ai.testTranslate()]);
  res.json({ ok: true, image: img, translate: tr });
});

/* ---- full account administration ----------------------------------------- */
app.post('/api/admin/user/:id/edit', requireAuth, requireAdmin, (req, res) => {
  const u = store.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  try {
    const changed = store.updateUser(u, req.body || {});
    res.json({ ok: true, changed, user: store.publicUser(u) });
  } catch (e) {
    res.status(422).json({ error: 'validation_failed', message: String(e.message) });
  }
});

app.post('/api/admin/user/:id/delete', requireAuth, requireAdmin, (req, res) => {
  if (+req.params.id === req.me.id) {
    return res.status(422).json({ error: 'self_delete', message: 'You cannot delete your own account.' });
  }
  try {
    const gone = store.deleteUser(req.params.id);
    if (!gone) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(422).json({ error: 'refused', message: String(e.message) });
  }
});

app.post('/api/admin/users/bulk', requireAuth, requireAdmin, (req, res) => {
  const { ids = [], coins = 0, credits = 0, plan, days } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(422).json({ error: 'no_users' });
  const n = store.bulkGrant(ids, { coins: +coins, credits: +credits, plan, days: +days });
  res.json({ ok: true, updated: n });
});

app.post('/api/admin/announce', requireAuth, requireAdmin, (req, res) => {
  const { title = '', body = '', level = 'info', id, op } = req.body || {};
  if (op === 'delete' && id) { store.removeAnnouncement(id); return res.json({ ok: true }); }
  if (op === 'toggle' && id) {
    const a = store.announcements.find(x => x.id === id);
    return res.json({ ok: true, a: store.setAnnouncement(id, { active: !a.active }) });
  }
  if (!title.trim() || !body.trim()) return res.status(422).json({ error: 'validation_failed' });
  res.json({ ok: true, a: store.addAnnouncement({ title: title.trim(), body: body.trim(), level }) });
});

app.post('/api/projects/save', rateLimit('save', 30, 60_000), (req, res) => {
  res.json({ ok: true, saved_at: new Date().toISOString(), version: Math.floor(Math.random() * 40) + 2 });
});

app.post('/api/xp/event', (req, res) => {
  const gain = Number(req.body?.xp) || 10;
  db.user.xp += gain;
  const lv = db.levelFor(db.user.xp);
  res.json({ ok: true, xp: db.user.xp, level: lv.level, level_name: res.locals.L(lv, 'name') });
});

app.get('/api/search', rateLimit('search', 40, 60_000), (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ results: [] });
  // match either language's title, and answer in the caller's locale
  const { L, money } = res.locals;
  const hit = (o) => (o.title || '').toLowerCase().includes(q) ||
                     (o.title_fa || '').toLowerCase().includes(q);
  const results = [
    ...db.templates.filter(hit).map(t => ({
      type: 'template', id: t.id, title: L(t, 'title'), sub: L(t, 'catLabel'),
      img: '/img/' + t.img + '.webp', href: '/templates?q=' + encodeURIComponent(t.title),
    })),
    ...db.products.filter(hit).map(p => ({
      type: 'product', id: p.id, title: L(p, 'title'), sub: money(p.price),
      img: '/img/' + p.img + '.webp', href: '/marketplace?q=' + encodeURIComponent(p.title),
    })),
  ].slice(0, 6);
  res.json({ results });
});

/* ============================= FALLBACKS ================================= */

app.get('/offline', page('offline', 'Offline'));

app.use((req, res) => res.status(404).render('pages/404', { title: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('pages/500', { title: 'Something broke' });
});

/* Print the LAN address too: testing on a phone needs it, and the service
   worker only registers on localhost or HTTPS, which is worth saying once
   rather than leaving as a mystery when Install never appears. */
function lanAddress() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddress();
  console.log(`\n  Mint is running.\n`);
  console.log(`    on this computer   http://localhost:${PORT}`);
  if (lan) console.log(`    on your phone      http://${lan}:${PORT}   (same Wi-Fi)`);
  console.log(`\n  Sign in as  admin / admin123`);
  console.log(`  Stop with   Ctrl+C`);
  if (lan) {
    console.log(`\n  Note: the phone URL above shows the full responsive site, but`);
    console.log(`  "Install app" and offline mode need HTTPS or localhost - see`);
    console.log(`  "Installing on a phone" in README.md.`);
  }
  console.log('');
});
