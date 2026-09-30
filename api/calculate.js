const { calculate } = require('../shared/remontforma-pricing.js');

const SOURCES = [
  {id:'telegram-workazan116',name:'Telegram · Подработка Казань 24/7',url:'https://t.me/s/workazan116'},
  {id:'telegram-stroy-kazann',name:'Telegram · Стройка/Ремонт/Отделка Казань',url:'https://t.me/s/Stroy_Kazann'},
  {id:'telegram-stroykaremontkazan',name:'Telegram · СтРОЙКА/РЕМОНТ Казань',url:'https://t.me/s/stroykaremontkazan'},
  {id:'telegram-kazanstroit',name:'Telegram · Стройка Ремонт Казань',url:'https://t.me/s/kazanstroit'},
  {id:'telegram-stroykakzn',name:'Telegram · Ремонт стройка Казань',url:'https://t.me/s/stroykakzn'},
  {id:'telegram-kznrabotatut',name:'Telegram · Шабашка Халтура Казань',url:'https://t.me/s/kznrabotatut'}
];

const NEG=[
  'ремонт автомобиля','оргтехники','телефона','компьютера','стиральной машины',
  'холодильника','кондиционера','мелкий ремонт','мастер на час','вакансия',
  'ищу работу','ищу работу вахтой','резюме','зарплата','устроиться на работу',
  'требуются сотрудники','требуется сотрудник'
];

const POS=[
  'ремонт под ключ','ремонт квартиры','ремонт дома','ремонт коттеджа','комплексный ремонт',
  'отделка квартиры','отделка дома','ремонт новостройки','ремонт вторички',
  'ремонт офиса','ремонт магазина','ремонт коммерческого помещения','ремонт помещений',
  'капитальный ремонт','текущий ремонт','строительно-отделочные','нужен ремонт',
  'нужен ремонт квартиры','нужен ремонт дома','нужна бригада','нужна бригада на ремонт',
  'ищу бригаду на ремонт','ищу подрядчика','ищу исполнителя','ищу ремонт','заказать ремонт',
  'заказ на ремонт','заказчик ищет','требуется подрядчик','требуется ремонт',
  'сделать ремонт','сделать отделку','нужна отделка','ищу мастеров',
  'ищем бригаду на ремонт','ищем подрядчика','ищем исполнителя','квартира под ремонт',
  'дом под ремонт','объект под ремонт','объект на ремонт','отделка новостройки'
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
  return s
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<\/p>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ').trim();
}
function relevant(text){
  const t=text.toLowerCase().replace(/ё/g,'е');
  if(NEG.some(x=>t.includes(x))) return false;
  const clientRequest=/(ремонт|отделк|под ключ|объект под ремонт|квартира под ремонт|дом под ремонт|заказать ремонт|заказчик|ищу подрядчика|ищу исполнителя|нужна бригада на ремонт|нужен ремонт)/.test(t);
  const employerPost=EMPLOYER_PATTERNS.some(re=>re.test(t));
  if(employerPost && !clientRequest) return false;
  const hasRepair=POS.some(x=>t.includes(x));
  const hasObject=/(квартир|новостро|вторич|коттедж|частн\w* дом|жил\w* дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t);
  const hasClientIntent=/(нужен|нужна|нужно|ищу|ищем|заказать|заказчик|подрядчик|исполнитель|бригада|ремонт|отделк)/.test(t);
  return hasRepair || (hasObject && hasClientIntent);
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
  let s=0;
  if(/казан|казань/.test(t))s+=30;
  if(/нужен|нужна|нужно|ищу|ищем|требуется|заказать|заказчик/.test(t))s+=25;
  if(/под ключ|комплексн/.test(t))s+=25;
  if(/коммерц|офис|магазин|салон|кафе/.test(t))s+=15;
  if(a&&a>=40)s+=15;
  if(/бюджет|млн|₽|руб/.test(t))s+=5;
  if(/квартир|дом|коттедж|офис|магазин|помещени|объект/.test(t))s+=10;
  return Math.min(100,s);
}

async function liveAutoSearch(){
  const results=await Promise.all(SOURCES.map(async s=>{
    try{
      const rr=await fetch(s.url,{
        headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'},
        redirect:'follow',
        signal:AbortSignal.timeout(8000)
      });
      if(!rr.ok) throw new Error('HTTP '+rr.status);
      const html=await rr.text();
      const out=[];
      const re=/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi;
      let m;
      while((m=re.exec(html))){
        const text=clean(m[1]);
        if(text.length<20||!relevant(text))continue;
        const nearby=html.slice(Math.max(0,m.index-12000),Math.min(html.length,m.index+12000));
        const tm=nearby.match(/href=["'](https?:\/\/t\.me\/[^"']+\/\d+)["']/i);
        const a=area(text);
        out.push({
          id:s.id+'-'+Buffer.from((tm?.[1]||text.slice(0,100))).toString('base64url').slice(-24),
          source:s.name,url:tm?.[1]||s.url,title:text.slice(0,140),text,
          area:a,budget:budget(text),type:classify(text),score:score(text,a),
          publishedAt:null,status:'new'
        });
      }
      return {items:out,error:null};
    }catch(e){return {items:[],error:e?.message||String(e)};}
  }));
  const leads=results.flatMap(x=>x.items).sort((a,b)=>b.score-a.score);
  return {
    ok:true,updatedAt:new Date().toISOString(),
    stats:{
      found:leads.length,new:leads.length,duplicates:0,
      high:leads.filter(x=>x.score>=70).length
    },
    leads,
    diagnostics:results.map((x,i)=>({source:SOURCES[i].name,found:x.items.length,error:x.error}))
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