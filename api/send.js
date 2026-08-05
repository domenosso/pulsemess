const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    console.log("[API] 🚀 Получен запрос на отправку пуша");
    
    if (req.method !== 'POST') {
        console.error("[API] ❌ Ошибка: Метод не POST");
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Проверяем, все ли переменные загружены в Vercel
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error("[API] ❌ ОШИБКА: Не хватает переменных окружения (Env Vars) в Vercel!");
            return res.status(500).json({ error: 'Missing env variables' });
        }

        console.log("[API] Подключение к VAPID и Supabase...");
        
        // ВАША ПОЧТА (Обязательно для Google, чтобы не блокировали за спам)
        webpush.setVapidDetails(
            'mailto:paveltuktin3@gmail.com', 
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        // Подключаемся к вашей базе
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        const { receiverId, title, body } = req.body;
        console.log(`[API] 🔍 Ищем подписки для пользователя: ${receiverId}`);

        // Ищем устройство пользователя в базе Supabase
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', receiverId);

        if (error) {
            console.error("[API] ❌ Ошибка запроса в Supabase:", error);
            return res.status(500).json({ error: 'Database query failed', details: error });
        }

        if (!data || data.length === 0) {
            console.warn(`[API] ⚠️ Подписки для пользователя ${receiverId} не найдены!`);
            return res.status(404).json({ error: 'Subscription not found for this user' });
        }

        console.log(`[API] ✅ Найдено ${data.length} подписок. Отправляем...`);
        
        // Формируем данные (они уйдут в sw.js)
        const payload = JSON.stringify({ 
            title: title, 
            body: body,
            url: '/' 
        });
        
        // НАСТРОЙКИ ДЛЯ "ПРОБИВАНИЯ" СПЯЩЕГО ТЕЛЕФОНА
        const pushOptions = {
            TTL: 86400, // Пуш "живет" на серверах Google/Apple до 24 часов
            headers: { 
                'Urgency': 'high' // Высший приоритет
            }
        };

        const pushPromises = data.map(async subRecord => {
            try {
                await webpush.sendNotification(subRecord.subscription, payload, pushOptions);
                console.log(`[API] 🟢 Пуш успешно отправлен!`);
            } catch (e) {
                console.error(`[API] 🔴 ОШИБКА отправки пуша (токен устарел или отозван):`, e.message);
                // Если прилетает ошибка 410 (Gone), значит пользователь удалил приложение или заблокировал уведомления
            }
        });

        // Ждем завершения отправки на все устройства
        await Promise.all(pushPromises);

        console.log("[API] 🎉 Процесс рассылки завершен.");
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[API] 💥 ФАТАЛЬНАЯ ОШИБКА API:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
};
