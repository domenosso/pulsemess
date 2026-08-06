self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    let pushTitle = 'Nano';
    let pushBody = 'Новое сообщение';
    let urlToOpen = '/';

    if (event.data) {
        try {
            const data = event.data.json();
            pushTitle = data.title || pushTitle;
            pushBody = data.body || pushBody;
            if (data.url) urlToOpen = data.url;
        } catch (e) {
            pushBody = event.data.text();
        }
    }

    const options = {
        body: pushBody,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: 'nano-chat-message',
        renotify: true,
        data: { url: urlToOpen }
    };

    // Всегда показываем уведомление, чтобы браузер не дал теневой бан
    event.waitUntil(
        self.registration.showNotification(pushTitle, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
