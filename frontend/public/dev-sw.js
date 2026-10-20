// Kill-switch service worker.
// Project lain (HiYO Finance) pernah mendaftarkan SW di http://localhost:5173/dev-sw.js
// sehingga browser menyajikan index.html lama dari cache. Saat browser mengecek update SW,
// file ini menggantikannya: hapus semua cache, unregister diri sendiri, lalu reload tab.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
