// NOW_WHAT? Service Worker — nowwhat-shell-v0.9.0
const CACHE_NAME = 'nowwhat-shell-v0.9.0';

// Shell resources to cache on install
const SHELL_URLS = [
  './',
  './index.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .catch(err => {
        // Non-fatal: cache what we can
        console.warn('[sw] Shell cache failed:', err);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => {
              console.log('[sw] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Only handle same-origin requests
  try {
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // HTML navigation: network-first, fall back to cached index
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req)
          .then(response => {
            // Cache a fresh copy of the app shell
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
            return response;
          })
          .catch(() =>
            caches.match('./index.html').then(cached =>
              cached || caches.match('./')
            )
          )
      );
      return;
    }

    // Static assets (JS, CSS, fonts, images): cache-first, update in background
    event.respondWith(
      caches.match(req).then(cached => {
        const networkFetch = fetch(req).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    );
  } catch {
    // Ignore malformed URLs
  }
});
