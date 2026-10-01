import fs from 'node:fs/promises';

const DATA = new URL('../data/autosearch.json', import.meta.url);
const OUT = JSON.parse(await fs.readFile(DATA, 'utf8'));

const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public',city:'Казань'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public',city:'Казань'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public',city:'Казань'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public',city:'Казань'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public',city:'Казань'},
  {id:'telegram-zayavkiremont',name:'Telegram · Заявки на ремонт квартир',url:'https://t.me/s/zayavkiremont',type:'telegram_lead_channel',city:null}
];

const NEG=[
  'предлагаю услуги','оказываю услуги','оказываем услуги','услуги по ремонту','услуги ремонта',
  'выполняем ремонт','выполняю ремонт','делаем ремонт','сделаем ремонт','ремонт под ключ от',
  'стоимость работ','цена за м2','цены на ремонт','прайс','прайс-лист','расценки','скидка','акция',
  'закажите ремонт','заказать ремонт у нас','пишите в личку','звоните','оставляйте заявку',
  'принимаем заказы','свободна бригада','свободная бригада','наша бригада','наша компания',
  'наши работы','наши услуги','портфолио','объект в работе','взяли новый объект','взяли объект',
  'завершили ремонт','покажу объект','показываем объект','работаем в казани','работаем по казани',
  'ищу работу','ищем работников','требуются работники','требуется сотрудник','требуются сотрудники',
  'зарплата','резюме','вакансия','вахта','мастер на час','мелкий ремонт'
];
const POS=[
  'ищу бригаду','ищу ремонтную бригаду','ищу подрядчика','ищу исполнителя','ищу мастера','ищу мастеров',
  'нужна бригада','нужна бригада на ремонт','нужен подрядчик','нужен исполнитель','нужен мастер',
  'нужен мастер на ремонт','нужен ремонт','нужен ремонт квартиры','нужен ремонт дома','нужна отделка',
  'нужна отделка квартиры','посоветуйте бригаду','посоветуйте мастера','посоветуйте кто делал',
  'кто делал ремонт','кто может сделать ремонт','кто делал отделку','подскажите хорошую бригаду',
  'подскажите мастера','порекомендуйте бригаду','порекомендуйте мастера','ищем подрядчика',
  'ищем исполнителя','заказчик ищет','требуется подрядчик','требуется исполнитель',
  'квартира под ремонт','дом под ремонт','новостройка под ремонт','получил ключи','получили ключи',
  'купил квартиру','купили квартиру','квартира после получения ключей'
];

function clean(s=''){
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ').trim();
}
function area(text){
  const m=text.match(/(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м)/i);
  return m?Number(m[1].replace(',','.')):null;
}
function budget(text){
  const m=text.match(/(?:бюджет|стоимость|цена|сумма)[^\d]{0,20}(\d[\d\s]{3,})/i)
    || text.match(/(\d[\d\s]{4,})\s*(?:₽|руб\.?)/i);
  return m?Number(m[1].replace(/\s/g,'')):null;
}
function classify(text){
  const t=text.toLowerCase();
  if(/коммерц|офис|магазин|салон|кафе|помещени/.test(t))return 'Коммерция';
  if(/коттедж|частн(?:ый|ом) дом|дом/.test(t))return 'Дом';
  return 'Квартира';
}
function analyze(text,source){
  const t=text.toLowerCase().replace(/ё/g,'е');
  if(t.length<25)return {ok:false,reason:'слишком коротко'};
  if(NEG.some(x=>t.includes(x)))return {ok:false,reason:'реклама/поиск работников'};
  if(/требуютс[яь]\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/.test(t))
    return {ok:false,reason:'ищут работников'};
  const direct=POS.find(x=>t.includes(x));
  if(!direct)return {ok:false,reason:'нет прямого запроса клиента'};
  if(!/(квартир|новостро|вторич|коттедж|частн(?:ый|ом) дом|дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t))
    return {ok:false,reason:'нет объекта ремонта'};
  const city=/(казан|казань|татарстан)/.test(t)||source.city==='Казань';
  if(source.type==='telegram_lead_channel'&&!city)return {ok:false,reason:'не Казань'};
  if(!/(ищу|нужен|нужна|нужно|подскажите|посоветуйте|порекомендуйте|кто может|кто делал|получил ключи|получили ключи|купил квартиру|купили квартиру)/.test(t))
    return {ok:false,reason:'не похоже на заказчика'};
  const reasons=[direct];
  if(city)reasons.push('Казань');
  if(/\d+(?:[.,]\d+)?\s*(?:м2|м²|кв\.?\s*м)/i.test(text))reasons.push('есть площадь');
  if(/бюджет|\d[\d\s]*(?:₽|руб)|млн/.test(t))reasons.push('есть бюджет');
  if(/ключ|начать|срок|когда|сентябр|октябр|ноябр|декабр/.test(t))reasons.push('есть срок/ключи');
  return {ok:true,reasons,city};
}
function score(text,a,source){
  const t=text.toLowerCase();let s=50;
  if(/казан|казань|татарстан/.test(t)||source.city==='Казань')s+=15;
  if(/ищу|нужен|нужна|нужно|посоветуйте|подскажите|порекомендуйте/.test(t))s+=10;
  if(/квартир|новостро|вторич|дом|коттедж|офис|магазин|коммерц/.test(t))s+=10;
  if(a)s+=8;
  if(/бюджет|млн|₽|руб/.test(t))s+=5;
  if(/ключ|срок|начать|когда/.test(t))s+=5;
  return Math.min(100,s);
}
function level(sc,text,a){
  const t=text.toLowerCase();
  const details=(a?1:0)+(/бюджет|млн|₽|руб/.test(t)?1:0)+(/ключ|срок|начать|когда/.test(t)?1:0);
  return sc>=85&&details>=2?'hot':'potential';
}
async function fetchSource(s){
  const rr=await fetch(s.url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(12000)});
  if(!rr.ok)throw new Error('HTTP '+rr.status);
  return rr.text();
}
function parseTelegram(html,s){
  const out=[],re=/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi;let m;
  while((m=re.exec(html))){
    const text=clean(m[1]);
    const info=analyze(text,s); if(!info.ok)continue;
    const nearby=html.slice(Math.max(0,m.index-12000),Math.min(html.length,m.index+12000));
    const tm=nearby.match(/href=["'](https?:\/\/t\.me\/[^"']+\/\d+)["']/i);
    const a=area(text),b=budget(text),sc=score(text,a,s);
    out.push({
      id:s.id+'-'+Buffer.from(tm?.[1]||text.slice(0,120)).toString('base64url').slice(-28),
      source:s.name,url:tm?.[1]||s.url,title:text.slice(0,160),text,area:a,budget:b,type:classify(text),
      score:sc,level:level(sc,text,a),reasons:info.reasons,city:info.city,publishedAt:null,status:'new',
      firstSeenAt:new Date().toISOString()
    });
  }
  return out;
}
async function sendTelegram(leads){
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_ADMIN_CHAT_ID)return;
  for(const x of leads.filter(x=>x.level==='hot').slice(0,5)){
    const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД\n\n'+x.text+'\n\n📍 '+x.type+(x.area?' · '+x.area+' м²':'')+'\n🎯 '+x.score+'%\n🔎 '+x.reasons.join(' · ')+'\n\n'+x.url;
    await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:msg,disable_web_page_preview:false})
    });
  }
}
const all=[];
const diagnostics=[];
for(const s of SOURCES){
  try{
    const html=await fetchSource(s);
    const items=parseTelegram(html,s);
    diagnostics.push({source:s.name,found:items.length,status:'readable',error:null});
    all.push(...items);
  }catch(e){diagnostics.push({source:s.name,found:0,status:'unavailable',error:e?.message||String(e)});}
}
const oldIds=new Set((OUT.leads||[]).map(x=>x.id));
const unique=new Map();
for(const x of [...all,...(OUT.leads||[])]){
  if(!unique.has(x.id))unique.set(x.id,x);
}
const leads=[...unique.values()].sort((a,b)=>b.score-a.score).slice(0,300);
const freshHot=all.filter(x=>x.level==='hot'&&!oldIds.has(x.id));
await sendTelegram(freshHot);
const result={
  ok:true,updatedAt:new Date().toISOString(),
  stats:{found:all.length,new:freshHot.length,duplicates:all.length-leads.length,high:leads.filter(x=>x.level==='hot').length,hot:leads.filter(x=>x.level==='hot').length,potential:leads.filter(x=>x.level==='potential').length},
  leads,diagnostics,
  access:{note:'Публичные источники сканируются. Закрытые чаты ЖК не считаются пустыми: для чтения нужен разрешённый доступ.'}
};
await fs.writeFile(DATA,JSON.stringify(result,null,2)+'\n');
await fs.writeFile(new URL('../site/autosearch-data.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.stats));
