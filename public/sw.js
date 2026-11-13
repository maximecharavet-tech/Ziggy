/* Ziggy service worker — makes the site work offline, nothing else.
 *
 * - Static files (/_next/static, mascot, media, icons, dodo art): cache first
 *   (they are versioned or never change).
 * - Pages: network first, with the last copy kept for offline visits, and a
 *   friendly fallback page when a page was never opened online.
 * - API calls and anything cross-origin: untouched (no data is cached), except
 *   the public list of bedtime-story pictures (kept for « Garder pour ce soir »).
 * - « Garder pour ce soir » (page → worker message "dodo-keep"): a story's own
 *   files (/dodo/…: voice, songs, timings, pictures) are downloaded into KEEP,
 *   a cache that survives version bumps, and served from it offline, ranged
 *   audio requests included. Same-origin only, nothing leaves the device.
 * Bump VERSION to clear old caches.
 */
const VERSION = 'ziggy-v7';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const KEEP = 'ziggy-dodo-stories';
const DODO_ASSETS = '/api/ziggy/dodo/assets';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== KEEP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) => /^\/(_next\/static|mascot|media|icons|dodo|hyper)\//.test(url.pathname) || /\.(?:svg|png|webp|jpg|jpeg|woff2?)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === DODO_ASSETS) {
    // Fresh list when online; the kept copy offline.
    event.respondWith(fetch(req).catch(async () => (await (await caches.open(KEEP)).match(url.href)) || Response.error()));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  // Audio streamed by <audio> (Range requests, e.g. the dodo "Version musicale"): the browser
  // handles it, except for a story kept for tonight, answered from the device.
  if (req.headers.has('range')) {
    if (url.pathname.startsWith('/dodo/')) event.respondWith(rangeFromKept(req, url));
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req); // the kept stories first, then the static cache
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
        return res;
      })()
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

/** 206 answer cut from the kept full file; the network when the story was not kept. */
async function rangeFromKept(req, url) {
  const hit = await (await caches.open(KEEP)).match(url.href);
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!hit || !m || (m[1] === '' && m[2] === '')) return fetch(req);
  const buf = await hit.arrayBuffer();
  const size = buf.byteLength;
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Only a story's own files (mirrors isKeepable in src/lib/dodo/offline.ts). */
const keepable = (u) => typeof u === 'string' && ((/^\/dodo\/[A-Za-z0-9._/-]+$/.test(u) && !u.includes('..')) || u === DODO_ASSETS);

async function keepStory(urls) {
  const cache = await caches.open(KEEP);
  let ok = 0;
  let failed = 0;
  for (const u of urls) {
    try {
      const abs = new URL(u, self.location.origin).href;
      const res = await fetch(abs);
      if (res.ok && res.status === 200) {
        await cache.put(abs, res);
        ok++;
      } else failed++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

// « Garder pour ce soir »: the page sends { type: 'dodo-keep', story, urls } with a reply port.
self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d || d.type !== 'dodo-keep' || !Array.isArray(d.urls)) return;
  const port = event.ports && event.ports[0];
  const urls = [...new Set(d.urls.filter(keepable))].slice(0, 80);
  event.waitUntil(
    keepStory(urls).then((r) => {
      if (port) port.postMessage({ type: 'dodo-keep-done', story: String(d.story || ''), ok: r.ok, failed: r.failed });
    })
  );
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
