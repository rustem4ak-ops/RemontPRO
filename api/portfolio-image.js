const PUBLIC_KEY = 'https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
const DOWNLOAD_API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'https://remont-pro-nine.vercel.app');
    const path = url.searchParams.get('path');
    if (!path) {
      res.status(400).json({ok:false,error:'path is required'});
      return;
    }

    const api = DOWNLOAD_API +
      '?public_key=' + encodeURIComponent(PUBLIC_KEY) +
      '&path=' + encodeURIComponent(path);

    const r = await fetch(api, {
      headers: {
        'User-Agent': 'RemontFormaPortfolio/6.0',
        'Accept': 'application/json'
      }
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.href) {
      res.status(404).json({ok:false,error:'Image not found'});
      return;
    }

    const image = await fetch(data.href, {
      headers: {'User-Agent':'RemontFormaPortfolio/6.0'}
    });

    if (!image.ok) {
      res.status(502).json({ok:false,error:'Yandex image download failed'});
      return;
    }

    const type = image.headers.get('content-type') || 'image/jpeg';
    const length = image.headers.get('content-length');
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=259200');
    if (length) res.setHeader('Content-Length', length);

    const buffer = Buffer.from(await image.arrayBuffer());
    res.status(200).end(buffer);
  } catch (e) {
    res.status(502).json({ok:false,error:e && e.message ? e.message : 'Portfolio image proxy error'});
  }
};