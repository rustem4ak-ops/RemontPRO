// РЕМОНТФОРМА — единый движок расчёта.
// Не содержит Telegram/Bitrix24/UI-кода: один расчёт для сайта, бота и РемонтPRO.

const HIDDEN_MARKUP_PERCENT = 30;
const HIDDEN_MULTIPLIER = 1 + HIDDEN_MARKUP_PERCENT / 100;

const DEFAULT_RATES = {
  electrical: { partial: 2500, full: 3500 },
  plumbing: { partial: 1000, full: 2500 },
  bathroom: 50000,
  tile: { fixed: 10000, under4: 10000, from4: 8000, from10: 4000, from20: 3000, from40: 2500 },
  laminate: 1000,
  plasticPlinth: 400,
  polyurethanePlinth: 1300,
  walls: { wallpaper: 1500, paint: 4000, decorative: 2500 },
  cleanElectrical: { under40: 1000, from40to80: 700, from80to150: 600, over150: 500 },
  cleanPlumbing: 6000,
  cleaning: 400,
  trash: { upTo150: 1000, over150: 800 },
  windows: 20000
};

const n = (v) => Math.max(0, Number(v) || 0);
const rateTile = (a,r) => a < 4 ? r.under4 : a < 10 ? r.from4 : a < 20 ? r.from10 : a < 40 ? r.from20 : r.from40;
const rateCleanElectrical = (a,r) => a < 40 ? r.under40 : a <= 80 ? r.from40to80 : a <= 150 ? r.from80to150 : r.over150;
const rateTrash = (a,r) => a <= 150 ? r.upTo150 : r.over150;

function calculate(input = {}, rates = DEFAULT_RATES) {
  const floor = n(input.floor);
  const bath = n(input.bath);
  const balcony = n(input.balcony);
  const main = Math.max(0, floor - bath - balcony);
  const wallsArea = main * 2.8;
  const rows = [];
  // Клиентская цена рассчитывается с фиксированной внутренней наценкой 30%.
  // Наценка нигде не показывается и не передаётся как отдельный параметр.
  const add = (name, cost, quantity, unit = 'м²', price = 0) => {
    if (cost > 0) {
      const clientCost = Math.round(cost * HIDDEN_MULTIPLIER);
      const clientPrice = Math.round(price * HIDDEN_MULTIPLIER * 100) / 100;
      rows.push({
        name,
        quantity: Math.round(quantity*100)/100,
        unit,
        price: clientPrice,
        cost: clientCost
      });
    }
  };

  const electrical = input.electrical || 'none';
  if (electrical === 'partial') add('Электрика — частичная замена', floor*rates.electrical.partial, floor, 'м²', rates.electrical.partial);
  if (electrical === 'full') add('Электрика — полная замена', floor*rates.electrical.full, floor, 'м²', rates.electrical.full);
  if (electrical === 'manual') { const p=n(input.electricalRate); add('Электрика — ручная цена', floor*p, floor, 'м²', p); }

  const plumbing = input.plumbing || 'none';
  if (plumbing === 'partial') add('Сантехника — частичная замена', floor*rates.plumbing.partial, floor, 'м²', rates.plumbing.partial);
  if (plumbing === 'full') add('Сантехника — полная замена', floor*rates.plumbing.full, floor, 'м²', rates.plumbing.full);
  if (plumbing === 'manual') { const p=n(input.plumbingRate); add('Сантехника — ручная цена', floor*p, floor, 'м²', p); }

  const bathroom = input.bathroom || 'none';
  if (bathroom === 'classic') add('Классический санузел', bath*rates.bathroom, bath, 'м²', rates.bathroom);
  if (bathroom === 'manual') { const q=n(input.bathroomArea); add('Санузел — ручная площадь', q*rates.bathroom, q, 'м²', rates.bathroom); }

  let tileArea=0;
  if (input.tile === 'fixed') { tileArea=main; add('Плитка', main*rates.tile.fixed, main, 'м²', rates.tile.fixed); }
  if (input.tile === 'manual') { tileArea=Math.min(main,n(input.tileArea)); const p=rateTile(tileArea,rates.tile); add('Плитка — ручная площадь', tileArea*p, tileArea, 'м²', p); }
  if (input.laminate) { const q=Math.max(0,main-tileArea); add('Ламинат / кварцвинил',q*rates.laminate,q,'м²',rates.laminate); }

  if (input.plinth === 'plastic') { const q=n(input.plasticQty)||main; add('Плинтус пластиковый',q*rates.plasticPlinth,q,'м²',rates.plasticPlinth); }
  if (input.plinth === 'polyurethane') { const q=n(input.polyQty)||main; add('Плинтус полиуретановый',q*rates.polyurethanePlinth,q,'м²',rates.polyurethanePlinth); }

  const wallItems = [
    ['wallpaper','Подготовка под обои + обои',rates.walls.wallpaper],
    ['paint','Подготовка под покраску + покраска',rates.walls.paint],
    ['decorative','Подготовка под декоративку + декоративка',rates.walls.decorative]
  ].filter(([k]) => input.walls?.[k]);
  const manualWall = wallItems.reduce((s,[k]) => s+n(input.walls?.[k]?.area),0);
  const autoWall = wallItems.filter(([k]) => n(input.walls?.[k]?.area)<=0);
  const remain = Math.max(0,wallsArea-manualWall);
  for (const [k,name,p] of wallItems) { const q=n(input.walls?.[k]?.area)|| (autoWall.length ? remain/autoWall.length : 0); add(name,q*p,q,'м²',p); }

  if (n(input.windows) > 0) add('Окна', n(input.windows)*rates.windows, n(input.windows), 'шт.', rates.windows);

  if (input.cleanElectrical) { const p=rateCleanElectrical(floor,rates.cleanElectrical); add('Чистовая электрика',floor*p,floor,'м²',p); }
  if (input.cleanPlumbing) add('Чистовая сантехника',bath*rates.cleanPlumbing,bath,'м² санузла',rates.cleanPlumbing);
  if (input.cleaning) add('Клининг',floor*rates.cleaning,floor,'м²',rates.cleaning);
  if (input.trash) { const p=rateTrash(floor,rates.trash); add('Вывоз мусора',floor*p,floor,'м²',p); }

  for (const w of (input.customWorks||[])) { const q=n(w.quantity); const p=n(w.price); add(String(w.name||'Работа'),q*p,q,w.unit||'м²',p); }

  // rows уже содержат конечные клиентские цены с внутренней наценкой 30%.
  // Поэтому дополнительную наценку к subtotal/total не применяем.
  const subtotal = rows.reduce((s,x)=>s+x.cost,0);
  const total = subtotal;
  return {
    floor,
    bath,
    balcony,
    mainArea:main,
    wallsArea:Math.round(wallsArea*100)/100,
    rows,
    subtotal,
    total,
    pricePerM2:floor?Math.round(total/floor*100)/100:0
  };
}

module.exports = { calculate, DEFAULT_RATES };

