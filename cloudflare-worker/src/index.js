import pricing from "../../shared/remontforma-pricing.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function money(n) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0)) + " ₽";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
async function telegram(env, text, html = true) {
  const token = env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN;
  const chat = env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID || env.TG_ADMIN_CHAT_ID;
  if (!token || !chat) return { ok: false, error: "Telegram secrets are not configured" };
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, ...(html ? { parse_mode: "HTML" } : {}) }),
    signal: AbortSignal.timeout(5000)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && !!data.ok, error: data.description || (response.ok ? "" : "HTTP " + response.status) };
}
async function maxSend(env, text) {
  const token = env.MAX_BOT_TOKEN;
  const userId = env.MAX_ADMIN_USER_ID;
  const chatId = env.MAX_ADMIN_CHAT_ID;
  const target = userId ? "/messages?user_id=" + encodeURIComponent(userId) : (chatId ? "/messages?chat_id=" + encodeURIComponent(chatId) : "");
  if (!token || !target) return { ok: false, error: "MAX secrets are not configured" };
  const response = await fetch("https://platform-api2.max.ru" + target, {
    method: "POST",
    headers: { Authorization: token, "content-type": "application/json" },
    body: JSON.stringify({ text: text.replace(/<[^>]+>/g, ""), notify: true }),
    signal: AbortSignal.timeout(5000)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, error: data.message || data.error || (response.ok ? "" : "HTTP " + response.status) };
}
async function lead(request, env) {
  if (request.method === "GET") {
    const tg = !!((env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN) && (env.TELEGRAM_ADMIN_CHAT_ID || env.TELEGRAM_CHAT_ID || env.TG_ADMIN_CHAT_ID));
    const mx = !!(env.MAX_BOT_TOKEN && (env.MAX_ADMIN_USER_ID || env.MAX_ADMIN_CHAT_ID));
    return json({ ok: true, service: "РЕМОНТФОРМА Lead API (Cloudflare)", telegram: tg, max: mx });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const b = await readBody(request);
  const phone = String(b.phone || "").trim();
  if (!phone) return json({ ok: false, error: "Phone is required" }, 400);

  const q = b.calculator || {};
  const rows = Array.isArray(q.rows) ? q.rows : [];
  const object = b.object || {};
  const lines = [
    "🆕 <b>Новая заявка</b>", "",
    "🏠 Объект: <b>" + esc(object.type || "Не указан") + "</b>",
    "📐 Общая площадь: <b>" + (Number(object.floor) || 0) + " м²</b>",
    "🚿 Санузел: <b>" + (Number(object.bath) || 0) + " м²</b>",
    "🔲 Плитка — пол: <b>" + (Number(object.tileArea) || 0) + " м²</b>", "",
    "👤 Имя: <b>" + esc(b.name || "Не указано") + "</b>",
    "📞 Номер телефона: <b>" + esc(phone) + "</b>",
    "📍 Источник: <b>" + esc(b.source || "site") + "</b>", ""
  ];
  if (rows.length) {
    for (const row of rows) lines.push("• " + esc(row.name) + " — " + money(row.cost));
    lines.push("", "<b>ИТОГО: " + money(q.total) + "</b>", "<b>Цена за м²: " + money(q.pricePerM2) + "</b>");
  } else {
    lines.push("💰 Предварительный расчёт: <b>" + money(q.total) + "</b>");
  }
  if (b.comment) lines.push("", "💬 " + esc(b.comment));
  const message = lines.join("\n");
  const [tg, mx] = await Promise.all([
    telegram(env, message, true).catch(e => ({ ok: false, error: String(e) })),
    b.skipMax ? Promise.resolve({ ok: false, error: "MAX skipped" }) : maxSend(env, message).catch(e => ({ ok: false, error: String(e) }))
  ]);
  if (!tg.ok && !mx.ok) return json({ ok: false, telegramSent: false, maxSent: false, error: "Не удалось отправить заявку ни в Telegram, ни в MAX", telegramError: tg.error, maxError: mx.error }, 502);
  return json({ ok: true, telegramSent: tg.ok, maxSent: mx.ok, telegramError: tg.error || null, maxError: mx.error || null });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/api/lead" || url.pathname === "/lead") return lead(request, env);
    if (url.pathname === "/api/calculate" || url.pathname === "/calculate") {
      if (request.method === "GET") return json({ ok: true, service: "РЕМОНТФОРМА Calculator API", version: "cloudflare-1.0" });
      if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
      const body = await readBody(request);
      try {
        return json({ ok: true, result: pricing.calculate(body) });
      } catch (e) {
        return json({ ok: false, error: e && e.message ? e.message : "Calculation error" }, 400);
      }
    }
    return json({ ok: false, error: "Not found" }, 404);
  }
};
