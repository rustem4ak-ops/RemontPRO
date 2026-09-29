const { calculate } = require('../shared/remontforma-pricing.js');

const TOKEN = process.env.MAX_BOT_TOKEN;
const SECRET = process.env.MAX_WEBHOOK_SECRET || 'rf-max-2026-webhook';
const API = 'https://platform-api2.max.ru';

const sessions = globalThis.__RF_MAX_SESSIONS || (globalThis.__RF_MAX_SESSIONS = new Map());

async function maxApi(path, method = 'POST', body) {
  if (!TOKEN) throw new Error('MAX_BOT_TOKEN is not configured');
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || 'MAX API error');
  return data;
}

function buttons(rows) {
  return [{ type: 'inline_keyboard', payload: { buttons: rows } }];
}
const cb = (text, payload) => ({ type: 'callback', text, payload });
const link = (text, url) => ({ type: 'link', text, url });
const contact = text => ({ type: 'request_contact', text });

async function send(chatId, text, attachments = []) {
  return maxApi('/messages?chat_id=' + encodeURIComponent(chatId), 'POST', {
    text, attachments
  });
}
function save(chatId, state) { sessions.set(String(chatId), state); }
function get(chatId) { return sessions.get(String(chatId)); }
function clear(chatId) { sessions.delete(String(chatId)); }

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0)) + ' ₽';
}
function objectName(v) {
  return v === 'house' ? 'Дом' : v === 'commercial' ? 'Коммерция' : 'Квартира';
}
function num(v) {
  const n = Number(String(v || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function start(chatId) {
  clear(chatId);
  save(chatId, { step: 'object' });
  return send(chatId,
    '🏠 РЕМОНТФОРМА\n\nРассчитаем предварительную стоимость ремонта. Выберите тип объекта:',
    buttons([
      [cb('🏠 Квартира', 'OBJ:apartment')],
      [cb('🏡 Дом', 'OBJ:house')],
      [cb('🏢 Коммерция', 'OBJ:commercial')]
    ])
  );
}

async function askArea(chatId, s) {
  s.step = 'area'; save(chatId, s);
  return send(chatId, '📐 Напишите общую площадь объекта в м².\nНапример: 80');
}
async function askBath(chatId, s) {
  s.step = 'bath'; save(chatId, s);
  return send(chatId, '🚿 Напишите площадь санузла в м².\nЕсли не нужен расчёт санузла — 0');
}
async function askElectrical(chatId, s) {
  s.step = 'electrical'; save(chatId, s);
  return send(chatId, '⚡ Электрика\n\nВыберите вариант:',
    buttons([[cb('Нет','E:none')],[cb('Частичный монтаж — 2 500 ₽/м²','E:partial')],[cb('Полный монтаж — 3 500 ₽/м²','E:full')]]));
}
async function askPlumbing(chatId, s) {
  s.step = 'plumbing'; save(chatId, s);
  return send(chatId, '🚰 Сантехника\n\nВыберите вариант:',
    buttons([[cb('Нет','P:none')],[cb('Частичный монтаж — 1 000 ₽/м²','P:partial')],[cb('Полный монтаж — 2 500 ₽/м²','P:full')]]));
}
async function askBathroom(chatId, s) {
  s.step = 'bathroom'; save(chatId, s);
  return send(chatId, '🚿 Санузел\n\nВыберите вариант:',
    buttons([[cb('Нет','B:none')],[cb('Классический санузел — 50 000 ₽/м²','B:classic')]]));
}
async function askTile(chatId, s) {
  s.step = 'tile'; save(chatId, s);
  return send(chatId, '🧱 Пол — плитка\n\nВыберите вариант:',
    buttons([[cb('Без плитки','T:none')],[cb('Плитка на всей основной площади — 10 000 ₽/м²','T:fixed')],[cb('Указать площадь плитки','T:manual')]]));
}
async function askTileArea(chatId, s) {
  s.step = 'tileArea'; save(chatId, s);
  return send(chatId, '🧱 Напишите площадь плитки в м².\nНапример: 12');
}
async function askFloor(chatId, s) {
  s.step = 'floorFinish'; save(chatId, s);
  return send(chatId, '🏠 Оставшиеся полы\n\nВыберите вариант:',
    buttons([[cb('Не делать','F:none')],[cb('Кварцвинил — 1 000 ₽/м²','F:quartz')],[cb('Ламинат — 1 000 ₽/м²','F:laminate')]]));
}
async function askWalls(chatId, s) {
  s.step = 'walls'; save(chatId, s);
  return send(chatId, '🎨 Стены\nМожно выбрать несколько вариантов. После выбора нажмите «Продолжить».',
    buttons([
      [cb('Обои — 1 500 ₽/м²','W:wallpaper')],
      [cb('Покраска — 4 000 ₽/м²','W:paint')],
      [cb('Декоративная штукатурка — 2 500 ₽/м²','W:decorative')],
      [cb('➡️ Продолжить','W:done')]
    ])
  );
}
async function askPlinth(chatId, s) {
  s.step = 'plinth'; save(chatId, s);
  return send(chatId, '📏 Плинтус\n\nВыберите вариант:',
    buttons([[cb('Нет','PL:none')],[cb('Пластиковый — 400 ₽/м²','PL:plastic')],[cb('Полиуретановый — 1 300 ₽/м²','PL:polyurethane')]]));
}
async function askExtras(chatId, s) {
  s.step = 'extras'; save(chatId, s);
  return send(chatId, '🧹 Завершение\n\nВыберите нужные работы:',
    buttons([
      [cb((s.cleanElectrical ? '☑ ' : '☐ ') + 'Чистовая электрика','X:cleanElectrical')],
      [cb((s.cleanPlumbing ? '☑ ' : '☐ ') + 'Чистовая сантехника','X:cleanPlumbing')],
      [cb((s.cleaning ? '☑ ' : '☐ ') + 'Клининг — 400 ₽/м²','X:cleaning')],
      [cb((s.trash ? '☑ ' : '☐ ') + 'Вывоз мусора','X:trash')],
      [cb('➡️ Рассчитать','X:done')]
    ])
  );
}

function toInput(s) {
  return {
    floor: s.floor, bath: s.bath, balcony: 0,
    electrical: s.electrical || 'none',
    plumbing: s.plumbing || 'none',
    bathroom: s.bathroom || 'none',
    tile: s.tile || 'none',
    tileArea: s.tileArea || 0,
    laminate: ['quartz','laminate'].includes(s.floorFinish),
    plinth: s.plinth || 'none',
    walls: s.walls || {},
    cleanElectrical: !!s.cleanElectrical,
    cleanPlumbing: !!s.cleanPlumbing,
    cleaning: !!s.cleaning,
    trash: !!s.trash
  };
}
function stageSum(rows, fn) { return rows.filter(fn).reduce((a, x) => a + Number(x.cost || 0), 0); }

async function showResult(chatId, s) {
  const result = calculate(toInput(s));
  s.step = 'lead'; s.result = result; save(chatId, s);
  const rows = result.rows || [];
  const e = stageSum(rows, x => /Электрика|Сантехника|санузел/.test(x.name));
  const tile = stageSum(rows, x => x.name.startsWith('Плитка'));
  const floors = stageSum(rows, x => x.name.startsWith('Ламинат / кварцвинил'));
  const walls = stageSum(rows, x => /обои|покраску|декоративку|Плинтус/.test(x.name));
  const clean = stageSum(rows, x => /Чистовая/.test(x.name));
  const end = stageSum(rows, x => /Клининг|Вывоз/.test(x.name));
  return send(chatId,
    '🧮 РЕМОНТФОРМА — предварительный расчёт\n\n' +
    '🏠 Объект: ' + objectName(s.objectType) + '\n' +
    '📐 Площадь: ' + result.floor + ' м²\n' +
    '📐 Основная площадь: ' + result.mainArea + ' м²\n\n' +
    '1️⃣ Электрика, сантехника, санузел — ' + money(e) + '\n' +
    '2️⃣ Плитка — ' + money(tile) + '\n' +
    '3️⃣ Напольные покрытия — ' + money(floors) + '\n' +
    '4️⃣ Стены и плинтусы — ' + money(walls) + '\n' +
    '5️⃣ Чистовые работы — ' + money(clean) + '\n' +
    '6️⃣ Завершение — ' + money(end) + '\n\n' +
    '💰 ИТОГО: ' + money(result.total) + '\n' +
    '📊 Цена за м² по полу: ' + money(result.pricePerM2) + '\n\n' +
    'Это предварительный расчёт. Точная смета формируется после замера.',
    buttons([
      [contact('📞 Получить точную смету')],
      [cb('🔄 Рассчитать заново','RESTART')],
      [link('🌐 Открыть сайт РЕМОНТФОРМА','https://remont-pro-nine.vercel.app')]
    ])
  );
}

async function handleCallback(update) {
  const c = update.message_callback || update.callback || {};
  const payload = c.payload || c.callback_data || c.data || '';
  const chatId = update.chat_id || c.chat_id || c.message?.recipient?.chat_id || c.message?.recipient?.user_id;
  if (!chatId) return;
  const s = get(chatId) || {};
  if (payload === 'RESTART') return start(chatId);

  if (payload.startsWith('OBJ:')) {
    s.objectType = payload.slice(4); return askArea(chatId, s);
  }
  if (payload.startsWith('E:')) { s.electrical = payload.slice(2); return askPlumbing(chatId, s); }
  if (payload.startsWith('P:')) { s.plumbing = payload.slice(2); return askBathroom(chatId, s); }
  if (payload.startsWith('B:')) { s.bathroom = payload.slice(2); return askTile(chatId, s); }
  if (payload === 'T:none') { s.tile='none'; return askFloor(chatId,s); }
  if (payload === 'T:fixed') { s.tile='fixed'; return askFloor(chatId,s); }
  if (payload === 'T:manual') { s.tile='manual'; return askTileArea(chatId,s); }
  if (payload.startsWith('F:')) { s.floorFinish=payload.slice(2); return askWalls(chatId,s); }
  if (payload.startsWith('W:')) {
    const w=payload.slice(2);
    if (w === 'done') return askPlinth(chatId,s);
    s.walls=s.walls||{};
    s.walls[w] = s.walls[w] || { area: 0 };
    save(chatId,s); return askWalls(chatId,s);
  }
  if (payload.startsWith('PL:')) { s.plinth=payload.slice(3); return askExtras(chatId,s); }
  if (payload.startsWith('X:')) {
    const x=payload.slice(2);
    if (x === 'done') return showResult(chatId,s);
    s[x] = !s[x]; return askExtras(chatId,s);
  }
  if (c.callback_id) {
    await maxApi('/answers?callback_id=' + encodeURIComponent(c.callback_id), 'POST', { message: { text: 'Выбрано' } }).catch(()=>{});
  }
}

function contactFromMessage(message) {
  const a = message?.body?.attachments || message?.attachments || [];
  for (const x of a) {
    if (x.type === 'contact') {
      const p = x.payload || {};
      const v = p.vcf_info || '';
      const m = v.match(/TEL[^:]*:([^\r\n]+)/i);
      return (p.max_info?.phone || (m && m[1]) || '').trim();
    }
  }
  return '';
}

async function handleMessage(update) {
  const m = update.message || {};
  const chatId = update.chat_id || m.recipient?.chat_id || m.recipient?.user_id;
  if (!chatId) return;
  const text = String(m.body?.text || m.text || '').trim();

  if (/^\/start$|^Начать$/i.test(text)) return start(chatId);
  const s = get(chatId);
  if (!s) return start(chatId);

  if (s.step === 'lead') {
    const phone = contactFromMessage(m);
    if (phone) {
      const lead = {
        name: m.sender?.name || 'Клиент',
        phone,
        source: 'max',
        medium: 'max_bot',
        calculator: {
          total: s.result?.total || 0,
          pricePerM2: s.result?.pricePerM2 || 0
        },
        object: {
          type: objectName(s.objectType),
          floor: s.floor || 0,
          bath: s.bath || 0,
          balcony: 0
        }
      };
      await fetch('https://remont-pro-nine.vercel.app/api/lead', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(lead)
      });
      clear(chatId);
      await send(chatId, '✅ Спасибо! Заявка принята.\n\n📞 ' + phone + '\n\nМы свяжемся с вами для обсуждения проекта.');
      return;
    }
  }

  if (s.step === 'area') {
    const v=num(text); if(v===null) return send(chatId,'⚠️ Введите площадь числом, например 80');
    s.floor=v; return askBath(chatId,s);
  }
  if (s.step === 'bath') {
    const v=num(text); if(v===null) return send(chatId,'⚠️ Введите площадь санузла числом, например 4');
    s.bath=v; return askElectrical(chatId,s);
  }
  if (s.step === 'tileArea') {
    const v=num(text); if(v===null) return send(chatId,'⚠️ Введите площадь плитки числом, например 12');
    const main=Math.max(0,(s.floor||0)-(s.bath||0)); s.tileArea=Math.min(v,main); return askFloor(chatId,s);
  }
  return send(chatId,'Нажмите кнопку «Рассчитать заново» или отправьте /start.');
}

module.exports = async function handler(req,res) {
  if (req.method === 'GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА MAX Bot',configured:!!TOKEN});
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  if (SECRET && req.headers['x-max-bot-api-secret'] !== SECRET) return res.status(401).json({ok:false,error:'Unauthorized'});
  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    if (update.update_type === 'message_callback') await handleCallback(update);
    else if (update.update_type === 'message_created' || update.update_type === 'bot_started') await handleMessage(update);
    return res.status(200).json({ok:true});
  } catch(e) {
    return res.status(200).json({ok:false,error:e.message});
  }
};
