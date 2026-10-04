// РЕМОНТФОРМА — приём лидов.
// Production endpoint: /api/lead -> Telegram + MAX administrator.
// TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — Telegram уведомление.
// MAX_BOT_TOKEN + MAX_ADMIN_USER_ID (лично) или MAX_ADMIN_CHAT_ID (чат) — MAX уведомление.

function tg(method, body) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.resolve(null);
  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}

async function maxSend(text) {
  var token = process.env.MAX_BOT_TOKEN;
  if (!token) return null;

  var userId = process.env.MAX_ADMIN_USER_ID;
  var chatId = process.env.MAX_ADMIN_CHAT_ID;
  var targets = [];

  if (userId) targets.push('/messages?user_id=' + encodeURIComponent(userId));
  if (chatId) targets.push('/messages?chat_id=' + encodeURIComponent(chatId));
  if (!targets.length) return null;

  var last = null;
  for (var i = 0; i < targets.length; i++) {
    try {
      var r = await fetch('https://platform-api2.max.ru' + targets[i], {
        method: 'POST',
        headers: {
          'Authorization': token,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ text: text })
      });
      var data = await r.json().catch(function(){ return {}; });
      last = { ok: r.ok, data: data };
      if (r.ok) return last;
    } catch (e) {
      last = { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }
  return last;
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
      max: Boolean(process.env.MAX_BOT_TOKEN && (process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID))
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ok:false,error:'Method not allowed'});
  }

  try {
    var b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    var phone = String(b.phone || '').trim();
    if (!phone) return res.status(400).json({ok:false,error:'Phone is required'});

    var q = b.calculator || {};
    var o = b.object || {};
    var files = b.files || {};
    var photos = Array.isArray(files.photos) ? files.photos : [];

    // Формат уведомления повторяет блок «Предварительный расчёт» на сайте.\n    // Сначала идут только данные лида, затем полный расчёт по 6 этапам.\n    var rows = Array.isArray(q.rows) ? q.rows : [];\n    var stage = function(title, matcher) {\n      var items = rows.filter(matcher);\n      if (!items.length) return null;\n      var sum = items.reduce(function(total, item) { return total + (Number(item.cost) || 0); }, 0);\n      var out = ['<b>' + title + '</b>'];\n      items.forEach(function(item) {\n        out.push('• ' + esc(item.name) + ' — ' + money(item.cost));\n      });\n      out.push('<b>Итого: ' + money(sum) + '</b>');\n      return out.join('\n');\n    };\n\n    var stages = [\n      stage('1️⃣ Черновая электрика + черновая сантехника', function(x) { return /Электрика|Сантехника/.test(x.name); }),\n      stage('2️⃣ Плиточные работы', function(x) { return /Классический санузел|Плитка/.test(x.name); }),\n      stage('3️⃣ Напольные работы', function(x) { return /Ламинат \\/ кварцвинил|Плинтус/.test(x.name); }),\n      stage('4️⃣ Стены', function(x) { return /Окна|Подготовка под обои \\+ обои|Подготовка под покраску \\+ покраска|Подготовка под декоративку \\+ декоративка/.test(x.name); }),\n      stage('5️⃣ Чистовая электрика / сантехника', function(x) { return /Чистовая/.test(x.name); }),\n      stage('6️⃣ Завершающие работы', function(x) { return /Клининг|Вывоз мусора/.test(x.name); })\n    ].filter(Boolean);\n\n    var lines = [\n      '🆕 <b>Новая заявка</b>',\n      '',\n      '👤 Имя: <b>' + esc(b.name || 'Не указано') + '</b>',\n      '📞 Номер телефона: <b>' + esc(phone) + '</b>',\n      '📍 Источник: <b>' + esc(b.source || 'site') + '</b>',\n      ''\n    ];\n\n    if (stages.length) {\n      lines = lines.concat(stages);\n      lines.push('');\n      lines.push('<b>ИТОГО: ' + money(q.total) + '</b>');\n      lines.push('<b>Цена за м² по полу: ' + money(q.pricePerM2) + '</b>');\n    } else {\n      lines.push('💰 Предварительный расчёт: <b>' + money(q.total) + '</b>');\n      lines.push('📏 Цена за м² по полу: <b>' + money(q.pricePerM2) + '</b>');\n    }\n\n    if (b.comment) lines.push('', '💬 ' + esc(b.comment));\n\n    var message = lines.join('\n');
    var telegramSent = false;
    var maxSent = false;

    // Telegram должен получать заявку даже если один из каналов временно ошибся.
    // При проблеме с HTML повторяем отправку без parse_mode.
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      try {
        var t = await tg('sendMessage', {
          chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        });
        telegramSent = Boolean(t && t.ok);
        if (!telegramSent) {
          var plain = message.replace(/<[^>]+>/g, '');
          var t2 = await tg('sendMessage', {
            chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
            text: plain
          });
          telegramSent = Boolean(t2 && t2.ok);
        }
      } catch (telegramError) {
        try {
          var plainFallback = message.replace(/<[^>]+>/g, '');
          var t3 = await tg('sendMessage', {
            chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
            text: plainFallback
          });
          telegramSent = Boolean(t3 && t3.ok);
        } catch (_) {}
      }
    }

    if (!b.skipMax && process.env.MAX_BOT_TOKEN && (process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID)) {
      try {
        var m = await maxSend(
          message.replace(/<b>/g, '').replace(/<\/b>/g, '')
        );
        maxSent = Boolean(m && m.ok);
      } catch (_) {}
    }

    if (!telegramSent && !maxSent) {
      return res.status(502).json({
        ok:false,
        error:'Не удалось отправить заявку ни в Telegram, ни в MAX'
      });
    }

    return res.status(200).json({
      ok:true,
      telegramSent:telegramSent,
      maxSent:maxSent,
    });
  } catch (e) {
    return res.status(500).json({ok:false,error:String(e && e.message ? e.message : e)});
  }
};
