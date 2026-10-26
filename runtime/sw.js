// Offline app shell. Generated into out/sw.js by scripts/postbuild.mjs (version and file list filled in).
// Model files (/m/) are not handled here: the inference worker verifies and caches them itself.
const CACHE = 'kinship-shell-__VERSION__';
const SHELL = __SHELL__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('kinship-shell-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/m/')) return;
  if (url.pathname === '/model-release.json') {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  // pages and route payloads (not content-hashed): network first so a new deploy shows at once; cached copy offline
  if (req.mode === 'navigate' || url.pathname.endsWith('.txt')) {
    e.respondWith(fetch(req).catch(async () =>
      (await caches.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await caches.match('/') : undefined) || Response.error()));
    return;
  }
  // content-hashed assets and engine files: cache first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
