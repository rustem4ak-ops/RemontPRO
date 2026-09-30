const PUBLIC_KEY = 'https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';
const DOWNLOAD_API = API + '/download';

const FEATURED = {
  '20231223_114527.jpg': {label:'Гостиная', title:'Готовый интерьер · современная отделка', order:1},
  '20231223_114512.jpg': {label:'Кухня', title:'Кухня · чистовая отделка', order:2},
  '20231223_114444.jpg': {label:'Спальня', title:'Жилая комната · отделка под ключ', order:3},
  'photo_2026-03-26_16-19-37.jpg': {label:'Санузел', title:'Санузел · плитка и сантехника', order:4},
  'photo_2022-07-25_14-22-12.jpg': {label:'Санузел', title:'Зона умывальника · отделка', order:5},
  'photo_2026-03-26_16-46-25.jpg': {label:'Санузел', title:'Санузел · готовый результат', order:6}
};

async function getFolder(path) {
  const params = new URLSearchParams({
    public_key: PUBLIC_KEY,
    path: path || '/',
    limit: '1000',
    preview_size: 'XXXL'
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(API + '?' + params.toString(), {
      headers: {'User-Agent':'RemontFormaPortfolio/5.0','Accept':'application/json'},
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch (_) {}
    if (!response.ok) throw new Error('Yandex Disk API: HTTP ' + response.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getDownloadUrl(path) {
  const params = new URLSearchParams({public_key: PUBLIC_KEY, path});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(DOWNLOAD_API + '?' + params.toString(), {
      headers: {'User-Agent':'RemontFormaPortfolio/5.0','Accept':'application/json'},
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch (_) {}
    if (!response.ok || !data.href) return null;
    return data.href;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function collect(path, folderName, out, depth = 0) {
  if (depth > 6) return;
  const data = await getFolder(path);
  const items = data && data._embedded && data._embedded.items || [];

  await Promise.allSettled(items.map(async item => {
    // Yandex public API expects a path relative to the shared folder, not disk:/...
    const itemPath = (path && path !== '/' ? path.replace(/\/$/, '') + '/' : '/') + item.name;

    if (item.type === 'dir') {
      try {
        await collect(itemPath, item.name || folderName, out, depth + 1);
      } catch (_) {}
      return;
    }

    if (item.type !== 'file' || !/^image\//i.test(item.mime_type || '')) return;

    let url = item.preview || null;
    if (!url) url = item.file || null;
    if (!url) url = await getDownloadUrl(itemPath);

    if (url) {
      const featured = FEATURED[item.name];
      out.push({
        name: item.name,
        path: itemPath,
        folder: folderName || 'Реализованные ремонты',
        preview: url,
        url,
        size: Number(item.size || 0),
        label: featured ? featured.label : null,
        title: featured ? featured.title : 'Реализованный ремонт',
        featured: !!featured,
        order: featured ? featured.order : 100
      });
    }
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=1800');

  try {
    const root = await getFolder('/');
    const images = [];
    const items = root && root._embedded && root._embedded.items || [];

    await Promise.allSettled(items.map(async item => {
      const itemPath = '/' + item.name;
      if (item.type === 'dir') {
        try { await collect(itemPath, item.name, images); } catch (_) {}
        return;
      }
      if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
        let url = item.preview || item.file || await getDownloadUrl(itemPath);
        if (url) {
          const featured = FEATURED[item.name];
          images.push({
            name:item.name,path:itemPath,folder:'Реализованные ремонты',
            preview:url,url,size:Number(item.size||0),
            label:featured ? featured.label : null,
            title:featured ? featured.title : 'Реализованный ремонт',
            featured:!!featured,order:featured ? featured.order : 100
          });
        }
      }
    }));

    const unique = [];
    const seen = new Set();
    for (const image of images) {
      const key = image.path || image.url || image.name;
      if (!seen.has(key)) { seen.add(key); unique.push(image); }
    }

    unique.sort((a,b) => (a.order-b.order) || a.name.localeCompare(b.name,'ru'));

    if (!unique.length) throw new Error('Яндекс Диск не вернул фотографии');

    res.status(200).json({ok:true,count:unique.length,images:unique});
  } catch (e) {
    res.status(502).json({ok:false,error:e && e.message ? e.message : 'Portfolio API error'});
  }
};