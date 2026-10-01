const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public',city:'Казань'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public',city:'Казань'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public',city:'Казань'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public',city:'Казань'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public',city:'Казань'},
  {id:'telegram-zayavkiremont',name:'Telegram · Заявки на ремонт квартир',url:'https://t.me/s/zayavkiremont',type:'telegram_lead_channel',city:null},
  {id:'telegram-vsem-podryad',name:'Telegram · Всем подряд',url:'https://t.me/s/vsem_podryad',type:'telegram_construction',city:null},
  {id:'telegram-sosedi61kvartal',name:'Telegram · 61 Квартал ЖК | Соседи',url:'https://t.me/s/sosedi61kvartal',type:'telegram_jk',city:'Казань'},
  {id:'telegram-domkzn',name:'Telegram · Дом и соседи Казань',url:'https://t.me/s/domkzn',type:'telegram_local',city:'Казань'},
  {id:'telegram-kuyuki-official',name:'Посёлки · Куюки — official',url:'https://t.me/s/kuyuki_official',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-salmachi-info',name:'Посёлки · Салмачи • Куюки | ИНФО ЧАТ',url:'https://t.me/s/salmachi_info',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-salmachi-online',name:'Посёлки · Салмачи — Куюки | Чат',url:'https://t.me/s/salmachi_online',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-konstantinovka-kazan',name:'Посёлки · Константиновка Казань',url:'https://t.me/s/konstantinovka_kazan',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-osinovo',name:'Посёлки · Осиново — Радужный — Салават Купере',url:'https://t.me/s/osinovoo16',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-biektay-chat',name:'Посёлки · Высокая Гора — чат жителей',url:'https://t.me/s/chat_biektay',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-biektay-vgora',name:'Посёлки · Высокая Гора — Биектау',url:'https://t.me/s/biektay_vgora',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-usady',name:'Посёлки · Усады — объявления и соседи',url:'https://t.me/s/kazan_usady',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-laiysh-kzn',name:'Посёлки · Лаишевский район — Лаишево — Сокуры — Столбище — Усады — Ковали',url:'https://t.me/s/laish_kzn',type:'telegram_village',city:'Казань',radiusKm:50},
  {id:'telegram-zelenodolsk',name:'Посёлки/города · Зеленодольск Life',url:'https://t.me/s/zelenodolsk_news',type:'telegram_local',city:'Казань',radiusKm:50},
  {id:'telegram-zeldol',name:'Посёлки/города · Зеленодольск.Онлайн',url:'https://t.me/s/zeldol',type:'telegram_local',city:'Казань',radiusKm:50},
  {id:'telegram-verhniy-uslon',name:'Посёлки · Казань — Верхний Услон',url:'https://t.me/s/perepravakazan',type:'telegram_local',city:'Казань',radiusKm:50},
  {id:'kazan-chatnovosela',name:'ЖК · Каталог чатов новосёлов Казани',url:'https://kazan.chatnovosela.ru/',type:'web_catalog',city:'Казань'},
  {id:'profi-kazan-remont',name:'Профи.ру · заказы на ремонт квартир в Казани',url:'https://profi.ru/geo-kzn/rabota/remont/zakazy-na-remont-kvartir/',type:'marketplace_orders',city:'Казань',parser:'profi'},
  {id:'stroybirza-kazan-remont',name:'СтройБиржа · заказы на ремонт в Казани',url:'https://stroybirza.ru/zakazy-na-remont/kazan',type:'marketplace_orders',city:'Казань',parser:'stroybirza'},
  {id:'b2b-kazan-remont',name:'B2B-Center · ремонт квартир Татарстан',url:'https://www.b2b-center.ru/search/respublika-tatarstan/remont-kvartir/',type:'tender',city:'Казань',parser:'tender'},
  {id:'b2b-kazan-buildings',name:'B2B-Center · ремонт зданий Татарстан',url:'https://www.b2b-center.ru/search/respublika-tatarstan/remont-zdanij-i-sooruzhenij/',type:'tender',city:'Казань',parser:'tender'},
  {id:'b2b-kazan-current',name:'B2B-Center · текущий ремонт Татарстан',url:'https://www.b2b-center.ru/search/respublika-tatarstan/tekushhij-remont/',type:'tender',city:'Казань',parser:'tender'}
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
  'нужен мастер на ремонт','нужен ремонт','нужно сделать ремонт','нужно сделать отделку','надо сделать ремонт','надо сделать отделку','ищу ремонт','ищем бригаду','нужен ремонт квартиры','нужен ремонт дома','нужна отделка',
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
  /ищу\s+(?:контакты|рекомендации|мастера|бригаду|ремонт)/,
  /(?:нужно|надо)\s+(?:сделать|провести)\s+(?:ремонт|отделку|плитку|электрику|сантехнику)/
];

const OBJECT_RE=/(квартир|новостро|вторич|коттедж|частн(?:ый|ом) дом|дом|офис|магазин|салон|кафе|помещени|коммерц|объект|сануз|ванн|кухн)/;
const CLIENT_RE=/(ищу|нужен|нужна|нужно|посоветуйте|подскажите|порекомендуйте|кто может|кто делал|кто знает|сколько стоит|где найти|ищем|надо|получил ключи|получили ключи|купил квартиру|купили квартиру)/;

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
  const m=text.match(/(?:бюджет|стоимость|цена|сумма)[^\d]{0,30}(\d[\d\s]{3,})/i)
    || text.match(/(\d[\d\s]{4,})\s*(?:₽|руб\.?)/i);
  return m?Number(m[1].replace(/\s/g,'')):null;
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
  if((source.type==='telegram_construction' || source.type==='telegram_village' || source.type==='telegram_local') && !city) return {ok:false,reason:'не Казань/пригород'};
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
  const out=[],re=/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi; let m;
  while((m=re.exec(html))){
    const text=clean(m[1]); const info=analyze(text,source);
    if(!info.ok) continue;
    const nearby=html.slice(Math.max(0,m.index-14000),Math.min(html.length,m.index+14000));
    const tm=nearby.match(/href=["'](https?:\/\/t\.me\/[^"']+\/\d+)["']/i);
    const author=nearby.match(/tgme_widget_message_author_name[^>]*>([\s\S]*?)<\/a>/i);
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
  const links=new Set(); const re=/https?:\/\/(?:t\.me)\/(?:s\/)?([A-Za-z0-9_]{4,})/g; let m;
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

function marketplaceItems(text,source){
  const out=[];
  if(source.parser==='profi'){
    const parts=text.split(/(?=Мастер по ремонту)/g).slice(1);
    for(const raw of parts){
      const chunk=raw.slice(0,1100).trim();
      if(!/ремонт|отделк|сануз|плитк|электрик|сантех/i.test(chunk)) continue;
      if(!OBJECT_RE.test(chunk.toLowerCase())) continue;
      const a=area(chunk),b=budget(chunk);
      const info={ok:true,reasons:['клиентский заказ','Казань'],city:true,direct:true,question:false};
      if(a) info.reasons.push('есть площадь');
      if(b) info.reasons.push('есть бюджет');
      const sc=Math.min(100,78+(a?7:0)+(b?5:0)+(/под ключ|комплексн/i.test(chunk)?5:0));
      const id=source.id+'-'+Buffer.from(chunk.slice(0,180)).toString('base64url').slice(-28);
      out.push({id,source:source.name,url:source.url,title:chunk.split(/\s{2,}/)[0].slice(0,160),text:chunk,
        author:null,area:a,budget:b,type:classify(chunk),score:sc,level:sc>=82?'hot':'potential',
        reasons:info.reasons,city:true,publishedAt:null,firstSeenAt:new Date().toISOString(),status:'new'});
    }
  } else if(source.parser==='stroybirza'){
    const chunks=text.split(/(?=Заказ|квартира|новостройка|санузел|под ключ)/gi);
    for(const raw of chunks){
      const chunk=raw.slice(0,1400).trim();
      if(!/ремонт|отделк|плитк|сануз|новостройк/i.test(chunk) || !OBJECT_RE.test(chunk.toLowerCase())) continue;
      const a=area(chunk),b=budget(chunk);
      const sc=Math.min(100,75+(a?8:0)+(b?6:0)+(/под ключ|готовой смет/i.test(chunk)?5:0));
      const id=source.id+'-'+Buffer.from(chunk.slice(0,180)).toString('base64url').slice(-28);
      out.push({id,source:source.name,url:source.url,title:chunk.slice(0,160),text:chunk,
        author:null,area:a,budget:b,type:classify(chunk),score:sc,level:sc>=82?'hot':'potential',
        reasons:['клиентский заказ','Казань'].concat(a?['есть площадь']:[],b?['есть бюджет']:[]),
        city:true,publishedAt:null,firstSeenAt:new Date().toISOString(),status:'new'});
    }
  }
  return out.slice(0,80);
}
function tenderItems(text,source){
  const out=[]; const chunks=text.split(/(?=Опубликовано:|Закупка №|Выполнение работ)/g);
  for(const raw of chunks){
    const chunk=raw.slice(0,1800).trim();
    if(!/ремонт|отделоч|строитель|плитк|здани|помещен|квартир/i.test(chunk)) continue;
    const b=budget(chunk);
    const id=source.id+'-'+Buffer.from(chunk.slice(0,220)).toString('base64url').slice(-28);
    out.push({id,source:source.name,url:source.url,title:chunk.slice(0,170),text:chunk,
      author:null,area:area(chunk),budget:b,type:/квартир|жил|дом/i.test(chunk)?'Квартира':'Коммерция',
      score:60+(b?15:0),level:'tender',reasons:['публичный тендер','Татарстан'],city:true,
      publishedAt:null,firstSeenAt:new Date().toISOString(),status:'new',leadType:'tender'});
  }
  return out.slice(0,100);
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
      let items=[];
      if(s.type==='telegram_public'||s.type==='telegram_lead_channel'||s.type==='telegram_construction'||s.type==='telegram_jk'||s.type==='telegram_village'||s.type==='telegram_local') items=parseTelegram(html,s);
      else if(s.type==='marketplace_orders') items=marketplaceItems(clean(html),s);
      else if(s.type==='tender') items=tenderItems(clean(html),s);
      diagnostics.push({source:s.name,url:s.url,found:items.length,status:'readable',error:null,type:s.type});
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
    stats:{found:all.length,new:all.length,duplicates:Math.max(0,all.length-leads.length),high:leads.filter(x=>x.level==='hot').length,hot:leads.filter(x=>x.level==='hot').length,potential:leads.filter(x=>x.level==='potential').length,tenders:leads.filter(x=>x.level==='tender').length},
    leads,diagnostics,
    access:{catalogZhK:discovered.length,scannedSources:sources.length,nearKazanRadiusKm:50,note:'Добавлены публичные группы и каналы поселков/пригородов в радиусе до 50 км от Казани. Закрытые чаты не считаются пустыми: для чтения нужен разрешённый доступ.'}
  };
}
async function notifyTelegram(leads){
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_ADMIN_CHAT_ID)return;
  for(const x of leads.filter(x=>x.level==='hot').slice(0,5)){
    const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД\n\n'+x.text+'\n\n📍 '+x.type+(x.area?' · '+x.area+' м²':'')+'\n🎯 '+x.score+'%\n🔎 '+x.reasons.join(' · ')+'\n\n'+x.url;
    await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:msg})});
  }
}
async function notifyMax(leads){
  if(!process.env.MAX_BOT_TOKEN||!process.env.MAX_ADMIN_CHAT_ID)return;
  for(const x of leads.filter(x=>x.level==='hot').slice(0,5)){
    const msg='🔥 НОВЫЙ ГОРЯЧИЙ ЛИД\n\n'+x.text+'\n\n📍 '+x.type+(x.area?' · '+x.area+' м²':'')+'\n🎯 '+x.score+'%\n🔎 '+x.reasons.join(' · ')+'\n\n'+x.url;
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
module.exports={SOURCES,runLive,runScheduled,analyze,score,level,area,budget,classify};
