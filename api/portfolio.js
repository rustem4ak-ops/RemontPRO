const https = require('https');

const PUBLIC_KEY = 'https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

function getJson(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RemontFormaPortfolio/3.0',
        'Accept': 'application/json'
      },
      timeout: 15000
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (res.statusCode !== 200) {
            const err = new Error('Yandex Disk API: HTTP ' + res.statusCode);
            err.status = res.statusCode;
            throw err;
          }
          resolve(json);
        } catch (e) {
          if (attempt < 2) {
            setTimeout(() => getJson(url, attempt + 1).then(resolve).catch(reject), 400 * (attempt + 1));
          } else reject(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Yandex Disk API timeout')));
    req.on('error', e => {
      if (attempt < 2) {
        setTimeout(() => getJson(url, attempt + 1).then(resolve).catch(reject), 400 * (attempt + 1));
      } else reject(e);
    });
  });
}

async function getFolder(path) {
  const url = API + '?public_key=' + encodeURIComponent(PUBLIC_KEY) +
    '&path=' + encodeURIComponent(path) + '&limit=1000&preview_size=XXXL';
  return getJson(url);
}

async function collect(path, folderName, out) {
  const data = await getFolder(path);
  const items = data && data._embedded && data._embedded.items || [];
  for (const item of items) {
    const itemPath = item.path || ((path ? path + '/' : '') + item.name);
    if (item.type === 'dir') {
      await collect(itemPath, item.name || folderName, out);
    } else if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
      out.push({
        name: item.name,
        path: itemPath,
        folder: folderName || 'Реализованные ремонты',
        preview: item.preview || null,
        url: item.file || item.public_url || null,
        size: Number(item.size || 0)
      });
    }
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const root = await getFolder('');
    const images = [];
    const items = root && root._embedded && root._embedded.items || [];
    for (const item of items) {
      const path = item.path || item.name;
      if (item.type === 'dir') {
        await collect(path, item.name, images);
      } else if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
        images.push({
          name:item.name,
          path,
          folder:'Реализованные ремонты',
          preview:item.preview || null,
          url:item.file || item.public_url || null,
          size:Number(item.size || 0)
        });
      }
    }
    res.status(200).json({ok:true,count:images.length,images});
  } catch (e) {
    res.status(502).json({ok:false,error:e.message || 'Portfolio API error'});
  }
};