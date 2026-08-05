const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Инициализируем внутри функции, чтобы ключи Vercel гарантированно загрузились
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.SUPABASE_URL) {
            return res.status(500).json({ error: 'Env variables missing' });
        }

        webpush.setVapidDetails(
            'mailto:paveltuktin3@gmail.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        const { receiverId, title, body } = req.body;

        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', receiverId);

        if (error || !data || data.length === 0) {
            return res.status(200).json({ status: 'no_subs' });
        }

        const uniqueEndpoints = new Set();
        const uniqueSubs = [];
        const idsToDelete = [];

        // Убираем дубликаты устройств
        for (const record of data) {
            let sub = record.subscription;
            // Защита от криво сохраненных данных в Supabase
            if (typeof sub === 'string') {
                try { sub = JSON.parse(sub); } catch(e) {}
            }

            const endpoint = sub?.endpoint;
            if (!endpoint) continue;

            if (uniqueEndpoints.has(endpoint)) {
                idsToDelete.push(record.id);
            } else {
                uniqueEndpoints.add(endpoint);
                uniqueSubs.push({ id: record.id, subscription: sub });
            }
        }

        // БЕЗОПАСНОЕ удаление мусора из базы (раньше тут крашился процесс)
        if (idsToDelete.length > 0) {
            await supabase.from('push_subscriptions').delete().in('id', idsToDelete).catch(e => console.log('Clean Error:', e));
        }

        const payload = JSON.stringify({ title, body, url: '/' });
        const pushOptions = { TTL: 86400, headers: { 'Urgency': 'high' } };

        const pushPromises = uniqueSubs.map(async (record) => {
            try {
                await webpush.sendNotification(record.subscription, payload, pushOptions);
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', record.id).catch(err => console.log(err));
                }
            }
        });

        await Promise.all(pushPromises);
        return res.status(200).json({ success: true, sentTo: uniqueSubs.length });

    } catch (err) {
        console.error('Fatal API Error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
