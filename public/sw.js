/**
 * Mint service worker.
 *
 * Strategy per kind of request, chosen so the app never serves stale prices or
 * a stale session but still opens instantly and survives a dropped connection:
 *
 *   static assets (/css, /js, /img, /fonts)  cache-first, then network
 *   navigations (HTML pages)                 network-first, cache as fallback
 *   generated art (/img/gen)                 cache-first, capped LRU
 *   API and auth (/api, /login, /logout)     never touched, always network
 *
 * Bump VERSION to invalidate everything; old caches are deleted on activate.
 */
const VERSION = 'mint-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const GEN = `${VERSION}-gen`;
const GEN_MAX = 40;

/* Enough to render the shell and the offline page with no network. */
const PRECACHE = [
  '/offline',
  '/css/mint.css',
  '/js/mint.js',
  '/img/brand/mark-96.png',
  '/img/brand/mark-192.png',
  '/img/brand/wordmark.png',
  '/img/brand/favicon-32.png',
  '/fonts/Vazirmatn-Regular.woff2',
  '/fonts/Vazirmatn-Medium.woff2',
  '/fonts/Vazirmatn-SemiBold.woff2',
  '/fonts/Vazirmatn-Bold.woff2',
];

const isStatic = (url) =>
  /^\/(css|js|fonts)\//.test(url.pathname) ||
  (/^\/img\//.test(url.pathname) && !url.pathname.startsWith('/img/gen/'));

const isGenerated = (url) => url.pathname.startsWith('/img/gen/');

const neverCache = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname === '/login' ||
  url.pathname === '/logout' ||
  url.pathname === '/signup';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC)
      // addAll rejects the whole batch on one 404, which would leave the worker
      // uninstalled; add individually and tolerate misses.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/** Keep a cache from growing without bound: drop oldest entries first. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') {
    cache.put(req, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    const offline = await caches.match('/offline');
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (neverCache(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isGenerated(url)) {
    event.respondWith(cacheFirst(request, GEN, GEN_MAX));
    return;
  }
  if (isStatic(url)) {
    event.respondWith(cacheFirst(request, STATIC));
  }
});

/* Let the page ask for an immediate update after a deploy. */
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
