// Работа без сети. Когда сеть есть — всегда свежая версия с сайта (и она же кладётся в кэш);
// без сети — то, что уже в кэше. Звуки большие и не меняются — их сначала из кэша.
const CACHE = 'nen-veb-v20';
const CORE = ['./', 'index.html', 'css/app.css', 'js/app.js', 'vendor/preact-htm.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      if (url.pathname.endsWith('.wav')) {
        const hit = await c.match(e.request);
        if (hit) return hit;
      }
      try {
        const r = await fetch(e.request, { cache: 'no-cache' });
        if (r.ok) c.put(e.request, r.clone());
        return r;
      } catch (err) {
        const hit = await c.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })
  );
});
