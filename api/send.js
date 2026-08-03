const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Настраиваем VAPID
webpush.setVapidDetails(
    'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Подключаем Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { receiverId, title, body } = req.body;

    try {
        // 1. Ищем подписку получателя в базе
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', receiverId);

        if (error || !data || data.length === 0) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // 2. Отправляем пуш на каждое устройство пользователя
        const payload = JSON.stringify({ title, body });
        
        const pushPromises = data.map(subRecord => 
            webpush.sendNotification(subRecord.subscription, payload).catch(e => console.error(e))
        );

        await Promise.all(pushPromises);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
