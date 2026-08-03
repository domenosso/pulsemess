// Этот код работает в фоне операционной системы
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/icon.png', // Убедитесь, что у вас есть иконка
            badge: '/icon.png',
            vibrate: [200, 100, 200],
            data: { url: '/' } // куда перейти при клике
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
