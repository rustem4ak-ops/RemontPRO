# РЕМОНТФОРМА API на Cloudflare Workers

Этот Worker заменяет Vercel API для отправки заявок и расчёта стоимости.

## Развёртывание

1. Откройте https://dash.cloudflare.com/ и войдите в аккаунт.
2. Из корня репозитория выполните `npx wrangler login` (если потребуется авторизация), затем `npx wrangler deploy --config cloudflare-worker/wrangler.toml`. При необходимости сначала установите Wrangler: `npm install -D wrangler`.
3. В Cloudflare → Workers & Pages → Worker `remontforma-api` → Settings → Variables and Secrets добавьте секреты:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `MAX_BOT_TOKEN`
   - `MAX_ADMIN_USER_ID` или `MAX_ADMIN_CHAT_ID`

   Выберите тип Secret и вставьте те же значения, что настроены в Vercel. Не добавляйте токены в GitHub или исходники. После добавления выполните Deploy.
4. Проверьте выданный Cloudflare адрес:
   - `https://<worker-name>.<account-subdomain>.workers.dev/api/lead`
   - `https://<worker-name>.<account-subdomain>.workers.dev/api/calculate`

## Переключение сайта

После успешной проверки Worker и тестовой заявки поменяйте две константы в `index.html`:
`API='https://<worker-name>.<account-subdomain>.workers.dev/api/calculate'`
и
`LEAD='https://<worker-name>.<account-subdomain>.workers.dev/api/lead'`.

**Не переключайте сайт до настройки секретов и проверки тестовой заявки.** URL `workers.dev` зависит от аккаунта Cloudflare, поэтому его нельзя достоверно указать заранее.

Примечание: endpoint `?autosearch=1`, ранее обслуживавшийся калькулятором Vercel, пока не перенесён. Основной расчёт и отправка заявок поддерживаются.
