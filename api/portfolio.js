const https = require('https');

const PUBLIC_KEY = 'https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers:{'User-Agent':'RemontFormaPortfolio/1.0'}}, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({status:res.statusCode, data:JSON.parse(data)}); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function walk(items, folder) {
  const out = [];
  for (const item of items || []) {
    const path = item.path || ((folder || '') + '/' + item.name);
    if (item.type === 'dir') {
      out.push(...walk(item._embedded && item._embedded.items, path));
    } else if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
      out.push({
        name: item.name,
        path,
        folder: folder || 'Реализованные ремонты',
        preview: item.preview || null,
        url: item.public_url || null
      });
    }
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  try {
    const url = API + '?public_key=' + encodeURIComponent(PUBLIC_KEY) + '&limit=1000&preview_size=XXXL';
    const r = await getJson(url);
    if (r.status !== 200) throw new Error('Yandex Disk API: HTTP ' + r.status);
    const root = r.data;
    const images = walk(root._embedded && root._embedded.items, '');
    res.status(200).json({ok:true, count:images.length, images});
  } catch (e) {
    res.status(502).json({ok:false,error:e.message});
  }
};