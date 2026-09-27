# РемонтPRO

Android/Capacitor project for the РемонтPRO renovation estimator.

## GitHub APK build

The workflow **Build RemontPRO APK** automatically builds a debug APK on every push to `main` and can also be started manually from GitHub Actions.

The APK is published as the workflow artifact:

`RemontPRO-v14-debug-apk`

## Local build

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Then build the APK from Android Studio.

## Version

v14.0.0 — editable rates with pencil buttons and saved prices.


## РЕМОНТФОРМА — сайт и единая система заявок

Production site: https://remont-pro-nine.vercel.app  
Telegram bot: https://t.me/RemontFormaBot  
Calculator API: https://remont-pro-nine.vercel.app/api/calculate

### Что добавлено на сайте
- расширенный калькулятор в модальном окне;
- тип объекта: квартира / дом / коммерция;
- площадь, санузел, балкон, комнаты, состояние, тип ремонта, окна/откосы;
- расчёт по единому API РЕМОНТФОРМА;
- этапный результат и цена за м²;
- форма «Получить точную смету»;
- источник заявки / UTM;
- фото объекта и планировка как данные заявки;
- печатная форма, которую можно сохранить через браузер как PDF;
- блоки услуг, портфолио, процесс работы и отзывы;
- переход в Telegram.

### Lead API

POST /api/lead принимает контакт, параметры объекта, расчёт, выбранные работы и метаданные файлов.

Для автоматической передачи заявки в Telegram и Bitrix24 необходимо добавить в Vercel Environment Variables:

- TELEGRAM_BOT_TOKEN — уже используется ботом;
- TELEGRAM_ADMIN_CHAT_ID — chat ID, куда отправлять новые заявки;
- BITRIX24_WEBHOOK_URL — входящий вебхук Bitrix24 с правом создания CRM-лида.

Если последние два параметра не заданы, сайт и калькулятор продолжают работать, а Lead API возвращает состояние интеграций.
