self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

let unreadCount = 0; // Счетчик для иконки приложения

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

    // Увеличиваем счетчик и ставим цифру на иконку
    unreadCount++;
    if (navigator.setAppBadge) {
        navigator.setAppBadge(unreadCount).catch(console.error);
    }

    const options = {
        body: pushBody,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        // Параметр tag удален, поэтому пуши больше не схлопываются в один
        data: { url: urlToOpen }
    };

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            let isAppFocused = false;
            for (let i = 0; i < windowClients.length; i++) {
                if (windowClients[i].focused) {
                    isAppFocused = true;
                    break;
                }
            }
            if (isAppFocused) {
                // Если юзер в приложении, сбрасываем бейдж и не шлем системный пуш
                unreadCount = 0;
                if (navigator.clearAppBadge) navigator.clearAppBadge().catch(console.error);
                return Promise.resolve();
            }
            return self.registration.showNotification(pushTitle, options);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Сбрасываем счетчик при клике по уведомлению
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

// Слушаем команду от открытого приложения на сброс счетчика
self.addEventListener('message', (event) => {
    if (event.data === 'clearBadge') {
        unreadCount = 0;
        if (navigator.clearAppBadge) navigator.clearAppBadge().catch(console.error);
    }
});
