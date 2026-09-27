const { calculate } = require('../shared/remontforma-pricing.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = 'https://api.telegram.org/bot';

async function telegram(method, body) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(API_BASE + TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

function keyboard(rows) {
  return { reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: true } };
}

function stateKey(chatId) {
  return 'rf:' + chatId;
}

// Stateless MVP: Telegram sends the current step in callback-style text.
// State is kept in Vercel KV later; this endpoint first provides the bot health/webhook helpers.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Telegram Bot',
      configured: Boolean(TOKEN),
      state: 'ready'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = update.message;
    if (!message?.chat?.id) return res.status(200).json({ ok: true, ignored: true });

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();

    if (text === '/start' || text === '🏠 Начать') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '🏠 РЕМОНТФОРМА\n\nРассчитаем предварительную стоимость ремонта. Выберите тип объекта:',
        ...keyboard([
          ['🏠 Квартира'],
          ['🏡 Дом'],
          ['🏢 Коммерция']
        ])
      });
      return res.status(200).json({ ok: true });
    }

    if (text === '🧮 Рассчитать стоимость') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '🧮 Начинаем расчёт. Выберите тип объекта:',
        ...keyboard([
          ['🏠 Квартира'],
          ['🏡 Дом'],
          ['🏢 Коммерция']
        ])
      });
      return res.status(200).json({ ok: true });
    }

    if (text === '📋 Наши услуги') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '📋 РЕМОНТФОРМА выполняет ремонт квартир, домов и коммерческих помещений под ключ в Казани.'
      });
      return res.status(200).json({ ok: true });
    }

    if (text === '📸 Наши работы') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '📸 Раздел портфолио будет подключён следующим этапом.'
      });
      return res.status(200).json({ ok: true });
    }

    if (text === '📞 Связаться с нами') {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '📞 Оставьте ваш номер телефона сообщением — мы свяжемся с вами.'
      });
      return res.status(200).json({ ok: true });
    }

    if (/^🏠 Квартира$|^🏡 Дом$|^🏢 Коммерция$/.test(text)) {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: 'Отлично. Напишите общую площадь объекта в м², например: 80'
      });
      return res.status(200).json({ ok: true });
    }

    await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Я готов помочь с расчётом. Нажмите «🧮 Рассчитать стоимость» или «🏠 Начать».'
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Bot error' });
  }
};
