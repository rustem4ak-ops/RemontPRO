const { calculate } = require('../shared/remontforma-pricing.js');
const { runLive } = require('../shared/autosearch.cjs');

module.exports = async function handler(req,res){
  if(req.method==='GET' && req.query?.autosearch==='1'){
    try{return res.status(200).json(await runLive());}
    catch(e){return res.status(500).json({ok:false,error:e?.message||'AutoSearch error'});}
  }
  if(req.method==='GET') return res.status(200).json({ok:true,service:'РЕМОНТФОРМА Calculator API',version:'1.0.2'});
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    return res.status(200).json({ok:true,result:calculate(body)});
  }catch(e){return res.status(400).json({ok:false,error:e?.message||'Calculation error'});}
};
