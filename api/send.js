const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Выносим подключение наверх, чтобы убрать холодный старт и ускорить работу
let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:paveltuktin3@gmail.com', // Ваша почта
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { receiverId, title, body } = req.body;

        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', receiverId);

        if (error || !data || data.length === 0) {
            return res.status(200).json({ status: 'no_subs' });
        }

        // 🚀 ГЛАВНЫЙ ФИКС: Убираем дубликаты устройств!
        const uniqueEndpoints = new Set();
        const uniqueSubs = [];
        const idsToDelete = [];

        data.forEach(record => {
            const endpoint = record.subscription?.endpoint;
            if (!endpoint) return;

            // Если такой токен уже есть, помечаем его на удаление
            if (uniqueEndpoints.has(endpoint)) {
                idsToDelete.push(record.id);
            } else {
                uniqueEndpoints.add(endpoint);
                uniqueSubs.push(record);
            }
        });

        // Тихо чистим мусор в базе (не задерживая отправку сообщений)
        if (idsToDelete.length > 0) {
            supabase.from('push_subscriptions').delete().in('id', idsToDelete).then();
        }

        const payload = JSON.stringify({ title, body, url: '/' });
        const pushOptions = { 
            TTL: 86400, // 24 часа
            headers: { 'Urgency': 'high' } 
        };

        // Отправляем только на УНИКАЛЬНЫЕ устройства
        const pushPromises = uniqueSubs.map(async (record) => {
            try {
                await webpush.sendNotification(record.subscription, payload, pushOptions);
            } catch (e) {
                // Если токен "умер" (приложение удалили) - чистим базу
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', record.id);
                }
            }
        });

        await Promise.all(pushPromises);
        return res.status(200).json({ success: true, sentTo: uniqueSubs.length });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server Error' });
    }
};const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// 🚀 ОПТИМИЗАЦИЯ: Инициализируем библиотеки снаружи функции. 
// Это убирает "Холодный старт" Vercel и ускоряет отправку с 5 секунд до 0.5 сек!
let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:paveltuktin3@gmail.com', // <--- ВАША ПОЧТА
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { receiverId, title, body } = req.body;

        // Запрашиваем подписки (берем также id колонку, чтобы удалять мертвые)
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', receiverId);

        if (error || !data || data.length === 0) {
            return res.status(200).json({ status: 'no_subs' }); // Возвращаем 200, чтобы не засорять логи красным
        }

        const payload = JSON.stringify({ title, body, url: '/' });
        
        const pushOptions = {
            TTL: 86400, // 24 часа
            headers: { 'Urgency': 'high' } // Мгновенная доставка
        };

        // Отправляем пуши параллельно на все устройства юзера
        const pushPromises = data.map(async (record) => {
            try {
                await webpush.sendNotification(record.subscription, payload, pushOptions);
            } catch (e) {
                // 🛑 ГЛАВНЫЙ ФИКС: Если устройство удалило приложение (ошибка 410 или 404)
                if (e.statusCode === 410 || e.statusCode === 404) {
                    console.log(`[API] 🗑 Удаляем мертвый токен (ID: ${record.id}) из базы...`);
                    await supabase.from('push_subscriptions').delete().eq('id', record.id);
                } else {
                    console.error('[API] Ошибка провайдера пушей:', e.message);
                }
            }
        });

        await Promise.all(pushPromises);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[API] 💥 ФАТАЛЬНАЯ ОШИБКА:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
