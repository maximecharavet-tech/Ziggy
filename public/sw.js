/* Ziggy service worker — makes the site work offline, nothing else.
 *
 * - Static files (/_next/static, mascot, media, icons, dodo art): cache first
 *   (they are versioned or never change).
 * - Pages: network first, with the last copy kept for offline visits, and a
 *   friendly fallback page when a page was never opened online.
 * - API calls and anything cross-origin: untouched (no data is cached).
 * Bump VERSION to clear old caches.
 */
const VERSION = 'ziggy-v7';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/favicon.svg', '/manifest.webmanifest'];

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
  // Audio streamed by <audio> (Range requests, e.g. the dodo "Version musicale"): let the browser handle it.
  if (req.headers.has('range')) return;

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

// L'appli du Père Noël: a scheduled call's notification opens (or focuses) the ringing call page.
self.addEventListener('notificationclick', (event) => {
  const url = (event.notification.data && event.notification.data.url) || '/pere-noel/appel';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c && new URL(c.url).origin === self.location.origin) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
