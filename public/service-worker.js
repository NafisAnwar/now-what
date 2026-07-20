// NOW_WHAT? Service Worker - cache revision 1.2.0-beta.1
const CACHE_PREFIX = 'nowwhat-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1.2.0-beta.1`;
const FONT_ORIGINS = new Set([
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

// Core shell resources plus built assets discovered from index.html.
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/now_what-transparent_white.png',
  '/icon-192.svg',
  '/icon-512.svg',
];

function absoluteUrl(url) {
  return new URL(url, self.location.origin).href;
}

function isCacheableResponse(response) {
  return response && (response.ok || response.type === 'opaque');
}

async function fetchAndCache(cache, request) {
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

function discoverCacheUrls(html) {
  const urls = new Set(SHELL_URLS.map(absoluteUrl));
  const attrPattern = /\b(?:href|src)="([^"]+)"/g;
  let match;

  while ((match = attrPattern.exec(html)) !== null) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || raw.startsWith('data:')) continue;

    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin === self.location.origin || url.origin === 'https://fonts.googleapis.com') {
        urls.add(url.href);
      }
    } catch {
      // Ignore malformed asset references.
    }
  }

  return Array.from(urls);
}

async function cacheFontStylesheetAndFiles(cache, stylesheetUrl) {
  const stylesheetRequest = new Request(stylesheetUrl, { cache: 'reload', mode: 'cors' });
  const response = await fetchAndCache(cache, stylesheetRequest);
  if (!response.ok) return;

  const css = await response.clone().text();
  const fontUrls = Array.from(
    css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g),
    match => match[1]
  );

  await Promise.all(
    fontUrls.map(url =>
      fetchAndCache(cache, new Request(url, { cache: 'reload', mode: 'cors' })).catch(() => undefined)
    )
  );
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  let indexResponse;

  try {
    indexResponse = await fetchAndCache(cache, new Request('/index.html', { cache: 'reload' }));
  } catch {
    indexResponse = await cache.match('/index.html') || await cache.match('/');
  }

  await Promise.all(
    SHELL_URLS
      .filter(url => url !== '/index.html')
      .map(url => fetchAndCache(cache, new Request(url, { cache: 'reload' })).catch(() => undefined))
  );

  if (!indexResponse) return;

  const html = await indexResponse.clone().text();
  const cacheUrls = discoverCacheUrls(html);

  await Promise.all(
    cacheUrls.map(url => {
      const parsed = new URL(url);
      if (parsed.origin === 'https://fonts.googleapis.com') {
        return cacheFontStylesheetAndFiles(cache, url).catch(() => undefined);
      }
      if (parsed.origin === self.location.origin) {
        return fetchAndCache(cache, new Request(url, { cache: 'reload' })).catch(() => undefined);
      }
      return undefined;
    })
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  return fetchAndCache(cache, request);
}

self.addEventListener('install', event => {
  event.waitUntil(
    cacheAppShell().catch(() => undefined).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests.
  if (req.method !== 'GET') return;

  try {
    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isFontRequest = FONT_ORIGINS.has(url.origin);
    if (!isSameOrigin && !isFontRequest) return;

    if (isFontRequest) {
      event.respondWith(cacheFirst(req));
      return;
    }

    // HTML navigation: network-first, fall back to cached index.
    if (req.mode === 'navigate') {
      event.respondWith(
        (async () => {
          try {
            const response = await fetch(req);
            if (isCacheableResponse(response)) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put('/index.html', response.clone());
            }
            return response;
          } catch {
            const cache = await caches.open(CACHE_NAME);
            return await cache.match('/index.html') || await cache.match('/') || Response.error();
          }
        })()
      );
      return;
    }

    // Static assets: cache-first, update in background.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const networkFetch = fetchAndCache(cache, req).catch(() => undefined);
        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }
        return await networkFetch || Response.error();
      })()
    );
  } catch {
    // Ignore malformed URLs.
  }
});
