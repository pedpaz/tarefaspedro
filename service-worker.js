// Service Worker — Tarefas Pedro
// Cache version: bump quando atualizar para forçar refresh
const CACHE = 'tarefas-pedro-v2';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Inter+Tight:wght@400;500;600;700&display=swap'
];

// Install: pre-cache core files
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(FILES).catch(function(err){
        console.warn('Cache pré-fill incompleto:', err);
      });
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== CACHE) return caches.delete(key);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Fetch: cache-first for app shell, network-first for others
self.addEventListener('fetch', function(e){
  const url = new URL(e.request.url);

  // Only handle GET
  if(e.request.method !== 'GET') return;

  // Cache-first strategy
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(res){
        // Only cache successful same-origin responses
        if(res && res.status === 200 && url.origin === self.location.origin){
          const clone = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return res;
      }).catch(function(){
        // Offline fallback: return the index for navigation requests
        if(e.request.mode === 'navigate'){
          return caches.match('./index.html');
        }
      });
    })
  );
});
