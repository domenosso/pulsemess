const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error("ОШИБКА: Не хватает переменных окружения (Environment Variables) в Vercel!");
            return res.status(500).json({ error: 'Server configuration error: missing env variables' });
        }

        // ОБЯЗАТЕЛЬНО: укажите здесь вашу настоящую почту!
        webpush.setVapidDetails(
            'mailto:paveltukhtin3@gmail.com', 
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        const { receiverId, title, body } = req.body;

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

        const payload = JSON.stringify({ title, body });
        
        // Эта настройка "пробивает" сон телефона на Android/iOS
        const pushOptions = {
            TTL: 60, 
            headers: {
                'Urgency': 'high' 
            }
        };

        const pushPromises = data.map(subRecord => 
            webpush.sendNotification(subRecord.subscription, payload, pushOptions)
                .catch(e => console.error('Push provider rejected:', e))
        );

        await Promise.all(pushPromises);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Fatal API Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
};
