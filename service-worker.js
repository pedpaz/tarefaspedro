// Service Worker — gabriela.
// Estratégia: network-first pro HTML/app.js (pega versão nova), cache-first pros assets + OCR.
const CACHE = 'gabriela-v13';
const VERSION = 'v13';
const FILES = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.svg',
];

// Install: pré-cacheia e ativa imediatamente
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(FILES).catch(function (err) {
        console.warn('Cache pre-fill incompleto:', err);
      });
    })
  );
});

// Activate: limpa caches antigos, assume controle e avisa os clients
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return self.clients.matchAll({ type: 'window' }).then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
        });
      });
    })
  );
});

// Fetch: network-first pro HTML e app.js; cache-first pro resto
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  var isAppShell =
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('app.js');

  if (isAppShell) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function (res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Outros assets (ícones, fontes): cache-first
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var isFont = url.hostname.indexOf('fonts.g') !== -1;
          var isOcrAsset =
            url.hostname.indexOf('jsdelivr.net') !== -1 ||
            url.hostname.indexOf('tessdata') !== -1 ||
            url.pathname.indexOf('tesseract') !== -1 ||
            url.pathname.endsWith('.wasm') ||
            url.pathname.endsWith('.traineddata') ||
            url.pathname.endsWith('.traineddata.gz');
          if (url.origin === self.location.origin || isFont || isOcrAsset) {
            var clone = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(e.request, clone).catch(function () {}); });
          }
        }
        return res;
      }).catch(function () {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// Permite o client forçar atualização
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
