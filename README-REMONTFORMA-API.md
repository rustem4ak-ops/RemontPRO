# РЕМОНТФОРМА — Calculator API

Это первый слой общей системы РЕМОНТФОРМА.

## Зачем

Один расчёт должен использоваться Telegram-ботом, сайтом и РемонтPRO. Цены и формулы не должны копироваться в три разных приложения.

## Создано

- `shared/remontforma-pricing.js` — единый расчётный движок.
- `api/calculate.js` — HTTP API для расчёта.
- `README-REMONTFORMA-API.md` — описание архитектуры.

## Endpoint

После размещения на Vercel/другом Node-compatible хостинге:

- GET `/api/calculate` — проверка API.
- POST `/api/calculate` — расчёт.

Пример тела POST:

```json
{
  "floor": 80,
  "bath": 5,
  "balcony": 4,
  "electrical": "partial",
  "plumbing": "full",
  "bathroom": "classic",
  "tile": "manual",
  "tileArea": 10,
  "laminate": true,
  "plinth": "plastic",
  "walls": {"wallpaper": {"area": 0}}
}
```

## Важно

Пока Telegram-бот не подключён к API и рабочий РемонтPRO не заменяется. Сначала проверяем API, затем подключаем Telegram и сайт.
