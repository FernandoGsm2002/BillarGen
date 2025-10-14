// Service Worker para notificaciones push
const CACHE_NAME = 'billargen-v1';
const urlsToCache = [
  '/',
  '/manifest.json'
];

// Instalar SW
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activar SW
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retornar desde cache o hacer fetch
        return response || fetch(event.request);
      })
  );
});

// Push notifications
self.addEventListener('push', event => {
  console.log('Push received:', event);
  
  let notificationData = {};
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'BillarGen',
      body: event.data ? event.data.text() : 'Nueva notificación',
      icon: '/pngs/logologin.png',
      badge: '/pngs/logologin.png'
    };
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || '/pngs/logologin.png',
    badge: notificationData.badge || '/pngs/logologin.png',
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/pngs/logologin.png'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ],
    tag: notificationData.tag || 'billargen-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'BillarGen',
      notificationOptions
    )
  );
});

// Click en notificación
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action !== 'close') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
