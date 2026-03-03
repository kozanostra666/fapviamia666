const CACHE_NAME = 'poker-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/game.js',
  '/manifest.json',
  '/images/dealer.png',
  '/images/cardback.png',
  '/images/doodle.png',
  '/images/avatar1.png',
  '/images/avatar2.png',
  '/images/avatar3.png',
  '/images/avatar4.png',
  '/images/avatar5.png',
  '/images/avatar6.png',
  '/images/avatar7.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first strategy (offline works perfectly)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache new requests on the fly
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
