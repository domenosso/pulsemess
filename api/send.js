const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.SUPABASE_URL) {
            return res.status(500).json({ error: 'Ключи не найдены' });
        }

        webpush.setVapidDetails(
            'mailto:paveltuktin3@gmail.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { receiverId, title, body } = req.body;

        // 🚀 ФИКС ЗАДЕРЖКИ: Берем только 2 самые последние (свежие) подписки!
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', receiverId)
            .order('id', { ascending: false })
            .limit(2);

        if (error || !data || data.length === 0) {
            return res.status(200).json({ status: 'no_subs_found' });
        }

        const payload = JSON.stringify({ title: title, body: body, url: '/' });
        
        // urgency с маленькой буквы - стандарт протокола Web Push для моментальной доставки
        const pushOptions = { TTL: 86400, headers: { 'urgency': 'high' } }; 

        const pushPromises = data.map(async (record) => {
            let sub = record.subscription;
            if (typeof sub === 'string') {
                try { sub = JSON.parse(sub); } catch(e) {}
            }
            if (!sub || !sub.endpoint) return;

            try {
                await webpush.sendNotification(sub, payload, pushOptions);
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    // Удаляем мертвый ключ тихо (без await), чтобы не тормозить Vercel
                    supabase.from('push_subscriptions').delete().eq('id', record.id).then();
                }
            }
        });

        // Используем allSettled, чтобы если 1 ключ умер, остальные всё равно доставились без сбоев
        await Promise.allSettled(pushPromises);
        
        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
