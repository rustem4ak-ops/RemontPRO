// РЕМОНТФОРМА — приём лидов.
// Production endpoint: /api/lead -> Telegram administrator.
// TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — уведомление администратора.
// BITRIX24_WEBHOOK_URL — необязательная интеграция Bitrix24.

function tg(method, body) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.resolve(null);
  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Lead API',
      telegram: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID),
      bitrix: Boolean(process.env.BITRIX24_WEBHOOK_URL)
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Method not allowed' });
  }

  try {
    var b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    var phone = String(b.phone || '').trim();
    if (!phone) return res.status(400).json({ok:false,error:'Phone is required'});

    var q = b.calculator || {};
    var o = b.object || {};
    var files = b.files || {};
    var photos = Array.isArray(files.photos) ? files.photos : [];

    var lines = [
      '🆕 <b>Новая заявка РЕМОНТФОРМА</b>',
      '',
      '👤 ' + esc(b.name || 'Не указано'),
      '📞 <b>' + esc(phone) + '</b>',
      '📍 Источник: <b>' + esc(b.source || 'site') + '</b>',
      '📊 Канал: ' + esc(b.medium || '—') + ' | Кампания: ' + esc(b.campaign || '—'),
      '🏠 Объект: ' + esc(o.type || 'Не указан'),
      '📐 Площадь: ' + esc(o.floor || 0) + ' м²',
      '🚿 Санузел: ' + esc(o.bath || 0) + ' м²',
      '🌿 Балкон: ' + esc(o.balcony || 0) + ' м²',
      '🚪 Комнат: ' + esc(o.rooms || '—'),
      '🏗 Состояние: ' + esc(o.state || '—'),
      '🎯 Задача: ' + esc(o.finish || '—'),
      '🪟 Окон/откосов: ' + esc(o.windows || 0),
      '',
      '💰 Предварительный расчёт: <b>' + money(q.total) + '</b>',
      '📏 Цена за м²: <b>' + money(q.pricePerM2) + '</b>',
      '📎 Фото: ' + photos.length,
      '📄 Планировка: ' + (files.plan && files.plan.name ? files.plan.name : 'нет')
    ];
    if (b.comment) lines.push('💬 ' + esc(b.comment));

    var telegramSent = false;
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      var t = await tg('sendMessage', {
        chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML'
      });
      telegramSent = Boolean(t && t.ok);
      if (!telegramSent) {
        return res.status(502).json({
          ok:false,
          error:'Telegram send failed',
          telegram:t || null
        });
      }
    }

    return res.status(200).json({
      ok:true,
      telegramSent:telegramSent,
      bitrixSent:false,
      bitrixId:null
    });
  } catch (e) {
    return res.status(500).json({ok:false,error:String(e && e.message ? e.message : e)});
  }
};