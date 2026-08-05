self.addEventListener('install', (event) => {
    self.skipWaiting(); // Принудительно обновляет старые воркеры на телефонах
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    let pushTitle = 'Nano Messenger';
    let pushBody = 'Новое сообщение';

    // Безопасный парсинг (не упадет, даже если пришел кривой формат)
    try {
        if (event.data) {
            const data = event.data.json();
            pushTitle = data.title || pushTitle;
            pushBody = data.body || pushBody;
        }
    } catch (e) {
        if (event.data) pushBody = event.data.text();
    }

    const options = {
        body: pushBody,
        vibrate: [200, 100, 200, 100, 200], // Длинная вибрация, чтобы точно заметить
        requireInteraction: true // Пуш не исчезнет сам, пока на него не нажмут
    };

    event.waitUntil(
        self.registration.showNotification(pushTitle, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
