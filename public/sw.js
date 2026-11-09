// AYO PWA Service Worker — version simplifiée pour éviter les conflits
const CACHE_NAME = 'ayo-v2';

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// On ne met rien en cache, on laisse le réseau faire son travail
self.addEventListener("fetch", () => {
  return; 
});
