// Zento Data Service Worker v1.0
// IMPORTANT: This file must be compiled/copied to sw.js at build time.
// For deployment, rename to sw.js or configure your build tool to output it as sw.js.

const CACHE_NAME = 'zentodata-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  (self as unknown as { skipWaiting: () => void }).skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? new Response('', { status: 503 })))
  );
});

self.addEventListener('push', (event) => {
  const data = (event as PushEvent).data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Zento Data', {
      body: data.body ?? 'Nueva notificación',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
    })
  );
});
