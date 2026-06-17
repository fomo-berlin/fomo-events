/* FOMO Berlin service worker — offline-capable app shell.
 * Strategy:
 *   - HTML navigations: network-first (events stay fresh; cache fallback offline)
 *   - same-origin assets (icons, vendored Leaflet, .ics): stale-while-revalidate
 *   - CSS/fonts/tiles: stale-while-revalidate
 * __BUILD_ID__ is replaced at build time (lib/emit.js) so each deploy busts caches.
 */
const CACHE_VERSION = '__BUILD_ID__';
const SHELL_CACHE = 'fomo-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'fomo-runtime-' + CACHE_VERSION;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

const SWR_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'tile.openstreetmap.org',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache mutations (form POSTs, /api/*)
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // always hit network for the API

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) { event.respondWith(networkFirst(req)); return; }

  if (url.origin === self.location.origin || SWR_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    })
    .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')));
}

function staleWhileRevalidate(req) {
  return caches.open(RUNTIME_CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}
