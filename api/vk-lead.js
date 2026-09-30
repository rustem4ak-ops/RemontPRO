const API='https://api.vk.com/method/messages.send';
const VERSION='5.199';

module.exports=async function(req,res){
  if(req.method==='GET'){res.status(200).json({ok:true,service:'РЕМОНТФОРМА VK Lead API',configured:Boolean(process.env.VK_ACCESS_TOKEN&&process.env.VK_ADMIN_PEER_ID)});return}
  if(req.method!=='POST'){res.status(405).json({ok:false,error:'Method not allowed'});return}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const phone=String(body.phone||'').trim();
    if(!phone){res.status(400).json({ok:false,error:'Телефон обязателен'});return}
    const token=process.env.VK_ACCESS_TOKEN;
    const peer=process.env.VK_ADMIN_PEER_ID;
    if(!token||!peer){res.status(503).json({ok:false,error:'VK пока не настроен: добавьте VK_ACCESS_TOKEN и VK_ADMIN_PEER_ID в Vercel'});return}
    const text=[
      '🔔 НОВАЯ ЗАЯВКА — РЕМОНТФОРМА',
      '',
      '👤 Имя: '+(body.name||'не указано'),
      '📞 Телефон: '+phone,
      body.comment?'💬 Комментарий: '+body.comment:'',
      '',
      '🌐 Источник: сайт',
      body.url?'🔗 Страница: '+body.url:'',
      body.referrer?'↩️ Переход с: '+body.referrer:''
    ].filter(Boolean).join('\n');
    const params=new URLSearchParams({
      access_token:token,
      v:VERSION,
      peer_id:String(peer),
      random_id:String(Date.now()),
      message:text
    });
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||data.error){
      const msg=data?.error?.error_msg||'VK API error';
      res.status(502).json({ok:false,error:msg});
      return;
    }
    res.status(200).json({ok:true,vk_message_id:data.response});
  }catch(e){
    res.status(500).json({ok:false,error:e?.message||'VK lead error'});
  }
};
