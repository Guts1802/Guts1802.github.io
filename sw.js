// K-Drama Cast Checker - service worker
// Goal: the app shell (index.html + icons) loads instantly and works offline, since all your
// actual data (dramas, watchlist, favorites, skipped shows) already lives in localStorage.
// Live API calls (TMDB/OMDb/Gemini/GitHub) are deliberately left uncached - those need to be
// fresh, and the app already handles network failures for them gracefully on its own.

const CACHE_NAME = 'kdrama-cast-checker-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(APP_SHELL); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // API calls (TMDB etc.) go straight to network, uncached

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function() {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
