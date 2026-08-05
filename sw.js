// Принудительно обновляем старый Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
    console.log("[SW] 🔔 ПРИШЕЛ PUSH-СИГНАЛ!");
    
    // Значения по умолчанию, если что-то пойдет не так
    let title = "Nano Messenger";
    let body = "Новое сообщение!";

    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            body = data.body || body;
        } catch (e) {
            body = event.data.text();
        }
    }

    const options = {
        body: body,
        icon: '/icon.png', // Убедитесь, что файл icon.png существует на Vercel
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        requireInteraction: true, // Уведомление не исчезнет само
        data: { url: '/' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
