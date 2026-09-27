const { calculate } = require('../shared/remontforma-pricing.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = 'https://api.telegram.org/bot';

// v2 uses a compact per-chat session encoded in Telegram ForceReply messages.
// It does not depend on input_field_placeholder, which is unreliable in some
// Telegram Web clients. The state is also mirrored in a process-local Map for
// fast handling while a Vercel instance remains warm.
const sessions = globalThis.__RF_TELEGRAM_SESSIONS || (globalThis.__RF_TELEGRAM_SESSIONS = new Map());

async function telegram(method, body) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(API_BASE + TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
  return data.result;
}

const kb = (rows) => ({
  reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: true }
});

const inline = (rows) => ({
  reply_markup: { inline_keyboard: rows }
});

function forceReply(text) {
  return {
    reply_markup: {
      force_reply: true,
      selective: true
    }
  };
}

function cleanNumber(text) {
  const normalized = String(text || '').replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const v = Number(normalized);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function sessionKey(chatId) {
  return String(chatId);
}

function saveSession(chatId, state) {
  sessions.set(sessionKey(chatId), state);
}

function getSession(chatId) {
  return sessions.get(sessionKey(chatId));
}

function clearSession(chatId) {
  sessions.delete(sessionKey(chatId));
}

function objectName(o) {
  return o === 'h' ? 'Дом' : o === 'c' ? 'Коммерция' : 'Квартира';
}

async function sendNumeric(chatId, step, question, state) {
  saveSession(chatId, { ...state, step });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: question,
    ...forceReply()
  });
}

async function start(chatId) {
  clearSession(chatId);
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🏠 РЕМОНТФОРМА\n\nРассчитаем предварительную стоимость ремонта. Выберите тип объекта:',
    ...kb([['🏠 Квартира'], ['🏡 Дом'], ['🏢 Коммерция']])
  });
}

async function askElectrical(chatId, s) {
  saveSession(chatId, { ...s, step: 'electrical' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '⚡ Электрика\n\nВыберите вариант монтажа:',
    ...inline([
      [{ text: 'Нет', callback_data: 'E0' }],
      [{ text: 'Частичный монтаж', callback_data: 'E1' }],
      [{ text: 'Полный монтаж', callback_data: 'E2' }],
    ])
  });
}

async function askPlumbing(chatId, s) {
  saveSession(chatId, { ...s, step: 'plumbing' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚰 Сантехника\n\nВыберите вариант монтажа:',
    ...inline([
      [{ text: 'Нет', callback_data: 'P0' }],
      [{ text: 'Частичный монтаж', callback_data: 'P1' }],
      [{ text: 'Полный монтаж', callback_data: 'P2' }],
    ])
  });
}

async function askBathroom(chatId, s) {
  saveSession(chatId, { ...s, step: 'bathroom' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚿 Санузел\n\nВыберите вариант:',
    ...inline([
      [{ text: 'Нет', callback_data: 'B0' }],
      [{ text: 'Классический санузел', callback_data: 'B1' }],
    ])
  });
}

async function askFloor(chatId, s) {
  return sendNumeric(
    chatId,
    'tileArea',
    '🧱 Пол — плитка (коридоры, комнаты)\n\nНапишите площадь плитки в м², например: 12',
    { ...s, step: 'tileArea' }
  );
}

async function askLaminate(chatId, s) {
  saveSession(chatId, { ...s, step: 'laminate' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🏠 Оставшиеся полы\n\nВыберите вариант:',
    ...inline([
      [{ text: 'Кварцвинил', callback_data: 'LQ' }],
      [{ text: 'Ламинат', callback_data: 'LL' }]
    ])
  });
}

async function askPlinth(chatId, s) {
  saveSession(chatId, { ...s, step: 'plinth' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '📏 Плинтус\n\nВыберите вариант:',
    ...inline([
      [{ text: 'Нет', callback_data: 'PL0' }],
      [{ text: 'Пластиковый', callback_data: 'PL1' }],
      [{ text: 'Полиуретановый', callback_data: 'PL2' }]
    ])
  });
}

async function askWalls(chatId, s) {
  saveSession(chatId, { ...s, step: 'walls' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧱 Стены\n\nВыберите отделку. Можно выбрать несколько вариантов:',
    ...inline([
      [{ text: 'Обои', callback_data: 'W1' }],
      [{ text: 'Покраска', callback_data: 'W2' }],
      [{ text: 'Декоративка', callback_data: 'W3' }],
    ])
  });
}

async function askCleanElectrical(chatId, s) {
  saveSession(chatId, { ...s, step: 'cleanElectrical' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '💡 Чистовая электрика',
    ...inline([
      [{ text: 'Да', callback_data: 'CE1' }],
      [{ text: 'Нет', callback_data: 'CE0' }]
    ])
  });
}

async function askCleanPlumbing(chatId, s) {
  saveSession(chatId, { ...s, step: 'cleanPlumbing' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚿 Чистовая сантехника',
    ...inline([
      [{ text: 'Да', callback_data: 'CP1' }],
      [{ text: 'Нет', callback_data: 'CP0' }]
    ])
  });
}

async function askCleaning(chatId, s) {
  saveSession(chatId, { ...s, step: 'cleaning' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧹 Клининг',
    ...inline([
      [{ text: 'Да', callback_data: 'CL1' }],
      [{ text: 'Нет', callback_data: 'CL0' }]
    ])
  });
}

async function askTrash(chatId, s) {
  saveSession(chatId, { ...s, step: 'trash' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚛 Вывоз мусора',
    ...inline([
      [{ text: 'Да', callback_data: 'TR1' }],
      [{ text: 'Нет', callback_data: 'TR0' }]
    ])
  });
}

function toInput(s) {
  return {
    floor: s.floor,
    bath: s.bath,
    balcony: s.balcony,
    electrical: s.electrical || 'none',
    electricalRate: s.electricalRate,
    plumbing: s.plumbing || 'none',
    plumbingRate: s.plumbingRate,
    bathroom: s.bathroom || 'none',
    bathroomArea: s.bathroomArea,
    tile: s.tile || 'none',
    tileArea: s.tileArea,
    laminate: !!s.laminate,
    plinth: s.plinth || 'none',
    walls: s.walls || {},
    cleanElectrical: !!s.cleanElectrical,
    cleanPlumbing: !!s.cleanPlumbing,
    cleaning: !!s.cleaning,
    trash: !!s.trash,
    customWorks: s.customWorks || [],
    markup: Number(s.markup || 0)
  };
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';
}

function resultText(result, s) {
  const rows = result.rows || [];

  const sumBy = (predicate) => rows
    .filter(predicate)
    .reduce((sum, row) => sum + Number(row.cost || 0), 0);

  const stage1 = sumBy(r =>
    r.name.startsWith('Электрика') ||
    r.name.startsWith('Сантехника') ||
    r.name === 'Классический санузел'
  );

  const stage2 = sumBy(r =>
    r.name.startsWith('Плитка')
  );

  const stage3 = sumBy(r =>
    r.name.startsWith('Плитка') ||
    r.name.startsWith('Ламинат / кварцвинил')
  );

  const stage4 = sumBy(r =>
    r.name.startsWith('Подготовка под обои') ||
    r.name.startsWith('Подготовка под покраску') ||
    r.name.startsWith('Подготовка под декоративку') ||
    r.name.startsWith('Плинтус')
  );

  const stage5 = sumBy(r =>
    r.name === 'Чистовая электрика' ||
    r.name === 'Чистовая сантехника'
  );

  const stage6 = sumBy(r =>
    r.name === 'Клининг' ||
    r.name === 'Вывоз мусора'
  );

  return [
    '🧮 <b>Предварительный расчёт РЕМОНТФОРМА</b>',
    '',
    '🏠 Объект: <b>' + objectName(s.objectType) + '</b>',
    '📐 Общая площадь: <b>' + result.floor + ' м²</b>',
    '📐 Основная площадь: <b>' + result.mainArea + ' м²</b>',
    '',
    '1️⃣ <b>Этап 1 — Электрика, сантехника</b>',
    '💰 <b>' + money(stage1) + '</b>',
    '',
    '2️⃣ <b>Этап 2 — Плитка</b>',
    '💰 <b>' + money(stage2) + '</b>',
    '',
    '3️⃣ <b>Этап 3 — Напольные покрытия</b>',
    '💰 <b>' + money(stage3) + '</b>',
    '',
    '4️⃣ <b>Этап 4 — Стены</b>',
    '💰 <b>' + money(stage4) + '</b>',
    '',
    '5️⃣ <b>Этап 5 — Чистовые работы</b>',
    '💰 <b>' + money(stage5) + '</b>',
    '',
    '6️⃣ <b>Этап 6 — Сопутствующие работы</b>',
    '💰 <b>' + money(stage6) + '</b>',
    '',
    '💵 <b>Общая стоимость работ: ' + money(result.total) + '</b>',
    '📐 Цена за м² по полу: <b>' + money(result.pricePerM2) + '</b>',
    '',
    '📞 Хотите получить точный расчёт и консультацию?'
  ].join('\\n');
}

async function showResult(chatId, s) {
  const result = calculate(toInput(s));
  saveSession(chatId, { ...s, step: 'phone', result });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: resultText(result, s),
    parse_mode: 'HTML',
    ...kb([['📞 Отправить номер телефона'], ['🔄 Рассчитать заново']])
  });
}

async function answerCallback(query) {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;

  const action = String(query.data || '');
  let s = getSession(chatId) || {};

  await telegram('answerCallbackQuery', { callback_query_id: query.id });

  switch (action) {
    case 'E0': s.electrical = 'none'; return askPlumbing(chatId, s);
    case 'E1': s.electrical = 'partial'; return askPlumbing(chatId, s);
    case 'E2': s.electrical = 'full'; return askPlumbing(chatId, s);

    case 'P0': s.plumbing = 'none'; return askBathroom(chatId, s);
    case 'P1': s.plumbing = 'partial'; return askBathroom(chatId, s);
    case 'P2': s.plumbing = 'full'; return askBathroom(chatId, s);

    case 'B0': s.bathroom = 'none'; return askFloor(chatId, s);
    case 'B1': s.bathroom = 'classic'; return askFloor(chatId, s);

    case 'LQ': s.laminate = true; s.laminateType = 'quartzvinyl'; return askPlinth(chatId, s);
    case 'LL': s.laminate = true; s.laminateType = 'laminate'; return askPlinth(chatId, s);

    case 'PL0': s.plinth = 'none'; return askWalls(chatId, s);
    case 'PL1': s.plinth = 'plastic'; return askWalls(chatId, s);
    case 'PL2': s.plinth = 'polyurethane'; return askWalls(chatId, s);

    case 'W1':
      s.walls = { ...(s.walls || {}), wallpaper: { area: 0 } };
      return askCleanElectrical(chatId, s);
    case 'W2':
      s.walls = { ...(s.walls || {}), paint: { area: 0 } };
      return askCleanElectrical(chatId, s);
    case 'W3':
      s.walls = { ...(s.walls || {}), decorative: { area: 0 } };
      return askCleanElectrical(chatId, s);

    case 'W_DONE':
      return askCleanElectrical(chatId, s);

    case 'CE0': s.cleanElectrical = false; return askCleanPlumbing(chatId, s);
    case 'CE1': s.cleanElectrical = true; return askCleanPlumbing(chatId, s);
    case 'CP0': s.cleanPlumbing = false; return askCleaning(chatId, s);
    case 'CP1': s.cleanPlumbing = true; return askCleaning(chatId, s);
    case 'CL0': s.cleaning = false; return askTrash(chatId, s);
    case 'CL1': s.cleaning = true; return askTrash(chatId, s);
    case 'TR0': s.trash = false; return showResult(chatId, s);
    case 'TR1': s.trash = true; return showResult(chatId, s);

    default:
      return telegram('sendMessage', {
        chat_id: chatId,
        text: '⚠️ Этот пункт устарел. Нажмите «🏠 Начать» и запустите новый расчёт.'
      });
  }
}

async function askWallsContinue(chatId, s) {
  saveSession(chatId, { ...s, step: 'wallsChoice' });
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧱 Выбрано: ' + Object.keys(s.walls || {}).map(k => k === 'wallpaper' ? 'обои' : k === 'paint' ? 'покраска' : 'декоративка').join(', ') + '\n\nМожно добавить ещё вариант или продолжить:',
    ...inline([
      [{ text: '➕ Обои', callback_data: 'W1' }, { text: '🎨 Покраска', callback_data: 'W2' }],
      [{ text: '✨ Декоративка', callback_data: 'W3' }],
      [{ text: '➡️ Продолжить', callback_data: 'W_DONE' }]
    ])
  });
}

async function handleNumeric(chatId, text, s) {
  const v = cleanNumber(text);
  if (v === null) {
    return telegram('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Нужно ввести число. Например: 65'
    });
  }

  switch (s.step) {
    case 'floor':
      s.floor = v;
      s.balcony = 0;
      return sendNumeric(chatId, 'bath', '🚿 Напишите площадь санузла в м². Если санузла нет — 0', s);

    case 'bath':
      s.bath = v;
      s.balcony = 0;
      return askElectrical(chatId, s);

    case 'bathroomArea':
      s.bathroom = 'manual';
      s.bathroomArea = v;
      return askFloor(chatId, s);

    case 'tileArea': {
      const main = Math.max(0, Number(s.floor || 0) - Number(s.bath || 0) - Number(s.balcony || 0));
      s.tile = 'manual';
      s.tileArea = Math.min(v, main);
      return askLaminate(chatId, s);
    }

    default:
      return telegram('sendMessage', {
        chat_id: chatId,
        text: '⚠️ Сейчас бот не ожидает число. Нажмите «🏠 Начать», чтобы начать расчёт заново.'
      });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Telegram Bot',
      version: '2.2.0',
      configured: Boolean(TOKEN)
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const update = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    if (update.callback_query) {
      await answerCallback(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    if (!message?.chat?.id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();

    if (message.contact?.phone_number) {
      const s = getSession(chatId);
      const phone = message.contact.phone_number;
      clearSession(chatId);

      await telegram('sendMessage', {
        chat_id: chatId,
        text: '✅ Спасибо! Заявка принята.\n\n📞 ' + phone + '\n\nМы сохранили предварительный расчёт. Следующим этапом подключим автоматическую передачу заявки в CRM.',
        ...kb([['🧮 Рассчитать стоимость'], ['🏠 Начать']])
      });

      return res.status(200).json({ ok: true, lead: true, phone, hasCalculation: Boolean(s?.result) });
    }

    if (text === '📞 Отправить номер телефона') {
      return res.status(200).json(await telegram('sendMessage', {
        chat_id: chatId,
        text: '📞 Нажмите кнопку ниже, чтобы отправить номер телефона.',
        reply_markup: {
          keyboard: [[{ text: '📞 Отправить номер телефона', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }));
    }

    if (text === '🔄 Рассчитать заново' || text === '/start' || text === '🏠 Начать' || text === '🧮 Рассчитать стоимость') {
      return res.status(200).json(await start(chatId));
    }

    if (text === '📋 Наши услуги') {
      return res.status(200).json(await telegram('sendMessage', {
        chat_id: chatId,
        text: '📋 РЕМОНТФОРМА — ремонт квартир, домов и коммерческих помещений под ключ в Казани.'
      }));
    }

    if (text === '📸 Наши работы') {
      return res.status(200).json(await telegram('sendMessage', {
        chat_id: chatId,
        text: '📸 Портфолио подключим следующим этапом.'
      }));
    }

    if (text === '📞 Связаться с нами') {
      return res.status(200).json(await telegram('sendMessage', {
        chat_id: chatId,
        text: '📞 Отправьте номер телефона — мы свяжемся с вами.',
        reply_markup: {
          keyboard: [[{ text: '📞 Отправить номер телефона', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }));
    }

    if (/^🏠 Квартира$|^🏡 Дом$|^🏢 Коммерция$/.test(text)) {
      const objectType = text.startsWith('🏠') ? 'a' : text.startsWith('🏡') ? 'h' : 'c';
      return res.status(200).json(await sendNumeric(
        chatId,
        'floor',
        '📐 Напишите общую площадь объекта в м², например: 80',
        { objectType }
      ));
    }

    const session = getSession(chatId);

    if (session && [
      'floor', 'bath',
      'electricalRate', 'plumbingRate', 'bathroomArea', 'tileArea'
    ].includes(session.step)) {
      return res.status(200).json(await handleNumeric(chatId, text, session));
    }

    // Fallback: if Telegram delivered the numeric reply without a warm server session,
    // inspect the replied-to bot message and recover the expected step.
    const repliedText = String(message.reply_to_message?.text || '');
    if (repliedText.includes('общую площадь объекта')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'floor', objectType: session?.objectType || 'a' }));
    }
    if (repliedText.includes('площадь санузла')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'bath', ...(session || {}) }));
    }
    if (repliedText.includes('цену электрики')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'electricalRate', ...(session || {}) }));
    }
    if (repliedText.includes('цену сантехники')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'plumbingRate', ...(session || {}) }));
    }
    if (repliedText.includes('площадь санузла для расчёта')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'bathroomArea', ...(session || {}) }));
    }
    if (repliedText.includes('площадь плитки')) {
      return res.status(200).json(await handleNumeric(chatId, text, { step: 'tileArea', ...(session || {}) }));
    }

    return res.status(200).json(await telegram('sendMessage', {
      chat_id: chatId,
      text: 'Нажмите «🧮 Рассчитать стоимость» или «🏠 Начать», чтобы запустить расчёт.'
    }));
  } catch (error) {
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      try {
        await telegram('sendMessage', {
          chat_id: chatId,
          text: '⚠️ ' + (error.message || 'Ошибка') + '\n\nНажмите «🏠 Начать» и попробуйте ещё раз.'
        });
      } catch (_) {}
    }
    return res.status(200).json({ ok: false, error: error.message || 'Bot error' });
  }
};
