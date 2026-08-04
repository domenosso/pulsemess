const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. ЖЕСТКАЯ ПРОВЕРКА ПЕРЕМЕННЫХ (чтобы сразу понять, если ключи забыли добавить в Vercel)
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error("ОШИБКА: Не хватает переменных окружения (Environment Variables) в Vercel!");
            return res.status(500).json({ error: 'Server configuration error: missing env variables' });
        }

        // 2. Инициализация (перенесена внутрь функции)
        webpush.setVapidDetails(
            'paveltukhtin3@gmail.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        const { receiverId, title, body } = req.body;

        // 3. Ищем подписки пользователя
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', receiverId);

        if (error) {
            console.error("Supabase Error:", error);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Subscription not found for this user' });
        }

        // 4. Отправляем пуши
        const payload = JSON.stringify({ title, body });
        
        const pushPromises = data.map(subRecord => 
            webpush.sendNotification(subRecord.subscription, payload)
                .catch(e => console.error('Push provider rejected:', e))
        );

        await Promise.all(pushPromises);

        return res.status(200).json({ success: true });
    } catch (err) {
        // Ловим любые другие ошибки и отдаем их текст (поможет при дебаге)
        console.error('Fatal API Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
};
