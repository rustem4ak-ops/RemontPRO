const { calculate } = require('../shared/remontforma-pricing.js');

const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public',city:'Казань'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public',city:'Казань'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public',city:'Казань'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public',city:'Казань'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public',city:'Казань'},
  {id:'telegram-zayavkiremont',name:'Telegram · Заявки на ремонт квартир',url:'https://t.me/s/zayavkiremont',type:'telegram_lead_channel',city:null},
  {id:'kazan-chatnovosela',name:'ЖК · Каталог чатов новосёлов Казани',url:'https://kazan.chatnovosela.ru/',type:'web_catalog',city:'Казань'}
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

const EMPLOYER_PATTERNS=[
  /требуютс[яь]\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/,
  /нужн[ыо]\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/,
  /ищ(?:ем|у)\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/,
  /бригада\s+(?:монтажник|рабоч)/,
  /с\s+инструментом\s+и\s+авто/,
  /оплата\s+(?:достойная|поэтапно|сдельная)/,
  /оплачиваем\s+(?:дорогу|проезд)/,
  /предоставляем\s+(?:бытовк|жиль|прожив)/,
  /работа\s+(?:круглый год|в разных регионах|вахтой)/
];

function clean(s=''){
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\\s*\/?>/gi,' ').replace(/<\/p>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ')
    .replace(/&quot;/gi,'\"').replace(/&#39;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\\s+/g,' ').trim();
}

function analyze(text, source){
  const t=text.toLowerCase().replace(/ё/g,'е');
  const reasons=[];
  if(t.length<25) return {ok:false,reason:'слишком коротко'};
  if(NEG.some(x=>t.includes(x))) return {ok:false,reason:'реклама/поиск работников'};
  if(/требуютс[яь]\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/.test(t)) return {ok:false,reason:'ищут работников'};
  const direct=POS.find(x=>t.includes(x));
  if(!direct) return {ok:false,reason:'нет прямого запроса клиента'};
  const object=/(квартир|новостро|вторич|коттедж|частн(?:ый|ом) дом|дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t);
  if(!object) return {ok:false,reason:'нет объекта ремонта'};
  const city=/(казан|казань|татарстан)/.test(t) || source.city==='Казань';
  if(source.type==='telegram_lead_channel' && !city) return {ok:false,reason:'не Казань'};
  const firstPerson=/(ищу|нужен|нужна|нужно|подскажите|посоветуйте|порекомендуйте|кто может|кто делал|получил ключи|получили ключи|купил квартиру|купили квартиру)/.test(t);
  if(!firstPerson) return {ok:false,reason:'не похоже на заказчика'};
  reasons.push(direct);
  if(city) reasons.push('Казань');
  if(/\d+(?:[.,]\d+)?\s*(?:м2|м²|кв\.?\s*м)/i.test(text)) reasons.push('есть площадь');
  if(/бюджет|\d[\d\s]*(?:₽|руб)|млн/.test(t)) reasons.push('есть бюджет');
  if(/ключ|начать|срок|когда|сентябр|октябр|ноябр|декабр/.test(t)) reasons.push('есть срок/ключи');
  return {ok:true,reasons,city,direct};
}
function relevant(text,source){ return analyze(text,source).ok; }

function area(text){
  const m=text.match(/(\d+(?:[.,]\d+)?)\s*(?:м2|м²|кв\.?\s*м)/i);
  return m?Number(m[1].replace(',','.')):null;
}
function budget(text){
  const m=text.match(/(?:бюджет|стоимость|цена|сумма)[^\d]{0,20}(\d[\d\s]{3,})/i);
  return m?Number(m[1].replace(/\s/g,'')):null;
}
function classify(text){
  const t=text.toLowerCase();
  if(/коммерц|офис|магазин|салон|кафе|помещени/.test(t))return 'Коммерция';
  if(/коттедж|дом/.test(t))return 'Дом';
  return 'Квартира';
}
function score(text,a,source){
  const t=text.toLowerCase();
  let s=50;
  const city=/(казан|казань|татарстан)/.test(t)||source.city==='Казань';
  if(city)s+=15;
  if(/ищу|нужен|нужна|нужно|посоветуйте|подскажите|порекомендуйте/.test(t))s+=10;
  if(/квартир|новостро|вторич|дом|коттедж|офис|магазин|коммерц/.test(t))s+=10;
  if(a)s+=8;
  if(/бюджет|млн|₽|руб/.test(t))s+=5;
  if(/ключ|срок|начать|когда/.test(t))s+=5;
  return Math.min(100,s);
}
function leadLevel(score,text,a){
  const t=text.toLowerCase();
  const details=(a?1:0)+(/бюджет|млн|₽|руб/.test(t)?1:0)+(/ключ|срок|начать|когда/.test(t)?1:0);
  if(score>=85 && details>=2) return 'hot';
  return 'potential';
}

async function liveAutoSearch(){
  const results=await Promise.all(SOURCES.map(async s=>{
    try{
      const rr=await fetch(s.url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:AbortSignal.timeout(8000)});
      if(!rr.ok) throw new Error('HTTP '+rr.status);
      const html=await rr.text();
      if(s.type==='web_catalog'){
        const m=html.match(/(\d{2,3})\s*(?:жилых комплексов|ЖК)/i);
        return {items:[],found:0,status:'catalog',catalogCount:m?Number(m[1]):null,error:null};
      }
      const out=[],re=/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi;let m;
      while((m=re.exec(html))){
        const text=clean(m[1]); if(text.length<20||!relevant(text,s)) continue;
        const nearby=html.slice(Math.max(0,m.index-12000),Math.min(html.length,m.index+12000));
        const tm=nearby.match(/href=["'](https?:\/\/t\.me\/[^"']+\/\d+)["']/i);
        const a=area(text); const info=analyze(text,s); const sc=score(text,a,s);
        out.push({id:s.id+'-'+Buffer.from((tm?.[1]||text.slice(0,100))).toString('base64url').slice(-24),source:s.name,url:tm?.[1]||s.url,title:text.slice(0,140),text,area:a,budget:budget(text),type:classify(text),score:sc,level:leadLevel(sc,text,a),reasons:info.reasons,city:info.city,publishedAt:null,status:'new'});
      }
      return {items:out,found:out.length,status:'readable',error:null};
    }catch(e){return {items:[],found:0,status:'unavailable',error:e?.message||String(e)};}
  }));
  const leads=results.flatMap(x=>x.items).sort((a,b)=>b.score-a.score);
  const catalog=results.find(x=>x.status==='catalog');
  return {ok:true,updatedAt:new Date().toISOString(),
    stats:{found:leads.length,new:leads.length,duplicates:0,high:leads.filter(x=>x.level==='hot').length,hot:leads.filter(x=>x.level==='hot').length,potential:leads.filter(x=>x.level==='potential').length},
    leads,
    diagnostics:results.map((x,i)=>({source:SOURCES[i].name,found:x.found,status:x.status,catalogCount:x.catalogCount||null,error:x.error||null})),
    access:{catalogZhK:catalog?.catalogCount||0,note:'Закрытые/приватные чаты ЖК не считаются пустыми: для чтения нужен разрешённый доступ.'}
  };
}

module.exports = async function handler(req,res){
  if(req.method==='GET' && req.query?.autosearch==='1'){
    try{return res.status(200).json(await liveAutoSearch());}
    catch(e){return res.status(500).json({ok:false,error:e?.message||'AutoSearch error'});}
  }
  if(req.method==='GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Calculator API',version:'1.0.1'});
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    return res.status(200).json({ok:true,result:calculate(body)});
  }catch(e){return res.status(400).json({ok:false,error:e?.message||'Calculation error'});}
};