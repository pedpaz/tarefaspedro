// Service Worker — Hub Pedro
// v18: network-first pro HTML + cache de assets OCR (Tesseract)
const CACHE = 'hub-pedro-v28';
const VERSION = 'v28';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Inter+Tight:wght@400;500;600;700&display=swap'
];

// Install: pre-cache e ativa IMEDIATAMENTE (sem esperar abas fecharem)
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(FILES).catch(function(err){
        console.warn('Cache pre-fill incompleto:', err);
      });
    })
  );
});

// Activate: limpa caches antigos + assume controle + notifica clientes
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== CACHE){
          console.log('Deletando cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      // Notifica todas as abas/PWA que o SW novo assumiu
      return self.clients.matchAll({type:'window'}).then(function(clients){
        clients.forEach(function(client){
          client.postMessage({type:'SW_UPDATED', version: VERSION});
        });
      });
    })
  );
});

// Fetch: network-first pro HTML, cache-first pros outros
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // HTML/navigation: SEMPRE tenta rede primeiro (pega versão nova se houver)
  if(e.request.mode === 'navigate' ||
     e.request.destination === 'document' ||
     url.pathname.endsWith('.html') ||
     url.pathname.endsWith('/')){
    e.respondWith(
      fetch(e.request, {cache:'no-store'}).then(function(res){
        if(res && res.status === 200){
          var clone = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Outros assets (ícones, fontes, OCR): cache-first (mais rápido)
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(res){
        if(res && res.status === 200){
          // Cacheia se: same-origin OU asset de OCR (Tesseract.js, traineddata, wasm)
          var isTesseractAsset =
            url.hostname.indexOf('jsdelivr.net') !== -1 ||
            url.hostname.indexOf('tessdata') !== -1 ||
            url.hostname.indexOf('githubusercontent') !== -1 ||
            url.hostname.indexOf('raw.githubusercontent') !== -1 ||
            url.pathname.indexOf('tesseract') !== -1 ||
            url.pathname.endsWith('.wasm') ||
            url.pathname.endsWith('.wasm.js') ||
            url.pathname.endsWith('.traineddata') ||
            url.pathname.endsWith('.traineddata.gz');
          if(url.origin === self.location.origin || isTesseractAsset){
            var clone = res.clone();
            caches.open(CACHE).then(function(cache){
              cache.put(e.request, clone).catch(function(){});
            });
          }
        }
        return res;
      }).catch(function(){
        if(e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

// Permite forçar update via mensagem do client (botão "Recarregar agora")
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
