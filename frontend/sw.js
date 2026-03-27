/* Hotel OS — Service Worker v5
 * Cache-first pour assets statiques
 * Network-only pour TOUS les appels API
 */

const CACHE_VERSION = 'hotel-os-v13';

const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/api.js',
  '/js/utils.js',
  '/js/modal.js',
  '/js/app.js',
  '/js/pages/dashboard.js',
  '/js/pages/rooms.js',
  '/js/pages/tasks.js',
  '/js/pages/interventions.js',
  '/js/pages/rounds.js',
  '/js/pages/messages.js',
  '/js/pages/conversations.js',
  '/js/pages/attendance.js',
  '/js/pages/reviews.js',
  '/js/pages/equipment.js',
  '/js/pages/stock.js',
  '/js/pages/notifications.js',
  '/js/pages/settings.js',
  '/manifest.json',
];

/*
 * Détection API par premier segment de chemin.
 * Ex : /rooms/5     → segment[1] = "rooms"       → API ✅
 *      /js/rooms.js → segment[1] = "js"           → pas API ✅
 *      /health      → détection directe            → API ✅
 */
const API_SEGMENTS = new Set([
  'auth', 'users', 'rooms', 'tasks', 'interventions',
  'rounds', 'messages', 'qr', 'reviews', 'equipment',
  'stock', 'dashboard', 'roles', 'permissions', 'settings',
  'attendance', 'conversations', 'notifications', 'zones',
  'services', 'audit', 'hotels',
]);

function isApiCall(pathname) {
  /* Routes sans sous-segment */
  if (pathname === '/health' || pathname.startsWith('/health?')) return true;
  if (pathname === '/openapi.json') return true;
  if (pathname === '/docs'  || pathname.startsWith('/docs/'))   return true;
  if (pathname === '/redoc' || pathname.startsWith('/redoc/'))  return true;

  /* Premier segment du chemin */
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg ? API_SEGMENTS.has(seg) : false;
}

/* ── Install ─────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install partiel :', err))
  );
});

/* ── Activate : supprime les anciens caches ──────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ───────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  /* POST/PATCH/DELETE → toujours réseau, jamais de cache */
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Cross-origin → réseau direct */
  if (url.origin !== self.location.origin) return;

  /* API → réseau uniquement, jamais mis en cache */
  if (isApiCall(url.pathname)) return;

  /* Assets statiques → cache-first, réseau en fallback */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          /* Hors ligne — fallback SPA pour les navigations */
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});
