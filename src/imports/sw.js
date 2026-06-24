// Service Worker - Zento Data
// Permite que la app funcione offline

const CACHE_NAME = 'zento-data-v1';
const RUNTIME_CACHE = 'zento-runtime-v1';

// Archivos esenciales para que funcione offline
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pdf.html'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache de aplicación creado');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch((err) => {
        console.error('Error en cache:', err);
      })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Eliminar caches antiguos
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tomar control de clientes inmediatamente
  self.clients.claim();
});

// Interceptar requests (estrategia Cache First con Network Fallback)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear requests a Firebase u otros servidores externos
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('wa.me')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Guardar en runtime cache para uso posterior
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red, intentar desde cache
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || new Response(
                JSON.stringify({ error: 'Sin conexión a internet' }),
                { status: 503, statusText: 'Sin conexión' }
              );
            });
        })
    );
    return;
  }

  // Para archivos de la app: Cache First
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request)
          .then((response) => {
            // Cachear respuestas exitosas
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Fallback offline
            if (request.method === 'GET') {
              return caches.match(request);
            }
            return new Response(
              JSON.stringify({ error: 'Operación no disponible sin conexión' }),
              { status: 503, statusText: 'Sin conexión' }
            );
          });
      })
  );
});

// Background Sync (sincronizar cuando vuelva conexión)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cotizaciones') {
    event.waitUntil(syncCotizaciones());
  }
});

async function syncCotizaciones() {
  try {
    // Aquí puedes sincronizar datos que se guardaron offline
    console.log('Sincronizando datos...');
  } catch (error) {
    console.error('Error en sincronización:', error);
    throw error;
  }
}

// Notificaciones Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Zento Data';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230ea5c8" width="192" height="192"/><text x="96" y="120" font-size="80" font-weight="bold" text-anchor="middle" fill="white">Z</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230ea5c8" width="192" height="192"/><text x="96" y="120" font-size="80" font-weight="bold" text-anchor="middle" fill="white">Z</text></svg>',
    tag: data.tag || 'zento-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      // Si no, abrir una nueva
      return clients.openWindow('/');
    })
  );
});

// Mensajes desde la app
self.addEventListener('message', (event) => {
  console.log('Mensaje recibido en SW:', event.data);
  
  if (event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('Service Worker cargado correctamente');
