const TOKEN = process.env.MAX_BOT_TOKEN;
const API = 'https://platform-api2.max.ru';
const WEBHOOK = 'https://remont-pro-nine.vercel.app/api/max';
const SECRET = process.env.MAX_WEBHOOK_SECRET || 'rf-max-2026-webhook';
// MAX API v2 may require the Russian Trusted Root CA on runtimes without it.

module.exports = async function handler(req,res){
  if(req.method==='GET'){
    if(!TOKEN) return res.status(500).json({ok:false,error:'MAX_BOT_TOKEN is not configured'});
    try{
      const r=await fetch(API+'/subscriptions',{
        method:'POST',
        headers:{Authorization:TOKEN,'Content-Type':'application/json'},
        body:JSON.stringify({url:WEBHOOK,update_types:['bot_started','message_created','message_callback'],secret:SECRET})
      });
      const data=await r.json().catch(()=>({}));
      return res.status(r.ok?200:502).json({ok:r.ok,webhook:WEBHOOK,subscription:data});
    }catch(e){return res.status(500).json({ok:false,error:e.message||'Setup error',name:e.name||null,code:e.code||null,cause:e.cause?.message||e.cause?.code||null});}
  }
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    if(!TOKEN) return res.status(500).json({ok:false,error:'MAX_BOT_TOKEN is not configured'});
    const r=await fetch(API+'/subscriptions',{
      method:'POST',
      headers:{Authorization:TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({
        url:WEBHOOK,
        update_types:['bot_started','message_created','message_callback'],
        secret:SECRET
      })
    });
    const data=await r.json().catch(()=>({}));
    return res.status(r.ok?200:502).json({ok:r.ok,webhook:WEBHOOK,subscription:data});
  }catch(e){return res.status(500).json({ok:false,error:e.message||'Setup error'})}
};