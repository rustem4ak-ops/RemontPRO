const https = require('https');

const TOKEN = process.env.MAX_BOT_TOKEN;
const API = 'https://platform-api2.max.ru';
const WEBHOOK = 'https://remont-pro-nine.vercel.app/api/max';
const SECRET = process.env.MAX_WEBHOOK_SECRET || 'rf-max-2026-webhook';

const ROOT_CA_URL =
  'https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt';
const SUB_CA_URL =
  'https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt';

let cachedAgent = null;
let cachedAt = 0;

function download(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'RemontPRO-MAX/1.0' }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return reject(new Error(`Certificate download failed: HTTP ${response.statusCode}`));
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    request.on('timeout', () => request.destroy(new Error('Certificate download timeout')));
    request.on('error', reject);
  });
}

async function getAgent() {
  if (cachedAgent && Date.now() - cachedAt < 6 * 60 * 60 * 1000) {
    return cachedAgent;
  }

  const [rootCA, subCA] = await Promise.all([
    download(ROOT_CA_URL),
    download(SUB_CA_URL)
  ]);

  cachedAgent = new https.Agent({
    keepAlive: true,
    ca: [rootCA, subCA],
    minVersion: 'TLSv1.2'
  });

  cachedAt = Date.now();
  return cachedAgent;
}

function maxRequest(path, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const agent = await getAgent();
      const url = new URL(path, API);
      const body = options.body ? JSON.stringify(options.body) : null;

      const request = https.request(url, {
        method: options.method || 'GET',
        agent,
        headers: {
          Authorization: TOKEN,
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        },
        timeout: 20000
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data = {};

          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = { raw: text };
          }

          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            data
          });
        });
      });

      request.on('timeout', () => request.destroy(new Error('MAX API request timeout')));
      request.on('error', reject);

      if (body) request.write(body);
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function setupCommands() {
  return maxRequest('/me/commands', {
    method: 'PATCH',
    body: {
      commands: [
        { name: 'start', description: 'Начать расчёт ремонта' },
        { name: 'calculator', description: 'Рассчитать стоимость ремонта' },
        { name: 'admin', description: 'Показать MAX user_id для настройки уведомлений' }
      ]
    }
  });
}

async function setupWebhook() {
  return maxRequest('/subscriptions', {
    method: 'POST',
    body: {
      url: WEBHOOK,
      update_types: ['bot_started', 'message_created', 'message_callback'],
      secret: SECRET
    }
  });
}

async function getSubscriptions() {
  return maxRequest('/subscriptions');
}

module.exports = async function handler(req, res) {
  if (!TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'MAX_BOT_TOKEN is not configured'
    });
  }

  try {
    if (req.method === 'GET') {
      const commands = await setupCommands();
      const setup = await setupWebhook();
      const subscriptions = await getSubscriptions();

      const ok = commands.ok && setup.ok && subscriptions.ok;

      return res.status(ok ? 200 : 502).json({
        ok,
        webhook: WEBHOOK,
        commands: {
          ok: commands.ok,
          status: commands.status,
          data: commands.data
        },
        setup: {
          ok: setup.ok,
          status: setup.status,
          data: setup.data
        },
        subscriptions: {
          ok: subscriptions.ok,
          status: subscriptions.status,
          data: subscriptions.data
        }
      });
    }

    if (req.method === 'POST') {
      const setup = await setupWebhook();
      const subscriptions = await getSubscriptions();

      return res.status(setup.ok && subscriptions.ok ? 200 : 502).json({
        ok: setup.ok && subscriptions.ok,
        webhook: WEBHOOK,
        setup: {
          ok: setup.ok,
          status: setup.status,
          data: setup.data
        },
        subscriptions: {
          ok: subscriptions.ok,
          status: subscriptions.status,
          data: subscriptions.data
        }
      });
    }

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'MAX setup error',
      name: error.name || null,
      code: error.code || null,
      cause: error.cause?.message || error.cause?.code || null
    });
  }
};
