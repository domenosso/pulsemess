self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

let unreadCount = 0;

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

    unreadCount++;
    if (navigator.setAppBadge) {
        navigator.setAppBadge(unreadCount).catch(console.error);
    }

    const options = {
        body: pushBody,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        data: { url: urlToOpen }
    };

    // БЕЗУСЛОВНЫЙ ПОКАЗ. Больше никаких проверок. Браузер нас не забанит.
    event.waitUntil(
        self.registration.showNotification(pushTitle, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    unreadCount = 0;
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(console.error);

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

self.addEventListener('message', (event) => {
    if (event.data === 'clearBadge') {
        unreadCount = 0;
        if (navigator.clearAppBadge) navigator.clearAppBadge().catch(console.error);
    }
});
