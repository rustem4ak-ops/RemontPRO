const { calculate } = require('../shared/remontforma-pricing.js');
const { runLive } = require('../shared/autosearch.cjs');

module.exports = async function handler(req,res){
  // Allow the production website and the GitHub Pages mirror to call this API.
  const origin = req.headers && req.headers.origin;
  const allowedOrigins = [
    'https://rustem4ak-ops.github.io',
    'https://remont-pro-nine.vercel.app'
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  if(req.method==='GET' && req.query?.autosearch==='1'){
    try{return res.status(200).json(await runLive());}
    catch(e){return res.status(500).json({ok:false,error:e?.message||'AutoSearch error'});}
  }
  if(req.method==='GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Calculator API',version:'1.1.0'});
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    return res.status(200).json({ok:true,result:calculate(body)});
  }catch(e){return res.status(400).json({ok:false,error:e?.message||'Calculation error'});}
};
