const { calculate } = require('../shared/remontforma-pricing.js');

const VERSION = '3.0.0-bitrix';
const BOT_TOKEN = process.env.BITRIX_CHATBOT_TOKEN;
const WEBHOOK = process.env.BITRIX24_WEBHOOK_URL;

const sessions = globalThis.__RF_BITRIX_SESSIONS || (globalThis.__RF_BITRIX_SESSIONS = new Map());

function key(dialogId) { return String(dialogId || ''); }
function save(dialogId, state) { sessions.set(key(dialogId), state); }
function get(dialogId) { return sessions.get(key(dialogId)); }
function clear(dialogId) { sessions.delete(key(dialogId)); }

async function bx(method, body = {}) {
  if (!WEBHOOK) throw new Error('BITRIX24_WEBHOOK_URL is not configured');
  const url = WEBHOOK.replace(/\\/+$/, '') + '/' + method + '.json';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

async function send(botId, dialogId, message, keyboard) {
  const fields = { message };
  if (keyboard) fields.keyboard = keyboard;
  return bx('imbot.v2.Chat.Message.send', {
    botId: Number(botId),
    botToken: BOT_TOKEN,
    dialogId: String(dialogId),
    fields
  });
}

async function answerCommand(botId, commandId, messageId, dialogId, message) {
  return bx('imbot.v2.Command.answer', {
    botId: Number(botId),
    botToken: BOT_TOKEN,
    commandId: Number(commandId),
    messageId: Number(messageId),
    dialogId: String(dialogId),
    fields: { message }
  });
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';
}

function num(text) {
  const normalized = String(text || '').replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const v = Number(normalized);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function objectName(v) {
  return v === 'h' ? 'Дом' : v === 'c' ? 'Коммерция' : 'Квартира';
}

function inputFrom(s) {
  return {
    floor: s.floor,
    bath: s.bath,
    balcony: 0,
    electrical: s.electrical || 'none',
    plumbing: s.plumbing || 'none',
    bathroom: s.bathroom || 'none',
    tile: s.tile || 'none',
    tileArea: s.tileArea,
    laminate: Boolean(s.laminate),
    plinth: s.plinth || 'none',
    walls: s.walls || {},
    cleanElectrical: Boolean(s.cleanElectrical),
    cleanPlumbing: Boolean(s.cleanPlumbing),
    cleaning: Boolean(s.cleaning),
    trash: Boolean(s.trash),
    customWorks: []
  };
}

function resultText(result, s) {
  const rows = result.rows || [];
  const sum = fn => rows.filter(fn).reduce((a, r) => a + Number(r.cost || 0), 0);
  const stage1 = sum(r => r.name.startsWith('Электрика') || r.name.startsWith('Сантехника') || r.name === 'Классический санузел');
  const stage2 = sum(r => r.name.startsWith('Плитка'));
  const stage3 = sum(r => r.name.startsWith('Плитка') || r.name.startsWith('Ламинат / кварцвинил'));
  const stage4 = sum(r => r.name.includes('обои') || r.name.includes('покраску') || r.name.includes('декоративку') || r.name.startsWith('Плинтус'));
  const stage5 = sum(r => r.name === 'Чистовая электрика' || r.name === 'Чистовая сантехника');
  const stage6 = sum(r => r.name === 'Клининг' || r.name === 'Вывоз мусора');

  return [
    '🧮 <b>Предварительный расчёт РЕМОНТФОРМА</b>',
    '',
    '🏠 Объект: <b>' + objectName(s.objectType) + '</b>',
    '📐 Общая площадь: <b>' + result.floor + ' м²</b>',
    '📐 Основная площадь: <b>' + result.mainArea + ' м²</b>',
    '',
    '1️⃣ Электрика, сантехника: <b>' + money(stage1) + '</b>',
    '2️⃣ Плитка: <b>' + money(stage2) + '</b>',
    '3️⃣ Напольные покрытия: <b>' + money(stage3) + '</b>',
    '4️⃣ Стены и плинтус: <b>' + money(stage4) + '</b>',
    '5️⃣ Чистовые работы: <b>' + money(stage5) + '</b>',
    '6️⃣ Сопутствующие работы: <b>' + money(stage6) + '</b>',
    '',
    '💵 <b>Итого: ' + money(result.total) + '</b>',
    '📐 Цена за м²: <b>' + money(result.pricePerM2) + '</b>',
    '',
    'Чтобы начать новый расчёт: /calculator',
    'Чтобы связаться с менеджером: напишите «менеджер».'
  ].join('\\n');
}

function menuKeyboard() {
  return [
    { TEXT: '🧮 Рассчитать стоимость', ACTION: 'SEND', ACTION_VALUE: '/calculator' },
    { TEXT: '📞 Связаться с менеджером', ACTION: 'SEND', ACTION_VALUE: 'менеджер' }
  ];
}

async function start(botId, dialogId) {
  clear(dialogId);
  save(dialogId, { step: 'object' });
  return send(botId, dialogId,
    '🏠 <b>РЕМОНТФОРМА</b>\\n\\nРассчитаем предварительную стоимость ремонта.\\n\\nНапишите: <b>квартира</b>, <b>дом</b> или <b>коммерция</b>.',
    menuKeyboard()
  );
}

async function ask(botId, dialogId, text, state, step) {
  save(dialogId, { ...state, step });
  return send(botId, dialogId, text);
}

async function showResult(botId, dialogId, s) {
  const result = calculate(inputFrom(s));
  save(dialogId, { ...s, step: 'phone', result });
  return send(botId, dialogId,
    resultText(result, s) + '\\n\\n📞 Если хотите, отправьте номер телефона сообщением — мы сохраним заявку в CRM.'
  );
}

function phoneCandidates(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\\D/g, '');
  const a = [raw, '+' + digits];
  if (digits.length === 11 && digits.startsWith('8')) a.push('+7' + digits.slice(1));
  if (digits.length === 10) a.push('+7' + digits);
  return [...new Set(a.filter(Boolean))];
}

async function ensureContact(phone, name, dialogId) {
  for (const p of phoneCandidates(phone)) {
    const found = await bx('crm.contact.list', {
      filter: { PHONE: p },
      select: ['ID', 'NAME', 'LAST_NAME', 'PHONE'],
      start: 0
    });
    if (Array.isArray(found?.result) && found.result[0]?.ID) return Number(found.result[0].ID);
  }
  const created = await bx('crm.contact.add', {
    fields: {
      NAME: String(name || 'Клиент'),
      PHONE: [{ VALUE: phone, VALUE_TYPE: 'MOBILE' }],
      SOURCE_ID: 'TELEGRAM',
      SOURCE_DESCRIPTION: 'РЕМОНТФОРМА Telegram через Bitrix24 Open Line | dialog:' + dialogId
    }
  });
  return created?.result ? Number(created.result) : null;
}

async function createDeal(phone, name, dialogId, result) {
  const contactId = await ensureContact(phone, name, dialogId);
  if (!contactId) return null;
  const deal = await bx('crm.deal.add', {
    fields: {
      TITLE: 'РЕМОНТФОРМА — Telegram расчёт',
      CONTACT_IDS: [contactId],
      OPPORTUNITY: Number(result?.total || 0),
      CURRENCY_ID: 'RUB',
      SOURCE_ID: 'TELEGRAM',
      SOURCE_DESCRIPTION: 'РЕМОНТФОРМА Telegram / Bitrix Open Line',
      COMMENTS: 'Предварительный расчёт: ' + money(result?.total) + '; цена/м²: ' + money(result?.pricePerM2) + '; dialog: ' + dialogId
    }
  });
  return { contactId, dealId: deal?.result ? Number(deal.result) : null };
}

async function handleText(botId, dialogId, text, user) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();
  let s = get(dialogId) || {};

  if (lower === '/calculator' || lower === '/calc' || lower === '/start' || lower === 'рассчитать заново' || lower === '🧮 рассчитать стоимость') {
    return start(botId, dialogId);
  }

  if (lower.includes('менеджер') || lower.includes('оператор')) {
    await send(botId, dialogId, '👤 Передаю диалог менеджеру РЕМОНТФОРМА.');
    try { await bx('imopenlines.bot.session.operator', { CHAT_ID: Number(String(dialogId).replace('chat','')) }); } catch (_) {}
    return;
  }

  if (s.step === 'object') {
    if (lower.includes('кварт')) s.objectType = 'a';
    else if (lower.includes('дом')) s.objectType = 'h';
    else if (lower.includes('коммер')) s.objectType = 'c';
    else return send(botId, dialogId, 'Напишите одним словом: <b>квартира</b>, <b>дом</b> или <b>коммерция</b>.');
    return ask(botId, dialogId, '📐 Напишите общую площадь объекта в м². Например: <b>80</b>.', s, 'floor');
  }

  if (s.step === 'floor') {
    const v = num(t);
    if (v === null) return send(botId, dialogId, '⚠️ Введите площадь числом. Например: <b>80</b>.');
    s.floor = v;
    return ask(botId, dialogId, '🚿 Напишите площадь санузла в м². Если не нужно учитывать санузел — <b>0</b>.', s, 'bath');
  }

  if (s.step === 'bath') {
    const v = num(t);
    if (v === null) return send(botId, dialogId, '⚠️ Введите площадь числом. Например: <b>5</b>.');
    s.bath = v;
    return ask(botId, dialogId, '⚡ Электрика: напишите <b>нет</b>, <b>частичная</b> или <b>полная</b>.', s, 'electrical');
  }

  if (s.step === 'electrical') {
    if (lower === 'нет') s.electrical = 'none';
    else if (lower.includes('част')) s.electrical = 'partial';
    else if (lower.includes('полн')) s.electrical = 'full';
    else return send(botId, dialogId, 'Напишите: <b>нет</b>, <b>частичная</b> или <b>полная</b>.');
    return ask(botId, dialogId, '🚰 Сантехника: напишите <b>нет</b>, <b>частичная</b> или <b>полная</b>.', s, 'plumbing');
  }

  if (s.step === 'plumbing') {
    if (lower === 'нет') s.plumbing = 'none';
    else if (lower.includes('част')) s.plumbing = 'partial';
    else if (lower.includes('полн')) s.plumbing = 'full';
    else return send(botId, dialogId, 'Напишите: <b>нет</b>, <b>частичная</b> или <b>полная</b>.');
    return ask(botId, dialogId, '🚿 Санузел: напишите <b>нет</b> или <b>классический</b>.', s, 'bathroom');
  }

  if (s.step === 'bathroom') {
    if (lower === 'нет') s.bathroom = 'none';
    else if (lower.includes('класс')) s.bathroom = 'classic';
    else return send(botId, dialogId, 'Напишите: <b>нет</b> или <b>классический</b>.');
    return ask(botId, dialogId, '🧱 Плитка. Напишите площадь плитки в м². Если плитка не нужна — <b>0</b>.', s, 'tileArea');
  }

  if (s.step === 'tileArea') {
    const v = num(t);
    if (v === null) return send(botId, dialogId, '⚠️ Введите площадь числом. Например: <b>12</b>.');
    const main = Math.max(0, Number(s.floor || 0) - Number(s.bath || 0));
    s.tile = v > 0 ? 'manual' : 'none';
    s.tileArea = Math.min(v, main);
    return ask(botId, dialogId, '🏠 Оставшиеся полы: напишите <b>кварцвинил</b>, <b>ламинат</b> или <b>нет</b>.', s, 'laminate');
  }

  if (s.step === 'laminate') {
    s.laminate = lower !== 'нет';
    s.laminateType = lower.includes('ламин') ? 'laminate' : 'quartzvinyl';
    return ask(botId, dialogId, '📏 Плинтус: напишите <b>нет</b>, <b>пластиковый</b> или <b>полиуретановый</b>.', s, 'plinth');
  }

  if (s.step === 'plinth') {
    if (lower === 'нет') s.plinth = 'none';
    else if (lower.includes('пласт')) s.plinth = 'plastic';
    else if (lower.includes('поли')) s.plinth = 'polyurethane';
    else return send(botId, dialogId, 'Напишите: <b>нет</b>, <b>пластиковый</b> или <b>полиуретановый</b>.');
    return ask(botId, dialogId, '🧱 Стены: напишите один или несколько вариантов через запятую: <b>обои</b>, <b>покраска</b>, <b>декоративка</b>. Если стены не нужны — <b>нет</b>.', s, 'walls');
  }

  if (s.step === 'walls') {
    s.walls = {};
    if (!lower.includes('нет')) {
      if (lower.includes('обои')) s.walls.wallpaper = { area: 0 };
      if (lower.includes('покрас')) s.walls.paint = { area: 0 };
      if (lower.includes('декор')) s.walls.decorative = { area: 0 };
    }
    return ask(botId, dialogId, '💡 Чистовая электрика: <b>да</b> или <b>нет</b>.', s, 'cleanElectrical');
  }

  if (s.step === 'cleanElectrical') {
    if (!['да','нет'].includes(lower)) return send(botId, dialogId, 'Напишите <b>да</b> или <b>нет</b>.');
    s.cleanElectrical = lower === 'да';
    return ask(botId, dialogId, '🚿 Чистовая сантехника: <b>да</b> или <b>нет</b>.', s, 'cleanPlumbing');
  }

  if (s.step === 'cleanPlumbing') {
    if (!['да','нет'].includes(lower)) return send(botId, dialogId, 'Напишите <b>да</b> или <b>нет</b>.');
    s.cleanPlumbing = lower === 'да';
    return ask(botId, dialogId, '🧹 Клининг: <b>да</b> или <b>нет</b>.', s, 'cleaning');
  }

  if (s.step === 'cleaning') {
    if (!['да','нет'].includes(lower)) return send(botId, dialogId, 'Напишите <b>да</b> или <b>нет</b>.');
    s.cleaning = lower === 'да';
    return ask(botId, dialogId, '🚛 Вывоз мусора: <b>да</b> или <b>нет</b>.', s, 'trash');
  }

  if (s.step === 'trash') {
    if (!['да','нет'].includes(lower)) return send(botId, dialogId, 'Напишите <b>да</b> или <b>нет</b>.');
    s.trash = lower === 'да';
    return showResult(botId, dialogId, s);
  }

  if (s.step === 'phone') {
    const digits = t.replace(/\\D/g, '');
    if (digits.length < 10) return send(botId, dialogId, '📞 Напишите номер телефона, например: <b>+7 900 123-45-67</b>.');
    try {
      const result = await createDeal(t, [user?.name, user?.lastName].filter(Boolean).join(' ') || 'Клиент', dialogId, s.result);
      clear(dialogId);
      return send(botId, dialogId,
        '✅ Заявка сохранена в CRM.' + (result?.dealId ? ' Сделка #' + result.dealId + ' создана.' : '') +
        '\\n\\nНовый расчёт можно начать командой <b>/calculator</b>.'
      );
    } catch (_) {
      return send(botId, dialogId, '⚠️ Номер получил, но CRM сейчас недоступна. Менеджер сможет связаться с вами после восстановления связи.\\n\\nНовый расчёт: <b>/calculator</b>.');
    }
  }

  return send(botId, dialogId, 'Нажмите «Рассчитать стоимость» или напишите <b>/calculator</b>.', menuKeyboard());
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) {}
  const p = new URLSearchParams(raw);
  const out = {};
  for (const [k,v] of p.entries()) out[k] = v;
  return out;
}

function nested(body, root, field) {
  return body?.data?.[root]?.[field] ??
    body?.[`data[${root}][${field}]`] ??
    body?.[`data[${root}][${field}]`];
}

function eventData(body) {
  if (body?.data) return body.data;
  const bot = {
    id: Number(body['data[bot][id]'] || 0),
    auth: body['data[bot][auth]'] || ''
  };
  const message = {
    id: Number(body['data[message][id]'] || 0),
    text: body['data[message][text]'] || ''
  };
  const chat = {
    id: Number(body['data[chat][id]'] || 0),
    dialogId: body['data[chat][dialogId]'] || body['data[chat][dialog_id]'] || ''
  };
  const user = {
    id: Number(body['data[user][id]'] || 0),
    name: body['data[user][name]'] || '',
    lastName: body['data[user][lastName]'] || ''
  };
  const command = {
    id: Number(body['data[command][id]'] || 0),
    command: body['data[command][command]'] || ''
  };
  return { bot, message, chat, user, command };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА Bitrix24 Open Line calculator',
      version: VERSION,
      configured: Boolean(WEBHOOK && BOT_TOKEN)
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = parseBody(req);
    const data = eventData(body);
    const event = body.event || '';

    if (!BOT_TOKEN || !WEBHOOK) return res.status(200).json({ ok: false, error: 'Bitrix env is not configured' });

    const eventToken = data.bot?.auth || body['auth[application_token]'] || '';
    if (eventToken && !String(eventToken).includes(BOT_TOKEN)) {
      return res.status(200).json({ ok: false, ignored: true });
    }

    if (event === 'ONIMBOTV2COMMANDADD') {
      const cmd = String(data.command?.command || '').replace(/^\//,'').toLowerCase();
      if (cmd === 'calculator' || cmd === 'calc' || cmd === 'start') {
        await answerCommand(data.bot.id, data.command.id, data.message.id, data.chat.dialogId || data.chat.id, 'Запускаю новый расчёт…');
        await start(data.bot.id, data.chat.dialogId || data.chat.id);
      } else if (cmd === 'manager' || cmd === 'operator') {
        await answerCommand(data.bot.id, data.command.id, data.message.id, data.chat.dialogId || data.chat.id, 'Передаю диалог менеджеру РЕМОНТФОРМА.');
        try { await bx('imopenlines.bot.session.operator', { CHAT_ID: Number(data.chat.id) }); } catch (_) {}
      } else {
        await answerCommand(data.bot.id, data.command.id, data.message.id, data.chat.dialogId || data.chat.id, 'Доступные команды: /calculator и /manager');
      }
      return res.status(200).json({ ok: true });
    }

    if (event === 'ONIMBOTV2MESSAGEADD') {
      const dialogId = data.chat?.dialogId || data.chat?.id;
      if (!dialogId || !data.bot?.id) return res.status(200).json({ ok: true, ignored: true });
      await handleText(data.bot.id, dialogId, data.message?.text || '', data.user || {});
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, ignored: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message || 'Bitrix bot error' });
  }
};
