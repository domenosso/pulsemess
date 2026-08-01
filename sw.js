// sw.js
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Показ уведомления по команде из приложения
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'showNotification') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: 'icon.png',
      badge: 'icon.png',
      vibrate: [200, 100, 200]
    });
  }
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
