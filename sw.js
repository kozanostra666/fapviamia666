const CACHE_NAME = 'poker-v1';

const BASE = '/fapviamia666';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/style.css',
  BASE + '/js/game.js',
  BASE + '/manifest.json',
  BASE + '/images/dealer.png',
  BASE + '/images/cardback.png',
  BASE + '/images/doodle.png',
  BASE + '/images/avatar1.png',
  BASE + '/images/avatar2.png',
  BASE + '/images/avatar3.png',
  BASE + '/images/avatar4.png',
  BASE + '/images/avatar5.png',
  BASE + '/images/avatar6.png',
  BASE + '/images/avatar7.png',
  BASE + '/icons/icon-192x192.png',
  BASE + '/icons/icon-512x512.png',
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
