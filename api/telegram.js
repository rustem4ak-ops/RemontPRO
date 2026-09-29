const { calculate } = require('../shared/remontforma-pricing.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = 'https://api.telegram.org/bot';
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

function save(id, s) { sessions.set(String(id), s); }
function get(id) { return sessions.get(String(id)); }
function clear(id) { sessions.delete(String(id)); }
function num(v) {
  const n = Number(String(v || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function money(v) { return new Intl.NumberFormat('ru-RU').format(Math.round(Number(v) || 0)) + ' ₽'; }

async function start(id) {
  clear(id);
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
    ['4️⃣', 'Стены', sum(['Подготовка под обои + обои', 'Подготовка под покраску + покраска', 'Подготовка под декоративку + декоративка'])],
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
  lines.push('💵 <b>ИТОГО: ' + money(r.total) + '</b>', '📐 Цена за м²: <b>' + money(r.pricePerM2) + '</b>', '', '📞 Для консультации отправьте номер телефона.');
  save(id, { ...s, step: 'result', result: r });
  return tg('sendMessage', { chat_id: id, text: lines.join('\n'), parse_mode: 'HTML', ...keyboard([['📞 Оставить номер телефона'], ['🔄 Рассчитать заново']]) });
}

async function callback(q) {
  const id = q.message && q.message.chat && q.message.chat.id;
  if (!id) return;
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  const s = get(id) || {};
  switch (q.data) {
    case 'E0': s.electrical='none'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'E1': s.electrical='partial'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'E2': s.electrical='full'; return buttons(id,'plumbing','🚰 Сантехника',[[{text:'Нет',callback_data:'P0'}],[{text:'Частичный монтаж',callback_data:'P1'}],[{text:'Полный монтаж',callback_data:'P2'}]],s);
    case 'P0': s.plumbing='none'; return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'P1': s.plumbing='partial'; return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'P2': s.plumbing='full'; return buttons(id,'bathroom','🚿 Санузел',[[{text:'Нет',callback_data:'B0'}],[{text:'Классический санузел',callback_data:'B1'}]],s);
    case 'B0': s.bathroom='none'; return ask(id,'tileArea','🧱 Плитка\n\nНапишите площадь плитки в м2 (коридор, комнаты)',s);
    case 'B1': s.bathroom='classic'; return ask(id,'tileArea','🧱 Плитка (коридор, комнаты)\n\nНапишите площадь пола в м², например: 12',s);
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
  if (req.method === 'GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Telegram Bot',version:'3.0.0'});
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try {
    const u = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (u.callback_query) { await callback(u.callback_query); return res.status(200).json({ok:true}); }
    const m=u.message;
    if (!m || !m.chat || !m.chat.id) return res.status(200).json({ok:true});
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

      let crmOk = false;
      let crmResult = null;
      try {
        const leadPayload = {
          name,
          phone,
          source: 'telegram',
          medium: 'telegram_bot',
          calculator: {
            total: s.result?.total || 0,
            pricePerM2: s.result?.pricePerM2 || 0
          },
          object: {
            type: s.objectType === 'h' ? 'Дом' : 'Квартира',
            floor: s.floor || 0,
            bath: s.bath || 0,
            balcony: 0
          }
        };

        const leadResponse = await fetch('https://remont-pro-nine.vercel.app/api/lead', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(leadPayload)
        });
        crmResult = await leadResponse.json().catch(() => ({}));
        crmOk = Boolean(leadResponse.ok && crmResult?.ok && crmResult?.bitrixSent);
      } catch (_) {}

      clear(id);

      const status = crmOk
        ? '✅ Номер получен. Заявка и предварительный расчёт переданы в Bitrix24. Мы свяжемся с вами для обсуждения проекта.'
        : '✅ Спасибо! Номер получен. Мы свяжемся с вами для обсуждения проекта.';

      await tg('sendMessage',{chat_id:id,text:status,...keyboard([['🔄 Рассчитать заново']])});
      return res.status(200).json({ok:true,crmOk,bitrixId:crmResult?.bitrixId||null});
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
      s.bath=v; await buttons(id,'electrical','⚡ Электрика',[[{text:'Нет',callback_data:'E0'}],[{text:'Частичный монтаж',callback_data:'E1'}],[{text:'Полный монтаж',callback_data:'E2'}]],s); return res.status(200).json({ok:true});
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
