// Stable Vercel redirect used as a fallback from the GitHub Pages site.
// A redirect cannot bypass a network-level Telegram block; it gives the site
// a first-party endpoint and keeps the destination easy to update.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Location", "https://t.me/+79172433455");
  return res.status(302).end();
}
