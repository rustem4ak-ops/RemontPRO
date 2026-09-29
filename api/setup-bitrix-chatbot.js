const crypto = require('crypto');

const WEBHOOK = process.env.BITRIX24_WEBHOOK_URL;
const BOT_TOKEN = process.env.BITRIX_CHATBOT_TOKEN;
const HANDLER_URL = 'https://remont-pro-nine.vercel.app/api/bitrix-openline-bot';

async function bx(method, body = {}) {
  if (!WEBHOOK) throw new Error('BITRIX24_WEBHOOK_URL is not configured');
  const url = WEBHOOK.replace(/\\/+$/, '') + '/' + method + '.json';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json().catch(() => ({}));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!WEBHOOK || !BOT_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Добавьте BITRIX24_WEBHOOK_URL и BITRIX_CHATBOT_TOKEN в Vercel Environment Variables.'
    });
  }

  try {
    const registered = await bx('imbot.v2.Bot.register', {
      fields: {
        code: 'remontforma_calculator',
        botToken: BOT_TOKEN,
        type: 'openline',
        isSupportOpenline: true,
        eventMode: 'webhook',
        webhookUrl: HANDLER_URL,
        properties: {
          name: 'РЕМОНТФОРМА Калькулятор',
          workPosition: 'Предварительный расчёт ремонта',
          color: 'green'
        }
      }
    });

    if (registered?.error) throw new Error(registered.error_description || registered.error);

    const bot = registered?.result?.bot;
    if (!bot?.id) throw new Error('Bitrix24 не вернул bot.id');

    const commands = [];
    for (const c of [
      ['calculator', '🧮 Рассчитать стоимость'],
      ['manager', '👤 Связаться с менеджером']
    ]) {
      const r = await bx('imbot.v2.Command.register', {
        botId: Number(bot.id),
        botToken: BOT_TOKEN,
        fields: {
          command: c[0],
          title: { ru: c[1], en: c[1] },
          hidden: false,
          common: false
        }
      });
      commands.push({ command: c[0], ok: !r?.error, error: r?.error_description || r?.error || null });
    }

    return res.status(200).json({
      ok: true,
      botId: Number(bot.id),
      handler: HANDLER_URL,
      commands,
      next: 'В CRM > Клиенты > Контакт-центр > Telegram откройте вашу Открытую линию и в блоке Чат-боты выберите «РЕМОНТФОРМА Калькулятор» и включите запуск на первом сообщении.'
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Setup error' });
  }
};
