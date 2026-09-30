/* Mint — users, sessions, announcements and the coin ledger.
   JSON-file backed so a restart doesn't wipe accounts. No external deps:
   passwords use scrypt from node:crypto. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'db.json');

/* Economy knobs live in lib/config.js so an admin can change them at runtime. */
const config = require('./config');
const COIN_VALUE = () => config.get('coinValue');
const AI_COIN_COST = () => config.get('aiCoinCost');
const AI_CREDIT_COST = () => config.get('aiCreditCost');

const blank = { users: [], sessions: {}, announcements: [], orders: [], nextId: 1 };
let db = { ...blank };

/* ------------------------------------------------------------ persistence */
function load() {
  try {
    db = { ...blank, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch { db = { ...blank }; }
  seed();
}
let writeTimer = null;
function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
    } catch (e) { console.error('store save failed:', e.message); }
  }, 120);
}

/* ------------------------------------------------------------- passwords */
function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash: h };
}
function verify(password, salt, expected) {
  const h = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(h), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ users */
const norm = (s) => String(s || '').trim().toLowerCase();

function createUser({ username, email, password, role = 'user', name, coins = 0, credits = 20 }) {
  if (db.users.some(u => norm(u.username) === norm(username))) throw new Error('username taken');
  const { salt, hash: h } = hash(password);
  const u = {
    id: db.nextId++,
    username: String(username).trim(),
    email: String(email || '').trim(),
    salt, hash: h, role,
    name: name || String(username).trim(),
    name_fa: name || String(username).trim(),
    bio: '', bio_fa: '',
    coins, credits, creditsTotal: Math.max(credits, 20),
    plan: 'free', planUntil: null,
    xp: 0, designs: 0, favorites: 0, purchases: 0, streak: 0,
    banned: false,
    createdAt: new Date().toISOString(),
  };
  db.users.push(u); save();
  return u;
}
const findByLogin = (v) =>
  db.users.find(u => norm(u.username) === norm(v) || norm(u.email) === norm(v));
const findById = (id) => db.users.find(u => u.id === +id);

function seed() {
  if (!db.users.length) {
    createUser({ username: 'admin', email: 'admin@mint.design', password: 'admin123',
                 role: 'admin', name: 'مدیر Mint', coins: 5000, credits: 9999 });
    const demo = [
      ['mahdiyarxmr', 'mahdiyar@mint.design', 'mahdiyar', 'مهدیار توکلی', 1200, 340],
      ['nocturne', 'nocturne@mint.design', 'nocturne1', 'Nocturne', 300, 120],
      ['yuki.dsg', 'yuki@mint.design', 'yukiyuki', 'Yuki', 80, 40],
      ['formfn', 'formfn@mint.design', 'formform', 'Form Function', 0, 12],
      ['bitcrush', 'bitcrush@mint.design', 'bitcrush', 'Bitcrush', 45, 0],
      ['lowpoly', 'lowpoly@mint.design', 'lowpoly1', 'Lowpoly', 900, 500],
      ['mistwood', 'mistwood@mint.design', 'mistwood', 'Mistwood', 20, 8],
    ];
    demo.forEach(([un, em, pw, nm, coins, credits], i) => {
      const u = createUser({ username: un, email: em, password: pw, name: nm, coins, credits });
      u.xp = [4820, 3100, 2400, 1800, 1200, 900, 400][i] || 100;
      u.designs = [48, 31, 24, 18, 12, 9, 4][i] || 2;
      if (i < 2) { u.plan = 'pro'; u.planUntil = Date.now() + 30 * 864e5; }
    });
    save();
  }
  if (!db.announcements.length) {
    db.announcements.push({
      id: 'a1', title: 'به Mint خوش آمدید',
      body: 'استودیوی هوش مصنوعی حالا فارسی را می‌فهمد و روی همه‌ی دستگاه‌ها طرح می‌سازد.',
      level: 'info', active: true, createdAt: new Date().toISOString(),
    });
    save();
  }
}

/* --------------------------------------------------------------- sessions */
function startSession(userId) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = { userId, at: Date.now() };
  save();
  return sid;
}
function sessionUser(sid) {
  const s = sid && db.sessions[sid];
  if (!s) return null;
  if (Date.now() - s.at > 30 * 864e5) { delete db.sessions[sid]; save(); return null; }
  const u = findById(s.userId);
  return u && !u.banned ? u : null;
}
function endSession(sid) { if (sid && db.sessions[sid]) { delete db.sessions[sid]; save(); } }

/* ------------------------------------------------------------------ plans */
function planActive(u) {
  return !!(u && u.plan !== 'free' && u.planUntil && u.planUntil > Date.now());
}
function grantPlan(u, plan, days) {
  const base = planActive(u) ? u.planUntil : Date.now();
  u.plan = plan;
  u.planUntil = base + days * 864e5;
  save();
  return u;
}
function grantCoins(u, n)   { u.coins = Math.max(0, u.coins + (+n || 0)); save(); return u; }
function grantCredits(u, n) {
  u.credits = Math.max(0, u.credits + (+n || 0));
  u.creditsTotal = Math.max(u.creditsTotal, u.credits);
  save(); return u;
}

/* ------------------------------------------------------ spending / orders */
/** Charge a generation: prefer AI credits, fall back to coins. */
function chargeGeneration(u) {
  if (!u) return { ok: false, reason: 'auth' };
  const cCost = AI_CREDIT_COST(), kCost = AI_COIN_COST();
  if (u.credits >= cCost) {
    u.credits -= cCost; save();
    return { ok: true, paidWith: 'credits', credits: u.credits, coins: u.coins, spent: cCost };
  }
  if (u.coins >= kCost) {
    u.coins -= kCost; save();
    return { ok: true, paidWith: 'coins', credits: u.credits, coins: u.coins, spent: kCost };
  }
  return { ok: false, reason: 'insufficient', credits: u.credits, coins: u.coins };
}

const coinsFor = (toman) => Math.ceil((+toman || 0) / COIN_VALUE());

function buyWithCoins(u, item) {
  if (!u) return { ok: false, reason: 'auth' };
  const cost = coinsFor(item.price);
  if (u.coins < cost) return { ok: false, reason: 'insufficient', need: cost, coins: u.coins };
  u.coins -= cost;
  u.purchases = (u.purchases || 0) + 1;
  db.orders.push({ id: 'o' + db.nextId++, userId: u.id, itemId: item.id,
                   title: item.title, price: item.price, coins: cost,
                   at: new Date().toISOString(), gifted: false });
  save();
  return { ok: true, cost, coins: u.coins };
}

/** Admin gift: hand an item over without charging. */
function giftItem(u, item, byAdmin) {
  u.purchases = (u.purchases || 0) + 1;
  db.orders.push({ id: 'o' + db.nextId++, userId: u.id, itemId: item.id,
                   title: item.title, price: 0, coins: 0,
                   at: new Date().toISOString(), gifted: true, by: byAdmin });
  save();
  return { ok: true };
}
const ordersFor = (userId) => db.orders.filter(o => o.userId === +userId);

/* --------------------------------------------------------- announcements */
function addAnnouncement({ title, body, level = 'info' }) {
  const a = { id: 'a' + db.nextId++, title, body, level, active: true,
              createdAt: new Date().toISOString() };
  db.announcements.unshift(a); save();
  return a;
}
function setAnnouncement(id, patch) {
  const a = db.announcements.find(x => x.id === id);
  if (a) { Object.assign(a, patch); save(); }
  return a;
}
function removeAnnouncement(id) {
  db.announcements = db.announcements.filter(x => x.id !== id); save();
}
const activeAnnouncements = () => db.announcements.filter(a => a.active);

/* ---------------------------------------------------------------- search */
function searchUsers(q = '', { limit = 50 } = {}) {
  const s = norm(q);
  let list = db.users;
  if (s) list = list.filter(u =>
    norm(u.username).includes(s) || norm(u.email).includes(s) ||
    norm(u.name).includes(s) || String(u.id) === s);
  return list.slice(0, limit);
}

/* Full account editing for the admin console. */
function updateUser(u, patch) {
  const out = {};
  if (patch.username && patch.username.trim() !== u.username) {
    const v = patch.username.trim();
    if (v.length < 3) throw new Error('username too short');
    if (db.users.some(x => x.id !== u.id && norm(x.username) === norm(v))) throw new Error('username taken');
    u.username = v; out.username = v;
  }
  if (patch.email !== undefined && patch.email.trim() !== u.email) {
    const v = patch.email.trim();
    if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new Error('bad email');
    if (db.users.some(x => x.id !== u.id && v && norm(x.email) === norm(v))) throw new Error('email taken');
    u.email = v; out.email = v;
  }
  if (patch.name !== undefined) { u.name = patch.name; u.name_fa = patch.name; out.name = patch.name; }
  if (patch.password) {
    if (String(patch.password).length < 8) throw new Error('password too short');
    const h = hash(patch.password);
    u.salt = h.salt; u.hash = h.hash; out.password = true;
    // a password change invalidates that user's other sessions
    for (const [sid, s2] of Object.entries(db.sessions)) if (s2.userId === u.id) delete db.sessions[sid];
  }
  if (patch.role && ['user', 'admin'].includes(patch.role)) { u.role = patch.role; out.role = patch.role; }
  if (patch.coins !== undefined) { u.coins = Math.max(0, Math.trunc(+patch.coins) || 0); out.coins = u.coins; }
  if (patch.credits !== undefined) {
    u.credits = Math.max(0, Math.trunc(+patch.credits) || 0);
    u.creditsTotal = Math.max(u.creditsTotal, u.credits); out.credits = u.credits;
  }
  if (patch.plan !== undefined) { u.plan = patch.plan; out.plan = patch.plan; }
  if (patch.planUntil !== undefined) { u.planUntil = patch.planUntil ? +patch.planUntil : null; }
  if (patch.banned !== undefined) { u.banned = !!patch.banned; out.banned = u.banned; }
  save();
  return out;
}

function deleteUser(id) {
  const i = db.users.findIndex(u => u.id === +id);
  if (i < 0) return false;
  const u = db.users[i];
  if (u.role === 'admin' && db.users.filter(x => x.role === 'admin').length <= 1) {
    throw new Error('cannot delete the last admin');
  }
  db.users.splice(i, 1);
  db.orders = db.orders.filter(o => o.userId !== +id);
  for (const [sid, s2] of Object.entries(db.sessions)) if (s2.userId === +id) delete db.sessions[sid];
  save();
  return true;
}

/** Bulk grant — everything the admin can hand out, applied to many users. */
function bulkGrant(ids, { coins = 0, credits = 0, plan, days }) {
  let n = 0;
  for (const id of ids) {
    const u = findById(id);
    if (!u) continue;
    if (coins) grantCoins(u, coins);
    if (credits) grantCredits(u, credits);
    if (plan && days) grantPlan(u, plan, days);
    n++;
  }
  return n;
}

const publicUser = (u) => u && ({
  id: u.id, username: u.username, email: u.email, role: u.role, name: u.name,
  coins: u.coins, credits: u.credits, creditsTotal: u.creditsTotal,
  plan: u.plan, planUntil: u.planUntil, planActive: planActive(u),
  xp: u.xp, designs: u.designs, purchases: u.purchases, banned: u.banned,
  createdAt: u.createdAt,
});

load();

module.exports = {
  COIN_VALUE, AI_COIN_COST, AI_CREDIT_COST, coinsFor,
  createUser, findByLogin, findById, verify, hash,
  startSession, sessionUser, endSession,
  planActive, grantPlan, grantCoins, grantCredits,
  chargeGeneration, buyWithCoins, giftItem, ordersFor,
  addAnnouncement, setAnnouncement, removeAnnouncement, activeAnnouncements,
  searchUsers, publicUser, updateUser, deleteUser, bulkGrant,
  get orders() { return db.orders; },
  get users() { return db.users; },
  get announcements() { return db.announcements; },
  save,
};
