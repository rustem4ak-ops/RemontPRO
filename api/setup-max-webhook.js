const TOKEN=process.env.MAX_BOT_TOKEN;
const SECRET=process.env.MAX_WEBHOOK_SECRET||'rf-max-webhook-2026';
const WEBHOOK='https://remont-pro-nine.vercel.app/api/max';
module.exports=async function(req,res){if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method not allowed'});if(!TOKEN)return res.status(500).json({ok:false,error:'MAX_BOT_TOKEN is not configured'});const r=await fetch('https://platform-api2.max.ru/subscriptions',{method:'POST',headers:{Authorization:TOKEN,'Content-Type':'application/json'},body:JSON.stringify({url:WEBHOOK,update_types:['message_created','message_callback','bot_started'],secret:SECRET})});const d=await r.json();return res.status(r.ok?200:500).json({ok:r.ok,max:d,webhook:WEBHOOK})};
