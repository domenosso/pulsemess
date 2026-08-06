const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 1. ПРОВЕРКА КЛЮЧЕЙ
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            return res.status(500).json({ error: 'Ключи окружения (Env Vars) не найдены в Vercel!' });
        }

        // 2. ИНИЦИАЛИЗАЦИЯ
        webpush.setVapidDetails(
            'mailto:paveltuktin3@gmail.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { receiverId, title, body } = req.body;

        // 3. ПОЛУЧАЕМ ПОДПИСКИ ПОЛЬЗОВАТЕЛЯ
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', receiverId);

        if (error) {
            return res.status(500).json({ error: 'Ошибка БД Supabase', details: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(200).json({ status: 'no_subs_found' });
        }

        const payload = JSON.stringify({ title: title, body: body, url: '/' });
        const pushOptions = { TTL: 86400, headers: { 'Urgency': 'high' } }; // 24 часа + высокий приоритет

        // 4. ОТПРАВЛЯЕМ ПУШИ
        const pushPromises = data.map(async (record) => {
            let sub = record.subscription;
            if (typeof sub === 'string') {
                try { sub = JSON.parse(sub); } catch(e) {}
            }
            if (!sub || !sub.endpoint) return;

            try {
                await webpush.sendNotification(sub, payload, pushOptions);
            } catch (e) {
                // Если токен умер, удаляем его из базы
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', record.id).catch(()=>{});
                }
            }
        });

        await Promise.all(pushPromises);
        return res.status(200).json({ success: true });

    } catch (err) {
        // Перехват любой фатальной ошибки сервера
        console.error('Fatal API Error:', err);
        return res.status(500).json({ error: 'Critical server error', msg: err.message });
    }
};
