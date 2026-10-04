const https = require('https');
const { calculate } = require('../shared/remontforma-pricing.js');
const { analyze, score, level, area, budget, classify } = require('../shared/autosearch.cjs');

const TOKEN = process.env.MAX_BOT_TOKEN;
const SECRET = process.env.MAX_WEBHOOK_SECRET || 'rf-max-2026-webhook';
const API = 'https://platform-api2.max.ru';
const LOGO_URL = 'https://remont-pro-nine.vercel.app/remontforma-logo.jpg';

const ROOT_CA_URL = 'https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt';
const SUB_CA_URL = 'https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt';

let cachedAgent = null;
let cachedAt = 0;

function download(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'RemontPRO-MAX/1.0' }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error('Certificate download failed: HTTP ' + response.statusCode));
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    request.on('timeout', () => request.destroy(new Error('Certificate download timeout')));
    request.on('error', reject);
  });
}

async function getAgent() {
  if (cachedAgent && Date.now() - cachedAt < 6 * 60 * 60 * 1000) return cachedAgent;
  const [rootCA, subCA] = await Promise.all([download(ROOT_CA_URL), download(SUB_CA_URL)]);
  cachedAgent = new https.Agent({
    keepAlive: true,
    ca: [rootCA, subCA],
    minVersion: 'TLSv1.2'
  });
  cachedAt = Date.now();
  return cachedAgent;
}

function maxRequest(path, method = 'GET', body) {
  return new Promise(async (resolve, reject) => {
    try {
      const agent = await getAgent();
      const url = new URL(path, API);
      const payload = body === undefined ? null : JSON.stringify(body);

      const request = https.request(url, {
        method,
        agent,
        headers: {
          Authorization: TOKEN,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        },
        timeout: 20000
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = {};
          try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(data.message || data.error || ('MAX API error HTTP ' + response.statusCode)));
            return;
          }
          resolve(data);
        });
      });

      request.on('timeout', () => request.destroy(new Error('MAX API request timeout')));
      request.on('error', reject);
      if (payload) request.write(payload);
      request.end();
    } catch (e) {
      reject(e);
    }
  });
}

const sessions = globalThis.__RF_MAX_SESSIONS || (globalThis.__RF_MAX_SESSIONS = new Map());
const liveLeadSeen = globalThis.__RF_MAX_LIVE_LEADS || (globalThis.__RF_MAX_LIVE_LEADS = new Set());

async function monitorMaxGroupMessage(update){
  const m=update.message||{};
  const text=String(m.body?.text||m.text||'').trim();
  const chatId=update.chat_id||m.recipient?.chat_id;
  if(!text||!chatId) return false;
  const source={id:'max-chat-'+chatId,name:'MAX · '+(m.recipient?.title||'группа'),type:'telegram_group',city:'Казань'};
  const info=analyze(text,source);
  if(!info.ok) return false;
  const sc=score(text,info,source);
  if(level(sc,text)!=='hot') return false;
  const messageId=m.body?.mid||m.id||update.message_id||String(update.timestamp||Date.now());
  const dedup=String(chatId)+':'+String(messageId);
  if(liveLeadSeen.has(dedup)) return false;
  liveLeadSeen.add(dedup);
  if(liveLeadSeen.size>3000){ const first=liveLeadSeen.values().next().value; liveLeadSeen.delete(first); }
  const title=m.recipient?.title||'группа MAX';
  const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД ИЗ MAX\\n\\n'+text+'\\n\\n🏢 '+title+'\\n📍 '+classify(text)+(area(text)?' · '+area(text)+' м²':'')+'\\n🎯 '+sc+'%\\n🔎 '+info.reasons.join(' · ');
  if(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_ADMIN_CHAT_ID){
    try{await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:msg})});}catch(_){}
  }
  return true;
}

function save(id, state) { sessions.set(String(id), state); }
function get(id) { return sessions.get(String(id)); }
function clear(id) { sessions.delete(String(id)); }

function money(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(v) || 0)) + ' ₽';
}

function num(v) {
  const n = Number(String(v || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function objectName(v) {
  return v === 'h' ? 'Дом' : v === 'commercial' ? 'Коммерция' : 'Квартира';
}

function buttons(rows) {
  return [{
    type: 'inline_keyboard',
    payload: { buttons: rows }
  }];
}

function cb(text, payload) {
  return { type: 'callback', text, payload };
}

function link(text, url) {
  return { type: 'link', text, url };
}

function contact(text) {
  return { type: 'request_contact', text };
}

async function send(chatId, text, rows = [], extraAttachments = []) {
  const attachments = [...(extraAttachments || []), ...(rows.length ? buttons(rows) : [])];
  return maxRequest('/messages?chat_id=' + encodeURIComponent(chatId), 'POST', {
    text,
    attachments
  });
}

async function answerCallback(callbackId) {
  if (!callbackId) return;
  try {
    await maxRequest('/answers?callback_id=' + encodeURIComponent(callbackId), 'POST', {});
  } catch (_) {}
}

async function start(id) {
  clear(id);
  save(id, { step: 'object' });
  return send(id,
    '👋 Добро пожаловать в РЕМОНТФОРМА!\n\nМы поможем быстро рассчитать предварительную стоимость ремонта.\n\n🏗️ Работаем с квартирами, домами и коммерческими помещениями.\n\n📐 Расчёт займёт всего несколько минут.\n\nДавайте начнём! Выберите тип объекта:',
    [
      [cb('🏠 Квартира', 'OBJ:a')],
      [cb('🏡 Дом', 'OBJ:h')],
      [cb('🏢 Коммерция', 'OBJ:commercial')]
    ],
    [{ type: 'image', payload: { url: LOGO_URL } }]
  );
}

async function ask(id, step, text, state) {
  save(id, { ...state, step });
  return send(id, text);
}

async function choose(id, step, text, rows, state) {
  save(id, { ...state, step });
  return send(id, text, rows);
}

function input(s) {
  return {
    floor: s.floor,
    bath: s.bath || 0,
    balcony: 0,
    windows: s.windows || 0,
    electrical: s.electrical || 'none',
    plumbing: s.plumbing || 'none',
    bathroom: s.bathroom || 'none',
    tile: 'manual',
    tileArea: s.tileArea || 0,
    laminate: true,
    plinth: s.plinth || 'none',
    walls: s.walls || {},
    cleanElectrical: !!s.cleanElectrical,
    cleanPlumbing: !!s.cleanPlumbing,
    cleaning: !!s.cleaning,
    trash: !!s.trash
  };
}

function sumRows(rows, names) {
  return rows
    .filter(x => names.some(n => x.name === n || x.name.startsWith(n)))
    .reduce((a, x) => a + Number(x.cost || 0), 0);
}

async function showResult(id, s) {
  const r = calculate(input(s));
  const rows = r.rows || [];

  const stages = [
    ['1️⃣', 'Черновая электрика + черновая сантехника', sumRows(rows, ['Электрика', 'Сантехника'])],
    ['2️⃣', 'Плиточные работы', sumRows(rows, ['Классический санузел', 'Плитка'])],
    ['3️⃣', 'Напольные работы', sumRows(rows, ['Ламинат / кварцвинил', 'Плинтус'])],
    ['4️⃣', 'Стены', sumRows(rows, [
      'Подготовка под обои + обои',
      'Подготовка под покраску + покраска',
      'Подготовка под декоративку + декоративка'
    ])],
    ['5️⃣', 'Чистовая электрика / сантехника', sumRows(rows, ['Чистовая электрика', 'Чистовая сантехника'])],
    ['6️⃣', 'Завершающие работы', sumRows(rows, ['Клининг', 'Вывоз мусора'])]
  ];

  const lines = [
    'РЕМОНТФОРМА — предварительный расчёт',
    '',
    '🏠 Объект: ' + objectName(s.objectType),
    '📐 Площадь: ' + r.floor + ' м²',
    '📐 Основная площадь: ' + r.mainArea + ' м²',
    ''
  ];

  for (const [icon, name, value] of stages) {
    lines.push(icon + ' ' + name);
    lines.push('💰 ' + money(value));
    lines.push('');
  }

  lines.push(
    '💵 ИТОГО: ' + money(r.total),
    '📐 Цена за м²: ' + money(r.pricePerM2),
    '',
    '📞 Для консультации отправьте номер телефона.'
  );

  save(id, { ...s, step: 'result', result: r });

  return send(id, lines.join('\n'), [
    [contact('📞 Оставить номер телефона')],
    [cb('🔄 Рассчитать заново', 'RESTART')],
    [link('🌐 Открыть сайт РЕМОНТФОРМА', 'https://remont-pro-nine.vercel.app')]
  ]);
}

async function commercial(id) {
  clear(id);
  save(id, { step: 'commercialLead', objectType: 'commercial' });
  return send(id,
    '🏢 Ремонт в коммерции зависит от проекта и объёмов работ.\n\nПоэтому отправьте номер телефона, чтобы обсудить подробности.',
    [
      [contact('📞 Оставить номер телефона')],
      [cb('🔄 Рассчитать заново', 'RESTART')]
    ]
  );
}

async function nextPlumbing(id, s) {
  return choose(id, 'plumbing', '🚰 Сантехника', [
    [cb('Нет', 'P0')],
    [cb('Частичный монтаж', 'P1')],
    [cb('Полный монтаж', 'P2')]
  ], s);
}

async function nextBathroom(id, s) {
  return choose(id, 'bathroom', '🚿 Санузел', [
    [cb('Нет', 'B0')],
    [cb('Классический санузел', 'B1')]
  ], s);
}

async function nextTileArea(id, s) {
  return ask(id, 'tileArea', '🧱 Плитка полы (коридор, комнаты)\n\nНапишите площадь плитки в м², например: 12', s);
}

async function nextFloor(id, s) {
  return choose(id, 'floorFinish', '🏠 Оставшиеся полы', [
    [cb('Кварцвинил', 'LQ')],
    [cb('Ламинат', 'LL')]
  ], s);
}

async function nextPlinth(id, s) {
  return choose(id, 'plinth', '📏 Плинтус', [
    [cb('Нет', 'PL0')],
    [cb('Пластиковый', 'PL1')],
    [cb('Полиуретановый', 'PL2')]
  ], s);
}

async function nextWalls(id, s) {
  return choose(id, 'walls', '🧱 Стены', [
    [cb('Без отделки', 'W0')],
    [cb('Обои', 'W1')],
    [cb('Покраска', 'W2')],
    [cb('Декоративка', 'W3')]
  ], s);
}

async function nextCleanElectrical(id, s) {
  return choose(id, 'cleanElectrical', '💡 Чистовая электрика', [
    [cb('Да', 'CE1')],
    [cb('Нет', 'CE0')]
  ], s);
}

async function nextCleanPlumbing(id, s) {
  return choose(id, 'cleanPlumbing', '🚿 Чистовая сантехника', [
    [cb('Да', 'CP1')],
    [cb('Нет', 'CP0')]
  ], s);
}

async function nextCleaning(id, s) {
  return choose(id, 'cleaning', '🧹 Клининг', [
    [cb('Да', 'CL1')],
    [cb('Нет', 'CL0')]
  ], s);
}

async function nextTrash(id, s) {
  return choose(id, 'trash', '🚛 Вывоз мусора', [
    [cb('Да', 'TR1')],
    [cb('Нет', 'TR0')]
  ], s);
}

async function handleCallback(update) {
  const c = update.callback || update.message_callback || {};
  const payload = String(c.payload || c.callback_data || c.data || '');
  const callbackId = c.callback_id || update.callback_id || '';

  const id =
    update.chat_id ||
    c.chat_id ||
    c.user?.user_id ||
    update.user?.user_id ||
    update.callback?.user?.user_id ||
    c.message?.recipient?.chat_id ||
    c.message?.recipient?.user_id ||
    update.message?.recipient?.chat_id ||
    update.message?.recipient?.user_id;

  // MAX присылает message_callback отдельным событием. Для личного
  // диалога ID пользователя находится в callback.user.user_id или
  // message.recipient.user_id; для группового — в recipient.chat_id.
  if (!id) return;

  // Не блокируем основной сценарий ожиданием /answers: если API ответа
  // временно тормозит, кнопка всё равно должна запустить новый расчёт.
  if (callbackId) {
    answerCallback(callbackId).catch(() => {});
  }

  const s = get(id) || {};

  switch (payload) {
    case 'RESTART':
      return start(id);

    case 'OBJ:a':
    case 'OBJ:h':
      s.objectType = payload === 'OBJ:h' ? 'h' : 'a';
      return ask(id, 'floor', '📐 Напишите общую площадь объекта в м², например: 80', s);

    case 'OBJ:commercial':
      return commercial(id);

    case 'E0':
    case 'E1':
    case 'E2':
      s.electrical = payload === 'E0' ? 'none' : payload === 'E1' ? 'partial' : 'full';
      return nextPlumbing(id, s);

    case 'P0':
    case 'P1':
    case 'P2':
      s.plumbing = payload === 'P0' ? 'none' : payload === 'P1' ? 'partial' : 'full';
      return nextBathroom(id, s);

    case 'B0':
      s.bathroom = 'none';
      return nextTileArea(id, s);

    case 'B1':
      s.bathroom = 'classic';
      return nextTileArea(id, s);

    case 'LQ':
    case 'LL':
      s.floorFinish = payload === 'LQ' ? 'quartz' : 'laminate';
      return nextPlinth(id, s);

    case 'PL0':
    case 'PL1':
    case 'PL2':
      s.plinth = payload === 'PL0' ? 'none' : payload === 'PL1' ? 'plastic' : 'polyurethane';
      return nextWalls(id, s);

    case 'W0':
      s.walls = {};
      return nextCleanElectrical(id, s);

    case 'W1':
      s.walls = { wallpaper: { area: 0 } };
      return nextCleanElectrical(id, s);

    case 'W2':
      s.walls = { paint: { area: 0 } };
      return nextCleanElectrical(id, s);

    case 'W3':
      s.walls = { decorative: { area: 0 } };
      return nextCleanElectrical(id, s);

    case 'CE0':
    case 'CE1':
      s.cleanElectrical = payload === 'CE1';
      return nextCleanPlumbing(id, s);

    case 'CP0':
    case 'CP1':
      s.cleanPlumbing = payload === 'CP1';
      return nextCleaning(id, s);

    case 'CL0':
    case 'CL1':
      s.cleaning = payload === 'CL1';
      return nextTrash(id, s);

    case 'TR0':
      s.trash = false;
      return showResult(id, s);

    case 'TR1':
      s.trash = true;
      return showResult(id, s);

    default:
      return send(id, '⚠️ Кнопка не распознана. Нажмите «🔄 Рассчитать заново».');
  }
}

function contactFromMessage(message) {
  const attachments = message?.body?.attachments || message?.attachments || [];

  for (const item of attachments) {
    if (item.type !== 'contact') continue;

    const p = item.payload || {};
    const maxPhone = p.max_info?.phone || p.phone || '';

    if (maxPhone) return String(maxPhone).trim();

    const vcf = String(p.vcf_info || '');
    const match = vcf.match(/TEL[^:]*:([^\r\n]+)/i);
    if (match) return match[1].trim();
  }

  return '';
}

async function sendLead(id, message, s, phone) {
  const lead = {
    name: message?.sender?.name || 'Клиент',
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
      balcony: 0,
      windows: s.windows || 0
    }
  };

  try {
    await fetch('https://remont-pro-nine.vercel.app/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lead)
    });
  } catch (_) {}

  clear(id);

  return send(id,
    '✅ Спасибо! Номер получен.\n\n📞 ' + phone + '\n\nМы свяжемся с вами для обсуждения проекта.',
    [[cb('🔄 Рассчитать заново', 'RESTART')]]
  );
}

async function handleMessage(update) {
  const m = update.message || {};
  const id = update.chat_id || m.recipient?.chat_id || m.recipient?.user_id;

  if (!id) return;

  const text = String(m.body?.text || m.text || '').trim();

  if (
    /^\/start$/i.test(text) ||
    /^Начать$/i.test(text) ||
    /^🏠 Начать$/i.test(text) ||
    /^🔄?\s*Рассчитать заново$/i.test(text)
  ) {
    return start(id);
  }

  const s = get(id);

  if (s?.step === 'result' || s?.step === 'commercialLead') {
    const phone = contactFromMessage(m);
    if (phone) return sendLead(id, m, s, phone);
  }

  if (text === '/calculator' || text === '/calc' || text === '🧮 Рассчитать стоимость') {
    return start(id);
  }

  if (!s) return start(id);

  if (s.step === 'floor') {
    const v = num(text);
    if (v === null) return send(id, '⚠️ Введите площадь числом, например 80');
    s.floor = v;
    return ask(id, 'bath', '🚿 Напишите площадь пола санузла в м². Если санузла нет — 0', s);
  }

  if (s.step === 'bath') {
    const v = num(text);
    if (v === null) return send(id, '⚠️ Введите площадь санузла числом, например 5');

    s.bath = v;
    return ask(id, 'windows', '🪟 Окна\n\nСколько окон? Напишите количество цифрой, например: 5', s);
  }

  if (s.step === 'windows') {
    const v = num(text);
    if (v === null || !Number.isInteger(v)) return send(id, '⚠️ Введите количество окон целым числом, например 5');
    s.windows = v;
    return choose(id, 'electrical', '⚡ Электрика', [
      [cb('Нет', 'E0')],
      [cb('Частичный монтаж', 'E1')],
      [cb('Полный монтаж', 'E2')]
    ], s);
  }

  if (s.step === 'tileArea') {
    const v = num(text);
    if (v === null) return send(id, '⚠️ Введите площадь плитки числом, например 12');

    const main = Math.max(0, (s.floor || 0) - (s.bath || 0));
    s.tileArea = Math.min(v, main);

    return nextFloor(id, s);
  }

  return send(id, 'Нажмите «🔄 Рассчитать заново» или отправьте /start.');
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'РЕМОНТФОРМА MAX Bot',
      version: '4.3.0',
      configured: !!TOKEN
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (SECRET && req.headers['x-max-bot-api-secret'] !== SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const update = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    if (update.update_type === 'message_callback') {
      await handleCallback(update);
    } else if (update.update_type === 'message_created') {
      const recipient = update.message?.recipient || {};
      const isGroupOrChannel = Boolean(
        recipient.title ||
        recipient.chat_type === 'chat' ||
        recipient.chat_type === 'channel' ||
        update.message?.recipient?.title
      );

      if (isGroupOrChannel) {
        await monitorMaxGroupMessage(update);
        return res.status(200).json({ ok: true, mode: 'group-monitor' });
      }

      await handleMessage(update);
    } else if (update.update_type === 'bot_added') {
      // MAX присылает chat_id в событии; сам факт подключения фиксируем логикой webhook.
    } else if (update.update_type === 'bot_removed') {
      // После удаления бота новые сообщения из этого чата больше не обрабатываются.
    } else if (update.update_type === 'bot_started') {
      const id = update.chat_id || update.user?.user_id;
      if (id) await start(id);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e.message || 'MAX bot error'
    });
  }
};
