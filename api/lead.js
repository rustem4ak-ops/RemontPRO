// РЕМОНТФОРМА — приём лидов с сайта.
// ENV: TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID для уведомления в Telegram.
// ENV: BITRIX24_WEBHOOK_URL для автоматического создания лида в Bitrix24.
async function tg(method, body){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) return null;
  const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return r.json();
}
function money(n){return new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽'}
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
module.exports=async function handler(req,res){
  if(req.method==='GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Lead API',telegram:Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID),bitrix:Boolean(process.env.BITRIX24_WEBHOOK_URL)});
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const phone=String(b.phone||'').trim();
    if(!phone) return res.status(400).json({ok:false,error:'Phone is required'});
    const q=b.calculator||{}, o=b.object||{};
    const text=[
      '🆕 <b>Новая заявка РЕМОНТФОРМА</b>','',
      '👤 '+esc(b.name||'Не указано'),
      '📞 <b>'+esc(phone)+'</b>',
      '📍 Источник: <b>'+esc(b.source||'site')+'</b>','',
      '🏠 Объект: '+esc(o.type||'Не указан'),
      '📐 Площадь: '+esc(o.floor||0)+' м²',
      '🚿 Санузел: '+esc(o.bath||0)+' м²',
      '🌿 Балкон: '+esc(o.balcony||0)+' м²',
      '🚪 Комнат: '+esc(o.rooms||'—'),
      '🏗 Состояние: '+esc(o.state||'—'),
      '🎯 Задача: '+esc(o.finish||'—'),
      '🪟 Окон/откосов: '+esc(o.windows||0),'',
      '💰 Предварительный расчёт: <b>'+money(q.total)+'</b>',
      '📏 Цена за м²: <b>'+money(q.pricePerM2)+'</b>',
      '📎 Фото: '+((b.files?.photos||[]).length||0),
      '📄 Планировка: '+(b.files?.plan?.name||'нет'),
      b.comment?'':'',
      b.comment?'💬 '+esc(b.comment):''
    ].filter(Boolean).join('\n');
    let telegramSent=false,bitrixSent=false,bitrixId=null;
    if(process.env.TELEGRAM_ADMIN_CHAT_ID){
      const t=await tg('sendMessage',{chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text,parse_mode:'HTML'});
      telegramSent=Boolean(t?.ok);
    }
    if(process.env.BITRIX24_WEBHOOK_URL){
      const fields={
        TITLE:'РЕМОНТФОРМА — '+(o.type||'объект')+' '+(o.floor||'')+' м²',
        NAME:String(b.name||''),
        PHONE:[{VALUE:phone,VALUE_TYPE:'WORK'}],
        SOURCE_DESCRIPTION:'Сайт РЕМОНТФОРМА | '+String(b.source||'site'),
        COMMENTS:'Предварительный расчёт: '+money(q.total)+'; цена/м²: '+money(q.pricePerM2)+'; объект: '+String(o.type||'')+'; площадь: '+String(o.floor||'')+' м²; санузел: '+String(o.bath||0)+' м². '+String(b.comment||'')
      };
      const br=await fetch(process.env.BITRIX24_WEBHOOK_URL+'crm.lead.add.json',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fields})});
      const bj=await br.json().catch(()=>({}));
      bitrixSent=Boolean(bj?.result);bitrixId=bj?.result||null;
    }
    return res.status(200).json({ok:true,telegramSent,bitrixSent,bitrixId});
  }catch(e){return res.status(500).json({ok:false,error:e.message||'Lead error'})}
}