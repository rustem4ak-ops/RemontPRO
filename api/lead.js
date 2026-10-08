// РЕМОНТФОРМА — приём лидов.
// Production endpoint: /api/lead -> Telegram + MAX administrator.
// TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — Telegram уведомление.
// MAX_BOT_TOKEN + MAX_ADMIN_USER_ID (лично) или MAX_ADMIN_CHAT_ID (чат) — MAX уведомление.

function tg(method, body) {
  var token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
  if (!token) return Promise.resolve(null);

  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); });
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
        body: JSON.stringify({
          text: text,
          notify: true
        })
      });

      var data = await r.json().catch(function() { return {}; });
      last = { ok: r.ok, status: r.status, data: data };

      if (r.ok) {
        return last;
      }

      // MAX может не принять HTML-разметку. Повторяем отправку тем же
      // содержанием, но без HTML-тегов — чтобы заявка не терялась.
      if (r.ok) {
        continue;
      }

      try {
        var plainText = text.replace(/<[^>]+>/g, '');
        var fallback = await fetch('https://platform-api2.max.ru' + targets[i], {
          method: 'POST',
          headers: {
            'Authorization': token,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            text: plainText,
            notify: true
          })
        });
        var fallbackData = await fallback.json().catch(function() { return {}; });
        last = { ok: fallback.ok, status: fallback.status, data: fallbackData };
        if (fallback.ok) {
          return last;
        }
      } catch (fallbackError) {
        last = {
          ok: false,
          error: String(fallbackError && fallbackError.message ? fallbackError.message : fallbackError)
        };
      }
    } catch (e) {
      last = {
        ok: false,
        error: String(e && e.message ? e.message : e)
      };
    }
  }

  return last;
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Lead API',
      telegram: Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.TG_ADMIN_CHAT_ID),
      max: Boolean(
        process.env.MAX_BOT_TOKEN &&
        (process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID)
      )
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    var b = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    var phone = String(b.phone || '').trim();

    if (!phone) {
      return res.status(400).json({
        ok: false,
        error: 'Phone is required'
      });
    }

    var q = b.calculator || {};
    var files = b.files || {};
    var photos = Array.isArray(files.photos) ? files.photos : [];
    var rows = Array.isArray(q.rows) ? q.rows : [];

    var stage = function(title, matcher) {
      var items = rows.filter(matcher);

      if (!items.length) return null;

      var sum = items.reduce(function(total, item) {
        return total + (Number(item.cost) || 0);
      }, 0);

      var out = ['<b>' + title + '</b>'];

      items.forEach(function(item) {
        out.push('• ' + esc(item.name) + ' — ' + money(item.cost));
      });

      out.push('<b>Итого: ' + money(sum) + '</b>');

      return out.join('\n');
    };

    var stages = [
      stage(
        '1️⃣ Черновая электрика + черновая сантехника',
        function(x) { return /Электрика|Сантехника/.test(x.name); }
      ),
      stage(
        '2️⃣ Плиточные работы',
        function(x) { return /Классический санузел|Плитка/.test(x.name); }
      ),
      stage(
        '3️⃣ Напольные работы',
        function(x) { return /Ламинат \/ кварцвинил|Плинтус/.test(x.name); }
      ),
      stage(
        '4️⃣ Стены',
        function(x) {
          return /Окна|Подготовка под обои \+ обои|Подготовка под покраску \+ покраска|Подготовка под декоративку \+ декоративка/.test(x.name);
        }
      ),
      stage(
        '5️⃣ Чистовая электрика / сантехника',
        function(x) { return /Чистовая/.test(x.name); }
      ),
      stage(
        '6️⃣ Завершающие работы',
        function(x) { return /Клининг|Вывоз мусора/.test(x.name); }
      )
    ].filter(Boolean);

    var object = b.object || {};
    var objectType = object.type || 'Не указан';
    var objectFloor = Number(object.floor) || 0;
    var objectBath = Number(object.bath) || 0;
    var objectTileArea = Number(object.tileArea) || 0;

    var lines = [
      '🆕 <b>Новая заявка</b>',
      '',
      '🏠 Объект: <b>' + esc(objectType) + '</b>',
      '📐 Общая площадь: <b>' + objectFloor + ' м²</b>',
      '🚿 Санузел: <b>' + objectBath + ' м²</b>',
      '🔲 Плитка — пол: <b>' + objectTileArea + ' м²</b>',
      '',
      '👤 Имя: <b>' + esc(b.name || 'Не указано') + '</b>',
      '📞 Номер телефона: <b>' + esc(phone) + '</b>',
      '📍 Источник: <b>' + esc(b.source || 'site') + '</b>',
      ''
    ];

    if (stages.length) {
      lines = lines.concat(stages);
      lines.push('');
      lines.push('<b>ИТОГО: ' + money(q.total) + '</b>');
      lines.push('<b>Цена за м² по полу: ' + money(q.pricePerM2) + '</b>');
    } else {
      lines.push('💰 Предварительный расчёт: <b>' + money(q.total) + '</b>');
      lines.push('📏 Цена за м² по полу: <b>' + money(q.pricePerM2) + '</b>');
    }

    if (b.comment) {
      lines.push('', '💬 ' + esc(b.comment));
    }

    if (photos.length) {
      lines.push('', '📷 Фото: ' + photos.length);
    }

    var message = lines.join('\n');
    var telegramSent = false;
    var maxSent = false;
    var maxError = '';

    var telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.TG_ADMIN_CHAT_ID;
    if (telegramChatId) {
      try {
        var t = await tg('sendMessage', {
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'HTML'
        });

        telegramSent = Boolean(t && t.ok);

        if (!telegramSent) {
          var plain = message.replace(/<[^>]+>/g, '');
          var t2 = await tg('sendMessage', {
            chat_id: telegramChatId,
            text: plain
          });

          telegramSent = Boolean(t2 && t2.ok);
        }
      } catch (telegramError) {
        try {
          var plainFallback = message.replace(/<[^>]+>/g, '');
          var t3 = await tg('sendMessage', {
            chat_id: telegramChatId,
            text: plainFallback
          });

          telegramSent = Boolean(t3 && t3.ok);
        } catch (_) {}
      }
    }

    if (
      !b.skipMax &&
      process.env.MAX_BOT_TOKEN &&
      (process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID)
    ) {
      try {
        var m = await maxSend(message);

        maxSent = Boolean(m && m.ok);

        if (!maxSent) {
          maxError = m && (
            (m.data && (m.data.message || m.data.error)) ||
            m.error ||
            ('HTTP ' + (m.status || 'unknown'))
          );
        }
      } catch (e) {
        maxError = String(e && e.message ? e.message : e);
      }
    } else {
      maxError = 'MAX_ADMIN_USER_ID/MAX_ADMIN_CHAT_ID не задан';
    }

    if (!telegramSent && !maxSent) {
      return res.status(502).json({
        ok: false,
        telegramSent: false,
        maxSent: false,
        error: 'Не удалось отправить заявку ни в Telegram, ни в MAX',
        maxError: maxError
      });
    }

    return res.status(200).json({
      ok: true,
      telegramSent: telegramSent,
      maxSent: maxSent,
      maxError: maxError || null
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e)
    });
  }
};
