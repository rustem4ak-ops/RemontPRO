const { calculate } = require('../shared/remontforma-pricing.js');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = 'https://api.telegram.org/bot';

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

const force = (placeholder, requestContact = false) => ({
  reply_markup: requestContact
    ? { keyboard: [[{ text: '📞 Отправить номер телефона', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
    : { force_reply: true, input_field_placeholder: placeholder }
});

const inline = (rows) => ({ reply_markup: { inline_keyboard: rows } });

function cleanNumber(text) {
  const v = Number(String(text).replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && v >= 0 ? v : null;
}

// Compact state. It is carried by Telegram itself, so this MVP does not need a database.
// f=floor,b=bath,l=balcony,e=electrical,p=plumbing,ba=bathroom,
// t=tile,lm=laminate,pl=plinth,w=wall,ce=clean electrical,cp=clean plumbing,
// cl=cleaning,tr=trash. Empty/0 means none.
function pack(s) {
  return [
    s.o || 'a', s.f ?? '', s.b ?? '', s.l ?? '',
    s.e || '0', s.er ?? '', s.p || '0', s.pr ?? '', s.ba || '0',
    s.t || '0', s.ta ?? '', s.lm || '0', s.pl || '0',
    s.w || '0', s.ce ? 1 : 0, s.cp ? 1 : 0, s.cl ? 1 : 0, s.tr ? 1 : 0
  ].join(',');
}

function unpack(v) {
  const a = String(v || '').split(',');
  return {
    o:a[0]||'a', f:num(a[1]), b:num(a[2]), l:num(a[3]),
    e:a[4]||'0', er:num(a[5]), p:a[6]||'0', pr:num(a[7]), ba:a[8]||'0',
    t:a[9]||'0', ta:num(a[10]), lm:a[11]||'0', pl:a[12]||'0', w:a[13]||'0',
    ce:a[14]==='1', cp:a[15]==='1', cl:a[16]==='1', tr:a[17]==='1'
  };
}
function num(v) {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nextNumeric(chatId, question, state, placeholder) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: question,
    ...force(placeholder || pack(state))
  });
}

async function start(chatId) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🏠 РЕМОНТФОРМА\\n\\nРассчитаем предварительную стоимость ремонта. Выберите тип объекта:',
    ...kb([['🏠 Квартира'], ['🏡 Дом'], ['🏢 Коммерция']])
  });
}

async function askElectrical(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '⚡ Электрика. Выберите вариант:',
    ...inline([
      [{text:'Нет',callback_data:'E|'+pack(s)}],
      [{text:'Частичная замена',callback_data:'e1|'+pack(s)}],
      [{text:'Полная замена',callback_data:'e2|'+pack(s)}],
      [{text:'Своя цена ₽/м²',callback_data:'em|'+pack(s)}]
    ])
  });
}

async function askPlumbing(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚰 Сантехника. Выберите вариант:',
    ...inline([
      [{text:'Нет',callback_data:'P0|'+pack(s)}],
      [{text:'Частичная замена',callback_data:'P1|'+pack(s)}],
      [{text:'Полная замена',callback_data:'P2|'+pack(s)}],
      [{text:'Своя цена ₽/м²',callback_data:'PM|'+pack(s)}]
    ])
  });
}

async function askBathroom(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚿 Санузел. Выберите вариант:',
    ...inline([
      [{text:'Нет',callback_data:'B0|'+pack(s)}],
      [{text:'Классический санузел',callback_data:'B1|'+pack(s)}]
    ])
  });
}

async function askFloor(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧱 Пол. Выберите вариант:',
    ...inline([
      [{text:'Плитка на весь основной пол',callback_data:'T1|'+pack(s)}],
      [{text:'Плитка — указать площадь',callback_data:'TM|'+pack(s)}],
      [{text:'Без плитки',callback_data:'T0|'+pack(s)}]
    ])
  });
}

async function askLaminate(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🏠 Добавить ламинат / кварцвинил на оставшуюся площадь?',
    ...inline([
      [{text:'Да',callback_data:'L1|'+pack(s)}],
      [{text:'Нет',callback_data:'L0|'+pack(s)}]
    ])
  });
}

async function askPlinth(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '📏 Плинтус:',
    ...inline([
      [{text:'Нет',callback_data:'PL0|'+pack(s)}],
      [{text:'Пластиковый',callback_data:'PL1|'+pack(s)}],
      [{text:'Полиуретановый',callback_data:'PL2|'+pack(s)}]
    ])
  });
}

async function askWall(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧱 Стены. Выберите основной вариант отделки:',
    ...inline([
      [{text:'Нет',callback_data:'W0|'+pack(s)}],
      [{text:'Обои',callback_data:'W1|'+pack(s)}],
      [{text:'Покраска',callback_data:'W2|'+pack(s)}],
      [{text:'Декоративка',callback_data:'W3|'+pack(s)}]
    ])
  });
}

async function askFinishing(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '✨ Чистовая электрика:',
    ...inline([
      [{text:'Да',callback_data:'CE1|'+pack(s)}],
      [{text:'Нет',callback_data:'CE0|'+pack(s)}]
    ])
  });
}

async function askCleanPlumbing(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚿 Чистовая сантехника:',
    ...inline([
      [{text:'Да',callback_data:'CP1|'+pack(s)}],
      [{text:'Нет',callback_data:'CP0|'+pack(s)}]
    ])
  });
}

async function askCleaning(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🧹 Клининг:',
    ...inline([
      [{text:'Да',callback_data:'CL1|'+pack(s)}],
      [{text:'Нет',callback_data:'CL0|'+pack(s)}]
    ])
  });
}

async function askTrash(chatId, s) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text: '🚛 Вывоз мусора:',
    ...inline([
      [{text:'Да',callback_data:'TR1|'+pack(s)}],
      [{text:'Нет',callback_data:'TR0|'+pack(s)}]
    ])
  });
}

function toInput(s) {
  const input = {
    floor:s.f, bath:s.b, balcony:s.l,
    electrical:s.e==='1'?'partial':s.e==='2'?'full':s.e==='m'?'manual':'none',
    electricalRate:s.er,
    plumbing:s.p==='1'?'partial':s.p==='2'?'full':s.p==='m'?'manual':'none',
    plumbingRate:s.pr,
    bathroom:s.ba==='1'?'classic':'none',
    tile:s.t==='1'?'fixed':s.t==='m'?'manual':'none',
    tileArea:s.ta,
    laminate:s.lm==='1',
    plinth:s.pl==='1'?'plastic':s.pl==='2'?'polyurethane':'none',
    walls: {
      wallpaper:s.w==='1',
      paint:s.w==='2',
      decorative:s.w==='3'
    },
    cleanElectrical:!!s.ce,
    cleanPlumbing:!!s.cp,
    cleaning:!!s.cl,
    trash:!!s.tr
  };
  return input;
}

function money(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)) + ' ₽';
}

async function showResult(chatId, s) {
  const result = calculate(toInput(s));
  const lines = result.rows.map(r => '• '+r.name+': '+money(r.cost)+' ('+r.quantity+' '+r.unit+' × '+money(r.price)+')');
  const text = [
    '🧮 <b>Предварительный расчёт РЕМОНТФОРМА</b>',
    '',
    'Площадь: '+result.floor+' м²',
    'Основная площадь: '+result.mainArea+' м²',
    '',
    ...(lines.length ? lines : ['• Работы не выбраны']),
    '',
    'Подытог: <b>'+money(result.subtotal)+'</b>',
    'Наценка: '+result.markup+'%',
    'ИТОГО: <b>'+money(result.total)+'</b>',
    'Цена за м² по полу: <b>'+money(result.pricePerM2)+'</b>',
    '',
    'Хотите, чтобы мы связались с вами и подготовили точный расчёт?'
  ].join('\\n');

  await telegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode:'HTML',
    ...force('Введите номер телефона', true)
  });
}

async function answerCallback(query) {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;
  const [action, packed] = String(query.data || '').split('|');
  let s = unpack(packed);

  await telegram('answerCallbackQuery', { callback_query_id: query.id });

  switch(action) {
    case 'E':
    case 'e1': case 'e2': s.e = action==='E'?'0':action==='e1'?'1':'2'; return askPlumbing(chatId,s);
    case 'em': return nextNumeric(chatId,'Введите вашу цену электрики за 1 м², например: 2800',s,'EM|'+pack(s));
    case 'P0': case 'P1': case 'P2': s.p=action.slice(1); return askBathroom(chatId,s);
    case 'PM': return nextNumeric(chatId,'Введите вашу цену сантехники за 1 м², например: 1500',s,'PM|'+pack(s));
    case 'B0': case 'B1': s.ba=action.slice(1); return askFloor(chatId,s);
    case 'T0': case 'T1': s.t=action.slice(1); return askLaminate(chatId,s);
    case 'TM': return nextNumeric(chatId,'Введите площадь плитки в м², например: 12',s,'TM|'+pack(s));
    case 'L0': case 'L1': s.lm=action.slice(1); return askPlinth(chatId,s);
    case 'PL0': case 'PL1': case 'PL2': s.pl=action.slice(2); return askWall(chatId,s);
    case 'W0': case 'W1': case 'W2': case 'W3': s.w=action.slice(1); return askFinishing(chatId,s);
    case 'CE0': case 'CE1': s.ce=action==='CE1'; return askCleanPlumbing(chatId,s);
    case 'CP0': case 'CP1': s.cp=action==='CP1'; return askCleaning(chatId,s);
    case 'CL0': case 'CL1': s.cl=action==='CL1'; return askTrash(chatId,s);
    case 'TR0': case 'TR1': s.tr=action==='TR1'; return showResult(chatId,s);
    default: return;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok:true,
      service:'РЕМОНТФОРМА Telegram Bot',
      configured:Boolean(TOKEN),
      version:'1.1.0'
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (update.callback_query) {
      await answerCallback(update.callback_query);
      return res.status(200).json({ok:true});
    }

    const message = update.message;
    if (!message?.chat?.id) return res.status(200).json({ok:true,ignored:true});

    const chatId = message.chat.id;
    const text = String(message.text || '').trim();

    if (message.contact?.phone_number) {
      const phone = message.contact.phone_number;
      await telegram('sendMessage', {
        chat_id:chatId,
        text:'✅ Спасибо! Заявка принята.\\n\\n📞 '+phone+'\\n\\nМы свяжемся с вами для уточнения деталей и подготовки точной сметы.',
        ...kb([['🧮 Рассчитать стоимость'],['🏠 Начать']])
      });
      return res.status(200).json({ok:true});
    }

    if (text==='/start' || text==='🏠 Начать' || text==='🧮 Рассчитать стоимость') {
      await start(chatId);
      return res.status(200).json({ok:true});
    }
    if (text==='📋 Наши услуги') {
      await telegram('sendMessage',{chat_id:chatId,text:'📋 РЕМОНТФОРМА — ремонт квартир, домов и коммерческих помещений под ключ в Казани.'});
      return res.status(200).json({ok:true});
    }
    if (text==='📸 Наши работы') {
      await telegram('sendMessage',{chat_id:chatId,text:'📸 Портфолио подключим следующим этапом.'});
      return res.status(200).json({ok:true});
    }
    if (text==='📞 Связаться с нами') {
      await telegram('sendMessage',{chat_id:chatId,text:'📞 Нажмите кнопку ниже и отправьте номер телефона.',...force('Введите номер телефона',true)});
      return res.status(200).json({ok:true});
    }

    const isObject = /^🏠 Квартира$|^🏡 Дом$|^🏢 Коммерция$/.test(text);
    if (isObject) {
      const o = text.startsWith('🏠')?'a':text.startsWith('🏡')?'h':'c';
      const s = {o};
      return res.status(200).json(await nextNumeric(chatId,'📐 Напишите общую площадь объекта в м², например: 80',s,'F|'+pack(s)));
    }

    const reply = message.reply_to_message;
    const placeholder = reply?.reply_markup?.input_field_placeholder || '';
    if (placeholder) {
      const [step, packed] = placeholder.split('|');
      let s = unpack(packed);

      if (step==='F') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите площадь числом, например 80');
        s.f=v;
        return res.status(200).json(await nextNumeric(chatId,'🚿 Площадь санузла в м² (если нет — 0)',s,'B|'+pack(s)));
      }
      if (step==='B') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите площадь числом');
        s.b=v;
        return res.status(200).json(await nextNumeric(chatId,'🪟 Площадь балкона в м² (если нет — 0)',s,'A|'+pack(s)));
      }
      if (step==='A') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите площадь числом');
        s.l=v;
        return res.status(200).json(await askElectrical(chatId,s));
      }
      if (step==='EM') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите цену числом');
        s.er=v; s.e='m'; return res.status(200).json(await askPlumbing(chatId,s));
      }
      if (step==='PM') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите цену числом');
        s.pr=v; s.p='m'; return res.status(200).json(await askBathroom(chatId,s));
      }
      if (step==='TM') {
        const v=cleanNumber(text); if (v===null) throw new Error('Введите площадь числом');
        s.ta=Math.min(v, Math.max(0,(s.f||0)-(s.b||0)-(s.l||0))); s.t='m';
        return res.status(200).json(await askLaminate(chatId,s));
      }
    }

    await telegram('sendMessage',{
      chat_id:chatId,
      text:'Нажмите «🧮 Рассчитать стоимость» или «🏠 Начать», чтобы запустить расчёт.'
    });
    return res.status(200).json({ok:true});
  } catch(error) {
    try {
      await telegram('sendMessage',{chat_id:req.body?.message?.chat?.id,text:'⚠️ '+(error.message||'Ошибка')+'\\n\\nПопробуйте ещё раз.'});
    } catch (_) {}
    return res.status(200).json({ok:false,error:error.message||'Bot error'});
  }
};
