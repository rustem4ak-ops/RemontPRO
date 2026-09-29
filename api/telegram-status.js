const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!TOKEN) return res.status(500).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });

  try {
    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/getWebhookInfo');
    const data = await r.json();

    return res.status(r.ok && data.ok ? 200 : 500).json({
      ok: Boolean(data.ok),
      expectedWebhook: 'https://remont-pro-nine.vercel.app/api/telegram',
      telegram: data
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Telegram API error' });
  }
};
