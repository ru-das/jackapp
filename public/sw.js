// Offline app shell. scripts/precache.js fills VERSION and PRECACHE at export time; the paths are relative to this file's scope.
const VERSION = '__VERSION__';
const PRECACHE = '__PRECACHE__';

const scoped = (p) => new URL(p, self.registration.scope).href;
const files = () => (Array.isArray(PRECACHE) ? PRECACHE : []).map(scoped);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(files())).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only our own files: OpenRouter, Ollama and Hugging Face traffic must never be touched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Deep links such as /run/<id> are all served by the one exported shell.
    event.respondWith(fetch(req).catch(() => caches.match(scoped('index.html'))));
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        if (res.ok) void cache.put(req, res.clone());
        return res;
      });
      // Hashed bundles never change, so the cache wins; everything else refreshes in the background.
      if (hit) {
        if (!url.pathname.includes('/_expo/static/')) fresh.catch(() => {});
        return hit;
      }
      return fresh;
    }),
  );
});
