// K-Drama Cast Checker - service worker
// Goal: the app shell (index.html + icons) works offline, since all your actual data (dramas,
// watchlist, favorites, skipped shows) already lives in localStorage. Live API calls (TMDB/
// OMDb/Gemini/GitHub) are deliberately left uncached - those need to be fresh, and the app
// already handles network failures for them gracefully on its own.
//
// v2: switched from cache-first to NETWORK-FIRST for the app shell. Cache-first meant that once
// index.html was cached on a device, every future visit kept serving that same frozen copy
// forever - re-deploying a new index.html to GitHub Pages had no effect until the cache was
// manually cleared. Network-first always tries to fetch the latest version first, and only
// falls back to the cached copy if there's no connection at all - so updates show up
// immediately, and offline viewing still works exactly the same.

const CACHE_NAME = 'kdrama-cast-checker-v2';
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
    fetch(event.request)
      .then(function(response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function() {
        // Offline: fall back to whatever was last cached, so the app still opens.
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
  );
});
