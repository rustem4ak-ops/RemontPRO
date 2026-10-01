const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public',city:'Казань'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public',city:'Казань'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public',city:'Казань'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public',city:'Казань'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public',city:'Казань'},
  {id:'telegram-zayavkiremont',name:'Telegram · Заявки на ремонт квартир',url:'https://t.me/s/zayavkiremont',type:'telegram_lead_channel',city:null},
  {id:'telegram-vsem-podryad',name:'Telegram · Всем подряд',url:'https://t.me/s/vsem_podryad',type:'telegram_construction',city:null},
  {id:'kazan-chatnovosela',name:'ЖК · Каталог чатов новосёлов Казани',url:'https://kazan.chatnovosela.ru/',type:'web_catalog',city:'Казань'}
];

const NEG = [
  'предлагаю услуги','оказываю услуги','оказываем услуги','выполняем ремонт','выполняю ремонт',
  'делаем ремонт','сделаем ремонт','ремонт под ключ от','закажите ремонт','заказать ремонт у нас',
  'принимаем заказы','свободна бригада','свободная бригада','наша бригада','наша компания',
  'наши работы','наши услуги','портфолио','объект в работе','взяли новый объект','взяли объект',
  'завершили ремонт','покажу объект','показываем объект','работаем в казани','работаем по казани',
  'ищу работу','ищем работников','требуются работники','требуется сотрудник','требуются сотрудники',
  'зарплата','резюме','вакансия','вахта','подработка','требуется рабочий','требуются рабочие'
];

const POS = [
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

const QUESTION = [
  /сколько\s+(?:сейчас\s+)?стоит\s+(?:ремонт|отделка)/,
  /кто\s+(?:может|делал|посоветует|посоветуй)/,
  /кто\s+знает\s+(?:хорош(его|ую)|нормальн(ого|ую))\s+(?:мастера|бригаду|подрядчика)/,
  /какую\s+бригаду\s+посоветуете/,
  /где\s+найти\s+(?:мастера|бригаду|подрядчика)/,
  /нужен\s+кто-то\s+(?:на|для)\s+(?:ремонт|отделк|плитк|электрик|сантех)/,
  /ищу\s+(?:контакты|рекомендации|мастера|бригаду)/
];

const OBJECT_RE=/(квартир|новостро|вторич|коттедж|частн(?:ый|ом) дом|дом|офис|магазин|салон|кафе|помещени|коммерц|объект|сануз|ванн|кухн)/;
const CLIENT_RE=/(ищу|нужен|нужна|нужно|посоветуйте|подскажите|порекомендуйте|кто может|кто делал|кто знает|сколько стоит|где найти|получил ключи|получили ключи|купил квартиру|купили квартиру)/;

function clean(s=''){
  return s.replace(/<script[\\s\\S]*?<\\/script>/gi,' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi,' ')
    .replace(/<br\\s*\\/?>/gi,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\\s+/g,' ').trim();
}
function area(text){
  const m=text.match(/(\\d+(?:[.,]\\d+)?)\\s*(?:м2|м²|кв\\.?\\s*м)/i);
  return m?Number(m[1].replace(',','.')):null;
}
function budget(text){
  const m=text.match(/(?:бюджет|стоимость|цена|сумма)[^\\d]{0,30}(\\d[\\d\\s]{3,})/i)
    || text.match(/(\\d[\\d\\s]{4,})\\s*(?:₽|руб\\.?)/i);
  return m?Number(m[1].replace(/\\s/g,'')):null;
}
function classify(text){
  const t=text.toLowerCase();
  if(/коммерц|офис|магазин|салон|кафе|помещени/.test(t)) return 'Коммерция';
  if(/коттедж|частн(?:ый|ом) дом|дом/.test(t)) return 'Дом';
  return 'Квартира';
}
function analyze(text,source){
  const t=text.toLowerCase().replace(/ё/g,'е');
  if(t.length<25) return {ok:false,reason:'слишком коротко'};
  if(NEG.some(x=>t.includes(x))) return {ok:false,reason:'реклама/поиск работников'};
  const direct=POS.find(x=>t.includes(x));
  const question=QUESTION.some(r=>r.test(t));
  const object=OBJECT_RE.test(t);
  const city=/(казан|казань|татарстан)/.test(t) || source.city==='Казань';
  if(source.type==='telegram_lead_channel' && !city) return {ok:false,reason:'не Казань'};
  if(source.type==='telegram_construction' && !city) return {ok:false,reason:'не Казань'};
  if(!object) return {ok:false,reason:'нет объекта ремонта'};
  if(!direct && !question) return {ok:false,reason:'нет намерения заказать'};
  if(!CLIENT_RE.test(t) && !question) return {ok:false,reason:'не похоже на заказчика'};
  const reasons=[];
  if(direct) reasons.push(direct);
  else if(question) reasons.push('вопрос о заказчике/ремонте');
  if(city) reasons.push('Казань');
  if(area(text)) reasons.push('есть площадь');
  if(budget(text)) reasons.push('есть бюджет');
  if(/ключ|начать|срок|когда|сентябр|октябр|ноябр|декабр|январ/.test(t)) reasons.push('есть срок/ключи');
  if(/под ключ|комплексн|вся квартир|целиком/.test(t)) reasons.push('полный ремонт');
  return {ok:true,reasons,city,direct,question};
}
function score(text,info,source){
  const t=text.toLowerCase(); let s=45;
  if(info.city) s+=15;
  if(info.direct) s+=12; else if(info.question) s+=7;
  if(OBJECT_RE.test(t)) s+=8;
  if(area(text)) s+=7;
  if(budget(text)) s+=5;
  if(/ключ|срок|начать|когда/.test(t)) s+=5;
  if(/под ключ|комплексн|целиком|вся квартир/.test(t)) s+=3;
  if(source.type==='telegram_construction' && /подрядчик|объем|договор/.test(t)) s+=3;
  return Math.min(100,s);
}
function level(sc,text){
  const t=text.toLowerCase();
  const details=(area(text)?1:0)+(budget(text)?1:0)+(/ключ|срок|начать|когда/.test(t)?1:0);
  return sc>=82 && details>=2 ? 'hot' : 'potential';
}
function parseTelegram(html,source){
  const out=[],re=/tgme_widget_message_text[^>]*>([\\s\\S]*?)<\\/div>/gi; let m;
  while((m=re.exec(html))){
    const text=clean(m[1]); const info=analyze(text,source);
    if(!info.ok) continue;
    const nearby=html.slice(Math.max(0,m.index-14000),Math.min(html.length,m.index+14000));
    const tm=nearby.match(/href=["'](https?:\\/\\/t\\.me\\/[^"']+\\/\\d+)["']/i);
    const author=nearby.match(/tgme_widget_message_author_name[^>]*>([\\s\\S]*?)<\\/a>/i);
    const dt=nearby.match(/datetime=["']([^"']+)["']/i);
    const a=area(text),b=budget(text),sc=score(text,info,source);
    out.push({
      id:source.id+'-'+Buffer.from(tm?.[1]||text.slice(0,140)).toString('base64url').slice(-28),
      source:source.name,url:tm?.[1]||source.url,title:text.slice(0,160),text,
      author:author?clean(author[1]):null,area:a,budget:b,type:classify(text),
      score:sc,level:level(sc,text),reasons:info.reasons,city:info.city,
      publishedAt:dt?dt[1]:null,firstSeenAt:new Date().toISOString(),status:'new'
    });
  }
  return out;
}
function discoverCatalog(html){
  const links=new Set(); const re=/https?:\\/\\/(?:t\\.me)\\/(?:s\\/)?([A-Za-z0-9_]{4,})/g; let m;
  while((m=re.exec(html))){
    const username=m[1]; if(!['s','joinchat'].includes(username)) links.add('https://t.me/s/'+username);
  }
  return [...links].slice(0,80);
}
async function fetchText(url,ms=12000){
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; RemontFormaAutoSearch/3.0)','Accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:AbortSignal.timeout(ms)});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.text();
}
async function scanSources(){
  const base=SOURCES.filter(x=>x.type!=='web_catalog');
  let discovered=[];
  try{
    const catalog=await fetchText('https://kazan.chatnovosela.ru/');
    discovered=discoverCatalog(catalog).map((url,i)=>({id:'jk-public-'+i,name:'ЖК · публичный Telegram',url,type:'telegram_jk',city:'Казань'}));
  }catch{}
  const sources=[...base,...discovered].filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i);
  const diagnostics=[]; const all=[];
  for(const s of sources){
    try{
      const html=await fetchText(s.url);
      const items=parseTelegram(html,s);
      diagnostics.push({source:s.name,url:s.url,found:items.length,status:'readable',error:null});
      all.push(...items);
    }catch(e){
      diagnostics.push({source:s.name,url:s.url,found:0,status:'unavailable',error:e?.message||String(e)});
    }
  }
  const unique=new Map();
  for(const x of all) if(!unique.has(x.id)) unique.set(x.id,x);
  const leads=[...unique.values()].sort((a,b)=>b.score-a.score).slice(0,300);
  return {
    ok:true,updatedAt:new Date().toISOString(),
    stats:{found:all.length,new:all.length,duplicates:all.length-leads.length,high:leads.filter(x=>x.level==='hot').length,hot:leads.filter(x=>x.level==='hot').length,potential:leads.filter(x=>x.level==='potential').length},
    leads,diagnostics,
    access:{catalogZhK:discovered.length,scannedSources:sources.length,note:'Публичные источники сканируются. Закрытые чаты ЖК не считаются пустыми: для чтения нужен разрешённый доступ.'}
  };
}
async function notifyTelegram(leads){
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_ADMIN_CHAT_ID)return;
  for(const x of leads.filter(x=>x.level==='hot').slice(0,5)){
    const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД\\n\\n'+x.text+'\\n\\n📍 '+x.type+(x.area?' · '+x.area+' м²':'')+'\\n🎯 '+x.score+'%\\n🔎 '+x.reasons.join(' · ')+'\\n\\n'+x.url;
    await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:msg})});
  }
}
async function notifyMax(leads){
  if(!process.env.MAX_BOT_TOKEN||!process.env.MAX_ADMIN_CHAT_ID)return;
  for(const x of leads.filter(x=>x.level==='hot').slice(0,5)){
    const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД\\n\\n'+x.text+'\\n\\n📍 '+x.type+(x.area?' · '+x.area+' м²':'')+'\\n🎯 '+x.score+'%\\n🔎 '+x.reasons.join(' · ')+'\\n\\n'+x.url;
    const url='https://platform-api2.max.ru/messages?chat_id='+encodeURIComponent(process.env.MAX_ADMIN_CHAT_ID);
    await fetch(url,{method:'POST',headers:{'Authorization':process.env.MAX_BOT_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({text:msg,disable_link_preview:false})});
  }
}
async function runLive(){ return scanSources(); }
async function runScheduled(existing={}){
  const scan=await scanSources(); const oldIds=new Set((existing.leads||[]).map(x=>x.id));
  const fresh=scan.leads.filter(x=>!oldIds.has(x.id));
  const merged=new Map();
  for(const x of [...scan.leads,...(existing.leads||[])]) if(!merged.has(x.id)) merged.set(x.id,x);
  const leads=[...merged.values()].sort((a,b)=>b.score-a.score).slice(0,300);
  const freshHot=fresh.filter(x=>x.level==='hot');
  await notifyTelegram(freshHot); await notifyMax(freshHot);
  return {...scan,stats:{...scan.stats,new:fresh.length,hot:leads.filter(x=>x.level==='hot').length,potential:leads.filter(x=>x.level==='potential').length},leads};
}
module.exports={SOURCES,runLive,runScheduled};
