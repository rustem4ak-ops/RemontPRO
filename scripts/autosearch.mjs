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

const NEG = [
  'предлагаю услуги','оказываю услуги','оказываем услуги','услуги по ремонту','услуги ремонта',
  'выполняем ремонт','выполняю ремонт','делаем ремонт','ремонт под ключ от','стоимость работ',
  'цена за м2','цены на ремонт','прайс','прайс-лист','расценки','скидка','акция','выгодно',
  'закажите ремонт','заказать ремонт у нас','пишите в личку','звоните','оставляйте заявку',
  'принимаем заказы','свободна бригада','свободная бригада','наша бригада','наша компания',
  'наши работы','наши услуги','портфолио','объект в работе','взяли новый объект','взяли объект',
  'завершили ремонт','покажу объект','показываем объект','работаем в казани','работаем по казани'
];
const POS = [
  'ищу бригаду','ищу подрядчика','ищу исполнителя','ищу мастера','ищу мастеров','нужна бригада',
  'нужна бригада на ремонт','нужен подрядчик','нужен исполнитель','нужен мастер',
  'нужен мастер на ремонт','нужен ремонт','нужна отделка','нужен ремонт квартиры','нужен ремонт дома',
  'ищу ремонтную бригаду','посоветуйте бригаду','посоветуйте мастера','кто делал ремонт',
  'кто может сделать ремонт','подскажите хорошую бригаду','подскажите мастера','порекомендуйте бригаду',
  'порекомендуйте мастера','ищем подрядчика','ищем исполнителя','заказчик ищет','требуется подрядчик',
  'требуется исполнитель','квартира под ремонт','дом под ремонт','получил ключи','получили ключи',
  'купил квартиру','купили квартиру','новостройка под ремонт','нужна отделка квартиры'
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
  if(t.length<25||NEG.some(x=>t.includes(x)))return false;
  if(/требуютс[яь]\s+(?:рабоч|монтажник|каменщик|плиточник|маляр|отделочник|электрик|сантехник)/.test(t))return false;
  const direct=POS.some(x=>t.includes(x));
  if(!direct)return false;
  if(!/(квартир|новостро|вторич|коттедж|дом|офис|магазин|салон|кафе|помещени|коммерц|объект)/.test(t))return false;
  return /(ищу|нужен|нужна|нужно|подскажите|посоветуйте|порекомендуйте|кто может|кто делал|получил ключи|получили ключи|купил квартиру|купили квартиру)/.test(t);
}


