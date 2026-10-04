const { calculate } = require('../shared/remontforma-pricing.js');
const { analyze, score, level, area, budget, classify } = require('../shared/autosearch.cjs');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = 'https://api.telegram.org/bot';
const LOGO_URL = 'https://remont-pro-nine.vercel.app/remontforma-logo.jpg';
const sessions = globalThis.__RF_SESSIONS || (globalThis.__RF_SESSIONS = new Map());

async function tg(method, body) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r = await fetch(API + TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.description || 'Telegram API error');
  return d.result;
}

const keyboard = rows => ({ reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: false } });
const commercialText = 'Ремонт в коммерции стоит дешевле и зависит от проекта и объемов работ.\n\nПоэтому пришлите номер телефона, чтобы обсудить все подробности.';
const inline = rows => ({ reply_markup: { inline_keyboard: rows } });
const force = { reply_markup: { force_reply: true, selective: true } };
const liveLeadSeen = globalThis.__RF_LIVE_LEADS || (globalThis.__RF_LIVE_LEADS = new Set());
const processedUpdates = globalThis.__RF_TG_PROCESSED_UPDATES || (globalThis.__RF_TG_PROCESSED_UPDATES = new Set());
const processedCallbacks = globalThis.__RF_TG_PROCESSED_CALLBACKS || (globalThis.__RF_TG_PROCESSED_CALLBACKS = new Set());
function remember(set, key, max = 5000) {
  if (set.has(key)) return false;
  set.add(key);
  if (set.size > max) set.delete(set.values().next().value);
  return true;
}
async function monitorGroupMessage(m) {
  const text = String(m.text || m.caption || '').trim();
  if (!text || !m.chat || !['group','supergroup'].includes(m.chat.type)) return false;
  const source = { id:'telegram-group-'+m.chat.id, name:'Telegram · '+(m.chat.title || 'группа'), type:'telegram_group', city:'Казань' };
  const info = analyze(text, source);
  if (!info.ok) return true;
  const id = String(m.chat.id)+':'+String(m.message_id);
  if (liveLeadSeen.has(id)) return true;
  liveLeadSeen.add(id); if (liveLeadSeen.size > 5000) liveLeadSeen.delete(liveLeadSeen.values().next().value);
  const sc = score(text, info, source), lv = level(sc, text);
  if (lv !== 'hot') return true;
  const msg = '🔥 НОВЫЙ ГОРЯЧИЙ ЛИД ИЗ ЧАТА ЖК\\n\\n' + text + '\\n\\n🏢 ' + (m.chat.title || 'Группа') + '\\n📍 ' + classify(text) + (area(text) ? ' · ' + area(text) + ' м²' : '') + '\\n🎯 ' + sc + '%\\n🔎 ' + info.reasons.join(' · ');
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) await tg('sendMessage', {chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:msg});
  if (process.env.MAX_BOT_TOKEN && process.env.MAX_ADMIN_CHAT_ID) {
    await fetch('https://platform-api2.max.ru/messages?chat_id='+encodeURIComponent(process.env.MAX_ADMIN_CHAT_ID), {method:'POST',headers:{'Authorization':process.env.MAX_BOT_TOKEN,'content-type':'application/json'},body:JSON.stringify({text:msg})});
  }
  return true;
}

function save(id, s) { sessions.set(String(id), s); }
function get(id) { return sessions.get(String(id)); }
function clear(id) { sessions.delete(String(id)); }
function num(v) {
  const n = Number(String(v || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function money(v) { return new Intl.NumberFormat('ru-RU').format(Math.round(Number(v) || 0)) + ' ₽'; }

function escHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>]/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];
  });
}

function buildLeadMessage(name, phone, s) {
  const r = s.result || {};
  const rows = Array.isArray(r.rows) ? r.rows : [];
  const groups = [
    ['1️⃣ Черновая электрика + черновая сантехника', function(x){ return /Электрика|Сантехника/.test(x.name); }],
    ['2️⃣ Плиточные работы', function(x){ return /Классический санузел|Плитка/.test(x.name); }],
    ['3️⃣ Напольные работы', function(x){ return /Ламинат \/ кварцвинил|Плинтус/.test(x.name); }],
    ['4️⃣ Стены', function(x){ return /Окна|Подготовка под обои \\+ обои|Подготовка под покраску \\+ покраска|Подготовка под декоративку \\+ декоративка/.test(x.name); }],
    ['5️⃣ Чистовая электрика / сантехника', function(x){ return /Чистовая/.test(x.name); }],
    ['6️⃣ Завершающие работы', function(x){ return /Клининг|Вывоз мусора/.test(x.name); }]
  ];
  const lines = [
    '🆕 <b>Новая заявка из Telegram</b>',
    '',
    '👤 Имя: <b>' + escHtml(name) + '</b>',
    '📞 Телефон: <b>' + escHtml(phone) + '</b>',
    '🏠 Объект: <b>' + (s.objectType === 'h' ? 'Дом' : 'Квартира') + '</b>',
    '📐 Площадь: <b>' + money(r.floor) + ' м²</b>',
    '🚿 Санузел: <b>' + money(r.bath) + ' м²</b>',
    '🪟 Окон: <b>' + Number(s.windows || 0) + '</b>',
    ''
  ];
  groups.forEach(function(g) {
    const items = rows.filter(g[1]);
    if (!items.length) return;
    const sum = items.reduce(function(a,x){ return a + Number(x.cost || 0); }, 0);
    lines.push('<b>' + g[0] + '</b>');
    items.forEach(function(x){ lines.push('• ' + escHtml(x.name) + ' — ' + money(x.cost)); });
    lines.push('<b>Итого: ' + money(sum) + '</b>', '');
  });
  lines.push('<b>ИТОГО: ' + money(r.total) + '</b>');
  lines.push('<b>Цена за м² по полу: ' + money(r.pricePerM2) + '</b>');
  return lines.join('\n');
}

async function start(id) {
  clear(id);
  // Не отправляем логотип по внешнему URL: Telegram может не получить его
  // и тогда весь /start завершается ошибкой. Сам расчёт должен работать независимо от картинки.
  return tg('sendMessage', {
    chat_id: id,
    text: 'Рассчитаем предварительную стоимость ремонта. Выберите тип объекта:',
    ...keyboard([['🏠 Квартира'], ['🏡 Дом'], ['🏢 Коммерция']])
  });
}
async function ask(id, step, text, s) {
  save(id, { ...s, step });
  return tg('sendMessage', { chat_id: id, text, ...force });
}
async function buttons(id, step, text, rows, s) {
  save(id, { ...s, step });
  return tg('sendMessage', { chat_id: id, text, ...inline(rows) });
}

function input(s) {
  return {
    floor: s.floor, bath: s.bath || 0, balcony: 0,
    windows: s.windows || 0,
    electrical: s.electrical || 'none',
    plumbing: s.plumbing || 'none',
    bathroom: s.bathroom || 'none',
    tile: 'manual', tileArea: s.tileArea || 0,
    laminate: true,
    plinth: s.plinth || 'none',
    walls: s.walls || {},
    cleanElectrical: !!s.cleanElectrical,
    cleanPlumbing: !!s.cleanPlumbing,
    cleaning: !!s.cleaning,
    trash: !!s.trash
  };
}

async function result(id, s) {
  const r = calculate(input(s));
  const rows = r.rows || [];
  const sum = names => rows.filter(x => names.some(n => x.name === n || x.name.startsWith(n))).reduce((a,x) => a + Number(x.cost || 0), 0);
  const stages = [
    ['1️⃣', 'Черновая электрика + черновая сантехника', sum(['Электрика', 'Сантехника'])],
    ['2️⃣', 'Плиточные работы', sum(['Классический санузел', 'Плитка'])],
    ['3️⃣', 'Напольные работы', sum(['Ламинат / кварцвинил', 'Плинтус'])],
    ['4️⃣', 'Стены', sum(['Окна', 'Подготовка под обои + обои', 'Подготовка под покраску + покраска', 'Подготовка под декоративку + декоративка'])],
    ['5️⃣', 'Чистовая электрика / сантехника', sum(['Чистовая электрика', 'Чистовая сантехника'])],
    ['6️⃣', 'Завершающие работы', sum(['Клининг', 'Вывоз мусора'])]
  ];
  const lines = [
    '<b>РЕМОНТФОРМА — предварительный расчёт</b>',
    '',
    '🏠 Объект: <b>' + (s.objectType === 'h' ? 'Дом' : 'Квартира') + '</b>',
    '📐 Площадь: <b>' + r.floor + ' м²</b>',
    '📐 Основная площадь: <b>' + r.mainArea + ' м²</b>',
    ''
  ];
  for (const [icon, name, value] of stages) {
    lines.push(icon + ' <b>' + name + '</b>', '💰 <b>' + money(value) + '</b>', '');
  }
  lines.push('💵 <b>ИТОГО: ' + money(r.total) + '</b>', '📐 Цена за м²: <b>' + money(r.pricePerM2) + '</b>', '', '⚠️ <i>Расчёт является приблизительным. Более точный расчёт можно сделать после осмотра объекта.</i>', '', '📞 Для консультации отправьте номер телефона.');
  save(id, { ...s, step: 'result', result: r });
  return tg('sendMessage', { chat_id: id, text: lines.join('\n'), parse_mode: 'HTML', ...keyboard([['📞 Оставить номер телефона'], ['🔄 Рассчитать заново']]) });
}

async function callback(q) {
  const id = q.message && q.message.chat && q.message.chat.id;
  if (!id) return;
  if (!remember(processedCallbacks, String(q.id))) return;
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  const s = get(id) || {};
  switch (q.data) {
    case 'E0': s.electrical='none'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'E1': s.electrical='partial'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'E2': s.electrical='full'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'P0': s.plumbing='none'; s.step='bathroom'; save(id,s); return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'P1': s.plumbing='partial'; s.step='bathroom'; save(id,s); return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'P2': s.plumbing='full'; s.step='bathroom'; save(id,s); return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'B0':
      s.bathroom='none';
      return ask(id,'tileArea','🧱 Плитка\n\nНапишите площадь плитки в м² (коридор, комнаты)',{...s,step:'tileArea'});
    case 'B1':
      s.bathroom='classic';
      return ask(id,'tileArea','🧱 Плитка (коридор, комнаты)\n\nНапишите площадь пола в м², например: 12',{...s,step:'tileArea'});
    case 'LQ': case 'LL': return buttons(id,'plinth','📏 Плинтус',[[{text:'Нет',callback_data:'PL0'}],[{text:'Пластиковый',callback_data:'PL1'}],[{text:'Полиуретановый',callback_data:'PL2'}]],s);
    case 'PL0': s.plinth='none'; return buttons(id,'walls','🧱 Стены',[[{text:'Без отделки',callback_data:'W0'}],[{text:'Обои',callback_data:'W1'}],[{text:'Покраска',callback_data:'W2'}],[{text:'Декоративка',callback_data:'W3'}]],s);
    case 'PL1': s.plinth='plastic'; return buttons(id,'walls','🧱 Стены',[[{text:'Без отделки',callback_data:'W0'}],[{text:'Обои',callback_data:'W1'}],[{text:'Покраска',callback_data:'W2'}],[{text:'Декоративка',callback_data:'W3'}]],s);
    case 'PL2': s.plinth='polyurethane'; return buttons(id,'walls','🧱 Стены',[[{text:'Без отделки',callback_data:'W0'}],[{text:'Обои',callback_data:'W1'}],[{text:'Покраска',callback_data:'W2'}],[{text:'Декоративка',callback_data:'W3'}]],s);
    case 'W0': s.walls={}; return buttons(id,'cleanElectrical','💡 Чистовая электрика',[[{text:'Да',callback_data:'CE1'}],[{text:'Нет',callback_data:'CE0'}]],s);
    case 'W1': s.walls={wallpaper:{area:0}}; return buttons(id,'cleanElectrical','💡 Чистовая электрика',[[{text:'Да',callback_data:'CE1'}],[{text:'Нет',callback_data:'CE0'}]],s);
    case 'W2': s.walls={paint:{area:0}}; return buttons(id,'cleanElectrical','💡 Чистовая электрика',[[{text:'Да',callback_data:'CE1'}],[{text:'Нет',callback_data:'CE0'}]],s);
    case 'W3': s.walls={decorative:{area:0}}; return buttons(id,'cleanElectrical','💡 Чистовая электрика',[[{text:'Да',callback_data:'CE1'}],[{text:'Нет',callback_data:'CE0'}]],s);
    case 'CE0': s.cleanElectrical=false; return buttons(id,'cleanPlumbing','🚿 Чистовая сантехника',[[{text:'Да',callback_data:'CP1'}],[{text:'Нет',callback_data:'CP0'}]],s);
    case 'CE1': s.cleanElectrical=true; return buttons(id,'cleanPlumbing','🚿 Чистовая сантехника',[[{text:'Да',callback_data:'CP1'}],[{text:'Нет',callback_data:'CP0'}]],s);
    case 'CP0': s.cleanPlumbing=false; return buttons(id,'cleaning','🧹 Клининг',[[{text:'Да',callback_data:'CL1'}],[{text:'Нет',callback_data:'CL0'}]],s);
    case 'CP1': s.cleanPlumbing=true; return buttons(id,'cleaning','🧹 Клининг',[[{text:'Да',callback_data:'CL1'}],[{text:'Нет',callback_data:'CL0'}]],s);
    case 'CL0': s.cleaning=false; return buttons(id,'trash','🚛 Вывоз мусора',[[{text:'Да',callback_data:'TR1'}],[{text:'Нет',callback_data:'TR0'}]],s);
    case 'CL1': s.cleaning=true; return buttons(id,'trash','🚛 Вывоз мусора',[[{text:'Да',callback_data:'TR1'}],[{text:'Нет',callback_data:'TR0'}]],s);
    case 'TR0': s.trash=false; return result(id,s);
    case 'TR1': s.trash=true; return result(id,s);
    default: return tg('sendMessage',{chat_id:id,text:'Нажмите «🏠 Начать» и запустите новый расчёт.'});
  }
}

module.exports = async function handler(req,res) {
  if (req.method === 'GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Telegram Bot',version:'3.6.0'});
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try {
    const u = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (u.callback_query) {
      const cbKey = 'cb:' + String(u.update_id || u.callback_query.id);
      if (!remember(processedUpdates, cbKey)) return res.status(200).json({ok:true,duplicate:true});
      await callback(u.callback_query);
      return res.status(200).json({ok:true});
    }
    const m=u.message;
    if (!m || !m.chat || !m.chat.id) return res.status(200).json({ok:true});
    const updateKey = String(u.update_id || (m.chat.id + ':' + m.message_id));
    if (!remember(processedUpdates, updateKey)) return res.status(200).json({ok:true,duplicate:true});
    if (['group','supergroup'].includes(m.chat.type)) { await monitorGroupMessage(m); return res.status(200).json({ok:true,mode:'group-monitor'}); }
    const id=m.chat.id, text=String(m.text||'').trim();

    if (text==='/admin') {
      await tg('sendMessage',{chat_id:id,text:'🔐 Ваш Telegram Chat ID:\n\n<code>'+String(id)+'</code>\n\nДобавьте это число в Vercel как TELEGRAM_ADMIN_CHAT_ID.',parse_mode:'HTML'});
      return res.status(200).json({ok:true,chatId:id});
    }

    if (text==='/start' || text==='/calculator' || text==='/calc' || text==='🏠 Начать' || text==='🧮 Рассчитать стоимость' || text==='🔄 Рассчитать заново') {
      await start(id); return res.status(200).json({ok:true});
    }
    if (text==='📞 Оставить номер телефона' || text==='📞 Отправить номер телефона') {
      await tg('sendMessage',{chat_id:id,text:'📞 Нажмите кнопку ниже, чтобы отправить номер телефона.',reply_markup:{keyboard:[[{text:'📞 Отправить номер телефона',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
      return res.status(200).json({ok:true});
    }
    if (m.contact && m.contact.phone_number) {
      const s = get(id) || {};
      const phone = String(m.contact.phone_number || '').trim();
      const firstName = String(m.contact.first_name || '').trim();
      const lastName = String(m.contact.last_name || '').trim();
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Клиент';

      const leadMessage = buildLeadMessage(name, phone, s);
      let leadOk = false;

      // Сначала отправляем заявку напрямую администратору Telegram.
      // Это исключает внутренний запрос Telegram -> Vercel -> /api/lead.
      if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
        try {
          await tg('sendMessage', {
            chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
            text: leadMessage,
            parse_mode: 'HTML'
          });
          leadOk = true;
        } catch (_) {
          try {
            await tg('sendMessage', {
              chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
              text: leadMessage.replace(/<[^>]+>/g, '')
            });
            leadOk = true;
          } catch (_) {}
        }
      }

      // Если прямое сообщение не прошло, оставляем резерв через /api/lead.
      if (!leadOk) {
        try {
          const leadResponse = await fetch('https://remont-pro-nine.vercel.app/api/lead', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              name,
              phone,
              source: 'telegram',
              medium: 'telegram_bot',
              calculator: s.result || { total: 0, pricePerM2: 0, rows: [] },
              object: {
                type: s.objectType === 'h' ? 'Дом' : 'Квартира',
                floor: s.floor || 0,
                bath: s.bath || 0,
                balcony: 0,
                windows: s.windows || 0
              }
            })
          });
          const leadResult = await leadResponse.json().catch(() => ({}));
          leadOk = Boolean(leadResponse.ok && leadResult && leadResult.ok && leadResult.telegramSent);
        } catch (_) {}
      }

      clear(id);
      const status = leadOk
        ? '✅ Номер получен. Заявка и полный предварительный расчёт отправлены нам в Telegram. Мы свяжемся с вами для обсуждения проекта.'
        : '⚠️ Номер получен, но заявку пока не удалось передать. Пожалуйста, попробуйте ещё раз или напишите нам напрямую.';
      await tg('sendMessage', {chat_id:id, text:status, ...keyboard([['🔄 Рассчитать заново']])});
      return res.status(200).json({ok:true,leadOk});
    }
    if (text==='🏢 Коммерция') {
      clear(id);
      await tg('sendMessage',{chat_id:id,text:commercialText,...keyboard([['📞 Оставить номер телефона'],['🔄 Рассчитать заново']])});
      return res.status(200).json({ok:true});
    }
    if (text==='🏠 Квартира' || text==='🏡 Дом') {
      const objectType=text.startsWith('🏡')?'h':'a';
      await ask(id,'floor','📐 Напишите общую площадь объекта в м², например: 80',{objectType});
      return res.status(200).json({ok:true});
    }

    const s=get(id);
    if (s && s.step==='floor') {
      const v=num(text); if(v===null) throw new Error('Введите площадь числом, например 80');
      s.floor=v; await ask(id,'bath','🚿 Напишите площадь пола санузла в м2. Если санузла нет — 0',s); return res.status(200).json({ok:true});
    }
    if (s && s.step==='bath') {
      const v=num(text); if(v===null) throw new Error('Введите площадь санузла числом, например 5');
      s.bath=v;
      // Фиксируем переход в windows ДО отправки сообщения, чтобы повторная доставка
      // одного и того же update не могла снова запустить вопрос про окна.
      s.step='windows';
      s.windowQuestionSent=true;
      save(id,s);
      await tg('sendMessage',{chat_id:id,text:'🪟 Окна\n\nСколько окон? Напишите количество цифрой, например: 5',...force});
      return res.status(200).json({ok:true});
    }
    if (s && s.step==='windows') {
      const v=num(text); if(v===null || !Number.isInteger(v)) throw new Error('Введите количество окон целым числом, например 5');
      s.windows=v;
      // После ввода количества окон следующий шаг всегда только electrical.
      s.step='electrical';
      s.windowQuestionSent=false;
      save(id,s);
      await buttons(id,'electrical','⚡ Электрика',[[{text:'Нет',callback_data:'E0'}],[{text:'Частичный монтаж',callback_data:'E1'}],[{text:'Полный монтаж',callback_data:'E2'}]],s);
      return res.status(200).json({ok:true});
    }
    if (s && s.step==='tileArea') {
      const v=num(text); if(v===null) throw new Error('Введите площадь плитки числом, например 12');
      s.tileArea=v; await buttons(id,'laminate','🏠 Оставшиеся полы',[[{text:'Кварцвинил',callback_data:'LQ'}],[{text:'Ламинат',callback_data:'LL'}]],s); return res.status(200).json({ok:true});
    }
    await tg('sendMessage',{chat_id:id,text:'Нажмите «🏠 Начать», чтобы запустить расчёт.'});
    return res.status(200).json({ok:true});
  } catch(e) {
    try { if (req.body && req.body.message && req.body.message.chat) await tg('sendMessage',{chat_id:req.body.message.chat.id,text:'⚠️ '+(e.message||'Ошибка')+'\n\nНажмите «🏠 Начать».'}); } catch(_) {}
    return res.status(200).json({ok:false,error:e.message||'Bot error'});
  }
};
