/**
 * ZENTO DATA — INSTRUCCIONES PWA PARA GITHUB REPO
 * ================================================
 * Aplica estos cambios en el repo: zentodata/Zento-Data-App
 *
 * PROBLEMA RAÍZ: GitHub Pages sirve el repo en un subdirectorio
 *   URL real: https://zentodata.github.io/Zento-Data-App/
 *   Los paths del manifest y SW deben incluir el prefijo /Zento-Data-App/
 *
 * ARCHIVOS A MODIFICAR EN EL REPO:
 *   1. index.html  — cambiar <head> (ver HEAD_PATCH abajo)
 *   2. manifest.json — reemplazar completo (ver MANIFEST abajo)
 *   3. sw.js — reemplazar completo (ver SW abajo)
 */

// ─── 1. CAMBIO EN index.html ─────────────────────────────────────────────────
// En el archivo index.html del repo, busca estas líneas y REEMPLÁZALAS:
//
// BUSCAR (líneas 12-15 actuales):
//   <link rel="icon" ... href="data:image/svg+xml,...">
//   <link rel="apple-touch-icon" ... href="data:image/svg+xml,...">
//   <link rel="manifest" href="manifest.json">
//
// REEMPLAZAR CON:

export const INDEX_HEAD_PATCH = `
<link rel="manifest" href="/Zento-Data-App/manifest.json">
<link rel="icon" type="image/png" href="/Zento-Data-App/icon-192.png">
<link rel="apple-touch-icon" href="/Zento-Data-App/icon-192.png">
<link rel="apple-touch-icon" sizes="192x192" href="/Zento-Data-App/icon-192.png">
<link rel="apple-touch-icon" sizes="512x512" href="/Zento-Data-App/icon-512.png">
<meta name="mobile-web-app-capable" content="yes">
<script>
if('serviceWorker'in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/Zento-Data-App/sw.js',{scope:'/Zento-Data-App/'})
      .then(function(r){console.log('SW registrado:',r.scope);})
      .catch(function(e){console.warn('SW error:',e);});
  });
}
</script>
`;
// Nota: el <script src="html2pdf..."> va DESPUÉS de este bloque, no lo elimines.

// ─── 2. REEMPLAZAR manifest.json COMPLETO ────────────────────────────────────
// Pega este contenido en el archivo manifest.json del repo:

export const MANIFEST = `{
  "id": "com.zentodata.app",
  "name": "Zento Data — Sistema de Gestión",
  "short_name": "ZentoData",
  "description": "Sistema profesional de cotización y gestión para empresas de seguridad electrónica en Guatemala.",
  "start_url": "/Zento-Data-App/",
  "scope": "/Zento-Data-App/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#07090f",
  "theme_color": "#0ea5c8",
  "lang": "es-GT",
  "dir": "ltr",
  "categories": ["business", "productivity"],
  "prefer_related_applications": false,
  "icons": [
    {
      "src": "/Zento-Data-App/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Zento-Data-App/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/Zento-Data-App/icon-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/Zento-Data-App/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Zento Data Cotizador"
    },
    {
      "src": "/Zento-Data-App/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Zento Data Dashboard"
    }
  ],
  "shortcuts": [
    {
      "name": "Nueva Cotización",
      "short_name": "Cotización",
      "url": "/Zento-Data-App/?tab=cotizador",
      "icons": [{ "src": "/Zento-Data-App/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Hoja de Trabajo",
      "short_name": "Hoja",
      "url": "/Zento-Data-App/?tab=hoja",
      "icons": [{ "src": "/Zento-Data-App/icon-192.png", "sizes": "192x192" }]
    }
  ]
}`;

// ─── 3. REEMPLAZAR sw.js COMPLETO ────────────────────────────────────────────
// Pega este contenido en el archivo sw.js del repo:

export const SW = `
const CACHE_NAME = 'zento-data-v2';
const RUNTIME_CACHE = 'zento-runtime-v2';
const BASE = '/Zento-Data-App';

const FILES_TO_CACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) {
          return k !== CACHE_NAME && k !== RUNTIME_CACHE;
        }).map(function(k) {
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(event.request).catch(function() {
      return caches.match(event.request);
    }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(RUNTIME_CACHE).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(BASE + '/index.html');
      });
    })
  );
});

self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Zento Data', {
      body: data.body || 'Nueva notificación',
      icon: BASE + '/icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(BASE + '/'));
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`;

// ─── 4. VERIFICA QUE TIENES ESTOS ARCHIVOS EN EL REPO ────────────────────────
// Estructura mínima requerida en la raíz del repo:
//
//   Zento-Data-App/
//   ├── index.html          ← con los cambios del HEAD_PATCH
//   ├── manifest.json       ← contenido MANIFEST de arriba
//   ├── sw.js               ← contenido SW de arriba
//   ├── icon-192.png        ← tu logo en 192×192 px (PNG)
//   ├── icon-512.png        ← tu logo en 512×512 px (PNG)
//   └── icon-maskable.png   ← logo con padding, fondo sólido (192×192 px)
//
// ─── 5. ACTIVAR GITHUB PAGES ─────────────────────────────────────────────────
// Settings → Pages → Source: Deploy from branch → Branch: main → / (root)
// URL resultante: https://zentodata.github.io/Zento-Data-App/
//
// ─── 6. VALIDAR EN PWABUILDER ────────────────────────────────────────────────
// Pega esta URL en pwabuilder.com:
//   https://zentodata.github.io/Zento-Data-App/
// Debe mostrar: ✅ Manifest detectado  ✅ Service Worker detectado
