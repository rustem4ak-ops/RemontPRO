const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SETUP_KEY = 'rfsetup_9c4d7e2a6b1f8c3d5e7a9b2c4d6f8a1';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method not allowed' });
  if (req.query?.key !== SETUP_KEY) return res.status(404).json({ ok:false });
  if (!TOKEN) return res.status(500).json({ ok:false, error:'TELEGRAM_BOT_TOKEN is not configured' });

  const webhookUrl = 'https://remont-pro-nine.vercel.app/api/telegram';
  const response = await fetch('https://api.telegram.org/bot' + TOKEN + '/setWebhook', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({url:webhookUrl, allowed_updates:['message','callback_query'], drop_pending_updates:true})
  });
  const data = await response.json();
  return res.status(response.ok && data.ok ? 200 : 500).json({
    ok:Boolean(data.ok),
    webhook:webhookUrl,
    telegram:data
  });
};
