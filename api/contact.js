// РЕМОНТФОРМА — приём лидов.
// Production endpoint: /api/lead -> Telegram + MAX administrator.
// TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID — Telegram уведомление.
// MAX_BOT_TOKEN + MAX_ADMIN_USER_ID (лично) или MAX_ADMIN_CHAT_ID (чат) — MAX уведомление.

function tg(method, body) {
  var token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
  if (!token) return Promise.resolve({ ok: false, error: 'TELEGRAM_BOT_TOKEN не задан' });

  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3500)
  }).then(function(r) { return r.json(); });
}

async function maxSend(text) {
  var token = process.env.MAX_BOT_TOKEN;
  if (!token) return null;

  // Use one configured destination per request to keep mobile form responses fast.
  var userId = process.env.MAX_ADMIN_USER_ID;
  var chatId = process.env.MAX_ADMIN_CHAT_ID;
  var target = userId
    ? '/messages?user_id=' + encodeURIComponent(userId)
    : (chatId ? '/messages?chat_id=' + encodeURIComponent(chatId) : null);
  if (!target) return null;

  async function post(message) {
    var r = await fetch('https://platform-api2.max.ru' + target, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ text: message, notify: true }),
      signal: AbortSignal.timeout(3000)
    });
    var data = await r.json().catch(function() { return {}; });
    return { ok: r.ok, status: r.status, data: data };
  }

  try {
    var result = await post(text);
    if (result.ok) return result;

    // Retry as plain text only after a definite HTTP rejection, not a timeout.
    try {
      var plainText = text.replace(/<[^>]+>/g, '');
      return await post(plainText);
    } catch (retryError) {
      return {
        ok: false,
        error: String(retryError && retryError.message ? retryError.message : retryError)
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message ? e.message : e)
    };
  }
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
  // Allow the production website and the GitHub Pages mirror to call this API.
  // This endpoint accepts public lead submissions and does not use cookies.
  // Wildcard CORS also supports the site's alternate hosting domains and Safari.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    var telegramTokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN);
    var telegramChatConfigured = Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.TG_ADMIN_CHAT_ID);
    var maxConfigured = Boolean(process.env.MAX_BOT_TOKEN && (process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID));
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Lead API',
      telegram: telegramTokenConfigured && telegramChatConfigured,
      telegramTokenConfigured: telegramTokenConfigured,
      telegramChatConfigured: telegramChatConfigured,
      max: maxConfigured,
      message: (!telegramTokenConfigured || !telegramChatConfigured)
        ? 'Telegram не настроен: проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID в настройках Vercel.'
        : 'Настройки Telegram присутствуют. Отправьте тестовую заявку с сайта для проверки доставки.'
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
    var telegramError = '';
    var maxError = '';

    var telegramChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || process.env.TG_ADMIN_CHAT_ID;

    // Send notifications in parallel so a slow messenger does not block the other.
    await Promise.all([
      (async function sendTelegram() {
        if (!telegramChatId) {
          telegramError = 'TELEGRAM_ADMIN_CHAT_ID не задан';
          return;
        }
        try {
          var t = await tg('sendMessage', {
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'HTML'
          });
          telegramSent = Boolean(t && t.ok);
          if (!telegramSent) {
            telegramError = (t && (t.description || t.error)) || 'Telegram не подтвердил отправку';
            // Retry plain text only after an explicit Telegram API rejection.
            var plain = message.replace(/<[^>]+>/g, '');
            var t2 = await tg('sendMessage', {
              chat_id: telegramChatId,
              text: plain
            });
            telegramSent = Boolean(t2 && t2.ok);
            if (!telegramSent) telegramError = (t2 && (t2.description || t2.error)) || telegramError;
          }
        } catch (e) {
          telegramError = String(e && e.message ? e.message : e);
        }
      })(),
      (async function sendMax() {
        if (b.skipMax) {
          maxError = 'Отправка в MAX отключена для этой заявки';
          return;
        }
        if (!process.env.MAX_BOT_TOKEN || !(process.env.MAX_ADMIN_USER_ID || process.env.MAX_ADMIN_CHAT_ID)) {
          maxError = 'MAX_ADMIN_USER_ID/MAX_ADMIN_CHAT_ID не задан';
          return;
        }
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
      })()
    ]);

    if (!telegramSent && !maxSent) {
      return res.status(502).json({
        ok: false,
        telegramSent: false,
        maxSent: false,
        error: 'Не удалось отправить заявку ни в Telegram, ни в MAX',
        telegramError: telegramError || 'Telegram не настроен или не ответил',
        maxError: maxError
      });
    }

    return res.status(200).json({
      ok: true,
      telegramSent: telegramSent,
      maxSent: maxSent,
      telegramError: telegramError || null,
      maxError: maxError || null
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e)
    });
  }
};
