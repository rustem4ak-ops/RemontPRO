import fs from 'node:fs/promises';

const DATA = new URL('../data/autosearch.json', import.meta.url);
const OUT = JSON.parse(await fs.readFile(DATA, 'utf8'));

const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public'},
  {id:'kazan-chatnovosela',name:'ЖК · Каталог чатов новосёлов Казани',url:'https://kazan.chatnovosela.ru/',type:'web_catalog'}
];

const POS = [
  'ремонт под ключ','ремонт квартиры','ремонт дома','ремонт коттеджа','комплексный ремонт',
  'отделка квартиры','отделка дома','ремонт новостройки','ремонт вторички',
  'ремонт офиса','ремонт магазина','ремонт коммерческого помещения','ремонт помещений',
  'капитальный ремонт','текущий ремонт','строительно-отделочные',
  'нужен ремонт','нужен ремонт квартиры','нужен ремонт дома','нужна бригада',
  'нужна бригада на ремонт','ищу бригаду','ищу подрядчика','ищу исполнителя',
  'ищу ремонт','заказать ремонт','заказ на ремонт','заказчик ищет',
  'требуется бригада','требуется подрядчик','требуется ремонт',
  'сделать ремонт','сделать отделку','нужна отделка','ищу мастеров',
  'ищем бригаду','ищем подрядчика','посоветуйте бригаду','посоветуйте мастера','кто делал ремонт','кто может сделать ремонт','нужен мастер','нужен подрядчик','ищем исполнителя','квартира под ремонт',
  'дом под ремонт','объект под ремонт','объект на ремонт','отделка новостройки',
  'ремонт новостройки','ремонт вторичного жилья'
];
const NEG = [
  'ремонт автомобиля','оргтехники','телефона','компьютера','стиральной машины',
  'холодильника','кондиционера','мелкий ремонт','мастер на час','вакансия',
  'ищу работу','ищу работу вахтой','резюме','зарплата',
  'устроиться на работу','требуются рабочие','требуются сотрудники'
];

function clean(s=''){
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
function decode(s){return clean(s);}
function esc(s){return String(s||'').replaceAll('\\','/').trim();}
function area(text){
  const m=text.match(/(?:площадь|площадью|площадь\s*квартиры|\bS\b)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м)/i)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м)\b/i);
  return m?Number(m[1].replace(',','.')):null;
}
function budget(text){
  const m=text.match(/(?:бюджет|стоимость|цена|сумма|на сумму)[^\d]{0,20}(\d[\d\s]{3,})(?:\s*(?:руб|₽|р\.?))?/i)
    || text.match(/(\d[\d\s]{4,})\s*(?:₽|руб\.?)/i);
  return m?Number(m[1].replace(/\s/g,'')):null;
}
function classify(text){
  const t=text.toLowerCase();
  if(/коммерц|офис|магазин|салон|кафе|административ|помещени/.test(t)) return 'Коммерция';
  if(/коттедж|частн(?:ый|ом) дом|дом/.test(t)) return 'Дом';
  return 'Квартира';
}
function relevant(text){
  const t=text.toLowerCase().replace(/ё/g,'е');
  if(NEG.some(x=>t.includes(x))) return false;
  const hasRepair=POS.some(x=>t.includes(x));
  const hasObject=/(квартир|новостро|вторич|коттедж|частн\w* дом|жил\w* дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t);
  const hasClientIntent=/(нужен|нужна|нужно|ищу|ищем|требуется|заказать|заказчик|подрядчик|исполнитель|бригада|посоветуйте|кто\s+(?:делал|может)|ремонт|отделк)/.test(t);
  return hasRepair || (hasObject && hasClientIntent);
}
function score(text,a){
  const t=text.toLowerCase();
  let s=0;
  if(/казан|казань/.test(t)) s+=30;
  if(/нужен|нужна|нужно|ищу|ищем|требуется|заказать|заказчик/.test(t)) s+=25;
  if(/под ключ|комплексн/.test(t)) s+=25;
  if(/коммерц|офис|магазин|салон|кафе/.test(t)) s+=15;
  if(a && a>=40) s+=15;
  if(/бюджет|млн|₽|руб/.test(t)) s+=5;
  if(/квартир|дом|коттедж|офис|магазин|помещени|объект/.test(t)) s+=10;
  return Math.min(100,s);
}
async function get(url){
  const r=await fetch(url,{headers:{'user-agent':'RemontPRO-AutoSearch/1.0'},signal:AbortSignal.timeout(20000)});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
  return await r.text();
}
function telegramItems(html,source){
  const out=[];
  const re=/<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>/gi;
  let m;
  while((m=re.exec(html))){
    const text=decode(m[1]);
    if(text.length<20 || !relevant(text)) continue;
    const from=Math.max(0,m.index-8000), to=Math.min(html.length,m.index+12000);
    const nearby=html.slice(from,to);
    const tm=nearby.match(/href=["'](https?:\\/\\/t\\.me\\/[^"']+\\/\\d+)["']/i);
    const link=tm?.[1] || source.url;
    const a=area(text);
    out.push({
      id:source.id+'-'+Buffer.from(link+'|'+text.slice(0,80)).toString('base64url').slice(-24),
      source:source.name,url:link,title:text.slice(0,120),text,area:a,budget:budget(text),
      type:classify(text),score:score(text,a),publishedAt:null
    });
  }
  return out;
}
function webItems(){return [];}

let found=[];
for(const s of SOURCES){
  try{
    const html=await get(s.url);
    found.push(...(s.type==='telegram'?telegramItems(html,s):webItems(html,s)));
  }catch(e){
    console.log('[source error]',s.id,e.message);
  }
}

const currentNames=new Set(SOURCES.filter(s=>s.type==='telegram_public').map(s=>s.name));
const old=new Map((OUT.leads||[]).filter(x=>currentNames.has(x.source)).map(x=>[x.id,x]));
const newIds=[];
let added=0;
for(const x of found){
  if(!old.has(x.id)){
    added++;
    newIds.push(x.id);
    old.set(x.id,{...x,status:'new',firstSeenAt:new Date().toISOString()});
  } else {
    old.set(x.id,{...old.get(x.id),...x});
  }
}
const leads=[...old.values()]
  .filter(x=>x.source!=='РосТендер · ремонт в Казани' && x.type!=='Тендер')
  .filter(x=>relevant((x.text||'')+' '+(x.title||'')))
  .sort((a,b)=>Number(b.score||0)-Number(a.score||0))
  .slice(0,500);

OUT.updatedAt=new Date().toISOString();
OUT.stats={
  found:leads.length,
  new:added,
  duplicates:Math.max(0,found.length-added),
  high:leads.filter(x=>x.score>=70).length
};
OUT.leads=leads;
OUT.diagnostics=SOURCES.map(s=>({source:s.name,type:s.type,status:s.type==='web_catalog'?'catalog':'readable'}));
OUT.access={catalogZhK:176,note:'Закрытые/приватные чаты ЖК не читаются без разрешённого доступа.'};

function msg(x){
  return [
    '🔥 НОВАЯ ЗАЯВКА — REMONTPRO','',
    '📍 '+(x.type||'Объект')+' · Казань',
    '📐 '+(x.area?x.area+' м²':'площадь не указана'),
    '💰 '+(x.budget?Number(x.budget).toLocaleString('ru-RU')+' ₽':'бюджет не указан'),
    '🎯 Соответствие: '+x.score+'%','',
    (x.title||x.text||'').slice(0,500),'',
    'Источник: '+x.source,x.url
  ].join('\\n');
}
async function notify(){
  const top=leads.filter(x=>newIds.includes(x.id)&&x.score>=70).slice(0,5);
  if(!top.length) return;
  const tgToken=process.env.TELEGRAM_BOT_TOKEN, tgChat=process.env.TELEGRAM_ADMIN_CHAT_ID;
  if(tgToken&&tgChat) for(const x of top) await fetch('https://api.telegram.org/bot'+tgToken+'/sendMessage',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({chat_id:tgChat,text:msg(x),disable_web_page_preview:false})
  }).catch(()=>{});
  const maxToken=process.env.MAX_BOT_TOKEN, maxChat=process.env.MAX_ADMIN_CHAT_ID;
  if(maxToken&&maxChat) for(const x of top) await fetch('https://platform-api2.max.ru/messages?chat_id='+encodeURIComponent(maxChat),{
    method:'POST',headers:{'Authorization':maxToken,'content-type':'application/json'},
    body:JSON.stringify({text:msg(x)})
  }).catch(()=>{});
  const notified=new Set(top.map(x=>x.id));
  OUT.leads=OUT.leads.map(x=>notified.has(x.id)?{...x,notifiedAt:new Date().toISOString()}:x);
}
await notify();
await fs.writeFile(DATA,JSON.stringify(OUT,null,2)+'\\n');
await fs.writeFile(new URL('../site/autosearch-data.json', import.meta.url),JSON.stringify(OUT,null,2)+'\\n');
console.log(JSON.stringify(OUT.stats));
