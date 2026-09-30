const PUBLIC_KEY = 'https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
const API = 'https://cloud-api.yandex.net/v1/disk/public/resources';

async function getFolder(path) {
  const url = API + '?public_key=' + encodeURIComponent(PUBLIC_KEY) +
    '&path=' + encodeURIComponent(path) +
    '&limit=1000&preview_size=XXXL';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RemontFormaPortfolio/4.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch (_) {}

    if (!response.ok) {
      throw new Error('Yandex Disk API: HTTP ' + response.status);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function collect(path, folderName, out, depth = 0) {
  if (depth > 5) return;

  const data = await getFolder(path);
  const items = data && data._embedded && data._embedded.items || [];

  await Promise.allSettled(items.map(async item => {
    const itemPath = item.path || ((path ? path + '/' : '') + item.name);

    if (item.type === 'dir') {
      try {
        await collect(itemPath, item.name || folderName, out, depth + 1);
      } catch (_) {}
      return;
    }

    if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
      out.push({
        name: item.name,
        path: itemPath,
        folder: folderName || 'Реализованные ремонты',
        preview: item.preview || null,
        url: item.file || item.public_url || null,
        size: Number(item.size || 0)
      });
    }
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    const root = await getFolder('');
    const images = [];
    const items = root && root._embedded && root._embedded.items || [];

    const tasks = items.map(async item => {
      const path = item.path || item.name;

      if (item.type === 'dir') {
        try {
          await collect(path, item.name, images);
        } catch (_) {}
        return;
      }

      if (item.type === 'file' && /^image\//i.test(item.mime_type || '')) {
        images.push({
          name: item.name,
          path,
          folder: 'Реализованные ремонты',
          preview: item.preview || null,
          url: item.file || item.public_url || null,
          size: Number(item.size || 0)
        });
      }
    });

    await Promise.allSettled(tasks);

    const unique = [];
    const seen = new Set();
    for (const image of images) {
      const key = image.path || image.url || image.name;
      if (!seen.has(key) && (image.preview || image.url)) {
        seen.add(key);
        unique.push(image);
      }
    }

    if (!unique.length) {
      throw new Error('Яндекс Диск не вернул фотографии');
    }

    res.status(200).json({
      ok: true,
      count: unique.length,
      images: unique
    });
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: e && e.message ? e.message : 'Portfolio API error'
    });
  }
};
