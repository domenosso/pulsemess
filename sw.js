self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    let pushTitle = 'Nano Messenger';
    let pushBody = 'У вас новое сообщение';
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
        tag: 'nano-chat-message', // Группирует пуши в один, если их слишком много
        renotify: true,
        data: { url: urlToOpen }
    };

    // 🚀 ГЛАВНЫЙ ФИКС: Проверяем, сидит ли юзер прямо сейчас в приложении
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            let isAppFocused = false;
            
            for (let i = 0; i < windowClients.length; i++) {
                if (windowClients[i].focused) {
                    isAppFocused = true;
                    break;
                }
            }

            // Если вы с открытым экраном чата - НЕ показываем системный пуш (чтобы не дублировать)
            if (isAppFocused) {
                return Promise.resolve();
            }

            // Если свернуто/закрыто - показываем!
            return self.registration.showNotification(pushTitle, options);
        })
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
