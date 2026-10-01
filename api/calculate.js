const { calculate } = require('../shared/remontforma-pricing.js');

const SOURCES = [
  {id:'telegram-jkazan',name:'Telegram · Шабашка / Работа в Казани',url:'https://t.me/s/jkazan',type:'telegram_public'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut',type:'telegram_public'},
  {id:'telegram-tenderlar23',name:'Telegram · Стройка|Ремонт|Казань|Новости',url:'https://t.me/s/tenderlar23',type:'telegram_public'},
  {id:'telegram-stroyou116kzn',name:'Telegram · Стройка Строительство Казань',url:'https://t.me/s/stroyou116kzn',type:'telegram_public'},
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116',type:'telegram_public'},
  {id:'kazan-chatnovosela',name:'ЖК · Каталог чатов новосёлов Казани',url:'https://kazan.chatnovosela.ru/',type:'web_catalog'}
];

const NEG=[
  'ремонт автомобиля','оргтехники','телефона','компьютера','стиральной машины','холодильника','кондиционера',
  'мелкий ремонт','мастер на час','вакансия','ищу работу','ищу работу вахтой','резюме','зарплата',
  'устроиться на работу','требуются сотрудники','требуется сотрудник',
  'предлагаю услуги','оказываю услуги','оказываем услуги','услуги по ремонту','услуги ремонта',
  'выполняем ремонт','выполняю ремонт','делаем ремонт','сделаем ремонт','ремонт под ключ от',
  'стоимость работ','цена за м2','цены на ремонт','прайс','прайс-лист','расценки',
  'скидка','акция','выгодно','закажите ремонт','заказать ремонт у нас','пишите в личку',
  'звоните','оставляйте заявку','принимаем заказы','свободна бригада','свободная бригада',
  'наша бригада','наша компания','наши работы','наши услуги','портфолио','объект в работе',
  'взяли новый объект','взяли объект','завершили ремонт','покажу объект','показываем объект',
  'работаем в казани','работаем по казани','выезжаем','есть свободные места'
];

const POS=[
  'ищу бригаду','ищу подрядчика','ищу исполнителя','ищу мастера','ищу мастеров',
  'нужна бригада','нужна бригада на ремонт','нужен подрядчик','нужен исполнитель',
  'нужен мастер','нужен мастер на ремонт','нужен ремонт','нужна отделка','нужен ремонт квартиры',
  'нужен ремонт дома','ищу ремонтную бригаду','посоветуйте бригаду','посоветуйте мастера',
  'посоветуйте кто делал','кто делал ремонт','кто может сделать ремонт','кто делал отделку',
  'подскажите хорошую бригаду','подскажите мастера','порекомендуйте бригаду',
  'порекомендуйте мастера','ищем подрядчика','ищем исполнителя','заказчик ищет',
  'требуется подрядчик','требуется исполнитель','квартира под ремонт','дом под ремонт',
  'квартира после получения ключей','получил ключи','получили ключи','купил квартиру',
  'купили квартиру','новостройка под ремонт','нужна отделка квартиры'
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
  return s.replace(/<script[\\s\\S]*?<\\/script>/gi,' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi,' ')
    .replace(/<br\\s*\\/?>/gi,' ').replace(/<\\/p>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ')
    .replace(/&quot;/gi,'\"').replace(/&#39;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\\s+/g,' ').trim();
}

function relevant(text){
  const t=text.toLowerCase().replace(/ё/g,'е');
  if(t.length<25) return false;
  if(NEG.some(x=>t.includes(x))) return false;

  const employerPost=EMPLOYER_PATTERNS.some(re=>re.test(t));
  if(employerPost) return false;

  const hasDirectIntent=POS.some(x=>t.includes(x));
  if(!hasDirectIntent) return false;

  const hasObject=/(квартир|новостро|вторич|коттедж|дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t);
  if(!hasObject) return false;

  const firstPersonClient=/(ищу|нужен|нужна|нужно|подскажите|посоветуйте|порекомендуйте|кто может|кто делал|получил ключи|получили ключи|купил квартиру|купили квартиру)/.test(t);
  return firstPersonClient;
}

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
function score(text,a){
  const t=text.toLowerCase();
  let s=45;
  if(/казан|казань/.test(t))s+=20;
  if(/нужен|нужна|нужно|ищу|подскажите|посоветуйте|порекомендуйте/.test(t))s+=20;
  if(/квартир|новостро|дом|коттедж|офис|магазин|коммерц/.test(t))s+=10;
  if(/кто делал|кто может|получил ключи|получили ключи|купил квартиру/.test(t))s+=10;
  if(a&&a>=40)s+=10;
  if(/бюджет|млн|₽|руб/.test(t))s+=5;
  return Math.min(100,s);
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
        const text=clean(m[1]); if(text.length<20||!relevant(text)) continue;
        const nearby=html.slice(Math.max(0,m.index-12000),Math.min(html.length,m.index+12000));
        const tm=nearby.match(/href=["'](https?:\/\/t\.me\/[^"']+\/\d+)["']/i);
        const a=area(text);
        out.push({id:s.id+'-'+Buffer.from((tm?.[1]||text.slice(0,100))).toString('base64url').slice(-24),source:s.name,url:tm?.[1]||s.url,title:text.slice(0,140),text,area:a,budget:budget(text),type:classify(text),score:score(text,a),publishedAt:null,status:'new'});
      }
      return {items:out,found:out.length,status:'readable',error:null};
    }catch(e){return {items:[],found:0,status:'unavailable',error:e?.message||String(e)};}
  }));
  const leads=results.flatMap(x=>x.items).sort((a,b)=>b.score-a.score);
  const catalog=results.find(x=>x.status==='catalog');
  return {ok:true,updatedAt:new Date().toISOString(),
    stats:{found:leads.length,new:leads.length,duplicates:0,high:leads.filter(x=>x.score>=70).length},
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