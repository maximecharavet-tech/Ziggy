/* Ziggy service worker — makes the site work offline, nothing else.
 *
 * - Static files (/_next/static, mascot, media, icons, dodo art): cache first
 *   (they are versioned or never change).
 * - Pages: network first, with the last copy kept for offline visits, and a
 *   friendly fallback page when a page was never opened online.
 * - API calls and anything cross-origin: untouched (no data is cached).
 * Bump VERSION to clear old caches.
 */
const VERSION = 'ziggy-v3';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) => /^\/(_next\/static|mascot|media|icons|dodo|hyper)\//.test(url.pathname) || /\.(?:svg|png|webp|jpg|jpeg|woff2?)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(PAGES)).put(req, res.clone());
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })()
    );
  }
});
