import { calculate } from '../shared/remontforma-pricing.js';

export default function handler(req,res) {
  if (req.method === 'GET') return res.status(200).json({ ok:true, service:'РЕМОНТФОРМА Calculator API', version:'1.0.0' });
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  try {
    const result=calculate(req.body||{});
    return res.status(200).json({ ok:true, result });
  } catch (e) {
    return res.status(400).json({ ok:false, error:e?.message||'Calculation error' });
  }
}
