/* ============================================================================
 * FINTEX — Основное ядро приложения, аналитика, жесты и синхронизация
 * Файл: app.js
 * ============================================================================ */

const FM = window.FintexMath;
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function vibro(type = 'light') {
  try {
    if (tg?.HapticFeedback) {
      if (type === 'selection') tg.HapticFeedback.selectionChanged();
      else if (['success', 'warning', 'error'].includes(type)) tg.HapticFeedback.notificationOccurred(type);
      else tg.HapticFeedback.impactOccurred(type);
    }
  } catch (e) {}
}

const ADMIN_ID = '8141670312';
const USER_ID = (() => {
  const tgId = tg?.initDataUnsafe?.user?.id;
  if (tgId) return String(tgId);
  let guestId = localStorage.getItem('fp_guest_uid');
  if (!guestId) {
    guestId = 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    localStorage.setItem('fp_guest_uid', guestId);
  }
  return guestId;
})();
const DEFAULT_GAS_URL = window.FintexCloud.defaultEndpoint;

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstGrapheme(str, fallback = 'F') {
  const chars = Array.from((str || '').trim());
  return chars.length ? chars[0].toUpperCase() : fallback;
}

function localDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function offsetDateISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
function nextMonthISO(iso) { return FM.nextMonth(iso || TODAY) || FM.nextMonth(TODAY); }

function getTodayISO() { return offsetDateISO(0); }
function getYesterdayISO() { return offsetDateISO(-1); }
Object.defineProperty(window, 'TODAY', { get: getTodayISO, configurable: true });
Object.defineProperty(window, 'YESTERDAY', { get: getYesterdayISO, configurable: true });

function fmtN(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function fmtR(n, prefix = '') {
  return `${prefix}${FM.money(n).toLocaleString('ru-RU', {maximumFractionDigits:2})} ₽`;
}

function greetingWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

function humanDate(iso) {
  if (!iso) return '';
  if (iso === TODAY) return 'Сегодня';
  if (iso === YESTERDAY) return 'Вчера';
  const mNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const p = iso.split('-');
  if (p.length < 3) return iso;
  return `${parseInt(p[2], 10)} ${mNames[parseInt(p[1], 10) - 1]}`;
}

function daysLeft(iso) { return FM.daysUntil(iso, TODAY); }

// ==================== БАРАБАННЫЙ СЧЁТЧИК ЦИФР (ODOMETER ROLL) ====================
function animateCounter(el, target, fromZero = false) {
  if (!el) return;
  const num = FM.money(target);
  const prevVal = fromZero ? 0 : Number(el.dataset.val || 0);
  el.dataset.val = num;
  const motionOn = localStorage.getItem('fp_motion') !== '0' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const formatted = fmtN(num);
  window.FintexNumerals.render(el,num);
  if (!motionOn || prevVal === num || num < 0 || !Number.isInteger(num)) return;

  const prevStr = fmtN(prevVal).padStart(formatted.length, '0');
  let digitIdx = 0;
  const htmlParts = Array.from(formatted).map((ch, idx) => {
    if (!/\d/.test(ch)) {
      return `<span class="inline-block">${ch === ' ' ? '&nbsp;' : ch}</span>`;
    }
    const targetDigit = Number(ch);
    const startDigit = /\d/.test(prevStr[idx]) ? Number(prevStr[idx]) : 0;
    const delay = digitIdx * 36;
    digitIdx++;
    const digitsHtml = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>';
    return `<span class="odo-col"><span class="odo-reel" data-target-digit="${targetDigit}" style="transform: translateY(-${startDigit * 10}%); transition-delay: ${delay}ms;">${digitsHtml}</span></span>`;
  });

  el.querySelector('.number-major').innerHTML = `<span class="odo-wrap">${htmlParts.join('')}</span>`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.querySelectorAll('.odo-reel').forEach(reel => {
        const d = Number(reel.dataset.targetDigit || 0);
        reel.style.transform = `translateY(-${d * 10}%)`;
      });
    });
  });
}

const CATS = {
  food:  { id: 'food',  name: 'Продукты', icon: 'shopping-bag', color: '#00D6C3', bg: 'rgba(0,214,195,0.12)' },
  taxi:  { id: 'taxi',  name: 'Транспорт', icon: 'car', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  cafe:  { id: 'cafe',  name: 'Рестораны', icon: 'utensils', color: '#F2C65D', bg: 'rgba(242,198,93,0.12)' },
  fun:   { id: 'fun',   name: 'Развлечения', icon: 'gamepad-2', color: '#FB7185', bg: 'rgba(251,113,133,0.12)' },
  subs:  { id: 'subs',  name: 'Подписки', icon: 'repeat', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  shop:  { id: 'shop',  name: 'Покупки', icon: 'shopping-cart', color: '#20C997', bg: 'rgba(32,201,151,0.12)' },
  health:{ id: 'health',name: 'Здоровье', icon: 'heart-pulse', color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
  other: { id: 'other', name: 'Прочее', icon: 'layers', color: '#8B9C97', bg: 'rgba(139,156,151,0.12)' }
};

function normalizeMerchantName(rawTitle) {
  let s = String(rawTitle || '')
    .replace(/\b(купил[аи]?|потратил[аи]?|оплатил[аи]?|заправил[аи]?сь?|сходил[аи]?|взял[аи]?|заказал[аи]?|покупка|оплата)\b/gi, ' ')
    .replace(/\b(на|в|во|за|из|от|до|по)\s+(руб\.?|рублей|рубля|₽)\b/gi, ' ')
    .replace(/\b(руб\.?|рублей|рубля|₽)\b/gi, ' ')
    .replace(/^[вво]\s+(?=[а-яa-z])/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return 'Покупка';

  const canonicalMap = [
    [/пятер[оё]?ч[а-я]*|пятерч|pyaterochka/i, 'Пятёрочка'],
    [/магнит[а-я]*|magnit/i, 'Магнит'],
    [/вкусвилл[а-я]*|vkusvill/i, 'ВкусВилл'],
    [/перекр[её]ст[а-я]*|perekrestok/i, 'Перекрёсток'],
    [/лент[ауеы]|lenta/i, 'Лента'],
    [/ашан[а-я]*|auchan/i, 'Ашан'],
    [/дикси|dixy/i, 'Дикси'],
    [/красное\s*(?:и|&)\s*белое|\bкб\b/i, 'Красное & Белое'],
    [/бристол[ья]?|bristol/i, 'Бристоль'],
    [/монетк[ауеи]/i, 'Монетка'],
    [/чижик[а-я]*/i, 'Чижик'],
    [/светофор[а-я]*/i, 'Светофор'],
    [/самокат[а-я]*|samokat/i, 'Самокат'],
    [/яндекс\s*лавк[ауи]/i, 'Яндекс Лавка'],
    [/wildberries|вайлдберриз|\bвб\b|\bwb\b/i, 'Wildberries'],
    [/ozon|озон/i, 'Ozon'],
    [/яндекс\s*маркет/i, 'Яндекс Маркет'],
    [/\bdns\b|днс/i, 'DNS'],
    [/м\.?видео|mvideo/i, 'М.Видео'],
    [/золотое\s*яблоко|goldapple/i, 'Золотое Яблоко'],
    [/яндекс\s*go|yandex\s*go|такси/i, 'Яндекс Go'],
    [/лукойл[а-я]*|lukoil/i, 'Лукойл'],
    [/газпромнефт[ьи]|газпром/i, 'Газпромнефть'],
    [/роснефт[ьи]|нефть-ресурс/i, 'Роснефть'],
    [/татнефт[ьи]/i, 'Татнефть'],
    [/^азс$/i, 'АЗС'],
    [/азс\s*№?\s*\d+|заправк[ауи]|бензин/i, 'АЗС · Топливо'],
    [/вкусно.*точк[ауи]/i, 'Вкусно — и точка'],
    [/rostic|ростикс|kfc/i, 'Rostic’s'],
    [/додо|dodo/i, 'Додо Пицца'],
    [/лекарств[а-я]*|аптек[ауи]|таблетк[а-я]*|витамин[а-я]*/i, 'Аптека'],
    [/автозапчаст[а-я]*|запчаст[а-я]*|автосервис|шиномонтаж|\bсто\b/i, 'Автозапчасти и сервис'],
    [/парикмахер[а-я]*|барбер[а-я]*|стрижк[ауи]|салон\s*красот/i, 'Салон красоты'],
    [/яндекс\s*плюс|yandex\s*plus/i, 'Яндекс Плюс'],
    [/кинопоиск/i, 'Кинопоиск'],
    [/\bмтс\b|mts/i, 'МТС'],
    [/билайн|beeline/i, 'Билайн'],
    [/мегафон|megafon/i, 'МегаФон'],
    [/tele2|теле2|\bt2\b/i, 't2 (Tele2)']
  ];

  for (const [re, canonical] of canonicalMap) {
    if (re.test(s)) return canonical;
  }

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function classifyCategory(title) {
  const low = (title || '').toLowerCase();
  if (/пятёроч|пятероч|пятерч|магнит|вкусвилл|перекрёст|перекрест|лента|ашан|дикси|монетк|чижик|светофор|самокат|лавка|красное.*белое|бристол|молок|хлеб|сыр|мясо|овощ|фрукт|круассан|батон|вода|сок|продукт/i.test(low)) return 'food';
  if (/бензин|азс|заправк|нефть|лукойл|газпром|роснефть|татнефть|такси|яндекс go|uber|метро|проезд|транспорт|автозапчаст|запчаст|шиномонтаж|аи-95|аи-92/i.test(low)) return 'taxi';
  if (/кофе|капучино|латте|американо|кафе|ресторан|бургер|пицц|суши|шаурм|обед|выпечк|вкусно|ростикс|додо/i.test(low)) return 'cafe';
  if (/ozon|озон|wildberries|вайлдберриз|вб|wb|одежд|обув|техник|dns|днс|мвидео|м\.видео|золотое яблоко/i.test(low)) return 'shop';
  if (/подписк|плюс|связь|мтс|билайн|мегафон|теле2|t2|интернет|кинопоиск|telegram|apple|icloud/i.test(low)) return 'subs';
  if (/кино|театр|билет|музей|парк|развлечен|игр/i.test(low)) return 'fun';
  if (/аптек|лекарств|таблет|витамин|врач|стоматолог|клиник|здоров/i.test(low)) return 'health';
  return 'other';
}

// ==================== РЕАЛЬНЫЕ ЛОГОТИПЫ КОМПАНИЙ И ИКОНКИ ПРОДУКТОВ/УСЛУГ ====================
const BRAND_REGISTRY = [
  // Банки
  { re: /т-банк|тинькофф|t-bank|tinkoff/i, bg: '#FFDD2D', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M4 4h16v6l-8 10L4 10V4z" fill="#1A1A1A"/><path d="M8 7h8v2.2h-2.8V15h-2.4V9.2H8V7z" fill="#FFDD2D"/></svg>' },
  { re: /сбер|sber/i, bg: '#21A038', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#FFF" stroke-width="2.2" stroke-dasharray="40 12"/><path d="M8.5 11.8l2.6 2.5 5.4-5" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { re: /альфа|alfa/i, bg: '#EF3124', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M12 4.5L7 16h2.4l1-2.5h3.2l1 2.5H17L12 4.5zm-0.9 7l0.9-2.4 0.9 2.4h-1.8zM6.5 18h11v2h-11v-2z" fill="#FFF"/></svg>' },
  { re: /втб|vtb/i, bg: '#002882', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M5 7h15l-1 2.4H4L5 7zm-0.8 3.8h15l-1 2.4h-15l1-2.4zm-0.8 3.8h15l-1 2.4h-15l1-2.4z" fill="#38BDF8"/></svg>' },
  { re: /ozon\s*банк|озон\s*банк/i, bg: '#005BFF', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6.5" stroke="#FFF" stroke-width="2.8"/></svg>' },
  { re: /газпромбанк|гпб/i, bg: '#0072CE', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M16 9.5A5 5 0 1 0 16.5 14H12v-2.2h6.5" stroke="#FFF" stroke-width="2.4" stroke-linecap="round"/></svg>' },
  { re: /яндекс\s*пэй|yandex\s*pay|яндекс\s*банк/i, bg: '#FFCC00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#1A1A1A" font-size="11" font-weight="800">ЯП</text></svg>' },
  { re: /райффайзен|raiffeisen/i, bg: '#FEE600', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="#1A1A1A" stroke-width="2.8" stroke-linecap="round"/></svg>' },
  { re: /совкомбанк|халва|sovcombank/i, bg: '#005AA9', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FF3B30" font-size="11" font-weight="800">Х</text></svg>' },
  { re: /мтс\s*банк|mts\s*bank/i, bg: '#E30611', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="9.5" font-weight="800">МТС</text></svg>' },
  // Супермаркеты, аптеки, авто и доставка
  { re: /пятёроч|пятероч|пятерч|pyaterochka/i, bg: '#E52322', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M13 4c2.5 0 4.5 1.5 5 3.5-2.2.3-4.2-.6-5-3.5z" fill="#4ADE80"/><path d="M8.5 7.5h7v2.3h-4.7v2.3c.6-.3 1.3-.4 2.1-.4 2.5 0 4.3 1.6 4.3 4s-2 4.1-4.8 4.1c-2.2 0-3.9-1-4.5-2.6l2.2-1c.4.9 1.2 1.4 2.2 1.4 1.3 0 2.2-.8 2.2-1.9s-.9-1.9-2.2-1.9c-.9 0-1.6.3-2.1.9l-1.9-.6.7-6.6z" fill="#FFF"/></svg>' },
  { re: /красное.*белое|\bкб\b/i, bg: '#D91E2A', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="10.5" font-weight="800">К&amp;Б</text></svg>' },
  { re: /монетк/i, bg: '#E30613', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="#FFDD00"/><text x="12" y="15.5" text-anchor="middle" fill="#E30613" font-size="10.5" font-weight="800">М</text></svg>' },
  { re: /чижик/i, bg: '#FFCC00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#1A1A1A" font-size="10.5" font-weight="800">Ч</text></svg>' },
  { re: /аптек|лекарств|таблет|витамин|здравсити|ригла|горздрав/i, bg: '#10B981', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="#FFF" stroke-width="3.2" stroke-linecap="round"/></svg>' },
  { re: /автозапчаст|запчаст|автосервис|шиномонтаж|exist|autodoc/i, bg: '#334155', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/></svg>' },
  { re: /магнит|magnit/i, bg: '#E60012', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M5 18V6h3.2l3.8 6.2L15.8 6H19v12h-2.8v-7.2L12 17.2 7.8 10.8V18H5z" fill="#FFF"/></svg>' },
  { re: /вкусвилл|vkusvill/i, bg: '#1E8E3E', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="11" font-weight="800" font-family="Inter,sans-serif">ВВ</text></svg>' },
  { re: /перекрёст|перекрест/i, bg: '#007A33', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#A3E635" stroke-width="3.2" stroke-linecap="round"/></svg>' },
  { re: /лента|lenta/i, bg: '#003C96', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#FFDD00"/><circle cx="12" cy="12" r="2.2" fill="#003C96"/></svg>' },
  { re: /дикси|dixy/i, bg: '#F37021', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">Д</text></svg>' },
  { re: /ашан|auchan/i, bg: '#E2001A', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">А</text></svg>' },
  { re: /самокат|samokat/i, bg: '#FF335F', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" stroke="#FFF" stroke-width="2.6"/></svg>' },
  // Маркетплейсы и электроника
  { re: /wildberries|вайлдберриз|\bвб\b|\bwb\b/i, bg: 'linear-gradient(135deg,#CB11AB,#481173)', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="10.5" font-weight="800" font-family="Inter,sans-serif">WB</text></svg>' },
  { re: /ozon|озон/i, bg: '#005BFF', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6.5" stroke="#FFF" stroke-width="2.8"/></svg>' },
  { re: /яндекс\s*маркет/i, bg: '#FFCC00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M6 17V7h3.2l2.8 5.2L14.8 7H18v10h-2.5v-5.8L12 16.5l-3.5-5.3V17H6z" fill="#1A1A1A"/></svg>' },
  { re: /\bdns\b|днс/i, bg: '#FF6B00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="9.5" font-weight="800">DNS</text></svg>' },
  { re: /м\.?видео|mvideo/i, bg: '#E31E24', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">М</text></svg>' },
  { re: /золотое\s*яблоко|goldapple/i, bg: '#C5E800', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#111" font-size="10" font-weight="800">GA</text></svg>' },
  // Такси, АЗС, транспорт
  { re: /яндекс\s*go|yandex\s*go|такси/i, bg: '#FFCC00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><rect x="4" y="4" width="8" height="8" fill="#1A1A1A"/><rect x="12" y="12" width="8" height="8" fill="#1A1A1A"/></svg>' },
  { re: /лукойл|lukoil/i, bg: '#ED1C24', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">Л</text></svg>' },
  { re: /газпромнефть|газпром/i, bg: '#0079C2', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M12 5c2.8 3.5 4.5 5.8 4.5 8.5a4.5 4.5 0 1 1-9 0C7.5 10.8 9.2 8.5 12 5z" fill="#FFF"/></svg>' },
  { re: /роснефть|нефть-ресурс|азс/i, bg: '#FFD200', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M12 5c2.8 3.5 4.5 5.8 4.5 8.5a4.5 4.5 0 1 1-9 0C7.5 10.8 9.2 8.5 12 5z" fill="#1A1A1A"/></svg>' },
  { re: /ржд/i, bg: '#E21A1A', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="9.5" font-weight="800">РЖД</text></svg>' },
  // Кафе и рестораны
  { re: /вкусно.*точка/i, bg: '#00573F', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><circle cx="8" cy="15" r="2.2" fill="#FF6B00"/><path d="M12 7l2.2 10M15.8 7L18 17" stroke="#FF6B00" stroke-width="2.4" stroke-linecap="round"/></svg>' },
  { re: /rostic|ростикс|kfc/i, bg: '#E4002B', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">R</text></svg>' },
  { re: /додо|dodo/i, bg: '#FF6900', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">D</text></svg>' },
  { re: /surf\s*coffee|stars\s*coffee|кофе/i, bg: '#1E1E1E', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M6 9h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9zm10 1h2a2 2 0 0 1 0 4h-2" stroke="#F2C65D" stroke-width="2"/></svg>' },
  // Подписки и связь
  { re: /яндекс\s*плюс|yandex\s*plus/i, bg: 'linear-gradient(135deg,#7B2CBF,#FF5400)', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="#FFF" stroke-width="3" stroke-linecap="round"/></svg>' },
  { re: /кинопоиск/i, bg: '#FF5500', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="11" font-weight="800">КП</text></svg>' },
  { re: /мтс|mts/i, bg: '#E30611', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="9.5" font-weight="800">МТС</text></svg>' },
  { re: /билайн|beeline/i, bg: '#FFCC00', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="3" fill="#1A1A1A"/><rect x="4" y="12" width="16" height="3" fill="#1A1A1A"/><rect x="4" y="18" width="16" height="2" fill="#1A1A1A"/></svg>' },
  { re: /мегафон|megafon/i, bg: '#00B956', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><circle cx="10" cy="12" r="2" fill="#FFF"/><circle cx="15" cy="9" r="1.6" fill="#FFF"/><circle cx="15" cy="15" r="1.6" fill="#FFF"/></svg>' },
  { re: /tele2|теле2|\bt2\b/i, bg: '#1F2229', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FF3366" font-size="11" font-weight="800">t2</text></svg>' },
  { re: /telegram|телеграм/i, bg: '#26A5E4', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M18.5 6.5L5.5 11.5l3.5 1.3 1.4 4.2 2.2-2.1 3.7 2.7 2.2-11.1z" fill="#FFF"/></svg>' },
  { re: /apple|icloud|app\s*store/i, bg: '#1D1D1F', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M15.5 12.6c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3z" fill="#FFF"/></svg>' },
  { re: /spotify/i, bg: '#1DB954', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M6.5 9.5c3.5-1 7.5-.8 10.5.8M7.5 12.8c2.8-.8 6-.6 8.5.7M8.5 16c2.2-.6 4.6-.4 6.5.5" stroke="#FFF" stroke-width="2" stroke-linecap="round"/></svg>' },
  { re: /иви|\bivi\b/i, bg: '#EA003D', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="11" font-weight="800">ivi</text></svg>' },
  { re: /okko|окко/i, bg: '#5B2EFF', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="15.5" text-anchor="middle" fill="#FFF" font-size="9.5" font-weight="800">okko</text></svg>' },
  { re: /\bvk\b|вк/i, bg: '#0077FF', svg: '<svg class="w-5 h-5" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" fill="#FFF" font-size="11" font-weight="800">VK</text></svg>' }
];

function merchantBadge(name, catId, type = 'expense') {
  if (type === 'income') {
    return `<div class="w-9 h-9 rounded-xl bg-[#00D6C3]/15 text-brand flex items-center justify-center shrink-0"><i data-lucide="arrow-down-left" class="w-4 h-4"></i></div>`;
  }
  const raw = (name || '').trim();
  for (const b of BRAND_REGISTRY) {
    if (b.re.test(raw)) {
      return `<div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style="background:${b.bg};">${b.svg}</div>`;
    }
  }
  const c = CATS[catId] || CATS.other;
  return `<div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${c.bg}; color:${c.color}"><i data-lucide="${c.icon}" class="w-4 h-4"></i></div>`;
}

function getProductIconBadge(itemName, catId = 'other') {
  const low = (itemName || '').toLowerCase();
  let icon = 'package';
  let color = '#00D6C3';
  let bg = 'rgba(0,214,195,0.12)';

  if (/молок|кефир|сыр|творог|йогурт|сметан|масло/i.test(low)) { icon = 'milk'; color = '#38BDF8'; bg = 'rgba(56,189,248,0.14)'; }
  else if (/хлеб|батон|круассан|булк|выпечк|печень|торт/i.test(low)) { icon = 'croissant'; color = '#F2C65D'; bg = 'rgba(242,198,93,0.14)'; }
  else if (/мясо|куриц|филе|говядин|свинин|колбас|сосиск|рыб|лосос/i.test(low)) { icon = 'beef'; color = '#FB7185'; bg = 'rgba(251,113,133,0.14)'; }
  else if (/яблок|банан|овощ|фрукт|томат|помидор|огурц|картоф|морков/i.test(low)) { icon = 'apple'; color = '#20C997'; bg = 'rgba(32,201,151,0.14)'; }
  else if (/кофе|капучино|латте|эспрессо|чай|вода|сок|напит|кола/i.test(low)) { icon = 'coffee'; color = '#F2C65D'; bg = 'rgba(242,198,93,0.14)'; }
  else if (/бензин|аи-95|аи-92|дизел|топлив/i.test(low)) { icon = 'fuel'; color = '#38BDF8'; bg = 'rgba(56,189,248,0.14)'; }
  else if (/такси|поездк|проезд|метро|билет/i.test(low)) { icon = 'car'; color = '#38BDF8'; bg = 'rgba(56,189,248,0.14)'; }
  else if (/аптек|лекарств|таблет|витамин|крем|шампун/i.test(low)) { icon = 'pill'; color = '#FB7185'; bg = 'rgba(251,113,133,0.14)'; }
  else if (/подписк|связь|тариф|интернет|плюс/i.test(low)) { icon = 'wifi'; color = '#A78BFA'; bg = 'rgba(167,139,250,0.14)'; }
  else if (/одежд|обув|футболк|куртк|джинс|кроссовк/i.test(low)) { icon = 'shirt'; color = '#20C997'; bg = 'rgba(32,201,151,0.14)'; }
  else if (CATS[catId]) { icon = CATS[catId].icon; color = CATS[catId].color; bg = CATS[catId].bg; }

  return `<span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:${bg}; color:${color}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>`;
}

// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
let state = {
  name: (localStorage.getItem('fp_name') || '').trim(),
  bank: localStorage.getItem('fp_bank') || 'Т-Банк',
  balance: FM.money(localStorage.getItem('fp_balance') ?? '22200'),
  payday: localStorage.getItem('fp_payday') || offsetDateISO(12),
  goal: safeJsonParse(localStorage.getItem('fp_goal'), { title: 'Финансовая подушка', saved: 0, target: 10000 }),
  catLimits: safeJsonParse(localStorage.getItem('fp_cat_limits'), {}),
  privacyMode: localStorage.getItem('fp_privacy') === '1',
  lastSyncText: 'сегодня',
  transactions: safeJsonParse(localStorage.getItem('fp_local_tx'), []),
  bills: safeJsonParse(localStorage.getItem('fp_bills'), [{ id: 'b1', title: 'Яндекс Плюс', amount: 399, due_date: offsetDateISO(4), is_paid: false, is_recurring: true }]),
  scanHistory: safeJsonParse(localStorage.getItem('fp_scan_history'), []),
  priceHistory: safeJsonParse(localStorage.getItem('fp_price_history'), {}),
  gasUrl: window.FintexCloud.getEndpoint(),
  apiToken: localStorage.getItem('fp_api_token') || '',
  syncQueue: safeJsonParse(localStorage.getItem('fp_sync_queue'), []),
  autopilotLogs: safeJsonParse(localStorage.getItem('fp_ap_logs'), []),
  autopilotLogFilter: 'ALL',
  pendingSmsOcrOp: null,
  clipboardCandidate: null,
  iosWizardBank: 'Т-Банк',
  testedSmsOp: null,
  selectedPriceKey: null,
  filterCat: 'all',
  analyticsMode: 'cycle',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelected: TODAY,
  calFilter: 'all',
  editTxId: null,
  addMode: 'expense',
  currentScan: null,
  pendingImport: [],
  onboardingStep: 0,
  secretTapCount: 0
};

function persistAll() {
  localStorage.setItem('fp_name', state.name);
  localStorage.setItem('fp_bank', state.bank);
  localStorage.setItem('fp_balance', String(state.balance));
  localStorage.setItem('fp_payday', state.payday);
  localStorage.setItem('fp_goal', JSON.stringify(state.goal));
  localStorage.setItem('fp_cat_limits', JSON.stringify(state.catLimits));
  localStorage.setItem('fp_local_tx', JSON.stringify(state.transactions));
  localStorage.setItem('fp_bills', JSON.stringify(state.bills));
  localStorage.setItem('fp_scan_history', JSON.stringify(state.scanHistory));
  localStorage.setItem('fp_price_history', JSON.stringify(state.priceHistory));
  try { window.dispatchEvent(new Event('filely:financial-data-updated')); } catch (e) {}
}

// ==================== ТЕМА И АНИМАЦИИ ====================
function setTheme(mode) {
  window.FintexAppearance.setMode(mode);
}
function setVisualStyle(style) {
  window.FintexAppearance.setStyle(style);
}

function applyMotionPref() {
  const enabled = localStorage.getItem('fp_motion') !== '0';
  document.documentElement.classList.toggle('no-motion', !enabled);
  const cb = document.getElementById('motion-toggle');
  if (cb) cb.checked = enabled;
  if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) stopOperationReveals();
  window.dispatchEvent(new Event('fintex:motionchange'));
}

function toggleMotionPref() {
  const cb = document.getElementById('motion-toggle');
  localStorage.setItem('fp_motion', cb?.checked ? '1' : '0');
  applyMotionPref();
  vibro('selection');
  toast(cb?.checked ? 'Анимации включены' : 'Анимации отключены');
}

// ==================== ONBOARDING В СТИЛЕ ПЕРВОГО ВХОДА OZON ====================
function initOnboardingFlow() {
  const onboarded = localStorage.getItem('fp_onboarded') === '1' && Boolean(state.name);
  if (!onboarded) {
    state.onboardingStep = 0;
    document.getElementById('setup-payday').value = state.payday;
    document.getElementById('onboarding-screen').classList.remove('hidden');
    renderOnboardingStep();
  } else {
    window.launchSproutEntrance?.();
  }
  lucide.createIcons();
}

function dismissReturningSplash() {
  window.FintexEntrance?.dismiss();
}

function replayMotionSplash() {
  window.launchSproutEntrance?.();
}

function replayFullOnboarding() {
  state.onboardingStep = 0;
  document.getElementById('setup-name').value = state.name;
  document.getElementById('setup-balance').value = state.balance;
  document.getElementById('setup-payday').value = state.payday;
  document.getElementById('ob-skip-btn').classList.remove('hidden');
  document.getElementById('onboarding-screen').classList.remove('hidden');
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const step = state.onboardingStep;
  [0, 1, 2, 3].forEach(i => document.getElementById(`ob-slide-${i}`).classList.toggle('hidden', i !== step));
  document.querySelectorAll('#ob-progress-bars > div').forEach((b, i) => {
    b.className = `h-1 rounded-full transition-all ${i <= step ? 'bg-[#00D6C3]' : 'bg-white/15'}`;
  });
  const btnText = document.getElementById('ob-next-text');
  const skipBtn = document.getElementById('ob-skip-btn');
  if (step === 0) btnText.textContent = 'Познакомиться с FINTEX';
  else if (step === 1) btnText.textContent = 'Дальше';
  else if (step === 2) btnText.textContent = 'Перейти к настройке';
  else {
    btnText.textContent = 'Начать пользоваться FINTEX';
    skipBtn.classList.add('hidden');
  }
  lucide.createIcons();
}

function nextOnboardingStep() {
  vibro('light');
  if (state.onboardingStep < 3) {
    state.onboardingStep++;
    renderOnboardingStep();
    return;
  }
  const nameVal = document.getElementById('setup-name').value.trim();
  if (!nameVal) {
    vibro('error');
    toast('Пожалуйста, укажите ваше имя');
    document.getElementById('setup-name').focus();
    return;
  }
  state.name = nameVal;
  state.balance = Math.max(0, Number(document.getElementById('setup-balance').value) || 0);
  state.payday = document.getElementById('setup-payday').value || offsetDateISO(12);
  localStorage.setItem('fp_onboarded', '1');
  persistAll();

  document.getElementById('onboarding-screen').classList.add('hidden');
  vibro('success');
  renderAll(true);
  toast(`Добро пожаловать, ${state.name}!`);
  syncWithBackend(false);
}

function jumpToOnboardingSetup() {
  vibro('light');
  state.onboardingStep = 3;
  renderOnboardingStep();
}

function restartOnboardingSetup() {
  state.onboardingStep = 3;
  document.getElementById('setup-name').value = state.name;
  document.getElementById('setup-balance').value = state.balance;
  document.getElementById('setup-payday').value = state.payday;
  document.getElementById('onboarding-screen').classList.remove('hidden');
  renderOnboardingStep();
}

function pickBank(btn, bank) {
  vibro('light');
  state.bank = bank;
  document.querySelectorAll('.bank-opt').forEach(b => b.className = 'bank-opt p-2.5 rounded-xl border text-left flex items-center gap-2 tap input-surface');
  btn.className = 'bank-opt p-2.5 rounded-xl border text-left flex items-center gap-2 tap btn-teal-soft';
}

// ==================== ДЕТЕРМИНИРОВАННЫЙ ХЭШ ДЕДУПЛИКАЦИИ И ОБЪЕДИНЕНИЕ ОПЕРАЦИЙ ====================
function computeClientDedupHash(dateIso, timeStr, amount, type, merchant, rawSig = '') {
  const normMerch = String(merchant || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').slice(0, 24);
  const normSig = String(rawSig || '').toLowerCase().replace(/\s+/g, '').slice(0, 64);
  const base = `${USER_ID}|${dateIso}|${timeStr || '00:00'}|${FM.minor(amount)}|${type}|${normMerch}|${normSig}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < base.length; i++) {
    const c = base.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (c + i);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return 'h_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function appendLocalAutopilotLog(status, bank, summary, rawPreview = '', errorCode = '') {
  state.autopilotLogs.unshift({
    log_id: 'loc_' + Date.now() + '_' + Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString(),
    uid: USER_ID,
    source: 'iPhone Client',
    status,
    bank: bank || state.bank,
    summary,
    raw_preview: String(rawPreview || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    error_code: errorCode
  });
  state.autopilotLogs = state.autopilotLogs.slice(0, 40);
  localStorage.setItem('fp_ap_logs', JSON.stringify(state.autopilotLogs));
}

function addOrMergeTransactions(incomingList, sourceName) {
  let addedCount = 0;
  let mergedCount = 0;
  let balanceDelta = 0;
  const added = [];
  const nowTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  incomingList.forEach((item, idx) => {
    if (!item || (item.currency && !['RUB','₽','РУБ'].includes(String(item.currency).toUpperCase()))) return;
    const amt = Math.abs(FM.money(item.amount));
    if (amt <= 0) return;
    const type = item.type === 'income' ? 'income' : 'expense';
    const opKind = item.op_kind || type;
    const opLabel = item.op_label || (type === 'income' ? 'Пополнение' : 'Покупка');
    const date = item.date || TODAY;
    if (FM.ordinal(date) === null || date > TODAY) { toast('Операция должна иметь корректную дату не позднее сегодня. Для будущих трат используйте платежи.'); return; }
    const time = item.time || nowTime;
    const merchant = normalizeMerchantName(item.merchant || 'Операция');
    const cat = CATS[item.category] ? item.category : classifyCategory(merchant);
    const intentional = ['Вручную','Повтор','Пополнение','Подушка','Голос'].includes(sourceName);
    const token = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`;
    const dedupHash = item.dedup_hash || computeClientDedupHash(date, time, amt, type, merchant, intentional ? token : item.raw || item.scan_id || '');

    const existing = (!intentional || item.dedup_hash) && state.transactions.find(t =>
      (t.dedup_hash && t.dedup_hash === dedupHash) ||
      (t.date === date && (t.time || '') === time && FM.minor(t.amount) === FM.minor(amt) && t.type === type && t.merchant.toLowerCase() === merchant.toLowerCase()) ||
      (item.items && item.items.length > 0 && item.time && t.time === item.time && t.merchant.toLowerCase() === merchant.toLowerCase() && t.date === date && FM.minor(t.amount) === FM.minor(amt) && t.type === type)
    );

    if (existing) {
      mergedCount++;
      existing._justMerged = true;
      if (item.items && item.items.length > 0) {
        existing.items = item.items;
        existing.source = `${existing.source} + Чек`;
      }
      appendLocalAutopilotLog('DUPLICATE', item.bank || state.bank, `Дубль отклонён: ${merchant} (${fmtR(amt)})`, item.raw || '', 'DUPLICATE_HASH');
    } else {
      addedCount++;
      const transaction = {
        id: 'tx_' + token,
        scan_id: item.scan_id || '',
        ...(sourceName==='FINTEX Capture'?{bank:item.bank||'',capture_confidence:Number.isFinite(item.confidence)?item.confidence:null}:{}),
        dedup_hash: dedupHash,
        merchant,
        amount: amt,
        category: cat,
        type,
        op_kind: opKind,
        op_label: opLabel,
        source: sourceName,
        date,
        time,
        items: item.items || [],
        goal_withdrawal: sourceName==='Подушка' ? amt : 0
      };
      state.transactions.unshift(transaction);
      added.push(transaction);
      balanceDelta = FM.add(balanceDelta, type === 'income' ? amt : -amt);
      appendLocalAutopilotLog('OK', item.bank || state.bank, `${opLabel}: ${merchant} ${type === 'income' ? '+' : '-'}${fmtR(amt)} (${time})`, item.raw || '', '');
    }
  });

  if (addedCount > 0) {
    state.balance = FM.add(state.balance, balanceDelta);
    const card = document.getElementById('hero-balance-card');
    if (card) { card.classList.remove('hero-pulse-update'); void card.offsetWidth; card.classList.add('hero-pulse-update'); }
  }
  if (mergedCount > 0) {
    vibro('light');
    setTimeout(() => vibro('success'), 95);
  }
  persistAll();
  if (addedCount > 0) {
    pushTransactionsToBackend(added);
    try { window.FINTEX_EXT?.onTransactionsAdded?.(added); } catch (e) {}
  }
  return { addedCount, mergedCount, added };
}

// ==================== БЮДЖЕТ, РЕЙТИНГ, ДЕТЕКТИВ, КАЛЕНДАРЬ И АНАЛИТИКА ====================
function calcMetrics() { return FM.metrics(state, TODAY); }

function calcDetailedRating() {
  const m = calcMetrics();
  const expenses = FM.transactions(state.transactions,null,TODAY).filter(t => t.type === 'expense');
  const gSaved = Math.max(0, FM.money(state.goal?.saved));
  const gTarget = Math.max(0.01, FM.money(state.goal?.target) || 10000);

  if (!expenses.length && gSaved === 0) {
    return {
      ready: false, total: null, badge: 'Нет данных',
      factors: [
        { name: 'Контроль расходов', weight: 25, score: 0, tip: 'Добавьте первую операцию' },
        { name: 'Финансовая подушка', weight: 25, score: 0, tip: 'Отложите первые 500 ₽ в цель' },
        { name: 'Обязательства', weight: 20, score: 0, tip: 'Укажите обязательные платежи' },
        { name: 'Запас накоплений', weight: 20, score: 0, tip: 'Пополняйте подушку еженедельно' },
        { name: 'Стабильность бюджета', weight: 10, score: 0, tip: 'Статистика появится после начала учёта' }
      ]
    };
  }

  const paceRatio = m.dailyCap > 0 ? Math.max(0, 1 - (m.todaySpent / (m.dailyCap * 1.35))) : 0;
  const f1 = Math.min(25, Math.round(paceRatio * 25));
  const f2 = Math.min(25, Math.round((gSaved / gTarget) * 25));
  const debtRatio = state.balance > 0 ? Math.min(1, m.billsReserved / state.balance) : 0.6;
  const f3 = Math.max(4, Math.round((1 - debtRatio) * 20));
  const f4 = gSaved >= 5000 ? 20 : gSaved >= 1000 ? 14 : gSaved > 0 ? 8 : 3;
  const f5 = m.freePool > m.dailyCap * 3 ? 10 : m.freePool > 0 ? 6 : 2;
  const total = Math.min(100, f1 + f2 + f3 + f4 + f5);
  const badge = total >= 80 ? 'Сильный' : total >= 55 ? 'Устойчивый' : 'Зона роста';

  return {
    ready: true, total, badge,
    factors: [
      { name: 'Контроль расходов', weight: 25, score: f1, tip: f1 >= 20 ? 'Траты в рамках дневной нормы' : 'Соблюдайте лимит на день' },
      { name: 'Финансовая подушка', weight: 25, score: f2, tip: f2 >= 20 ? 'Отличный запас прочности' : `Пополните подушку на ${fmtN(Math.max(500, gTarget - gSaved))} ₽` },
      { name: 'Обязательства', weight: 20, score: f3, tip: f3 >= 15 ? 'Низкая нагрузка обязательных списаний' : 'Высокая доля регулярных платежей' },
      { name: 'Запас накоплений', weight: 20, score: f4, tip: gSaved > 0 ? 'Резерв сформирован' : 'Откладывайте с каждого поступления' },
      { name: 'Стабильность бюджета', weight: 10, score: f5, tip: m.freePool > 0 ? 'Свободный остаток защищён' : 'Свободный остаток исчерпан' }
    ]
  };
}

function detectSubscriptionsAndAnomalies() {
  const expenses = FM.transactions(state.transactions,FM.shift(TODAY,-29),TODAY).filter(t => t.type === 'expense');
  const subsMap = {};
  state.bills.filter(b => !b.is_paid && b.is_recurring).forEach(b => {
    subsMap[b.title.toLowerCase()] = { id: b.id, title: b.title, amount: Math.max(0,FM.money(b.amount)), source: 'Плановый платёж' };
  });

  const merchFreq = {};
  expenses.forEach(t => {
    const key = t.merchant.toLowerCase();
    if (!merchFreq[key]) merchFreq[key] = { title: t.merchant, amounts: [], count: 0, cat: t.category };
    merchFreq[key].amounts.push(t.amount);
    merchFreq[key].count += 1;
  });

  Object.entries(merchFreq).forEach(([key, info]) => {
    const isKnownSub = info.cat === 'subs' || /плюс|кинопоиск|spotify|ivi|okko|wink|icloud|telegram|мтс|билайн|мегафон|теле2|интернет/i.test(key);
    if ((isKnownSub || info.count >= 2) && !subsMap[key]) {
      const avgAmt = FM.money(FM.sum(info.amounts) / info.amounts.length);
      subsMap[key] = { id: 'auto_' + key, title: info.title, amount: avgAmt, source: 'Найдено автопилотом' };
    }
  });

  const subsList = Object.values(subsMap);
  const monthlySubs = FM.sum(subsList,x=>x.amount);
  const annualSubs = FM.money(monthlySubs * 12);

  const anomalies = [];
  if (!expenses.length) {
    anomalies.push({ level: 'info', title: 'Недостаточно данных для детектива', desc: 'Отсканируйте чек или добавьте операции для поиска аномалий.' });
  } else {
    const seenPairs = {};
    expenses.forEach(t => {
      const pairKey = `${t.date}_${t.merchant.toLowerCase()}_${t.amount}`;
      if (seenPairs[pairKey]) {
        anomalies.push({ level: 'warn', title: `Повторное списание: ${t.merchant}`, desc: `Две одинаковые операции на ${fmtR(t.amount)} за ${humanDate(t.date)}.` });
      }
      seenPairs[pairKey] = true;
    });

    const byCat = {};
    expenses.forEach(t => byCat[t.category] = FM.add(byCat[t.category],t.amount));
    const totalSpent = FM.sum(expenses,t=>t.amount);
    Object.entries(byCat).forEach(([catId, amt]) => {
      const share = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
      if (share >= 55 && expenses.length >= 2) {
        anomalies.push({ level: 'warn', title: `Высокая доля: ${(CATS[catId] || CATS.other).name} (${share}%)`, desc: `Ушло ${fmtR(amt)} из ${fmtR(totalSpent)}. Рекомендуем установить лимит.` });
      }
    });

    if (!anomalies.length) {
      anomalies.push({ level: 'ok', title: 'Аномалий не обнаружено', desc: 'Двойных списаний и резких скачков по категориям нет.' });
    }
  }
  return { subsList, monthlySubs, annualSubs, anomalies };
}

// Presentation states are independent: a forecast deficit is not a duplicate charge.
function renderBalanceCardFeedback(m, hasAnomaly) {
  const exhausted = m.freePool === 0 || m.todaySpent >= m.dailyCap;
  const forecastRisk = m.hasData && Number.isFinite(m.forecastBalance) && m.forecastBalance < 0;
  const tone = exhausted || forecastRisk ? 'risk' : (hasAnomaly || m.pct >= 75 ? 'caution' : 'calm');
  const badge = document.getElementById('status-badge');
  badge.className = 'balance-status';
  badge.dataset.tone = tone;
  badge.textContent = tone === 'risk' ? 'Нужен контроль' : tone === 'caution' ? 'Обратите внимание' : 'Всё спокойно';
  const orb = document.getElementById('fintex-ai-orb');
  if (orb) {
    orb.className = `ai-orb ai-orb-${tone === 'risk' ? 'alert' : tone === 'caution' ? 'amber' : 'calm'} shrink-0`;
    orb.title = `FINTEX · ${badge.textContent}`;
  }

  const used = Math.max(0, Math.min(100, Number(m.pct) || 0));
  const bar = document.getElementById('hero-bar');
  bar.style.width = `${used}%`;
  bar.style.background = 'currentColor';
  document.getElementById('hero-budget-progress').setAttribute('aria-valuenow', String(used));
  document.getElementById('hero-daily-budget').dataset.exhausted = String(exhausted);
  document.getElementById('hero-today-spent').textContent = fmtR(m.todaySpent);
  document.getElementById('hero-budget-used').textContent = `${used}% лимита`;

  const forecast = document.getElementById('hero-forecast-text');
  forecast.textContent = m.hasData && Number.isFinite(m.forecastBalance)
    ? fmtR(Math.abs(m.forecastBalance), m.forecastBalance < 0 ? '−' : m.forecastBalance > 0 ? '+' : '')
    : '—';
  document.getElementById('hero-forecast-row').dataset.tone = forecastRisk ? 'risk' : 'calm';
  document.getElementById('hero-forecast-note').textContent = m.hasData
    ? 'При текущем темпе трат' : 'Появится после первых расходов';

  const notice = document.getElementById('hero-notice');
  notice.hidden = !(exhausted || hasAnomaly);
  notice.dataset.tone = exhausted ? 'risk' : 'caution';
  document.getElementById('hero-notice-title').textContent = exhausted ? 'Бюджет на сегодня исчерпан' : 'Проверьте последние расходы';
  document.getElementById('hero-notice-description').textContent = exhausted
    ? (m.freePool === 0 ? 'Средства зарезервированы. Посмотрите расчёт.' : 'Лимит достигнут. Посмотрите расходы за день.')
    : 'Есть повторные списания или высокая доля одной категории.';
  notice.onclick = () => {
    if (exhausted && m.freePool === 0) openForecastExplainModal();
    else if (exhausted) openTodayDetailModal();
    else { goTab('analytics'); toast('Проверьте операции и распределение расходов по категориям'); }
  };
}

function renderAll(animateFromZero = false) {
  const m = calcMetrics();
  const intel = detectSubscriptionsAndAnomalies();
  const hasAnomaly = intel.anomalies.some(a => a.level === 'warn');

  document.getElementById('hdr-greeting').textContent = state.name ? `${greetingWord()}, ${state.name}` : 'FINTEX';
  document.getElementById('hdr-sync-status').textContent = `Автопилот • синхр. ${state.lastSyncText}`;

  animateCounter(document.getElementById('hero-daily-left'), m.dailyLeft, animateFromZero);
  animateCounter(document.getElementById('hero-balance'), state.balance, animateFromZero);

  document.getElementById('hero-daily-cap').textContent = fmtR(m.dailyCap);
  window.FintexNumerals.render(document.getElementById('hero-reserved'),m.reserved);
  window.FintexNumerals.render(document.getElementById('hero-free-pool'),m.freePool);
  document.getElementById('hero-payday-date').textContent = humanDate(state.payday);
  document.getElementById('feed-today-sum').textContent = fmtR(m.totalTodaySpent);

  const explainEl = document.getElementById('hero-limit-explain');
  explainEl.textContent = m.freePool === 0
    ? 'Средства защищены для платежей и накоплений.'
    : `До зарплаты ${m.days} дн. Резерв не входит в дневной бюджет.`;

  renderBalanceCardFeedback(m, hasAnomaly);

  document.getElementById('sources-explicit-text').textContent = `Банк (${state.bank}) · Чеки OCR · Импорт CSV/TXT`;
  const cardBrandLbl = document.getElementById('hero-card-brand-lbl');
  if (cardBrandLbl) cardBrandLbl.textContent = `FINTEX · ${String(state.bank || 'КАРТА').toUpperCase()}`;

  // Визуальные проценты структуры капитала на карточке счёта
  const totalCap = Math.max(1, m.freePool + m.reserved);
  const freePct = state.balance > 0 ? Math.round((m.freePool / totalCap) * 100) : 0;
  const resPct = state.balance > 0 ? Math.max(0, 100 - freePct) : 0;
  const splitFreeEl = document.getElementById('hero-split-free');
  const splitResEl = document.getElementById('hero-split-res');
  if (splitFreeEl) splitFreeEl.style.width = `${freePct}%`;
  if (splitResEl) splitResEl.style.width = `${resPct}%`;
  const resPctEl = document.getElementById('hero-res-pct');
  const freePctEl = document.getElementById('hero-free-pct');
  if (resPctEl) resPctEl.textContent = `${resPct}%`;
  if (freePctEl) freePctEl.textContent = `${freePct}%`;

  // Подушка
  const gSaved = Math.max(0, FM.money(state.goal?.saved));
  const gTarget = Math.max(0.01, FM.money(state.goal?.target) || 10000);
  const gPct = Math.min(100, Math.round((gSaved / gTarget) * 100));
  const gRem = Math.max(0, gTarget - gSaved);
  document.getElementById('goal-title-label').textContent = state.goal?.title || 'Финансовая подушка';
  document.getElementById('goal-saved-label').textContent = fmtR(gSaved);
  document.getElementById('goal-target-label').textContent = fmtR(gTarget);
  document.getElementById('goal-bar').style.width = `${gPct}%`;
  const gBadge = document.getElementById('goal-pct-badge');
  const gRemEl = document.getElementById('goal-rem-sub');
  if (gBadge) gBadge.textContent = `${gPct}%`;
  if (gRemEl) gRemEl.textContent = gRem > 0 ? `Осталось накопить: ${fmtR(gRem)}` : 'Цель достигнута! Финансовая защита активна';

  document.getElementById('payday-callout')?.classList.add('hidden');
  document.getElementById('bills-card')?.classList.add('hidden');

  organizeSimplifiedLayout();
  renderHome(false);
  renderCalendar();
  renderAnalytics();
  renderSettings();
  try { window.FINTEX_EXT?.onAfterRender?.(); } catch (e) {}
  lucide.createIcons();
}

const FEED_WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const FEED_WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const FEED_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function parseLocalIsoDate(iso) {
  const p = String(iso || '').split('-').map(Number);
  if (p.length < 3 || !p[0] || !p[1] || !p[2]) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

function formatFeedDayHeader(iso) {
  const dt = parseLocalIsoDate(iso);
  if (!dt) return { title: iso || 'Без даты', sub: '' };
  const wdFull = FEED_WEEKDAYS_FULL[dt.getDay()];
  const curYear = new Date().getFullYear();
  const datePart = `${dt.getDate()} ${FEED_MONTHS_SHORT[dt.getMonth()]}${dt.getFullYear() !== curYear ? ` ${dt.getFullYear()}` : ''}`;

  if (iso === TODAY) return { title: 'Сегодня', sub: `${wdFull}, ${datePart}` };
  if (iso === YESTERDAY) return { title: 'Вчера', sub: `${wdFull}, ${datePart}` };
  return { title: `${wdFull}, ${datePart}`, sub: '' };
}

function formatFeedRowDate(iso) {
  const dt = parseLocalIsoDate(iso);
  if (!dt) return iso || '';
  const wdShort = FEED_WEEKDAYS_SHORT[dt.getDay()];
  const curYear = new Date().getFullYear();
  const datePart = `${dt.getDate()} ${FEED_MONTHS_SHORT[dt.getMonth()]}${dt.getFullYear() !== curYear ? ` ${dt.getFullYear()}` : ''}`;
  return `${wdShort}, ${datePart}`;
}

function ensureFeedDateState() {
  if (!state.feedDateMode) state.feedDateMode = 'all';
  if (typeof state.feedDateFrom !== 'string') state.feedDateFrom = '';
  if (typeof state.feedDateTo !== 'string') state.feedDateTo = '';
  if (typeof state.feedDatePickerOpen !== 'boolean') state.feedDatePickerOpen = false;
}

function setFeedDateMode(mode) {
  ensureFeedDateState();
  vibro('selection');
  if (mode === 'custom') {
    state.feedDateMode = 'custom';
    state.feedDatePickerOpen = !state.feedDatePickerOpen;
    if (!state.feedDateFrom) {
      state.feedDateFrom = TODAY;
      state.feedDateTo = TODAY;
    }
  } else {
    state.feedDateMode = mode;
    state.feedDatePickerOpen = false;
  }
  renderHome();
}

function onFeedCustomDateChange(edge) {
  ensureFeedDateState();
  const fromEl = document.getElementById('feed-date-from');
  const toEl = document.getElementById('feed-date-to');
  let fromVal = fromEl?.value || '';
  let toVal = toEl?.value || '';

  if (edge === 'from' && fromVal && (!toVal || toVal < fromVal)) {
    toVal = fromVal;
    if (toEl) toEl.value = toVal;
  }
  if (edge === 'to' && toVal && (!fromVal || fromVal > toVal)) {
    fromVal = toVal;
    if (fromEl) fromEl.value = fromVal;
  }

  state.feedDateFrom = fromVal;
  state.feedDateTo = toVal;
  state.feedDateMode = (fromVal || toVal) ? 'custom' : 'all';
  renderHome();
}

function resetFeedDateFilter() {
  ensureFeedDateState();
  vibro('selection');
  state.feedDateMode = 'all';
  state.feedDateFrom = '';
  state.feedDateTo = '';
  state.feedDatePickerOpen = false;
  renderHome();
}

function matchesFeedDateFilter(isoDate) {
  ensureFeedDateState();
  const mode = state.feedDateMode;
  if (mode === 'all') return true;
  if (!isoDate) return false;
  if (mode === 'today') return isoDate === TODAY;
  if (mode === 'yesterday') return isoDate === YESTERDAY;
  if (mode === '7d') return isoDate >= offsetDateISO(-6) && isoDate <= TODAY;
  if (mode === 'month') return isoDate.startsWith(TODAY.slice(0, 7));
  if (mode === 'custom') {
    const from = state.feedDateFrom;
    const to = state.feedDateTo || from;
    if (from && isoDate < from) return false;
    if (to && isoDate > to) return false;
    return true;
  }
  return true;
}

function getCustomDateChipLabel() {
  ensureFeedDateState();
  if (state.feedDateMode !== 'custom' || !state.feedDateFrom) return '📅 Выбрать дату';
  const fromLbl = formatFeedRowDate(state.feedDateFrom);
  const toLbl = state.feedDateTo ? formatFeedRowDate(state.feedDateTo) : fromLbl;
  return fromLbl === toLbl ? `📅 ${fromLbl}` : `📅 ${fromLbl} — ${toLbl}`;
}

function toggleHomeShowAllTx() {
  vibro('selection');
  state.homeShowAllTx = !state.homeShowAllTx;
  renderHome();
}

function organizeSimplifiedLayout() {
  const homeView = document.getElementById('view-home');
  const anView = document.getElementById('view-analytics');

  // 1. Переносим тепловую карту и граф категорий с главного экрана во вкладку «Аналитика»
  const hmMatrix = document.getElementById('hm-grid-matrix');
  const hmCard = hmMatrix?.closest('#view-home > div, #view-home > section, .card-surface');
  const cgNodes = document.getElementById('cat-graph-nodes');
  const cgCard = cgNodes?.closest('#view-home > div, #view-home > section, .card-surface');

  if (anView) {
    anView.classList.remove('space-y-2', 'space-y-2.5', 'space-y-3');
    anView.classList.add('space-y-5');

    const catBarsCard = document.getElementById('an-categories-bars')?.closest('.card-surface');
    if (cgCard && !anView.contains(cgCard)) {
      cgCard.classList.remove('hidden');
      cgCard.style.display = '';
      if (catBarsCard && catBarsCard.parentNode === anView) {
        catBarsCard.insertAdjacentElement('afterend', cgCard);
      } else {
        anView.appendChild(cgCard);
      }
    }
    if (hmCard && !anView.contains(hmCard)) {
      hmCard.classList.remove('hidden');
      hmCard.style.display = '';
      if (cgCard && cgCard.parentNode === anView) {
        cgCard.insertAdjacentElement('afterend', hmCard);
      } else {
        anView.appendChild(hmCard);
      }
    }
  }

  // 2. Убираем лишние мелкие подписи в шапке и главной карточке
  document.getElementById('hdr-sync-status')?.classList.add('hidden');
  document.getElementById('hero-limit-explain')?.classList.remove('hidden');
  document.getElementById('hero-card-brand-lbl')?.classList.remove('hidden');
  document.getElementById('hero-res-pct')?.classList.add('hidden');
  document.getElementById('hero-free-pct')?.classList.add('hidden');

  const sourcesEl = document.getElementById('sources-explicit-text');
  if (sourcesEl) {
    sourcesEl.classList.add('hidden');
    const srcRow = sourcesEl.parentElement;
    if (srcRow && srcRow.id !== 'hero-balance-card' && srcRow.textContent.trim() === '') {
      srcRow.classList.add('hidden');
    }
  }

  // 3. На главном экране оставляем только карточку дневного лимита/баланса и список операций
  if (homeView) {
    const heroCard = document.getElementById('hero-balance-card');
    const txFeed = document.getElementById('tx-feed');
    const treeMount = document.getElementById('filely-financial-tree-mount');
    const homeChildren = Array.from(homeView.children);
    const heroBlock = homeChildren.find(el => el === heroCard || el.contains(heroCard));
    const feedBlock = homeChildren.find(el => el === txFeed || el.contains(txFeed));

    homeChildren.forEach(el => {
      const keepTree = el === treeMount || el.id === 'filely-financial-tree-mount' || el.dataset?.ftxKeep === '1';
      if (el !== heroBlock && el !== feedBlock && !keepTree) {
        el.classList.add('hidden');
        el.style.display = 'none';
      } else {
        el.classList.remove('hidden');
        el.style.display = '';
      }
    });

    // Свободные отступы между блоками
    homeView.classList.remove('space-y-2', 'space-y-2.5', 'space-y-3', 'space-y-4');
    homeView.classList.add('space-y-6');

    if (heroCard) {
      heroCard.classList.remove('p-3.5', 'p-4', 'space-y-2', 'space-y-2.5', 'space-y-3');
      heroCard.classList.remove('p-5', 'space-y-4');
    }

    if (feedBlock) {
      feedBlock.classList.remove('space-y-1.5', 'space-y-2', 'space-y-2.5', 'space-y-3');
      feedBlock.classList.add('space-y-4');

      // Скрываем лишние панели фильтров и мелкие подписи в блоке ленты
      ['feed-date-strip', 'feed-custom-date-box', 'filter-strip', 'feed-period-summary'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });

      feedBlock.querySelectorAll('.text-\\[9px\\], .text-\\[10px\\]').forEach(el => {
        if (!el.closest('#tx-feed') && !el.closest('#home-tx-more-wrap')) {
          el.classList.add('hidden');
        }
      });
    }

    if (txFeed) {
      txFeed.classList.remove('space-y-2', 'space-y-2.5', 'space-y-3');
      txFeed.classList.add('space-y-4');
    }
  }
}

// Stagger new rows only; a background sync must not replay the whole history.
const operationRevealState = new WeakMap();
const operationRevealObservers = new Set();
function animateOperationRows(container, context, force = false) {
  if (!container) return;
  const previous = operationRevealState.get(container);
  if (previous?.observer) {
    previous.observer.disconnect();
    operationRevealObservers.delete(previous.observer);
  }
  if (!container.getClientRects().length) return;
  const rows = Array.from(container.querySelectorAll('[data-operation-row]'));
  const record = { context, ids: new Set(rows.map(row => row.dataset.operationRow)), pendingIds: new Set(), observer: null };
  operationRevealState.set(container, record);
  const motionAllowed = () => localStorage.getItem('fp_motion') !== '0' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!motionAllowed()) return;
  const reveal = force || !previous || previous.context !== context
    ? rows : rows.filter(row => !previous.ids.has(row.dataset.operationRow) || previous.pendingIds?.has(row.dataset.operationRow));
  const play = (row, index) => {
    if (!motionAllowed() || !row.isConnected || typeof row.animate !== 'function') return;
    row.getAnimations().filter(animation => animation.id === 'fintex-operation-reveal').forEach(animation => animation.cancel());
    record.pendingIds.delete(row.dataset.operationRow);
    const animation = row.animate([
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 380, delay: Math.min(index * 65, 260), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    animation.id = 'fintex-operation-reveal';
  };
  // Rows below the calendar grid should animate when scrolled into view, not offscreen.
  let pending = 0;
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(entry => {
        play(entry.target, reveal.indexOf(entry.target));
        observer.unobserve(entry.target);
        pending--;
      });
      if (pending === 0) { observer.disconnect(); operationRevealObservers.delete(observer); }
    }, { threshold: .08, rootMargin: '0px 0px -90px 0px' });
    record.observer = observer;
    reveal.forEach((row, index) => {
      const box = row.getBoundingClientRect();
      if (box.bottom > 0 && box.top < window.innerHeight - 90) play(row, index);
      else { pending++; record.pendingIds.add(row.dataset.operationRow); observer.observe(row); }
    });
    if (pending) operationRevealObservers.add(observer);
    else observer.disconnect();
  } else reveal.forEach(play);
}
function stopOperationReveals() {
  operationRevealObservers.forEach(observer => observer.disconnect());
  operationRevealObservers.clear();
  document.querySelectorAll('[data-operation-row]').forEach(row => {
    row.getAnimations?.().filter(animation => animation.id === 'fintex-operation-reveal').forEach(animation => animation.cancel());
  });
}
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', event => {
  if (event.matches) stopOperationReveals();
});

function renderHome() {
  state.homeShowAllTx = Boolean(state.homeShowAllTx);

  const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const rows = FM.transactions(state.transactions).filter(t => {
    if (q && !t.merchant.toLowerCase().includes(q) && !String(t.amount).includes(q)) return false;
    return true;
  });

  const feed = document.getElementById('tx-feed');
  if (!feed) return;

  let moreWrap = document.getElementById('home-tx-more-wrap');
  if (!moreWrap) {
    moreWrap = document.createElement('div');
    moreWrap.id = 'home-tx-more-wrap';
    moreWrap.className = 'pt-1';
    feed.insertAdjacentElement('afterend', moreWrap);
  }

  if (!rows.length) {
    feed.innerHTML = `
      <div class="card-surface p-6 text-center space-y-1.5">
        <div class="text-sm font-semibold text-main">Операций пока нет</div>
        <div class="text-xs text-sub">Добавьте первую покупку или пополнение</div>
      </div>
    `;
    moreWrap.innerHTML = '';
    return;
  }

  const sortedRows = [...rows].sort((a, b) => {
    const dCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dCmp !== 0) return dCmp;
    return String(b.time || '').localeCompare(String(a.time || ''));
  });

  const visibleRows = state.homeShowAllTx ? sortedRows : sortedRows.slice(0, 5);

  const groupsMap = new Map();
  visibleRows.forEach(t => {
    const key = t.date || 'unknown';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(t);
  });

  feed.innerHTML = Array.from(groupsMap.entries()).map(([dateKey, dayItems]) => {
    const hdr = formatFeedDayHeader(dateKey);
    const dayInc = FM.sum(dayItems.filter(t => t.type === 'income'),t=>t.amount);
    const dayExp = FM.sum(dayItems.filter(t => t.type === 'expense'),t=>t.amount);

    const dayTotalsHtml = `
      <div class="flex items-center gap-2 shrink-0">
        ${dayInc > 0 ? `<span class="text-xs font-bold text-emerald-400 tabular-nums">${fmtR(dayInc, '+')}</span>` : ''}
        ${dayExp > 0 ? `<span class="text-xs font-bold operation-expense tabular-nums">${fmtR(dayExp, '−')}</span>` : ''}
      </div>
    `;

    const itemsHtml = dayItems.map(t => {

      const dispMerchant = normalizeMerchantName(t.merchant);
      const dispCatId = CATS[t.category] && t.category !== 'other' ? t.category : classifyCategory(dispMerchant);
      const inc = t.type === 'income';
      const cat = CATS[dispCatId] || CATS.other;
      const rowDateText = formatFeedRowDate(t.date);

      const metaSub = inc
        ? rowDateText
        : `${cat.name} · ${rowDateText}`;

      const rowAccentCls = inc
        ? 'border-l-[3px] border-emerald-400 bg-emerald-500/[0.05]'
        : 'border-l-[3px] border-rose-400/75';

      const amountCls = inc
        ? 'operation-income'
        : 'operation-expense';

      const isSelectMode = Boolean(state.txSelectMode);
      const isSelected = Array.isArray(state.selectedTxIds) && state.selectedTxIds.includes(t.id);
      const rowClickHandler = isSelectMode
        ? `toggleTxSelection('${t.id}')`
        : `handleTxRowTap(event, '${t.id}')`;
      const selectCheckHtml = isSelectMode
        ? `<span class="tx-select-check ${isSelected ? 'is-checked' : ''}" aria-hidden="true">${isSelected ? '<i data-lucide="check" class="w-3 h-3 text-[#041311]"></i>' : ''}</span>`
        : '';

      return `
        <div data-tx-id="${t.id}" data-operation-row="${escapeHtml(t.id)}" data-operation-type="${inc ? 'income' : 'expense'}" class="tx-swipe-wrap border-b border-white/[0.06] last:border-b-0 ${t._justMerged ? 'tx-merge-flash' : ''} ${isSelected ? 'tx-row-selected' : ''}">
          <div class="tx-swipe-actions">
            <button type="button" onclick="event.stopPropagation(); repeatTxById('${t.id}')" class="bg-[#00D6C3]/20 text-brand text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5">
              <i data-lucide="repeat" class="w-3.5 h-3.5"></i><span>Повтор</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); deleteTxById('${t.id}')" class="bg-red-500/25 text-red-300 text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i><span>Удалить</span>
            </button>
          </div>
          <div data-tx-id="${t.id}" onclick="${rowClickHandler}"
               ontouchstart="swipeStart(event, '${t.id}')" ontouchmove="swipeMove(event, this)" ontouchend="swipeEnd(this, '${t.id}')"
               onmousedown="swipeMouseStart(event, this, '${t.id}')" onwheel="swipeWheel(event, this)"
               class="tx-swipe-content p-4 flex items-center justify-between gap-3.5 cursor-pointer ${rowAccentCls}">
            <div class="flex items-center gap-3.5 min-w-0">
              ${selectCheckHtml}
              ${merchantBadge(dispMerchant, dispCatId, t.type)}
              <div class="min-w-0">
                <div class="text-sm font-bold text-main truncate">${escapeHtml(dispMerchant)}</div>
                <div class="text-xs text-sub truncate mt-0.5">${metaSub}</div>
              </div>
            </div>
            <span class="money-val text-sm font-extrabold tabular-nums shrink-0 ${amountCls}">
              ${fmtR(t.amount, inc ? '+' : '−')}
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card-surface overflow-hidden">
        <div class="px-4 py-3 bg-white/[0.03] border-b border-white/[0.07] flex items-center justify-between gap-2">
          <span class="text-xs font-extrabold text-main truncate">${hdr.title}</span>
          ${dayTotalsHtml}
        </div>
        <div>${itemsHtml}</div>
      </div>
    `;
  }).join('');

  if (sortedRows.length > 5) {
    moreWrap.innerHTML = `
      <button type="button" onclick="toggleHomeShowAllTx()" class="w-full py-3.5 px-4 rounded-2xl card-surface border border-white/10 text-xs font-bold text-brand flex items-center justify-center gap-2 tap">
        <span>${state.homeShowAllTx ? 'Свернуть' : `Показать все (${sortedRows.length})`}</span>
        <i data-lucide="${state.homeShowAllTx ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4"></i>
      </button>
    `;
  } else {
    moreWrap.innerHTML = '';
  }

  if (typeof renderBatchActionDock === 'function') renderBatchActionDock(visibleRows);
  animateOperationRows(feed, 'home');
  lucide.createIcons();
}

let swipeStartX = 0, swipeStartY = 0, swipeDeltaX = 0, openedSwipeEl = null, swipeMovedFlag = false, swipeHoldTimer = null;

function handleTxRowTap(e, id) {
  if (swipeMovedFlag) { swipeMovedFlag = false; return; }
  if (openedSwipeEl) {
    openedSwipeEl.style.transform = 'translateX(0px)';
    openedSwipeEl = null;
    return;
  }
  openTxModal(id);
}

function swipeStart(e, txId) {
  const touch = e.touches?.[0];
  if (!touch) return;
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  swipeDeltaX = 0;
  swipeMovedFlag = false;
  if (swipeHoldTimer) clearTimeout(swipeHoldTimer);
  if (txId && !state.txSelectMode) {
    swipeHoldTimer = setTimeout(() => {
      swipeMovedFlag = true;
      if (typeof toggleTxSelectMode === 'function') toggleTxSelectMode(true, txId);
    }, 460);
  }
  if (openedSwipeEl && openedSwipeEl !== e.currentTarget) {
    openedSwipeEl.style.transform = 'translateX(0px)';
    openedSwipeEl = null;
  }
}

function swipeMove(e, el) {
  const touch = e.touches?.[0];
  if (!touch) return;
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
    if (swipeHoldTimer) { clearTimeout(swipeHoldTimer); swipeHoldTimer = null; }
  }
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(swipeDeltaX) < 12) return;
  if (dx < -8) {
    swipeMovedFlag = true;
    swipeDeltaX = Math.max(-168, dx);
    el.style.transition = 'none';
    el.style.transform = `translateX(${swipeDeltaX}px)`;
  } else if (dx > 12) {
    swipeMovedFlag = true;
    if (openedSwipeEl === el) {
      swipeDeltaX = 0;
      el.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = 'translateX(0px)';
    } else {
      swipeDeltaX = Math.min(48, dx);
      el.style.transition = 'none';
      el.style.transform = `translateX(${swipeDeltaX}px)`;
    }
  }
}

function swipeEnd(el, txId) {
  if (swipeHoldTimer) { clearTimeout(swipeHoldTimer); swipeHoldTimer = null; }
  el.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
  if (swipeDeltaX > 36 && txId) {
    el.style.transform = 'translateX(0px)';
    if (typeof toggleTxSelectMode === 'function') toggleTxSelectMode(true, txId);
  } else if (swipeDeltaX < -136 && txId) {
    el.style.transform = 'translateX(-100%)';
    vibro('medium');
    setTimeout(() => deleteTxById(txId), 150);
  } else if (swipeDeltaX < -48) {
    el.style.transform = 'translateX(-128px)';
    openedSwipeEl = el;
    vibro('selection');
  } else {
    el.style.transform = 'translateX(0px)';
    if (openedSwipeEl === el) openedSwipeEl = null;
  }
  swipeDeltaX = 0;
}

function swipeMouseStart(e, el, txId) {
  if (e.button !== 0 || e.target.closest('button')) return;
  const startX = e.clientX;
  let deltaX = 0;
  let dragged = false;
  if (openedSwipeEl && openedSwipeEl !== el) {
    openedSwipeEl.style.transform = 'translateX(0px)';
    openedSwipeEl = null;
  }
  const onMove = (mv) => {
    const dx = mv.clientX - startX;
    if (Math.abs(dx) > 6) dragged = true;
    if (dx < -6) {
      deltaX = Math.max(-168, dx);
      el.style.transition = 'none';
      el.style.transform = `translateX(${deltaX}px)`;
    } else if (dx > 8) {
      deltaX = Math.min(44, dx);
      el.style.transition = 'none';
      el.style.transform = `translateX(${deltaX}px)`;
    }
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (!dragged) return;
    swipeMovedFlag = true;
    el.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
    if (deltaX > 32 && txId) {
      el.style.transform = 'translateX(0px)';
      if (typeof toggleTxSelectMode === 'function') toggleTxSelectMode(true, txId);
    } else if (deltaX < -136 && txId) {
      el.style.transform = 'translateX(-100%)';
      setTimeout(() => deleteTxById(txId), 150);
    } else if (deltaX < -46) {
      el.style.transform = 'translateX(-128px)';
      openedSwipeEl = el;
    } else {
      el.style.transform = 'translateX(0px)';
      if (openedSwipeEl === el) openedSwipeEl = null;
    }
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function swipeWheel(e, el) {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 14) return;
  e.preventDefault();
  if (e.deltaX > 18) {
    if (openedSwipeEl && openedSwipeEl !== el) openedSwipeEl.style.transform = 'translateX(0px)';
    el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = 'translateX(-128px)';
    openedSwipeEl = el;
  } else if (e.deltaX < -18) {
    el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = 'translateX(0px)';
    if (openedSwipeEl === el) openedSwipeEl = null;
  }
}

function setCalFilter(mode) {
  vibro('selection');
  const restoreFocus = document.activeElement?.hasAttribute('data-cal-filter');
  state.calFilter = mode;
  renderCalendar();
  if (restoreFocus) document.querySelector(`[data-cal-filter="${mode}"]`)?.focus({ preventScroll: true });
}

function jumpCalToday() {
  vibro('light');
  const now = new Date();
  state.calYear = now.getFullYear();
  state.calMonth = now.getMonth();
  state.calSelected = TODAY;
  renderCalendar();
}

function pickCalDayFromAdjacent(iso) {
  vibro('selection');
  const [y, m] = iso.split('-').map(Number);
  state.calYear = y;
  state.calMonth = m - 1;
  state.calSelected = iso;
  renderCalendar();
}

function openAddModalForDate(iso) {
  openAddModal();
  const dateInp = document.getElementById('inp-add-date');
  if (dateInp) dateInp.value = iso || TODAY;
}

function formatCompactCalAmt(amount, sign = '') {
  const val = FM.money(amount);
  if (val <= 0) return '';
  if (val < 1000) return `${sign}${val}`;
  if (val < 1000000) return `${sign}${(val / 1000).toFixed(val < 10000 ? 1 : 0).replace(/\.0$/, '')}к`;
  if (val < 1000000000) return `${sign}${(val / 1000000).toFixed(val < 10000000 ? 1 : 0).replace(/\.0$/, '')}м`;
  return `${sign}${(val / 1000000000).toFixed(1).replace(/\.0$/, '')}млрд`;
}

function formatCalDayFullHeading(iso) {
  if (!iso) return 'Сегодня';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const mShort = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  if (iso === TODAY) return `Сегодня · ${d} ${mShort[m - 1]}`;
  if (iso === YESTERDAY) return `Вчера · ${d} ${mShort[m - 1]}`;
  return `${wDays[dt.getDay()]}, ${d} ${mShort[m - 1]}`;
}

// Planning lives in Calendar; keep legacy IDs stable for stored-data renderers.
function renderCalendarPlan() {
  window.FintexNumerals.render(document.getElementById('st-balance'),state.balance);
  document.getElementById('st-payday').textContent = humanDate(state.payday);
  document.getElementById('st-goal-title').textContent = state.goal?.title || 'Финансовая подушка';
  document.getElementById('st-goal-sub').textContent = `Отложено: ${fmtR(state.goal?.saved || 0)} из ${fmtR(state.goal?.target || 10000)}`;
  const activeBills = state.bills.filter(b => !b.is_paid).slice().sort((a,b) => String(a.due_date).localeCompare(String(b.due_date)));
  const planList = document.getElementById('st-bills-list');
  planList.innerHTML = activeBills.length
    ? activeBills.map(b => `<div class="plan-bill-row input-surface">
        <button type="button" data-plan-bill="${escapeHtml(b.id)}"><strong>${escapeHtml(b.title)}</strong><small>${humanDate(b.due_date)} · ${fmtR(b.amount)} · К дате →</small></button>
        <button type="button" data-plan-delete="${escapeHtml(b.id)}" aria-label="Удалить платёж ${escapeHtml(b.title)}">Удалить</button>
      </div>`).join('')
    : '<p class="text-xs text-sub">Нет запланированных платежей</p>';
  planList.querySelectorAll('[data-plan-bill]').forEach(button => button.addEventListener('click', () => {
    const bill = state.bills.find(b => b.id === button.dataset.planBill);
    if (!bill) return;
    pickCalDayFromAdjacent(bill.due_date);
    document.getElementById('calendar-plan').open = false;
    const heading = document.getElementById('cal-day-heading');
    heading.setAttribute('tabindex','-1');
    heading.focus({ preventScroll: true });
    document.getElementById('cal-day-section').scrollIntoView({block:'start',behavior:'auto'});
  }));
  planList.querySelectorAll('[data-plan-delete]').forEach(button => button.addEventListener('click', () => deleteBill(button.dataset.planDelete)));

}

function renderCalendar(forceReveal = false) {
  renderCalendarPlan();
  const calendarTxs = FM.transactions(state.transactions,null,TODAY);
  const focusedCalDate = document.activeElement?.dataset.calDate;
  const mNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const calFilter = state.calFilter || 'all';
  const monthPrefix = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}`;

  document.getElementById('cal-title').textContent = `${mNames[state.calMonth]} ${state.calYear}`;

  const now = new Date();
  const isAwayFromToday = state.calYear !== now.getFullYear() || state.calMonth !== now.getMonth() || state.calSelected !== TODAY;
  const todayBtn = document.getElementById('cal-today-btn');
  if (todayBtn) todayBtn.classList.toggle('hidden', !isAwayFromToday);

  const monthTxs = calendarTxs.filter(t => t.date && t.date.startsWith(monthPrefix));
  const monthInc = FM.sum(monthTxs.filter(t => t.type === 'income'),t=>t.amount);
  const monthExp = FM.sum(monthTxs.filter(t => t.type === 'expense'),t=>t.amount);
  const monthNet = monthInc - monthExp;

  const incEl = document.getElementById('cal-month-inc');
  const expEl = document.getElementById('cal-month-exp');
  const netEl = document.getElementById('cal-month-net');
  if (incEl) incEl.textContent = `+${fmtR(monthInc)}`;
  if (expEl) expEl.textContent = `−${fmtR(monthExp)}`;
  if (netEl) {
    netEl.textContent = monthNet > 0 ? `+${fmtR(monthNet)}` : (monthNet < 0 ? `−${fmtR(Math.abs(monthNet))}` : '0 ₽');
    netEl.className = `cal-summary-value ${monthNet > 0 ? 'cal-income' : monthNet < 0 ? 'cal-expense' : 'text-main'}`;
  }

  const m = calcMetrics();
  const shortageBox = document.getElementById('cal-shortage-alert');
  if (state.balance < m.billsReserved) {
    shortageBox.classList.remove('hidden');
    document.getElementById('cal-shortage-text').textContent = `Нехватка средств: на карте ${fmtR(state.balance)}, а запланировано платежей на ${fmtR(m.billsReserved)}.`;
  } else {
    shortageBox.classList.add('hidden');
  }

  const filterStrip = document.getElementById('cal-filter-strip');
  if (filterStrip) {
    const filters = [
      { id: 'all', label: 'Все' },
      { id: 'expense', label: '− Расходы' },
      { id: 'income', label: '+ Доходы' },
      { id: 'bills', label: 'Платежи' }
    ];
    filterStrip.innerHTML = filters.map(f => {
      const active = calFilter === f.id;
      return `<button type="button" onclick="setCalFilter('${f.id}')" data-cal-filter="${f.id}" aria-pressed="${active}" class="cal-filter ${active ? 'is-active' : ''}">${f.label}</button>`;
    }).join('');
  }

  const spendMap = {};
  const incomeMap = {};
  calendarTxs.forEach(t => {
    if (!t.date) return;
    if (t.type === 'income') incomeMap[t.date] = (incomeMap[t.date] || 0) + Number(t.amount || 0);
    else spendMap[t.date] = (spendMap[t.date] || 0) + Number(t.amount || 0);
  });

  const billMap = {};
  state.bills.filter(b => !b.is_paid && b.is_recurring).forEach(b => {
    if (!billMap[b.due_date]) billMap[b.due_date] = [];
    billMap[b.due_date].push(b);
  });

  const first = new Date(state.calYear, state.calMonth, 1);
  let offset = first.getDay() - 1;
  if (offset < 0) offset = 6;
  const totalDays = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(state.calYear, state.calMonth, 0).getDate();

  let zeroSpendDays = 0;
  let html = '';

  const prevYear = state.calMonth === 0 ? state.calYear - 1 : state.calYear;
  const prevMonth = state.calMonth === 0 ? 12 : state.calMonth;
  for (let i = offset - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevIso = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    html += `<button type="button" onclick="pickCalDayFromAdjacent('${prevIso}')" class="cal-day is-adjacent"><span class="cal-day-number">${dayNum}</span></button>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    const iso = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sel = iso === state.calSelected;
    const isToday = iso === TODAY;
    const pay = iso === state.payday;

    const dayExp = spendMap[iso] || 0;
    const dayInc = incomeMap[iso] || 0;
    const dayBills = billMap[iso] || [];
    const billsSum = FM.sum(dayBills,b=>b.amount);

    if (iso <= TODAY && dayExp === 0) zeroSpendDays++;

    const showExp = (calFilter === 'all' || calFilter === 'expense') && dayExp > 0;
    const showInc = (calFilter === 'all' || calFilter === 'income') && dayInc > 0;
    const showBill = (calFilter === 'all' || calFilter === 'bills') && billsSum > 0;

    const classes = ['cal-day'];
    if (sel) classes.push('is-selected');
    if (isToday) classes.push('is-today');
    if (showExp) classes.push('has-expense');
    if (showInc) classes.push('has-income');
    if (showBill || pay) classes.push('has-planned');
    const labels = [];
    if (showExp) labels.push(`<span class="cal-amount cal-expense money-val">${formatCompactCalAmt(dayExp, '−')}</span>`);
    if (showInc) labels.push(`<span class="cal-amount cal-income money-val">${formatCompactCalAmt(dayInc, '+')}</span>`);
    if (showBill && !showExp && !showInc) labels.push(`<span class="cal-amount cal-planned money-val">${formatCompactCalAmt(billsSum)}₽</span>`);
    if (pay && !showExp && !showInc && !showBill) labels.push('<span class="cal-payday-label">ЗП</span>');
    const description = [`${d} ${mNames[state.calMonth]} ${state.calYear}`];
    if (showExp) description.push(`Расходы ${fmtR(dayExp)}`);
    if (showInc) description.push(`Доходы ${fmtR(dayInc)}`);
    if (showBill) description.push(`Платежи ${fmtR(billsSum)}`);
    if (pay) description.push('День зарплаты');
    if (isToday) description.push('Сегодня');
    html += `<button type="button" data-cal-date="${iso}" onclick="pickCalDay('${iso}')" class="${classes.join(' ')}" aria-label="${escapeHtml(description.join('. '))}" aria-pressed="${sel}" ${isToday ? 'aria-current="date"' : ''}>
      <span class="cal-day-number">${d}</span>
      <span class="cal-day-amounts">${labels.join('')}</span>
      ${showBill && (showExp || showInc) ? '<span class="cal-bill-dot" aria-hidden="true"></span>' : ''}
    </button>`;
  }

  const totalCells = offset + totalDays;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextYear = state.calMonth === 11 ? state.calYear + 1 : state.calYear;
  const nextMonth = state.calMonth === 11 ? 1 : state.calMonth + 2;
  for (let d = 1; d <= trailing; d++) {
    const nextIso = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += `<button type="button" onclick="pickCalDayFromAdjacent('${nextIso}')" class="cal-day is-adjacent"><span class="cal-day-number">${d}</span></button>`;
  }

  document.getElementById('cal-cells').innerHTML = html;
  if (focusedCalDate) document.querySelector(`[data-cal-date="${focusedCalDate}"]`)?.focus({ preventScroll: true });
  document.getElementById('cal-period-summary').textContent = `Операций: ${monthTxs.length} · Без трат: ${zeroSpendDays} дн.`;

  const payDays = daysLeft(state.payday);
  const upcoming = state.bills
    .filter(b => !b.is_paid)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  document.getElementById('cal-upcoming-events').innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-brand"></i>
        <span class="text-xs font-bold text-main">Ритм до зарплаты</span>
      </div>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2C65D]/15 text-gold border border-[#F2C65D]/30">
        ${state.payday === TODAY ? 'Сегодня зарплата!' : `Через ${payDays} дн. · ${humanDate(state.payday)}`}
      </span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="input-surface p-2.5 rounded-xl">
        <div class="text-[10px] text-sub">Безопасно в день</div>
        <div class="font-extrabold text-brand tabular-nums mt-0.5">${fmtR(m.dailyLeft)}</div>
      </div>
      <div class="input-surface p-2.5 rounded-xl">
        <div class="text-[10px] text-sub">Резерв платежей (${upcoming.length})</div>
        <div class="font-extrabold text-gold tabular-nums mt-0.5">${fmtR(m.billsReserved)}</div>
      </div>
    </div>
  `;

  const dayBills = (calFilter === 'all' || calFilter === 'bills') ? state.bills.filter(b => b.due_date === state.calSelected && !b.is_paid) : [];
  document.getElementById('cal-day-bills').innerHTML = dayBills.map(b => `
    <div class="card-surface p-3 flex justify-between items-center gap-2 border border-[#F2C65D]/35">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-[#F2C65D]/15 text-gold flex items-center justify-center shrink-0">
          <i data-lucide="calendar-clock" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-bold text-main truncate">${escapeHtml(b.title)}</div>
          <div class="text-[11px] font-semibold text-gold tabular-nums">${fmtR(b.amount)} · Запланировано</div>
        </div>
      </div>
      <button type="button" onclick="payBill('${b.id}')" class="px-3 py-1.5 rounded-lg btn-turquoise text-xs shrink-0">Оплатить</button>
    </div>
  `).join('');

  let dayTxs = calendarTxs.filter(t => t.date === state.calSelected);
  if (calFilter === 'expense') dayTxs = dayTxs.filter(t => t.type === 'expense');
  if (calFilter === 'income') dayTxs = dayTxs.filter(t => t.type === 'income');
  if (calFilter === 'bills') dayTxs = [];

  const dayExpSum = FM.sum(dayTxs.filter(t => t.type === 'expense'),t=>t.amount);
  const dayIncSum = FM.sum(dayTxs.filter(t => t.type === 'income'),t=>t.amount);

  document.getElementById('cal-day-heading').textContent = formatCalDayFullHeading(state.calSelected);
  const totalBadges = [];
  if (dayIncSum > 0) totalBadges.push(`<span class="cal-income money-val">+${fmtR(dayIncSum)}</span>`);
  if (dayExpSum > 0) totalBadges.push(`<span class="cal-expense money-val">−${fmtR(dayExpSum)}</span>`);
  document.getElementById('cal-day-total').innerHTML = totalBadges.length ? totalBadges.join(' · ') : '0 ₽';

  document.getElementById('cal-day-count').textContent = `Операции: ${dayTxs.length}${dayBills.length ? ` · Платежи: ${dayBills.length}` : ''}`;
  document.getElementById('cal-day-txs').innerHTML = dayTxs.length
    ? dayTxs.map(t => {
        const income = t.type === 'income';
        const catName = income ? 'Пополнение' : (CATS[t.category]?.name || 'Прочее');
        return `<button type="button" data-operation-row="${escapeHtml(t.id)}" data-operation-type="${income ? 'income' : 'expense'}" class="cal-operation">
          <span class="cal-operation-icon" aria-hidden="true"><i data-lucide="${income ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i></span>
          <span class="cal-operation-copy"><span class="cal-operation-title">${escapeHtml(t.merchant || 'Операция')}</span><span class="cal-operation-meta">${escapeHtml(catName)}${t.time ? ` · ${escapeHtml(t.time)}` : ''}</span></span>
          <span class="cal-operation-amount money-val ${income ? 'cal-income' : 'cal-expense'}">${fmtR(t.amount, income ? '+' : '−')}</span>
        </button>`;
      }).join('')
    : `<div class="cal-empty"><i data-lucide="${calFilter === 'bills' ? 'calendar-check' : 'leaf'}" class="w-6 h-6" aria-hidden="true"></i><p>${calFilter === 'bills' ? (dayBills.length ? 'Платежи на этот день показаны выше' : 'На этот день платежей нет') : 'В этот день пока нет операций'}</p><button type="button" onclick="openAddModalForDate('${state.calSelected}')" class="btn-teal-soft">+ Добавить операцию</button></div>`;
  document.querySelectorAll('#cal-day-txs [data-operation-row]').forEach(row => row.addEventListener('click', () => openTxModal(row.dataset.operationRow)));
  animateOperationRows(document.getElementById('cal-day-txs'), `${state.calSelected}:${calFilter}`, forceReveal);

  if (window.lucide) lucide.createIcons();
}

function setAnalyticsMode(idx, mode) {
  vibro('selection');
  state.analyticsMode = mode;
  document.getElementById('an-thumb').style.transform = `translateX(${idx * 100}%)`;
  document.querySelectorAll('#an-seg .seg-item').forEach((el, i) => {
    el.className = `seg-item py-1 ${i === idx ? 'text-[#041311] font-bold' : 'text-sub'}`;
  });
  renderAnalytics();
}

function renderAnalytics() {
  const rating = calcDetailedRating();
  document.getElementById('an-score-val').textContent = rating.ready ? rating.total : '—';
  document.getElementById('an-score-badge').textContent = rating.badge;
  const scoreArc = document.getElementById('an-score-ring-arc');
  if (scoreArc) {
    const circScore = 163.36;
    const pctScore = rating.ready ? Math.max(0, Math.min(100, rating.total)) / 100 : 0;
    scoreArc.style.strokeDashoffset = String(circScore * (1 - pctScore));
  }
  document.getElementById('an-score-breakdown').innerHTML = rating.factors.map(f => `
    <div class="space-y-1">
      <div class="flex justify-between text-[11px]"><span class="text-main font-medium">${f.name}</span><span class="text-sub tabular-nums">${f.score} / ${f.weight}</span></div>
      <div class="w-full h-1.5 rounded-full overflow-hidden" style="background: var(--surface-2);"><div class="h-full rounded-full living-progress-bar" style="width:${Math.round((f.score / f.weight) * 100)}%; background:#00D6C3;"></div></div>
      <div class="text-[10px] text-dim">${f.tip}</div>
    </div>
  `).join('');

  const intel = detectSubscriptionsAndAnomalies();
  document.getElementById('an-detective-list').innerHTML = intel.anomalies.map(a => `
    <div class="input-surface p-3 space-y-1">
      <div class="text-xs font-bold text-main">${escapeHtml(a.title)}</div>
      <div class="text-[11px] text-sub">${escapeHtml(a.desc)}</div>
    </div>
  `).join('');

  document.getElementById('an-subs-summary').textContent = `За месяц: ${fmtR(intel.monthlySubs)} · За год: ${fmtR(intel.annualSubs)}`;
  document.getElementById('an-subs-list').innerHTML = intel.subsList.length
    ? intel.subsList.map(s => `
        <div onclick="openSubscriptionGuide(${escapeHtml(JSON.stringify(s.title))}, ${s.amount * 12}, ${escapeHtml(JSON.stringify(s.id))})" class="input-surface p-2.5 flex justify-between text-xs cursor-pointer">
          <div><div class="font-semibold text-main">${escapeHtml(s.title)}</div><div class="text-[10px] text-sub">${escapeHtml(s.source)}</div></div>
          <div class="text-right"><div class="font-bold text-gold">${fmtR(s.amount)}</div><div class="text-[10px] text-red-400">Отменить →</div></div>
        </div>
      `).join('')
    : `<div class="text-xs text-sub">Подписок пока не обнаружено</div>`;

  const daysSpan = state.analyticsMode === 'cycle' ? 14 : 30;
  const cutoff = FM.shift(TODAY,1-daysSpan);
  const expenses = FM.transactions(state.transactions,cutoff,TODAY).filter(t => t.type === 'expense');
  const total = FM.sum(expenses,t=>t.amount);
  document.getElementById('an-chart-headline').textContent = `${fmtR(total)} за ${daysSpan} дн.`;
  document.getElementById('an-total-spent').textContent = fmtR(total);
  document.getElementById('donut-center-val').textContent = fmtR(total);

  // График + данные для тактильного скраббинга
  const dayMap = {};
  expenses.forEach(t => dayMap[t.date] = FM.add(dayMap[t.date],t.amount));
  const pts = [];
  for (let i = 6; i >= 0; i--) {
    const dIso = offsetDateISO(-i);
    pts.push({ val: dayMap[dIso] || 0, dateIso: dIso });
  }
  const maxVal = Math.max(...pts.map(p => p.val), 500) * 1.15;
  const coords = pts.map((p, idx) => ({
    x: (idx / 6) * 300,
    y: 84 - (p.val / maxVal) * 70,
    val: p.val,
    dateIso: p.dateIso
  }));
  window._anChartPoints = coords;
  window._anChartDefaultHeadline = `${fmtR(total)} за ${daysSpan} дн.`;
  let dPath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cx = (coords[i].x + coords[i + 1].x) / 2;
    dPath += ` C ${cx} ${coords[i].y}, ${cx} ${coords[i + 1].y}, ${coords[i + 1].x} ${coords[i + 1].y}`;
  }
  document.getElementById('an-svg-line').setAttribute('d', dPath);
  document.getElementById('an-svg-area').setAttribute('d', `${dPath} L 300 90 L 0 90 Z`);
  document.getElementById('an-svg-dots').innerHTML = coords.map(c => `<circle cx="${c.x}" cy="${c.y}" r="3" fill="#00D6C3" />`).join('');

  // Круговая диаграмма
  const byCat = {};
  expenses.forEach(t => byCat[t.category] = FM.add(byCat[t.category],t.amount));
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const donutEl = document.getElementById('donut-segments');
  const circ = 2 * Math.PI * 38;
  let off = 0;
  donutEl.innerHTML = total > 0 ? sorted.map(([cid, amt]) => {
    const c = CATS[cid] || CATS.other;
    const frac = amt / total;
    const seg = `<circle cx="50" cy="50" r="38" fill="none" stroke="${c.color}" stroke-width="11" stroke-dasharray="${frac * circ} ${circ}" stroke-dashoffset="${-off * circ}" />`;
    off += frac;
    return seg;
  }).join('') : '';

  document.getElementById('an-categories-bars').innerHTML = sorted.length
    ? sorted.map(([cid, amt]) => {
        const c = CATS[cid] || CATS.other;
        const lim = Number(state.catLimits[cid]) || 0;
        const pct = lim > 0 ? Math.min(100, Math.round((amt / lim) * 100)) : Math.round((amt / total) * 100);
        return `
          <div onclick="openCatLimitModal()" class="space-y-1 cursor-pointer tap">
            <div class="flex items-center justify-between text-[11px]">
              <span class="flex items-center gap-1.5 text-main font-semibold truncate">
                <span class="w-2 h-2 rounded-full shrink-0" style="background:${c.color}; box-shadow: 0 0 6px ${c.color};"></span>
                <span class="truncate">${c.name}</span>
              </span>
              <span class="money-val text-sub tabular-nums shrink-0 ml-1">${lim > 0 ? `${fmtR(amt)} / ${fmtR(lim)}` : `${fmtR(amt)} · ${pct}%`}</span>
            </div>
            <div class="w-full h-1.5 rounded-full overflow-hidden" style="background: var(--surface-2);">
              <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background: ${c.color};"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="text-xs text-sub">Статистика пока недостаточна</div>`;

  // FINTEX AI совет
  const aiEl = document.getElementById('an-ai-advice');
  if (sorted.length) {
    const topName = (CATS[sorted[0][0]] || CATS.other).name.toLowerCase();
    const weeklySave = Math.max(300, Math.round((sorted[0][1] * 0.2) / 100) * 100);
    aiEl.textContent = `Главная статья расходов — «${topName}» (${fmtR(sorted[0][1])}). Если сократить её на ${fmtN(weeklySave)} ₽ в неделю, за год накопится ~${fmtN(weeklySave * 52)} ₽.`;
  }

  // Топ мест
  const byMerch = {};
  expenses.forEach(t => { byMerch[t.merchant] = (byMerch[t.merchant] || 0) + t.amount; });
  const topMerch = Object.entries(byMerch).sort((a, b) => b[1] - a[1]).slice(0, 3);
  document.getElementById('an-top-merchants').innerHTML = topMerch.length
    ? topMerch.map(([name, sum]) => `
        <div class="input-surface p-2.5 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            ${merchantBadge(name, 'other', 'expense')}
            <span class="font-semibold text-main truncate">${name}</span>
          </div>
          <span class="font-bold text-main tabular-nums shrink-0">${fmtR(sum)}</span>
        </div>
      `).join('')
    : `<div class="text-xs text-sub">Пока нет статистики по магазинам</div>`;

  renderCategoryGraph();
  renderPriceTrackerPreview();
  renderActivityHeatmap();
}

function renderSettings() {
  document.getElementById('st-avatar').textContent = firstGrapheme(state.name, 'F');
  document.getElementById('st-name').textContent = state.name || 'Пользователь';
  document.getElementById('st-bank').textContent = state.bank;
  document.getElementById('gas-url-field').value = state.gasUrl;
  const adCb = document.getElementById('auto-delta-toggle'); if (adCb) adCb.checked = localStorage.getItem('fp_auto_delta') !== '0';

  const syncLabel = document.getElementById('st-sync-label');
  if (syncLabel) syncLabel.textContent = window.FintexCloud.canSync() ? 'Облако: подключение через Telegram' : 'Локальные данные · для облака войдите через Telegram';
  const scansList = document.getElementById('saved-scans-list');
  scansList.innerHTML = state.scanHistory.length
    ? state.scanHistory.map(s => `
        <div class="input-surface p-2.5 flex items-center justify-between text-xs">
          <div class="min-w-0">
            <div class="font-semibold text-main truncate">${escapeHtml(s.merchant)} · ${fmtR(s.total || 0)}</div>
            <div class="text-[10px] text-sub">${s.date} · ${s.confirmed ? 'Подтверждён' : 'Черновик'}</div>
          </div>
          <button type="button" onclick="reprocessCurrentScan('${s.scan_id}')" class="px-2.5 py-1 rounded-lg btn-teal-soft text-[11px] font-semibold">Повторить</button>
        </div>
      `).join('')
    : `<div class="text-xs text-sub">Нет сохранённых оригиналов</div>`;
}

// ==================== ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ ====================
// ==================== 1. РЕЖИМ «СТЕЛС» (BLUR-ЗАЩИТА + ДВОЙНОЙ ТАП + ВСТРЯХИВАНИЕ iPhone) ====================
function applyStealthUI() {
  const active = Boolean(state.privacyMode);
  document.body.classList.toggle('stealth-mode', active);
  window.FintexNumerals.syncPrivacy();
  const pill = document.getElementById('stealth-pill');
  if (pill) pill.classList.toggle('hidden', !active);
  const eyeIcon = document.getElementById('privacy-eye-icon');
  if (eyeIcon) {
    eyeIcon.setAttribute('data-lucide', active ? 'eye-off' : 'eye');
    lucide.createIcons();
  }
}

function toggleStealthMode(silent = false) {
  vibro('medium');
  state.privacyMode = !state.privacyMode;
  localStorage.setItem('fp_privacy', state.privacyMode ? '1' : '0');
  applyStealthUI();
  if (!silent) {
    toast(state.privacyMode ? 'Режим «Стелс» включён (суммы размыты)' : 'Режим «Стелс» выключен');
  }
}

function togglePrivacy() {
  toggleStealthMode(false);
}

let lastHeroTapTs = 0;
function handleHeroTouchTap(e) {
  if (e.target.closest('button')) return;
  const now = Date.now();
  if (now - lastHeroTapTs < 320) {
    lastHeroTapTs = 0;
    toggleStealthMode(false);
  } else {
    lastHeroTapTs = now;
  }
}

// Детектор встряхивания iPhone для мгновенного включения режима «Стелс»
let lastShakeTs = 0;
function initShakeToStealth() {
  window.addEventListener('devicemotion', (e) => {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    if (mag > 24) {
      const now = Date.now();
      if (now - lastShakeTs > 1400) {
        lastShakeTs = now;
        toggleStealthMode(false);
      }
    }
  }, { passive: true });
}

// ==================== 2. ЖИВАЯ 3D-КАРТА СЧЁТА (ГИРОСКОП iPhone + ПАРАЛЛАКС БЛИКА) ====================
function applyCardTilt(rx, ry, gx, gy) {
  const card = document.getElementById('hero-balance-card');
  const glare = document.getElementById('hero-glare-layer');
  if (!card || localStorage.getItem('fp_motion') === '0') return;
  card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  if (glare) {
    glare.style.setProperty('--gx', `${gx.toFixed(1)}%`);
    glare.style.setProperty('--gy', `${gy.toFixed(1)}%`);
    glare.style.setProperty('--go', '0.78');
  }
}

function resetCardTilt() {
  const card = document.getElementById('hero-balance-card');
  const glare = document.getElementById('hero-glare-layer');
  if (card) card.style.transform = 'rotateX(0deg) rotateY(0deg)';
  if (glare) glare.style.setProperty('--go', '0.45');
}

function attachGyroListener() {
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma === null || e.beta === null) return;
    const gamma = Math.max(-25, Math.min(25, e.gamma)); // влево-вправо
    const beta = Math.max(15, Math.min(75, e.beta)) - 45; // наклон телефона в руке
    const ry = (gamma / 25) * 6.5;
    const rx = (-beta / 30) * 5.5;
    const gx = 50 + (gamma / 25) * 42;
    const gy = 50 + (beta / 30) * 42;
    applyCardTilt(rx, ry, gx, gy);
  }, { passive: true });
}

async function requestGyroPermission() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        attachGyroListener();
        document.getElementById('gyro-enable-btn')?.classList.add('hidden');
        vibro('success');
        toast('3D-гироскоп карты активирован');
      }
    }
  } catch (e) {}
}

function initHeroCard3D() {
  const card = document.getElementById('hero-balance-card');
  if (!card) return;

  // Touch / Pointer интерактивный наклон на любом экране
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    applyCardTilt(-ny * 8, nx * 10, (nx + 0.5) * 100, (ny + 0.5) * 100);
  });
  card.addEventListener('pointerleave', resetCardTilt);
  card.addEventListener('touchend', resetCardTilt);

  // Гироскоп iPhone
  if (typeof DeviceOrientationEvent !== 'undefined') {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.getElementById('gyro-enable-btn')?.classList.remove('hidden');
    } else {
      attachGyroListener();
    }
  }
}

// ==================== 3. ГОЛОСОВОЙ ВВОД РАСХОДОВ НА ЛЕТУ (WEB SPEECH API) ====================
let speechRec = null;
let isListeningVoice = false;
let parsedVoiceItems = [];

function wordsToNumbersRu(text) {
  let s = ' ' + text.toLowerCase().replace(/ё/g, 'е') + ' ';
  s = s.replace(/\bполторы\s+тысяч[иа]?\b/g, ' 1500 ');
  s = s.replace(/\bполтинник[а-я]*\b/g, ' 50 ');
  s = s.replace(/\bсотк[ауи]\b/g, ' 100 ');
  s = s.replace(/\bкосар[ьяей]+\b/g, ' 1000 ');

  const mults = { 'тысяч': 1000, 'тысячи': 1000, 'тысяча': 1000, 'тыщи': 1000, 'тыщ': 1000 };
  const nums = {
    'один': 1, 'одна': 1, 'одну': 1,
    'два': 2, 'две': 2,
    'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9,
    'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'тринадцать': 13, 'четырнадцать': 14,
    'пятнадцать': 15, 'шестнадцать': 16, 'семнадцать': 17, 'восемнадцать': 18, 'девятнадцать': 19,
    'двадцать': 20, 'тридцать': 30, 'сорок': 40, 'пятьдесят': 50, 'шестьдесят': 60,
    'семьдесят': 70, 'восемьдесят': 80, 'девяносто': 90,
    'сто': 100, 'двести': 200, 'триста': 300, 'четыреста': 400, 'пятьсот': 500,
    'шестьсот': 600, 'семьсот': 700, 'восемьсот': 800, 'девятьсот': 900
  };

  const tokens = s.trim().split(/\s+/);
  const out = [];
  let totalAcc = 0;
  let curAcc = 0;
  let inNumber = false;

  for (const tok of tokens) {
    if (/^\d+[.,]\d{1,2}$/.test(tok)) {
      if (inNumber) out.push(String(totalAcc+curAcc));
      totalAcc=0; curAcc=0; inNumber=false; out.push(tok.replace(',','.')); continue;
    }
    const cleanTok = tok.replace(/[.,!?]/g, '');
    if (/^\d+$/.test(cleanTok)) {
      if (inNumber) {
        out.push(String(totalAcc + curAcc));
        totalAcc = 0; curAcc = 0;
      }
      curAcc += Number(cleanTok);
      inNumber = true;
    } else if (nums[cleanTok] !== undefined) {
      curAcc += nums[cleanTok];
      inNumber = true;
    } else if (mults[cleanTok] !== undefined) {
      totalAcc += (curAcc || 1) * mults[cleanTok];
      curAcc = 0;
      inNumber = true;
    } else {
      if (inNumber) {
        out.push(String(totalAcc + curAcc));
        totalAcc = 0; curAcc = 0; inNumber = false;
      }
      out.push(tok);
    }
  }
  if (inNumber) out.push(String(totalAcc + curAcc));
  return out.join(' ');
}

function parseSpokenRussianExpenses(rawSpeech) {
  const normalized = wordsToNumbersRu(rawSpeech);
  const segments = FM.parseExpenses(normalized);
  const items = [];

  segments.forEach(parsed => {
    const seg = parsed.merchant;
    const amount = parsed.amount;

    // Ищем известный бренд или очищаем глаголы/предлоги
    let merchant = '';
    for (const b of BRAND_REGISTRY) {
      if (b.re.test(seg)) {
        const m = seg.match(b.re);
        if (m) { merchant = m[0]; break; }
      }
    }
    if (!merchant) {
      merchant = seg
        .replace(/\b(рублей|рубль|рубля|руб|р|на|за|в|во|купил|купила|потратил|потратила|оплатил|оплатила|заправился|заправилась|сходил|сходила)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    merchant = normalizeMerchantName(merchant || 'Покупка');
    items.push({
      merchant,
      amount,
      category: classifyCategory(merchant),
      type: 'expense',
      date: TODAY
    });
  });

  return items;
}

function openVoiceModal() {
  vibro('medium');
  parsedVoiceItems = [];
  document.getElementById('voice-transcript-inp').value = '';
  document.getElementById('voice-parsed-list').innerHTML = '';
  document.getElementById('voice-commit-btn').classList.add('hidden');
  document.getElementById('modal-voice').classList.remove('hidden');
  resetVoiceCordSpring();
  lucide.createIcons();
  startVoiceRecognition();
}

function resetVoiceCordSpring() {
  const btn = document.getElementById('voice-mic-toggle-btn');
  const path = document.getElementById('voice-cord-path');
  if (btn) {
    btn.style.transition = 'transform 0.48s cubic-bezier(0.34, 1.56, 0.64, 1)';
    btn.style.transform = 'translate(0px, 0px) scale(1)';
  }
  if (path) {
    path.setAttribute('d', 'M 60 2 Q 60 22 60 40');
  }
}

function initVoicePullCordPhysics() {
  const btn = document.getElementById('voice-mic-toggle-btn');
  const path = document.getElementById('voice-cord-path');
  if (!btn || !path) return;

  let startX = 0, startY = 0;
  let isPulling = false;
  let triggeredPull = false;

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    isPulling = true;
    triggeredPull = false;
    btn.style.transition = 'none';
    vibro('light');
  });

  btn.addEventListener('pointermove', (e) => {
    if (!isPulling) return;
    const rawDx = e.clientX - startX;
    const rawDy = e.clientY - startY;
    // Резиновое сопротивление шнура (damped spring)
    const dx = Math.max(-28, Math.min(28, rawDx * 0.45));
    const dy = Math.max(-10, Math.min(46, rawDy * 0.58));
    const stretchScale = 1 + Math.max(0, dy) * 0.0035;

    btn.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${stretchScale.toFixed(3)})`;
    const endX = 60 + dx;
    const endY = 40 + dy;
    const ctrlX = 60 + dx * 0.35;
    const ctrlY = 20 + dy * 0.45;
    path.setAttribute('d', `M 60 2 Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`);

    if (dy >= 28 && !triggeredPull) {
      triggeredPull = true;
      vibro('medium');
    } else if (dy < 28 && triggeredPull) {
      triggeredPull = false;
      vibro('selection');
    }
  });

  function releaseCord(e) {
    if (!isPulling) return;
    const movedDist = Math.hypot((e?.clientX || startX) - startX, (e?.clientY || startY) - startY);
    isPulling = false;
    resetVoiceCordSpring();

    // Срабатывает как при оттягивании шнура вниз, так и при обычном тапе
    if (triggeredPull || movedDist < 12) {
      vibro('success');
      toggleVoiceListening();
    }
    triggeredPull = false;
  }

  btn.addEventListener('pointerup', releaseCord);
  btn.addEventListener('pointercancel', releaseCord);
}

// ==================== ГРАФ СВЯЗЕЙ ФИНАНСОВЫХ КАТЕГОРИЙ ====================
let selectedGraphCatId = 'food';

function selectCategoryGraphNode(catId) {
  vibro('selection');
  selectedGraphCatId = catId;
  renderCategoryGraph();
}

function renderCategoryGraph() {
  const nodesBox = document.getElementById('cat-graph-nodes');
  if (!nodesBox) return;

  const expenses = FM.transactions(state.transactions,null,TODAY).filter(t => t.type === 'expense');
  const byCat = {};
  Object.keys(CATS).forEach(cid => { byCat[cid] = []; });
  expenses.forEach(t => {
    const cid = CATS[t.category] ? t.category : 'other';
    byCat[cid].push(t);
  });

  const activeCats = Object.values(CATS).filter(c => byCat[c.id].length > 0);
  const displayCats = activeCats.length ? activeCats : Object.values(CATS).slice(0, 4);

  if (!displayCats.some(c => c.id === selectedGraphCatId)) {
    selectedGraphCatId = displayCats[0].id;
  }

  nodesBox.innerHTML = displayCats.map(c => {
    const list = byCat[c.id] || [];
    const sum = FM.sum(list,x=>x.amount);
    const sel = c.id === selectedGraphCatId;
    return `
      <button type="button" onclick="selectCategoryGraphNode('${c.id}')" class="cat-node-btn ${sel ? 'is-selected' : ''} input-surface px-3 py-2 rounded-xl border border-white/10 flex items-center gap-2 shrink-0 text-left">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${c.color}; box-shadow: 0 0 8px ${c.color};"></span>
        <div>
          <div class="text-[11px] font-bold text-main leading-tight">${c.name}</div>
          <div class="text-[9px] text-sub tabular-nums">${fmtR(sum)} · ${list.length}</div>
        </div>
      </button>
    `;
  }).join('');

  const curCat = CATS[selectedGraphCatId] || CATS.food;
  const curList = byCat[curCat.id] || [];
  const curTotal = FM.sum(curList,x=>x.amount);

  document.getElementById('cg-selected-title').textContent = `${curCat.name} (${curList.length} связей)`;
  document.getElementById('cg-selected-total').textContent = fmtR(curTotal);

  if (!curList.length) {
    document.getElementById('cg-node-merchants').textContent = 'Нет точек';
    document.getElementById('cg-node-periods').textContent = 'Нет дат';
    document.getElementById('cg-node-txs').textContent = 'Нет записей';
    return;
  }

  // Связанные магазины
  const merchCount = {};
  curList.forEach(t => { merchCount[t.merchant] = (merchCount[t.merchant] || 0) + t.amount; });
  const topMerch = Object.entries(merchCount).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => m);
  document.getElementById('cg-node-merchants').innerHTML = topMerch.map(m => `<div class="truncate">• ${m}</div>`).join('');

  // Связанные периоды / дни недели
  const wdNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const wdSet = new Set();
  curList.slice(0, 5).forEach(t => {
    const [y, m, d] = t.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    wdSet.add(`${wdNames[dt.getDay()]}, ${humanDate(t.date)}`);
  });
  document.getElementById('cg-node-periods').innerHTML = Array.from(wdSet).slice(0, 2).map(p => `<div class="truncate">• ${p}</div>`).join('');

  // Связанные операции
  document.getElementById('cg-node-txs').innerHTML = curList.slice(0, 2).map(t => `<div class="truncate tabular-nums">-${fmtN(t.amount)} ₽</div>`).join('');
}

function toggleVoiceListening() {
  if (isListeningVoice) stopVoiceRecognition();
  else startVoiceRecognition();
}

function startVoiceRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusEl = document.getElementById('voice-status-label');
  const waveEl = document.getElementById('voice-wave-box');

  if (!SpeechRec) {
    statusEl.textContent = 'Диктовка недоступна в этом окне — введите или надиктуйте текст с клавиатуры iPhone ниже';
    document.getElementById('voice-transcript-inp').focus();
    return;
  }

  try {
    if (speechRec) speechRec.abort();
    speechRec = new SpeechRec();
    speechRec.lang = 'ru-RU';
    speechRec.interimResults = true;
    speechRec.maxAlternatives = 1;

    speechRec.onstart = () => {
      isListeningVoice = true;
      document.getElementById('voice-mic-toggle-btn')?.classList.add('is-listening');
      waveEl.classList.remove('hidden');
      statusEl.textContent = 'Слушаю... Говорите покупки и суммы';
    };

    speechRec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      document.getElementById('voice-transcript-inp').value = transcript;
      parseVoiceDraftText();
    };

    speechRec.onerror = (ev) => {
      isListeningVoice = false;
      document.getElementById('voice-mic-toggle-btn')?.classList.remove('is-listening');
      waveEl.classList.add('hidden');
      statusEl.textContent = ev.error === 'not-allowed'
        ? 'Доступ к микрофону запрещён — используйте микрофон на клавиатуре iPhone в поле ниже'
        : 'Нажмите на микрофон, чтобы повторить запись';
    };

    speechRec.onend = () => {
      isListeningVoice = false;
      document.getElementById('voice-mic-toggle-btn')?.classList.remove('is-listening');
      waveEl.classList.add('hidden');
      if (parsedVoiceItems.length > 0) {
        statusEl.textContent = `Распознано операций: ${parsedVoiceItems.length}`;
      } else {
        statusEl.textContent = 'Нажмите на микрофон и продиктуйте траты';
      }
    };

    speechRec.start();
  } catch (e) {
    statusEl.textContent = 'Нажмите на поле ниже и используйте голосовой ввод клавиатуры iPhone';
  }
}

function stopVoiceRecognition() {
  isListeningVoice = false;
  document.getElementById('voice-mic-toggle-btn')?.classList.remove('is-listening');
  document.getElementById('voice-wave-box')?.classList.add('hidden');
  try { if (speechRec) speechRec.stop(); } catch (e) {}
}

function parseVoiceDraftText() {
  const txt = document.getElementById('voice-transcript-inp').value.trim();
  parsedVoiceItems = parseSpokenRussianExpenses(txt);
  const listEl = document.getElementById('voice-parsed-list');
  const btn = document.getElementById('voice-commit-btn');

  if (!parsedVoiceItems.length) {
    listEl.innerHTML = '';
    btn.classList.add('hidden');
    return;
  }

  listEl.innerHTML = parsedVoiceItems.map(it => `
    <div class="input-surface p-3 flex items-center justify-between text-xs">
      <div class="flex items-center gap-2.5 min-w-0">
        ${merchantBadge(it.merchant, it.category, 'expense')}
        <div class="min-w-0">
          <div class="font-bold text-main truncate">${escapeHtml(it.merchant)}</div>
          <div class="text-[10px] text-sub">${(CATS[it.category] || CATS.other).name}</div>
        </div>
      </div>
      <span class="font-extrabold text-gold tabular-nums">-${fmtR(it.amount)}</span>
    </div>
  `).join('');

  btn.classList.remove('hidden');
  btn.textContent = `Записать (${parsedVoiceItems.length} опер. на ${fmtR(FM.sum(parsedVoiceItems,x=>x.amount))})`;
  lucide.createIcons();
}

function commitVoiceExpenses() {
  if (!parsedVoiceItems.length) return;
  stopVoiceRecognition();
  const total = FM.sum(parsedVoiceItems,x=>x.amount);
  addOrMergeTransactions(parsedVoiceItems, 'Голос');
  parsedVoiceItems = [];
  closeModals();
  vibro('success');
  updateSyncQueueUI();
renderAll(false);
  toast(`Записано голосом: -${fmtR(total)}`);
}

// ==================== 4. ЭКСПОРТ ПЛАТЕЖЕЙ И ЗАРПЛАТЫ В КАЛЕНДАРЬ iOS (.ICS) ====================
function exportToIosCalendar() {
  vibro('medium');
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FINTEX//Financial Autopilot//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  state.bills.filter(b => !b.is_paid && b.is_recurring).forEach(b => {
    const dtStart = (b.due_date || TODAY).replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:fintex-bill-${b.id}@fintex.app`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    if (b.is_recurring) lines.push('RRULE:FREQ=MONTHLY');
    lines.push(`SUMMARY:Оплата: ${b.title} (${b.amount} ₽)`);
    lines.push(`DESCRIPTION:Напоминание FINTEX Autopilot об обязательном списании ${b.amount} ₽.`);
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P1D');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Завтра списание по бюджету FINTEX');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  if (state.payday) {
    const payStart = state.payday.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:fintex-payday-${payStart}@fintex.app`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${payStart}`);
    lines.push('SUMMARY:День зарплаты • FINTEX');
    lines.push('DESCRIPTION:Обновите бюджетный цикл и пополните финансовую подушку в FINTEX.');
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT9H');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Сегодня день зарплаты в FINTEX');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  const icsContent = lines.join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const file = new File([blob], 'FINTEX_Calendar.ics', { type: 'text/calendar' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      files: [file],
      title: 'Финансовый календарь FINTEX',
      text: 'Напоминания о платежах, подписках и зарплате'
    }).catch(() => {});
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'FINTEX_Calendar.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Файл FINTEX_Calendar.ics сформирован');
}
function setFilter(id) { vibro('selection'); state.filterCat = id; renderHome(); }
function toggleSearch() { document.getElementById('search-bar-wrap').classList.toggle('hidden'); }
function shiftCalMonth(d) {
  const next = new Date(state.calYear, state.calMonth + d, 1);
  const day = Number((state.calSelected || TODAY).slice(8, 10)) || 1;
  state.calYear = next.getFullYear();
  state.calMonth = next.getMonth();
  const lastDay = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  state.calSelected = localDateISO(new Date(state.calYear, state.calMonth, Math.min(day, lastDay)));
  renderCalendar();
}
function pickCalDay(iso) { state.calSelected = iso; renderCalendar(); }
function openCanIBuyModal() {
  document.getElementById('cb-title').value = '';
  document.getElementById('cb-amount').value = '';
  calculateCanIBuy();
  document.getElementById('modal-can-buy').classList.remove('hidden');
}
function calculateCanIBuy() {
  window.FintexWorkTime?.refreshPurchase();
  const amt = Math.max(0, FM.parse(document.getElementById('cb-amount').value) || 0);
  const m = calcMetrics();
  if (amt <= 0) {
    document.getElementById('cb-verdict-title').textContent = 'Введите стоимость покупки';
    document.getElementById('cb-enough').textContent = '—';
    document.getElementById('cb-cushion').textContent = '—';
    document.getElementById('cb-economy-days').textContent = '—';
    document.getElementById('cb-safe-date').textContent = '—';
    return;
  }
  const after = m.freePool - amt;
  document.getElementById('cb-verdict-title').textContent = after >= 0 ? 'В пределах свободной суммы' : 'Риск дефицита бюджета';
  document.getElementById('cb-enough').textContent = after >= 0 ? 'Да, хватит' : `Не хватает ${fmtR(Math.abs(after))}`;
  document.getElementById('cb-cushion').textContent = after >= 0 ? 'Не пострадает' : 'Придётся затронуть подушку';
  document.getElementById('cb-economy-days').textContent = m.dailyCap > 0 ? `${Math.ceil(amt / m.dailyCap)} дн.` : 'Нет дневного бюджета';
  document.getElementById('cb-safe-date').textContent = after >= 0 ? 'В пределах остатка' : 'После пополнения — дата неизвестна';

  clearTimeout(window._cbHapticTimer);
  window._cbHapticTimer = setTimeout(() => {
    if (after < 0) vibro('warning');
    else if (amt > m.dailyLeft) vibro('medium');
    else vibro('light');
  }, 180);
}
function commitCanIBuy() {
  const amt = Math.max(0, FM.parse(document.getElementById('cb-amount').value) || 0);
  const title = document.getElementById('cb-title').value.trim() || 'Покупка';
  if (amt <= 0) return;
  addOrMergeTransactions([{ merchant: title, amount: amt, category: classifyCategory(title), type: 'expense', date: TODAY }], 'Вручную');
  closeModals(); renderAll(false); toast(`Записано: -${fmtR(amt)}`);
}

function openSubscriptionGuide(title, annualCost, billId) {
  document.getElementById('sg-title').textContent = title;
  document.getElementById('sg-cost').textContent = `Экономия при отмене: ${fmtR(annualCost)} / год`;
  document.getElementById('sg-steps').textContent = 'Откройте настройки подписок в App Store (Настройки iPhone → Apple ID → Подписки) или в приложении сервиса и отключите автопродление.';
  document.getElementById('sg-remove-btn').onclick = () => { deleteBill(billId); closeModals(); };
  document.getElementById('modal-sub-guide').classList.remove('hidden');
}

function openForecastExplainModal() {
  const m = calcMetrics();
  document.getElementById('forecast-math-body').innerHTML = `
    <div class="flex justify-between"><span>На карте:</span><strong>${fmtR(state.balance)}</strong></div>
    <div class="flex justify-between"><span>Резерв и подушка:</span><strong class="text-gold">-${fmtR(m.reserved)}</strong></div>
    <div class="flex justify-between pt-1 border-t divider-line"><span>Свободно:</span><strong class="text-brand">${fmtR(m.freePool)}</strong></div>
    <div class="flex justify-between"><span>Норма (${m.days} дн.):</span><strong>${fmtR(m.dailyCap)} / день</strong></div>
    <p class="text-xs text-sub">Дневной бюджет: (свободные деньги + сегодняшние повседневные траты) / дни до зарплаты, с округлением вниз до копейки. Платежи зарезервированы отдельно и в обычные траты не входят. Прогноз — оценка по доступной истории, не гарантия.</p>
  `;
  document.getElementById('modal-forecast-info').classList.remove('hidden');
}

function openGoalDetailsModal() {
  const saved = Number(state.goal?.saved) || 0;
  const target = Math.max(0.01, FM.money(state.goal?.target) || 10000);
  const pct = Math.min(100, Math.round((saved / target) * 100));
  document.getElementById('gd-title').textContent = state.goal?.title || 'Финансовая подушка';
  document.getElementById('gd-saved').textContent = fmtR(saved);
  document.getElementById('gd-pct').textContent = `${pct}%`;
  document.getElementById('gd-bar').style.width = `${pct}%`;
  document.getElementById('inp-goal-title').value = state.goal?.title || 'Финансовая подушка';
  document.getElementById('inp-goal-target').value = target;
  document.getElementById('modal-goal-detail').classList.remove('hidden');
}

function quickTopupGoal(amt) {
  amt = FM.money(amt);
  if (amt <= 0 || amt > calcMetrics().freePool) { toast('Недостаточно свободных денег для пополнения подушки'); return; }
  const prev = FM.money(state.goal.saved);
  const target = Math.max(0.01, FM.money(state.goal.target) || 10000);
  state.goal.saved = FM.add(prev, amt);
  persistAll();
  window.FintexBehavior?.recordSaving(amt);
  openGoalDetailsModal();
  updateSyncQueueUI();
  renderAll(false);
  if (prev < target && state.goal.saved >= target) {
    const celeb = document.getElementById('goal-celebrate-overlay');
    if (celeb) { celeb.classList.remove('hidden'); setTimeout(() => celeb.classList.add('hidden'), 1000); }
    toast('Поздравляем! Цель достигнута!');
  } else toast(`+${fmtR(amt)} в подушку`);
}

function withdrawFromGoal(amt, spendDirectly = false) {
  const saved = Math.max(0, FM.money(state.goal?.saved));
  if (saved <= 0) {
    vibro('error');
    toast('В финансовой подушке пока 0 ₽');
    return;
  }
  const requested = FM.money(amt);
  if (requested <= 0) { toast('Укажите положительную сумму'); return; }
  const take = Math.min(saved, requested);
  state.goal.saved = FM.add(saved, -take);
  if (spendDirectly) {
    addOrMergeTransactions([{
      merchant: `Из подушки (${state.goal?.title || 'Резерв'})`,
      amount: take,
      category: 'other',
      type: 'expense',
      date: TODAY
    }], 'Подушка');
    vibro('success');
    openGoalDetailsModal();
    renderAll(false);
    toast(`Потрачено из подушки: −${fmtR(take)}`);
  } else {
    persistAll();
    vibro('success');
    openGoalDetailsModal();
    renderAll(false);
    toast(`Переведено из подушки в доступные: +${fmtR(take)}`);
  }
  window.FintexBehavior?.recordSaving(-take);
}

function transferCustomGoal(spendDirectly = false) {
  const inp = document.getElementById('inp-goal-transfer-amt');
  const val = FM.parse(inp?.value) || 0;
  if (val <= 0) {
    vibro('error');
    toast('Укажите сумму перевода');
    return;
  }
  if (inp) inp.value = '';
  withdrawFromGoal(val, spendDirectly);
}

function saveGoalSettings() {
  const target=FM.parse(document.getElementById('inp-goal-target').value);
  if (target===null || target<=0) { toast('Укажите положительную сумму цели, не больше двух знаков после запятой'); return; }
  state.goal.title = document.getElementById('inp-goal-title').value.trim() || 'Финансовая подушка';
  state.goal.target = target;
  persistAll(); closeModals(); renderAll(false); toast('Цель обновлена');
}

function openTodayDetailModal() {
  const list = state.transactions.filter(t => t.date === TODAY && t.type === 'expense');
  document.getElementById('today-modal-list').innerHTML = list.length
    ? list.map(t => `<div class="p-3 flex justify-between text-xs"><span>${escapeHtml(t.merchant)}</span><span class="font-bold">-${fmtR(t.amount)}</span></div>`).join('')
    : `<div class="p-4 text-center text-xs text-sub">Сегодня трат не было</div>`;
  document.getElementById('modal-today').classList.remove('hidden');
}

function openTxModal(id) {
  state.editTxId = id;
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('mtx-name').textContent = t.merchant;
  document.getElementById('mtx-meta').textContent = `${fmtR(t.amount, t.type === 'income' ? '+' : '−')} · ${formatFeedRowDate(t.date)}${t.time ? `, ${t.time}` : ''} · ${t.source}`;
  const box = document.getElementById('mtx-items-box');
  if (Array.isArray(t.items) && t.items.length) {
    box.classList.remove('hidden');
    document.getElementById('mtx-items-list').innerHTML = t.items.map(it => {
      const cmp = getPriceComparison(it.name, it.price);
      return `
        <div class="flex items-center justify-between gap-2 py-1">
          <div class="flex items-center gap-2 min-w-0">
            ${getProductIconBadge(it.name, t.category)}
            <div class="min-w-0">
              <div class="text-main font-medium truncate">${escapeHtml(it.name)}</div>
              ${cmp ? `<div class="text-[9px] ${cmp.diff > 0 ? 'text-red-400' : cmp.diff < 0 ? 'text-brand' : 'text-sub'}">${escapeHtml(cmp.label)}</div>` : ''}
            </div>
          </div>
          <span class="text-main font-bold tabular-nums shrink-0">${fmtR(it.price)}</span>
        </div>
      `;
    }).join('');
    lucide.createIcons();
  } else box.classList.add('hidden');

  const grid = document.getElementById('mtx-cats');
  grid.innerHTML = t.type === 'income' ? '' : Object.values(CATS).map(c => `
    <button type="button" onclick="setTxCat('${c.id}')" class="p-2 rounded-xl border text-center text-[10px] font-medium ${t.category === c.id ? 'btn-turquoise' : 'input-surface text-sub'}">${c.name}</button>
  `).join('');
  document.getElementById('modal-tx').classList.remove('hidden');
}

function setTxCat(cid) {
  const t = state.transactions.find(x => x.id === state.editTxId);
  if (t) { t.category = cid; persistAll(); }
  closeModals(); renderAll(false); toast('Категория обновлена');
}

function repeatTxById(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  addOrMergeTransactions([{ merchant: t.merchant, amount: t.amount, category: t.category, type: t.type, date: TODAY }], 'Повтор');
  updateSyncQueueUI();
renderAll(false); toast('Операция повторена');
}
function repeatSelectedTx() { const id = state.editTxId; closeModals(); repeatTxById(id); }

let lastDeletedTxsBackup = [];

function undoLastTxDelete() {
  if (!Array.isArray(lastDeletedTxsBackup) || !lastDeletedTxsBackup.length) return;
  // Restore dependent bill cycles oldest first, regardless of feed ordering.
  [...lastDeletedTxsBackup].sort((a,b)=>String(a.bill_after?.last_paid_date||a.date).localeCompare(String(b.bill_after?.last_paid_date||b.date))).forEach(t => {
    if (!state.transactions.some(x => x.id === t.id)) {
      state.balance = FM.add(state.balance, t.type === 'income' ? t.amount : -t.amount);
      state.transactions.push(t);
      if(t.goal_withdrawal) { state.goal.saved=FM.add(state.goal.saved,-t.goal_withdrawal); window.FintexBehavior?.recordSaving(-t.goal_withdrawal); }
      if (t.bill_after) { const i=state.bills.findIndex(b=>b.id===t.bill_id); if(i>=0 && state.bills[i].due_date===t.bill_before?.due_date && state.bills[i].last_paid_tx_id===t.bill_before?.last_paid_tx_id) state.bills[i]={...t.bill_after}; }
    }
  });
  lastDeletedTxsBackup = [];
  persistAll();
  updateSyncQueueUI();
  renderAll(false);
  toast('Операции восстановлены');
}

function deleteTxsBatch(ids) {
  const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
  const removed = state.transactions.filter(x => idSet.has(x.id));
  if (!removed.length) return;
  lastDeletedTxsBackup = removed.map(x => ({ ...x }));
  [...removed].sort((a,b)=>String(b.bill_after?.last_paid_date||b.date).localeCompare(String(a.bill_after?.last_paid_date||a.date))).forEach(t => {
    state.balance = FM.add(state.balance, t.type === 'income' ? -t.amount : t.amount);
    if(t.goal_withdrawal) { state.goal.saved=FM.add(state.goal.saved,t.goal_withdrawal); window.FintexBehavior?.recordSaving(t.goal_withdrawal); }
    if (t.bill_before) { const i=state.bills.findIndex(b=>b.id===t.bill_id); if(i>=0 && state.bills[i].last_paid_tx_id===t.id) state.bills[i]={...t.bill_before}; }
  });
  state.transactions = state.transactions.filter(x => !idSet.has(x.id));
  if (Array.isArray(state.selectedTxIds)) {
    state.selectedTxIds = state.selectedTxIds.filter(x => !idSet.has(x));
  }
  openedSwipeEl = null;
  persistAll();
  updateSyncQueueUI();
  renderAll(false);
  if (typeof showUndoDeleteToast === 'function') {
    showUndoDeleteToast(removed.length);
  } else {
    toast(removed.length > 1 ? `Удалено операций: ${removed.length}` : 'Операция удалена');
  }
}

function deleteTxById(id) {
  deleteTxsBatch([id]);
}
function removeSelectedTx() { const id = state.editTxId; closeModals(); deleteTxById(id); }

function openCatLimitModal() {
  document.getElementById('cat-limits-form').innerHTML = Object.values(CATS).map(c => `
    <div class="input-surface px-3 py-2 flex justify-between items-center text-xs">
      <span>${c.name}</span>
      <input id="cat-lim-inp-${c.id}" type="number" value="${state.catLimits[c.id] || ''}" placeholder="Без лимита" class="w-24 bg-black/30 rounded px-2 py-1 text-right font-bold text-main" />
    </div>
  `).join('');
  document.getElementById('modal-cat-limit').classList.remove('hidden');
}
function saveCatLimits() {
  const next = {};
  Object.values(CATS).forEach(c => {
    const v = Number(document.getElementById(`cat-lim-inp-${c.id}`)?.value) || 0;
    if (v > 0) next[c.id] = v;
  });
  state.catLimits = next; persistAll(); closeModals(); renderAnalytics(); toast('Лимиты сохранены');
}

// ==================== 1. СВЕРКА ПО СКРИНШОТУ БАЛАНСА ИЗ БАНКА ====================
let pendingBalanceDiff = 0;
let detectedScreenBank = '';

function openBalanceModal(autoPickFile = false) {
  document.getElementById('inp-reconcile').value = state.balance;
  document.getElementById('bal-ocr-progress').classList.add('hidden');
  document.getElementById('bal-ocr-result').classList.add('hidden');
  document.getElementById('bal-log-diff-wrap').classList.add('hidden');
  pendingBalanceDiff = 0;
  detectedScreenBank = '';
  document.getElementById('modal-balance').classList.remove('hidden');
  lucide.createIcons();
  if (autoPickFile) {
    setTimeout(() => document.getElementById('bal-screenshot-input')?.click(), 180);
  }
}

async function handleBalanceScreenshot(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  document.getElementById('bal-ocr-progress').classList.remove('hidden');
  document.getElementById('bal-ocr-result').classList.add('hidden');
  vibro('medium');

  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Ошибка чтения скриншота'));
      r.readAsDataURL(file);
    });

    // Предобработка скриншота экрана iPhone (удаление верхней статус-панели с часами и батареей)
    const croppedUrl = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const topCut = Math.round(img.height * 0.06);
        const botCut = Math.round(img.height * 0.94);
        const h = Math.max(100, botCut - topCut);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.filter = 'contrast(1.25)';
        ctx.drawImage(img, 0, topCut, img.width, h, 0, 0, img.width, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });

    if (!window.Tesseract) throw new Error('OCR модуль не загружен');
    const ocrRes = await Tesseract.recognize(croppedUrl, 'rus+eng');
    const text = ocrRes.data.text || '';

    // Определяем банк по тексту на скриншоте
    let bankName = state.bank;
    if (/т-банк|тинькофф|black|all airlines/i.test(text)) bankName = 'Т-Банк';
    else if (/сбер|sber|сберкарта/i.test(text)) bankName = 'Сбер';
    else if (/альфа|alfa/i.test(text)) bankName = 'Альфа-Банк';
    else if (/ozon|озон/i.test(text)) bankName = 'Ozon Банк';
    else if (/втб|vtb/i.test(text)) bankName = 'ВТБ';
    else if (/газпром/i.test(text)) bankName = 'Газпромбанк';
    detectedScreenBank = bankName;

    // Извлекаем все суммы с символом ₽ / руб / RUB
    const matches = [...text.matchAll(/(\d[\d\s ]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB)/gi)];
    const candidates = [];
    matches.forEach(m => {
      const clean = m[1].replace(/[\s ]+/g, '').replace(',', '.');
      const val = FM.parse(clean);
      if (val!==null && val >= 0 && val < 50000000 && !candidates.includes(val)) {
        candidates.push(val);
      }
    });

    document.getElementById('bal-ocr-progress').classList.add('hidden');
    if (!candidates.length) {
      vibro('error');
      toast('Не удалось найти сумму баланса в ₽ на скриншоте');
      return;
    }

    const primaryVal = candidates[0];
    document.getElementById('bal-detected-bank-badge').innerHTML = `${merchantBadge(bankName, 'other', 'expense')}<span class="text-xs font-bold text-main">${bankName}</span>`;
    document.getElementById('bal-candidates-row').innerHTML = candidates.slice(0, 4).map(c => `
      <button type="button" onclick="selectDetectedBalance(${c})" class="px-2.5 py-1 rounded-lg btn-teal-soft text-[11px] font-bold tabular-nums">${fmtN(c)} ₽</button>
    `).join('');

    selectDetectedBalance(primaryVal);
    document.getElementById('bal-ocr-result').classList.remove('hidden');
    vibro('success');
    lucide.createIcons();
  } catch (err) {
    document.getElementById('bal-ocr-progress').classList.add('hidden');
    vibro('error');
    toast('Ошибка обработки скриншота');
  }
}

function selectDetectedBalance(screenVal) {
  document.getElementById('inp-reconcile').value = screenVal;
  document.getElementById('bal-prev-val').textContent = fmtR(state.balance);
  document.getElementById('bal-screen-val').textContent = fmtR(screenVal);

  const diff = screenVal - state.balance;
  pendingBalanceDiff = diff;
  const diffBadge = document.getElementById('bal-diff-badge');
  const logWrap = document.getElementById('bal-log-diff-wrap');

  if (diff === 0) {
    diffBadge.textContent = 'Баланс совпадает ✓';
    diffBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand';
    logWrap.classList.add('hidden');
  } else if (diff < 0) {
    diffBadge.textContent = `Расхождение: -${fmtN(Math.abs(diff))} ₽`;
    diffBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-[#F2C65D]/20 text-gold';
    document.getElementById('bal-diff-amt-lbl').textContent = fmtR(Math.abs(diff));
    logWrap.classList.remove('hidden');
  } else {
    diffBadge.textContent = `Больше на +${fmtN(diff)} ₽`;
    diffBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand';
    logWrap.classList.add('hidden');
  }
}

function applyReconcile() {
  const nextVal = FM.parse(document.getElementById('inp-reconcile').value);
  if (nextVal === null) { toast('Укажите корректный остаток'); return; }
  const effectiveDiff = FM.add(nextVal, -state.balance);
  const autoDeltaEnabled = localStorage.getItem('fp_auto_delta') !== '0';
  const wrapVisible = !document.getElementById('bal-log-diff-wrap').classList.contains('hidden');
  const shouldLogExpense = effectiveDiff < 0 && (
    wrapVisible ? document.getElementById('bal-log-diff-chk').checked : autoDeltaEnabled
  );

  if (shouldLogExpense) {
    const spentDiff = Math.abs(effectiveDiff);
    state.transactions.unshift({
      id: 'delta_' + Date.now(),
      merchant: detectedScreenBank ? `Авто-дельта (${detectedScreenBank})` : 'Авто-дельта баланса',
      amount: spentDiff,
      category: 'other',
      type: 'expense',
      source: 'Авто-дельта',
      date: TODAY,
      items: []
    });
  }

  state.balance = nextVal;
  persistAll();
  pushTransactionsToBackend(state.transactions.slice(0, 5));
  closeModals();
  updateSyncQueueUI();
renderAll(false);
  toast(shouldLogExpense ? `Авто-дельта: записано -${fmtR(Math.abs(effectiveDiff))}` : 'Остаток на карте обновлён');
}

function toggleAutoDeltaPref() {
  const cb = document.getElementById('auto-delta-toggle');
  localStorage.setItem('fp_auto_delta', cb?.checked ? '1' : '0');
  vibro('selection');
  toast(cb?.checked ? 'Авто-дельта баланса включена' : 'Авто-дельта баланса отключена');
}

// ==================== 3. АВТО-РАСПОЗНАВАНИЕ СМС / OCR / БУФЕРА ОБМЕНА ====================
function cleanSmsOcrNoise(rawText) {
  const lines = String(rawText || '')
    .replace(/\u00A0/g, ' ')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    if (/^([01]?\d|2[0-3]):[0-5]\d\b.*(LTE|5G|4G|3G|Wi-?Fi|\d{1,3}%|\b\d{2}\b)$/i.test(lines[0]) ||
        /^(LTE|5G|4G|Wi-?Fi|Сотовая связь)/i.test(lines[0])) {
      lines.shift();
    }
  }
  return lines.join('\n').trim();
}

function detectBankFromText(txt) {
  const s = String(txt || '');
  if (/(^|\s|[^\wа-я])(т-банк|тинькофф|t-bank|tinkoff|black|all\s*airlines|платинум)(\s|$|[^\wа-я])/i.test(s)) return 'Т-Банк';
  if (/(^|\s|[^\wа-я])(сбер|sber|сберкарта|сбербанк|900|mir-\d{4})(\s|$|[^\wа-я])/i.test(s)) return 'Сбер';
  if (/(^|\s|[^\wа-я])(альфа|alfa|alfa-?bank|alfabank)(\s|$|[^\wа-я])/i.test(s)) return 'Альфа-Банк';
  if (/(^|\s|[^\wа-я])(ozon\s*банк|озон\s*банк|озон\s*карта|ozon\s*card)(\s|$|[^\wа-я])/i.test(s)) return 'Ozon Банк';
  if (/(^|\s|[^\wа-я])(втб|vtb|1000)(\s|$|[^\wа-я])/i.test(s)) return 'ВТБ';
  if (/(^|\s|[^\wа-я])(газпромбанк|гпб|gpb)(\s|$|[^\wа-я])/i.test(s)) return 'Газпромбанк';
  if (/(^|\s|[^\wа-я])(яндекс\s*пэй|yandex\s*pay|яндекс\s*банк|плюс\s*дейли)(\s|$|[^\wа-я])/i.test(s)) return 'Яндекс Пэй';
  if (/(^|\s|[^\wа-я])(райффайзен|raiffeisen)(\s|$|[^\wа-я])/i.test(s)) return 'Райффайзен';
  if (/(^|\s|[^\wа-я])(совкомбанк|халва|sovcombank)(\s|$|[^\wа-я])/i.test(s)) return 'Совкомбанк';
  if (/(^|\s|[^\wа-я])(мтс\s*банк|mts\s*bank|мтс\s*деньги)(\s|$|[^\wа-я])/i.test(s)) return 'МТС Банк';
  return state.bank || 'Т-Банк';
}

function extractSmsDateAndTime(txt) {
  let dateIso = TODAY;
  const now = new Date();
  const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (/позавчера/i.test(txt)) dateIso = offsetDateISO(-2);
  else if (/вчера/i.test(txt)) dateIso = offsetDateISO(-1);
  else {
    const dmy = txt.match(/\b([0-3]?\d)[./]([01]?\d)[./](20\d{2}|\d{2})\b/);
    if (dmy) {
      const dd = String(dmy[1]).padStart(2, '0');
      const mm = String(dmy[2]).padStart(2, '0');
      const yy = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
      dateIso = `${yy}-${mm}-${dd}`;
    } else {
      const monthsMap = { 'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'мая': '05', 'май': '05', 'июн': '06', 'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12' };
      const rusM = txt.match(/\b([0-3]?\d)\s+(янв|фев|мар|апр|май|мая|июн|июл|авг|сен|окт|ноя|дек)[а-я]*\b/i);
      if (rusM) {
        const dd = String(rusM[1]).padStart(2, '0');
        const mm = monthsMap[rusM[2].toLowerCase().slice(0, 3)] || '01';
        dateIso = `${now.getFullYear()}-${mm}-${dd}`;
      }
    }
  }

  const tm = txt.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const timeStr = tm ? `${String(tm[1]).padStart(2, '0')}:${tm[2]}` : curTime;
  return { date: dateIso, time: timeStr };
}

function detectSmsOperationKind(txt) {
  if (/(возврат|отмена\s+покупк|отмена\s+оплат|отмена\s+операц|refund)/i.test(txt)) {
    return { type: 'income', op_kind: 'refund', op_label: 'Возврат' };
  }
  if (/(входящий\s+перевод|перевод\s+от|перевел[а]?\s+вам|поступил\s+перевод)/i.test(txt)) {
    return { type: 'income', op_kind: 'transfer_in', op_label: 'Перевод (вх.)' };
  }
  if (/(пополнен|зачислен|поступил|кэшбэк|cashback|зарплат|аванс|\+\s*\d)/i.test(txt) && !/(покупк|оплат|списан)/i.test(txt)) {
    return { type: 'income', op_kind: 'income', op_label: 'Пополнение' };
  }
  if (/(снятие|выдача\s+наличн|банкомат|atm)/i.test(txt)) {
    return { type: 'expense', op_kind: 'atm', op_label: 'Наличные' };
  }
  if (/(перевод|сбп|sbp|перечислен)/i.test(txt)) {
    return { type: 'expense', op_kind: 'transfer_out', op_label: 'Перевод СБП' };
  }
  if (/(покупк|оплат|списан|чека|картой|подписк)/i.test(txt)) {
    return { type: 'expense', op_kind: 'expense', op_label: 'Покупка' };
  }
  return null;
}

function parseBankSmsOrClipboard(rawText) {
  const txt = cleanSmsOcrNoise(rawText);
  if (!txt || txt.length < 4 || txt.length > 900) return null;

  const bank = detectBankFromText(txt);
  const dtInfo = extractSmsDateAndTime(txt);

  // 1. Проверка на фискальный QR
  if (/t=\d{8}T\d{4}&s=[\d.]+/i.test(txt)) {
    const qr = parseFiscalQrString(txt);
    if (qr.found && qr.sum > 0) {
      const amt = FM.money(qr.sum);
      const merch = `Чек по QR (ФН ${qr.fn})`;
      const dIso = qr.date || dtInfo.date;
      const tStr = qr.time || dtInfo.time;
      return {
        raw: txt,
        merchant: merch,
        amount: amt,
        type: 'expense',
        op_kind: 'expense',
        op_label: 'Чек QR',
        category: 'other',
        bank,
        cardBalance: null,
        date: dIso,
        time: tStr,
        dedup_hash: computeClientDedupHash(dIso, tStr, amt, 'expense', merch, txt)
      };
    }
  }

  // 2. Проверка на СМС / пуш-уведомление российского банка
  const opInfo = detectSmsOperationKind(txt);
  const mainPart = txt.split(/баланс|доступно|остаток/i)[0];
  const amtMatch = mainPart.match(/([+-]?\s*\d[\d\s]{0,10}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB|RUR|\bр\b)/i) ||
                   mainPart.match(/(?:покупк[а-я]*|оплат[а-я]*|списан[а-я]*|перевод|зачислен[а-я]*|возврат|снятие)\s+(\d[\d\s]{0,9}(?:[.,]\d{1,2})?)/i);

  if (!amtMatch) return null;
  const amount = FM.money(Math.abs(Number(amtMatch[1].replace(/\s+/g, '').replace(',', '.'))));
  if (!amount || amount <= 0 || amount > 10000000) return null;

  // Извлекаем остаток на карте после операции, если он указан в СМС
  let cardBalance = null;
  const balMatch = txt.match(/(?:баланс|доступно|остаток)[:\s]*(\d[\d\s]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB|RUR|\bр\b)?/i);
  if (balMatch) {
    const bVal = FM.money(Number(balMatch[1].replace(/\s+/g, '').replace(',', '.')));
    if (!isNaN(bVal) && bVal >= 0) cardBalance = bVal;
  }

  // Определяем магазин / получателя
  let merchant = '';
  for (const b of BRAND_REGISTRY) {
    if (b.re.test(txt) && !/банк|сбер|тинькофф|альфа|втб|райффайзен|совкомбанк/i.test(b.re.source)) {
      const m = txt.match(b.re);
      if (m) { merchant = m[0]; break; }
    }
  }
  if (!merchant) {
    const cleaned = mainPart
      .replace(amtMatch[0], '')
      .replace(/\b([0-3]?\d)[./]([01]?\d)[./](20\d{2}|\d{2})\b/g, ' ')
      .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, ' ')
      .replace(/(покупк[а-я]*|оплат[а-я]*|списан[а-я]*|зачислен[а-я]*|пополнен[а-я]*|возврат|отмена|снятие|перевод|карта|mir-\d+|\*\d{4}|rub|rur|руб\.?|₽)/gi, ' ')
      .replace(/[.;:()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fallbackLabel = opInfo ? opInfo.op_label : 'Покупка по карте';
    merchant = cleaned ? cleaned.slice(0, 32) : fallbackLabel;
  }
  merchant = merchant.charAt(0).toUpperCase() + merchant.slice(1);

  const finalOp = opInfo || { type: 'expense', op_kind: 'expense', op_label: 'Покупка' };
  if (!opInfo && merchant.length < 3) return null;

  return {
    raw: txt,
    merchant,
    amount,
    type: finalOp.type,
    op_kind: finalOp.op_kind,
    op_label: finalOp.op_label,
    category: classifyCategory(merchant),
    bank,
    cardBalance,
    date: dtInfo.date,
    time: dtInfo.time,
    dedup_hash: computeClientDedupHash(dtInfo.date, dtInfo.time, amount, finalOp.type, merchant, txt)
  };
}

async function readClipboardNow(manualTrigger = false) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      if (manualTrigger) toast('Буфер обмена недоступен в этом браузере');
      return;
    }
    const clipText = await navigator.clipboard.readText();
    const parsed = parseBankSmsOrClipboard(clipText);
    if (!parsed) {
      if (manualTrigger) toast('В буфере обмена не найдено банковских операций');
      return;
    }
    const seenHash = localStorage.getItem('fp_clip_dismissed') || '';
    if (!manualTrigger && seenHash === parsed.raw) return;

    state.clipboardCandidate = parsed;
    document.getElementById('clip-logo-box').innerHTML = merchantBadge(parsed.merchant, parsed.category, parsed.type);
    document.getElementById('clip-main-text').textContent = `${parsed.merchant} · ${parsed.type === 'income' ? '+' : '−'}${fmtR(parsed.amount)}`;
    document.getElementById('clip-sub-text').textContent = parsed.cardBalance !== null
      ? `${parsed.bank} · Остаток в СМС: ${fmtR(parsed.cardBalance)}`
      : `${parsed.bank} · ${(CATS[parsed.category] || CATS.other).name}`;

    document.getElementById('clipboard-banner').classList.remove('hidden');
    vibro('selection');
    lucide.createIcons();
  } catch (e) {
    if (manualTrigger) toast('Разрешите вставку из буфера в окне Safari');
  }
}

function confirmClipboardOperation() {
  const c = state.clipboardCandidate;
  if (!c) return;
  addOrMergeTransactions([{
    merchant: c.merchant,
    amount: c.amount,
    category: c.category,
    type: c.type,
    op_kind: c.op_kind,
    op_label: c.op_label,
    date: c.date,
    time: c.time,
    bank: c.bank,
    dedup_hash: c.dedup_hash,
    raw: c.raw
  }], `Буфер · ${c.bank}`);

  if (c.cardBalance !== null) {
    state.balance = c.cardBalance;
    persistAll();
  }

  localStorage.setItem('fp_clip_dismissed', c.raw);
  state.clipboardCandidate = null;
  document.getElementById('clipboard-banner').classList.add('hidden');
  vibro('success');
  updateSyncQueueUI();
renderAll(false);
  toast(`Записано из буфера: ${c.type === 'income' ? '+' : '-'}${fmtR(c.amount)}`);
}

function dismissClipboardBanner() {
  if (state.clipboardCandidate) {
    localStorage.setItem('fp_clip_dismissed', state.clipboardCandidate.raw);
  }
  state.clipboardCandidate = null;
  document.getElementById('clipboard-banner').classList.add('hidden');
}

// Мастер «Команд» iOS
const IOS_BANK_GUIDES = {
  'Т-Банк': {
    sender: 'Tinkoff или Т-Банк',
    steps: [
      'Откройте стандартное приложение «Команды» на iPhone → вкладка «Автоматизация» → «+».',
      'Выберите «Сообщение» → Отправитель: Tinkoff (или фильтр «Содержит: Покупка») → «Немедленный запуск».',
      'Добавьте действие «Получить содержимое URL» → Метод: POST → Тело запроса: JSON.',
      'Добавьте поле text со значением «Входные данные автоматизации» и вставьте адрес вебхука ниже.'
    ]
  },
  'Сбер': {
    sender: '900',
    steps: [
      'Откройте приложение «Команды» на iPhone → «Автоматизация» → «+».',
      'Выберите «Сообщение» → Отправитель: 900 → выберите «Немедленный запуск».',
      'Добавьте действие «Получить содержимое URL» → Метод: POST → Тело запроса: JSON.',
      'Создайте ключ text = «Входные данные автоматизации» и укажите ваш адрес вебхука ниже.'
    ]
  },
  'Альфа-Банк': {
    sender: 'Alfa-Bank',
    steps: [
      'Откройте «Команды» → «Автоматизация» → «+» → «Сообщение».',
      'Укажите отправителя Alfa-Bank и включите «Немедленный запуск».',
      'Добавьте «Получить содержимое URL» (POST, JSON, ключ text = Сообщение) с вашим URL ниже.'
    ]
  },
  'Ozon Банк': {
    sender: 'Ozon или пуш-уведомление',
    steps: [
      'В приложении Ozon Банка включите СМС-уведомления или копируйте текст пуша при оплате.',
      'Настройте автоматизацию «Сообщение» в «Командах» iOS на ваш персональный URL ниже.'
    ]
  },
  'ВТБ': {
    sender: 'VTB',
    steps: [
      'Откройте «Команды» → «Автоматизация» → «+» → «Сообщение» от VTB.',
      'Добавьте «Получить содержимое URL» (POST, JSON, ключ text = Сообщение) на ваш адрес ниже.'
    ]
  },
  'Газпромбанк': {
    sender: 'GPB',
    steps: [
      'Откройте «Команды» → «Автоматизация» → «+» → «Сообщение» от GPB.',
      'Добавьте «Получить содержимое URL» (POST, JSON, ключ text = Сообщение) на ваш адрес ниже.'
    ]
  }
};

function switchIosWizardMode(mode) {
  vibro('selection');
  const isBacktap = mode === 'backtap';
  const thumb = document.getElementById('ios-mode-thumb');
  if (thumb) thumb.style.transform = isBacktap ? 'translateX(0%)' : 'translateX(100%)';
  document.querySelectorAll('#ios-mode-seg .seg-item').forEach((el, idx) => {
    const active = (idx === 0 && isBacktap) || (idx === 1 && !isBacktap);
    el.className = `seg-item py-1.5 ${active ? 'text-[#041311] font-bold' : 'text-sub'}`;
  });
  document.getElementById('ios-pane-backtap')?.classList.toggle('hidden', !isBacktap);
  document.getElementById('ios-pane-sms')?.classList.toggle('hidden', isBacktap);
}

function openIosShortcutsModal() {
  state.iosWizardBank = state.bank || 'Т-Банк';
  const baseExec = (state.gasUrl || DEFAULT_GAS_URL).replace(/\/dev(\?.*)?$/, '/exec$1');
  const tokParam = state.apiToken ? `&token=${encodeURIComponent(state.apiToken)}` : '';
  document.getElementById('ios-webhook-url').value = `${baseExec}?uid=${USER_ID}${tokParam}`;
  document.getElementById('ios-sms-test-inp').value = '';
  document.getElementById('ios-sms-test-out').classList.add('hidden');
  document.getElementById('ios-sms-save-btn').classList.add('hidden');
  switchIosWizardMode('backtap');
  renderIosWizardBank();
  document.getElementById('modal-ios-shortcuts').classList.remove('hidden');
  lucide.createIcons();
}

function selectIosWizardBank(bank) {
  state.iosWizardBank = bank;
  renderIosWizardBank();
}

function renderIosWizardBank() {
  const banks = Object.keys(IOS_BANK_GUIDES);
  document.getElementById('ios-bank-pills').innerHTML = banks.map(b => `
    <button type="button" onclick="selectIosWizardBank('${b}')" class="px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 ${state.iosWizardBank === b ? 'btn-turquoise' : 'input-surface text-sub'}">${b}</button>
  `).join('');

  const info = IOS_BANK_GUIDES[state.iosWizardBank] || IOS_BANK_GUIDES['Т-Банк'];
  document.getElementById('ios-wiz-bank-title').textContent = `Настройка для ${state.iosWizardBank} (отправитель: ${info.sender})`;
  document.getElementById('ios-wiz-steps').innerHTML = info.steps.map(s => `<li>${s}</li>`).join('');
}

function copyTextField(inputId, msg) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.focus();
  inp.select();
  inp.setSelectionRange(0, 99999);
  try { document.execCommand('copy'); } catch (e) {}
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(inp.value).catch(() => {});
  }
  vibro('success');
  toast(msg);
}

function testSmsParser() {
  const raw = document.getElementById('ios-sms-test-inp').value.trim();
  const parsed = parseBankSmsOrClipboard(raw);
  const out = document.getElementById('ios-sms-test-out');
  const saveBtn = document.getElementById('ios-sms-save-btn');
  out.classList.remove('hidden');

  if (!parsed) {
    out.textContent = 'Не удалось распознать сумму операции. Убедитесь, что в тексте указана сумма (например, 650 RUB или 650 ₽).';
    out.className = 'text-[11px] text-red-400 pt-1';
    saveBtn.classList.add('hidden');
    return;
  }

  state.testedSmsOp = parsed;
  out.textContent = `Распознано: [${parsed.bank} · ${parsed.op_label}] ${parsed.merchant} · ${parsed.type === 'income' ? '+' : '-'}${fmtR(parsed.amount)} · ${humanDate(parsed.date)} ${parsed.time}${parsed.cardBalance !== null ? ` · Баланс: ${fmtR(parsed.cardBalance)}` : ''}`;
  out.className = 'text-[11px] text-brand font-semibold pt-1';
  saveBtn.classList.remove('hidden');
}

function commitTestedSms() {
  if (!state.testedSmsOp) return;
  const c = state.testedSmsOp;
  addOrMergeTransactions([{ merchant: c.merchant, amount: c.amount, category: c.category, type: c.type, op_kind: c.op_kind, op_label: c.op_label, date: c.date, time: c.time, bank: c.bank, dedup_hash: c.dedup_hash, raw: c.raw }], `СМС · ${c.bank}`);
  if (c.cardBalance !== null) { state.balance = c.cardBalance; persistAll(); }
  closeModals(); renderAll(false);
  toast(`Операция записана: ${c.type === 'income' ? '+' : '-'}${fmtR(c.amount)}`);
}

const SMART_HUB_MODES = [
  { icon: 'scan-line', title: 'Сканер и быстрый ввод', badge: '5 в 1', sub: 'Чеки, скрин баланса, буфер iOS, голос и проверка покупки', action: () => openSmartHubModal() },
  { icon: 'mic', title: 'Голосовой ввод расхода', badge: 'Свайп · Голос', sub: 'Нажмите, чтобы продиктовать покупки вслух', action: () => openVoiceModal() },
  { icon: 'smartphone-charging', title: 'Сверка скрином баланса', badge: 'Свайп · OCR', sub: 'Нажмите, чтобы загрузить скриншот экрана банка', action: () => openBalanceModal(true) },
  { icon: 'clipboard-paste', title: 'Распознать из буфера iOS', badge: 'Свайп · Буфер', sub: 'Нажмите, чтобы вставить СМС или QR из буфера', action: () => readClipboardNow(true) }
];
let smartHubIdx = 0;
let smartHubStartX = 0;
let smartHubSwiped = false;

function updateSmartHubCard() {
  const item = SMART_HUB_MODES[smartHubIdx] || SMART_HUB_MODES[0];
  const iconBox = document.getElementById('hub-active-icon-box');
  const titleEl = document.getElementById('hub-active-title');
  const badgeEl = document.getElementById('hub-active-badge');
  const subEl = document.getElementById('hub-active-sub');
  const dotsRow = document.getElementById('hub-dots-row');
  if (iconBox) iconBox.innerHTML = `<i data-lucide="${item.icon}" class="w-5 h-5 text-[#041311]"></i>`;
  if (titleEl) titleEl.textContent = item.title;
  if (badgeEl) badgeEl.textContent = item.badge;
  if (subEl) subEl.textContent = item.sub;
  if (dotsRow) {
    dotsRow.innerHTML = SMART_HUB_MODES.map((_, idx) =>
      `<span class="${idx === smartHubIdx ? 'w-4 bg-[#00D6C3]' : 'w-1.5 bg-white/20'} h-1 rounded-full transition-all"></span>`
    ).join('');
  }
  try { if (window.lucide) lucide.createIcons(); } catch (e) {}
}

function hubSwipeStart(e) {
  smartHubStartX = e.touches[0].clientX;
  smartHubSwiped = false;
}

function hubSwipeEnd(e) {
  const dx = e.changedTouches[0].clientX - smartHubStartX;
  if (Math.abs(dx) > 36) {
    smartHubSwiped = true;
    vibro('selection');
    smartHubIdx = dx < 0
      ? (smartHubIdx + 1) % SMART_HUB_MODES.length
      : (smartHubIdx - 1 + SMART_HUB_MODES.length) % SMART_HUB_MODES.length;
    updateSmartHubCard();
  }
}

function openSmartHubModal() {
  if (smartHubSwiped) { smartHubSwiped = false; return; }
  if (smartHubIdx > 0) {
    SMART_HUB_MODES[smartHubIdx].action();
    return;
  }
  vibro('light');
  document.getElementById('modal-smart-hub')?.classList.remove('hidden');
  try { if (window.lucide) lucide.createIcons(); } catch (e) {}
}

function closeModals() {
  ['modal-smart-hub', 'modal-scan', 'modal-autopilot', 'modal-can-buy', 'modal-sub-guide', 'modal-forecast-info', 'modal-goal-detail', 'modal-today', 'modal-tx', 'modal-cat-limit', 'modal-balance', 'modal-payday', 'modal-bill', 'modal-add', 'modal-ios-shortcuts', 'modal-price-tracker', 'modal-voice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const icon = document.getElementById('hdr-plus-icon');
  if (icon) icon.classList.remove('is-open');
}

function openPaydayModal() { document.getElementById('inp-next-payday').value = nextMonthISO(TODAY); document.getElementById('modal-payday').classList.remove('hidden'); }
function applyNewCycle() {
  const sal = Math.max(0, FM.parse(document.getElementById('inp-salary').value) || 0);
  const nextD = document.getElementById('inp-next-payday').value || nextMonthISO(TODAY);
  if(FM.ordinal(nextD)===null || nextD<=TODAY) { toast('Укажите будущую дату следующей зарплаты'); return; }
  state.balance = FM.add(state.balance, sal); state.payday = nextD;
  if (sal > 0) state.transactions.unshift({ id: 'sal_' + Date.now(), merchant: 'Зарплата', amount: sal, category: 'other', type: 'income', source: 'Пополнение', date: TODAY, items: [] });
  persistAll(); closeModals(); renderAll(false); toast('Новый цикл запущен');
}

function openBillModal() { document.getElementById('inp-bill-date').value = offsetDateISO(5); document.getElementById('modal-bill').classList.remove('hidden'); }
function saveNewBill() {
  const title = document.getElementById('inp-bill-title').value.trim();
  const amount = FM.parse(document.getElementById('inp-bill-amt').value);
  const due_date = document.getElementById('inp-bill-date').value || offsetDateISO(5);
  if (!title || amount===null || amount <= 0 || FM.ordinal(due_date)===null) return;
  state.bills.push({ id: 'b_' + Date.now(), title, amount, due_date, is_paid: false, is_recurring: true });
  persistAll(); closeModals(); renderAll(false); toast('Платёж добавлен');
}
function payBill(id) {
  const b = state.bills.find(x => x.id === id);
  if (!b || b.is_paid) return;
  if (b.last_paid_date === TODAY) { toast('Этот платёж уже отмечен сегодня'); return; }
  const amount = Math.max(0, FM.money(b.amount));
  if (!amount) return;
  const before={...b};
  const txId='txb_'+(window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`);
  if (b.is_recurring) {
    b.recurrence_day = b.recurrence_day || Number(b.due_date.slice(-2));
    b.due_date = FM.nextMonth(b.due_date,b.recurrence_day) || nextMonthISO(TODAY);
  } else b.is_paid = true;
  b.last_paid_date=TODAY; b.last_paid_tx_id=txId;
  state.balance = FM.add(state.balance, -amount);
  state.transactions.unshift({id:txId,merchant:b.title,amount,category:'subs',type:'expense',source:'Платёж',date:TODAY,items:[],bill_id:id,bill_before:before,bill_after:{...b}});
  persistAll(); renderAll(false); toast('Оплачено');
}

function deleteBill(id) { state.bills = state.bills.filter(x => x.id !== id); persistAll(); renderAll(false); }

function openAddModal() {
  switchAddMode('expense');
  document.getElementById('live-expense-preview').innerHTML = '';
  lastLiveBrandSig = '';
  const dateInp = document.getElementById('inp-add-date');
  if (dateInp) dateInp.value = TODAY;
  const icon = document.getElementById('hdr-plus-icon');
  if (icon) icon.classList.add('is-open');
  document.getElementById('modal-add').classList.remove('hidden');
}
function switchAddMode(mode) {
  state.addMode = mode;
  const idx = mode === 'expense' ? 0 : 1;
  document.getElementById('add-type-thumb').style.transform = `translateX(${idx * 100}%)`;
  document.getElementById('pane-expense').classList.toggle('hidden', mode !== 'expense');
  document.getElementById('pane-income').classList.toggle('hidden', mode !== 'income');
}
function submitExpense() {
  const txt = document.getElementById('inp-expense-text').value.trim();
  if (!txt) return;
  const targetDate = document.getElementById('inp-add-date')?.value || TODAY;
  const parsed = FM.parseExpenses(txt).map(item => ({...item, category:classifyCategory(item.merchant), type:'expense', date:targetDate}));
  if (!parsed.length) return;
  const totalAmt = FM.sum(parsed,x=>x.amount);
  addOrMergeTransactions(parsed, 'Вручную');
  document.getElementById('inp-expense-text').value = '';
  document.getElementById('live-expense-preview').innerHTML = '';
  closeModals(); renderAll(false);
  toast(parsed.length > 1 ? `Записано (${parsed.length} опер.): -${fmtR(totalAmt)}` : `Записано: -${fmtR(totalAmt)}`);
}
function submitIncome() {
  const title = document.getElementById('inp-inc-title').value.trim() || 'Пополнение';
  const amt = Math.max(0, FM.parse(document.getElementById('inp-inc-amt').value) || 0);
  if (amt <= 0) return;
  const targetDate = document.getElementById('inp-add-date')?.value || TODAY;
  addOrMergeTransactions([{ merchant: title, amount: amt, category: 'other', type: 'income', date: targetDate }], 'Пополнение');
  document.getElementById('inp-inc-title').value = '';
  document.getElementById('inp-inc-amt').value = '';
  closeModals(); renderAll(false); toast(`+${fmtR(amt)}`);
}

// ==================== АВТОПИЛОТ, OCR СКРИНШОТОВ СМС, ЖУРНАЛ И ОЧЕРЕДЬ ДОСТАВКИ ====================
function openAutopilotModal(section = 'import') {
  document.getElementById('stmt-preview-box').classList.add('hidden');
  document.getElementById('sms-ocr-progress').classList.add('hidden');
  document.getElementById('sms-ocr-result-card').classList.add('hidden');
  document.getElementById('ap-uid-badge').textContent = `UID: ${USER_ID}`;
  const tokInp = document.getElementById('gas-token-field');
  if (tokInp) tokInp.value = state.apiToken || '';
  updateSyncQueueUI();
  renderAutopilotLogs();
  const modal = document.getElementById('modal-autopilot');
  modal.classList.remove('hidden');
  const target = ['import','automation','cloud','logs'].includes(section) ? section : 'import';
  modal.querySelectorAll('details[id^="ap-section-"]').forEach(group => { group.open = group.id === `ap-section-${target}`; });
  lucide.createIcons();
  modal.querySelector('.modal-sheet').scrollTop = 0;
  document.querySelector(`#ap-section-${target} > summary`)?.focus({preventScroll:true});
}

function updateSyncQueueUI() {
  const qLen = (state.syncQueue || []).length;
  const homePill = document.getElementById('autopilot-stage-pill');
  const modalBadge = document.getElementById('ap-queue-badge');
  if (qLen > 0) {
    if (homePill) {
      homePill.textContent = `В очереди: ${qLen}`;
      homePill.className = 'text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F2C65D]/20 text-gold';
    }
    if (modalBadge) {
      modalBadge.textContent = `Ожидает отправки: ${qLen}`;
      modalBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-[#F2C65D]/20 text-gold';
    }
  } else {
    if (homePill) {
      homePill.textContent = 'Подтверждён';
      homePill.className = 'text-[10px] font-semibold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand';
    }
    if (modalBadge) {
      modalBadge.textContent = 'Доставлено ✓';
      modalBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand';
    }
  }
}

function setAutopilotLogFilter(statusFilter) {
  vibro('selection');
  state.autopilotLogFilter = statusFilter;
  document.querySelectorAll('#ap-log-filters .ap-log-fbtn').forEach(btn => {
    const match = (statusFilter === 'ALL' && btn.textContent === 'Все') ||
                  (statusFilter === 'OK' && btn.textContent === 'ОК') ||
                  (statusFilter === 'DUPLICATE' && btn.textContent === 'Дубли') ||
                  (statusFilter === 'ERROR' && btn.textContent === 'Ошибки');
    btn.className = `ap-log-fbtn px-2 py-0.5 rounded text-[10px] ${match ? 'font-bold btn-turquoise' : 'font-semibold input-surface text-sub'}`;
  });
  renderAutopilotLogs();
}

function renderAutopilotLogs() {
  const listEl = document.getElementById('autopilot-logs-list');
  if (!listEl) return;
  const f = state.autopilotLogFilter || 'ALL';
  const logs = (state.autopilotLogs || []).filter(item => {
    if (f === 'ALL') return true;
    if (f === 'OK') return item.status === 'OK' || item.status === 'AUTO_DELTA';
    if (f === 'DUPLICATE') return item.status === 'DUPLICATE';
    if (f === 'ERROR') return item.status === 'ERROR' || item.status === 'REJECTED';
    return true;
  });

  if (!logs.length) {
    listEl.innerHTML = `<div class="p-3 text-center text-sub">Записей в журнале пока нет</div>`;
    return;
  }

  listEl.innerHTML = logs.slice(0, 25).map(l => {
    const isErr = l.status === 'ERROR' || l.status === 'REJECTED';
    const isDup = l.status === 'DUPLICATE';
    const badgeCls = isErr
      ? 'bg-red-500/20 text-red-300'
      : isDup
        ? 'bg-[#F2C65D]/20 text-gold'
        : 'bg-[#00D6C3]/15 text-brand';
    const timeShort = (l.timestamp || '').slice(11, 16) || '';
    return `
      <div class="input-surface p-2.5 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeCls}">${escapeHtml(l.status)}${l.error_code ? ` · ${escapeHtml(l.error_code)}` : ''}</span>
          <span class="text-[9px] text-dim tabular-nums">${escapeHtml(l.bank || '')} · ${escapeHtml(timeShort)}</span>
        </div>
        <div class="text-main font-medium leading-snug">${escapeHtml(l.summary)}</div>
        ${l.raw_preview ? `<div class="text-[9px] text-dim font-mono truncate">${escapeHtml(l.raw_preview)}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function handleSmsScreenshotOcr(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  const progEl = document.getElementById('sms-ocr-progress');
  const resCard = document.getElementById('sms-ocr-result-card');
  progEl.classList.remove('hidden');
  resCard.classList.add('hidden');
  vibro('medium');

  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Ошибка чтения скриншота'));
      r.readAsDataURL(file);
    });

    if (!window.Tesseract) throw new Error('OCR движок недоступен');
    const ocrRes = await Tesseract.recognize(dataUrl, 'rus+eng');
    const rawOcr = ocrRes.data.text || '';
    const parsed = parseBankSmsOrClipboard(rawOcr);

    progEl.classList.add('hidden');
    if (!parsed) {
      vibro('error');
      appendLocalAutopilotLog('ERROR', state.bank, 'OCR скриншота СМС: не найдена сумма или операция', rawOcr, 'OCR_SMS_NO_MATCH');
      renderAutopilotLogs();
      toast('Не удалось распознать операцию на скриншоте');
      return;
    }

    state.pendingSmsOcrOp = parsed;
    document.getElementById('sms-ocr-bank-badge').innerHTML = `${merchantBadge(parsed.bank, 'other', 'expense')}<span class="text-xs font-bold text-main">${parsed.bank}</span>`;
    document.getElementById('sms-ocr-kind-pill').textContent = parsed.op_label;
    document.getElementById('sms-ocr-merchant').textContent = parsed.merchant;
    document.getElementById('sms-ocr-amount').textContent = fmtR(parsed.amount, parsed.type === 'income' ? '+' : '-');
    document.getElementById('sms-ocr-datetime').textContent = `${humanDate(parsed.date)} · ${parsed.time}`;
    document.getElementById('sms-ocr-bal').textContent = parsed.cardBalance !== null ? `Остаток: ${fmtR(parsed.cardBalance)}` : 'Остаток не указан';

    resCard.classList.remove('hidden');
    vibro('success');
    lucide.createIcons();
  } catch (err) {
    progEl.classList.add('hidden');
    vibro('error');
    appendLocalAutopilotLog('ERROR', state.bank, `Сбой OCR СМС: ${err.message}`, '', 'OCR_SMS_EXCEPTION');
    renderAutopilotLogs();
    toast('Ошибка обработки скриншота СМС');
  }
}

function commitSmsOcrResult() {
  const c = state.pendingSmsOcrOp;
  if (!c) return;
  const res = addOrMergeTransactions([{
    merchant: c.merchant,
    amount: c.amount,
    category: c.category,
    type: c.type,
    op_kind: c.op_kind,
    op_label: c.op_label,
    date: c.date,
    time: c.time,
    bank: c.bank,
    dedup_hash: c.dedup_hash,
    raw: c.raw
  }], `OCR СМС · ${c.bank}`);

  if (c.cardBalance !== null && res.addedCount > 0) {
    state.balance = c.cardBalance;
    persistAll();
  }

  state.pendingSmsOcrOp = null;
  document.getElementById('sms-ocr-result-card').classList.add('hidden');
  renderAutopilotLogs();
  updateSyncQueueUI();
renderAll(false);
  toast(res.addedCount > 0 ? `Записано: ${c.op_label} ${fmtR(c.amount)}` : 'Эта операция уже была записана (дубль)');
}

async function saveSecurityToken() {
  const tok = (document.getElementById('gas-token-field')?.value || '').trim();
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(tok)) { toast('Ключ: 32–128 букв, цифр, _ или -. Это ключ iOS-автоматизации, не пароль для входа.'); return; }
  try {
    await window.FintexCloud.request('set_config',{user_id:USER_ID,api_token:tok});
    state.apiToken=tok;localStorage.setItem('fp_api_token',tok);vibro('success');toast('Ключ автоматизации сохранён');
  } catch(e) { toast(e.message); }
}

async function handleStatementFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = FM.parseStatement(text,TODAY).map(t=>({...t,category:classifyCategory(t.merchant)}));
  state.pendingImport = parsed;
  document.getElementById('stmt-preview-box').classList.remove('hidden');
  document.getElementById('stmt-preview-title').textContent = `${file.name} (${parsed.length} опер.)`;
  document.getElementById('stmt-preview-list').innerHTML = parsed.slice(0, 10).map(it => `<div class="flex justify-between"><span>${escapeHtml(it.merchant)}</span><span>${fmtR(it.amount)}</span></div>`).join('');
  e.target.value = '';
}

function confirmStatementImport() {
  if (!state.pendingImport.length) return;
  const res = addOrMergeTransactions(state.pendingImport, 'Выписка');
  state.pendingImport = [];
  closeModals(); renderAll(false);
  toast(`Добавлено: ${res.addedCount}, дублей: ${res.mergedCount}`);
}

async function runAnimatedBankSync() {
  const ring = document.getElementById('sync-ring-loader');
  const pulse = document.getElementById('sync-pulse-runner');
  if (ring) ring.classList.remove('hidden');
  if (pulse) pulse.classList.remove('hidden');
  await syncWithBackend(true);
  if (ring) ring.classList.add('hidden');
  if (pulse) pulse.classList.add('hidden');
}

async function pushTransactionsToBackend(txSubset) {
  if (Array.isArray(txSubset) && txSubset.length) {
    const queuedIds = new Set(state.syncQueue.map(x => String(x.id)));
    txSubset.forEach(tx => {
      if (tx && tx.id && !queuedIds.has(String(tx.id))) {
        state.syncQueue.push(tx);
        queuedIds.add(String(tx.id));
      }
    });
    localStorage.setItem('fp_sync_queue', JSON.stringify(state.syncQueue));
    updateSyncQueueUI();
  }
  await flushSyncQueue();
}

async function flushSyncQueue() {
  if (!window.FintexCloud.canSync() || !state.gasUrl || !state.syncQueue.length) {
    updateSyncQueueUI();
    return;
  }
  try {
    const batch = state.syncQueue.slice(0, 30);
    const data = await window.FintexCloud.request('push_tx',{
      user_id:USER_ID,balance:state.balance,
      user:{name:state.name,bank:state.bank,payday:state.payday},transactions:batch
    });
    if (data && data.ok) {
      const ackSet = new Set((Array.isArray(data.ack_ids) ? data.ack_ids : []).map(String));
      state.syncQueue = state.syncQueue.filter(item => !ackSet.has(String(item.id)));
      localStorage.setItem('fp_sync_queue', JSON.stringify(state.syncQueue));
      updateSyncQueueUI();
    }
  } catch (e) {
    updateSyncQueueUI();
  }
}

async function syncWithBackend(notify = false) {
  if (!window.FintexCloud.canSync() || !state.gasUrl) { if(notify)toast('Для облака войдите через Telegram.'); return; }
  await flushSyncQueue();
  try {
    const data = await window.FintexCloud.request('init',{user_id:USER_ID});
    if (data.ok && data.user) {
      if(data.webhook_token){state.apiToken=data.webhook_token;localStorage.setItem('fp_api_token',data.webhook_token);}
      let pulledNew = 0;
      if (Array.isArray(data.transactions) && data.transactions.length) {
        const localIds = new Set(state.transactions.map(t => String(t.id)));
        const localHashes = new Set(state.transactions.filter(t => t.dedup_hash).map(t => String(t.dedup_hash)));
        const freshRemote = data.transactions.filter(rt =>
          rt.id && !localIds.has(String(rt.id)) && (!rt.dedup_hash || !localHashes.has(String(rt.dedup_hash)))
        );
        if (freshRemote.length) {
          freshRemote.forEach(rt => {
            if(!/^[a-zA-Z0-9_-]{1,150}$/.test(String(rt.id||''))) return;
            const amount=FM.money(rt.amount), date=FM.txKey(rt);
            if (amount<=0 || !date || date>TODAY || (rt.currency && !['RUB','₽','РУБ'].includes(String(rt.currency).toUpperCase()))) return;
            if(localIds.has(String(rt.id)) || (rt.dedup_hash && localHashes.has(String(rt.dedup_hash)))) return;
            localIds.add(String(rt.id)); if(rt.dedup_hash)localHashes.add(String(rt.dedup_hash));
            const opKind = rt.op_kind || rt.type || 'expense';
            const opLabels = { refund: 'Возврат', transfer_in: 'Перевод (вх.)', income: 'Пополнение', transfer_out: 'Перевод СБП', atm: 'Наличные', expense: 'Покупка' };
            state.transactions.unshift({
              id: String(rt.id),
              scan_id: '',
              dedup_hash: String(rt.dedup_hash || ''),
              merchant: rt.merchant || 'Автопилот',
              amount,
              category: CATS[rt.category] ? rt.category : classifyCategory(rt.merchant),
              type: rt.type === 'income' ? 'income' : 'expense',
              op_kind: opKind,
              op_label: opLabels[opKind] || (rt.type === 'income' ? 'Пополнение' : 'Покупка'),
              source: rt.source || 'iPhone / Облако',
              date,
              time: rt.time || '',
              items: Array.isArray(rt.items) ? rt.items : []
            });
            pulledNew++;
          });
        }
      }

      if (Array.isArray(data.logs) && data.logs.length) {
        const mergedMap = new Map();
        [...data.logs, ...(state.autopilotLogs || [])].forEach(item => {
          if (item && item.log_id && !mergedMap.has(item.log_id)) mergedMap.set(item.log_id, item);
        });
        state.autopilotLogs = Array.from(mergedMap.values())
          .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
          .slice(0, 45);
        localStorage.setItem('fp_ap_logs', JSON.stringify(state.autopilotLogs));
        renderAutopilotLogs();
      }

      if (typeof data.user.balance === 'number' && Number.isFinite(data.user.balance) && pulledNew > 0) {
        state.balance = FM.money(data.user.balance);
      }

      const now = new Date();
      state.lastSyncText = `сегодня, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (data.admin && USER_ID === ADMIN_ID) {
        document.getElementById('adm-users').textContent = data.admin.total_users;
        document.getElementById('adm-txs').textContent = data.admin.total_tx;
      }
      persistAll();
      updateSyncQueueUI();
      updateSyncQueueUI();
renderAll(false);
      if (pulledNew > 0) {
        vibro('success');
        toast(`Автопилот: загружено ${pulledNew} новых опер.`);
      } else if (notify) {
        toast('Синхронизация подтверждена ✓');
      }
    } else if (data && !data.ok && notify) {
      toast(data.error || 'Ошибка доступа к серверу');
    }
  } catch (e) {
    if (notify) toast('Офлайн-режим: данные сохранены в очередь');
  }
}

function saveGasUrl() {
  let val = document.getElementById('gas-url-field').value.trim();
  if (val.startsWith('Https://')) val = 'https://' + val.slice(8);
  val = val.replace(/\/dev(\?.*)?$/, '/exec$1');
  document.getElementById('gas-url-field').value = val;
  state.gasUrl = val;
  localStorage.setItem('fp_api_url', state.gasUrl);
  toast('Адрес сохранён. Проверяем синхронизацию.');
  syncWithBackend(true);
}

function handleVersionSecretTap() {
  state.secretTapCount++;
  if (state.secretTapCount >= 5 && USER_ID === ADMIN_ID) {
    state.secretTapCount = 0;
    document.getElementById('admin-box').classList.remove('hidden');
    toast('Режим администратора открыт');
  }
}

function goTab(name) {
  vibro('selection');
  const tabOrder = ['home', 'calendar', 'analytics', 'settings'];
  const tabIdx = Math.max(0, tabOrder.indexOf(name));
  const pill = document.getElementById('nav-active-pill');
  if (pill) pill.style.transform = `translateX(${tabIdx * 100}%)`;

  document.getElementById('home-header').classList.toggle('hidden', name !== 'home');
  tabOrder.forEach(v => {
    const sec = document.getElementById(`view-${v}`);
    const isTarget = v === name;
    sec.classList.toggle('hidden', !isTarget);
    if (isTarget) {
      sec.classList.remove('tab-panel-anim');
      void sec.offsetWidth;
      sec.classList.add('tab-panel-anim');
    }
  });

  document.querySelectorAll('.nav-tab').forEach(btn => {
    const active = btn.dataset.nav === name;
    btn.classList.toggle('is-active-tab', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
    btn.classList.toggle('text-brand', active);
    btn.classList.toggle('nav-active-glow', active);
    btn.classList.toggle('text-sub', !active);
  });
  organizeSimplifiedLayout();
  if (name === 'analytics') renderAnalytics();
  if (name === 'calendar') renderCalendar(true);
  if (name === 'home') animateOperationRows(document.getElementById('tx-feed'), 'home', true);
}

function initCardSpotlights() {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.card-surface');
    if (!card || localStorage.getItem('fp_motion') === '0') return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${(e.clientX - rect.left).toFixed(1)}px`);
    card.style.setProperty('--my', `${(e.clientY - rect.top).toFixed(1)}px`);
    card.style.setProperty('--mo', '1');
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.card-surface');
    if (card) card.style.setProperty('--mo', '0');
  }, { passive: true });
}

function toast(msg) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.classList.remove('opacity-0');
  setTimeout(() => el.classList.add('opacity-0'), 2300);
}

window.addEventListener('online', () => { flushSyncQueue(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { syncWithBackend(false); readClipboardNow(false); }
});


// ==================== ТАКТИЛЬНЫЙ ПОРОГ ЗАКРЫТИЯ ШТОРОК ====================
function initTactileSheets() {
  document.querySelectorAll('.modal-sheet').forEach(sheet => {
    let handle = sheet.querySelector('.sheet-handle');
    if (!handle) {
      const legacyBar = sheet.querySelector('.w-9.h-1');
      if (legacyBar) {
        legacyBar.classList.add('sheet-handle');
        handle = legacyBar;
      } else {
        handle = document.createElement('div');
        handle.className = 'sheet-handle mb-2';
        sheet.insertBefore(handle, sheet.firstChild);
      }
    }

    let startY = 0;
    let currentDy = 0;
    let crossedThreshold = false;

    sheet.addEventListener('touchstart', (e) => {
      if (sheet.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      currentDy = 0;
      crossedThreshold = false;
      sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
      if (!startY) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        currentDy = dy;
        sheet.style.transform = `translateY(${dy}px)`;
        if (dy >= 85 && !crossedThreshold) {
          crossedThreshold = true;
          vibro('light');
          handle.classList.add('is-ready');
        } else if (dy < 85 && crossedThreshold) {
          crossedThreshold = false;
          vibro('selection');
          handle.classList.remove('is-ready');
        }
      }
    }, { passive: true });

    sheet.addEventListener('touchend', () => {
      sheet.style.transition = '';
      handle.classList.remove('is-ready');
      if (crossedThreshold && currentDy >= 85) {
        vibro('medium');
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => {
          closeModals();
          sheet.style.transform = '';
        }, 170);
      } else {
        sheet.style.transform = '';
      }
      startY = 0;
      currentDy = 0;
      crossedThreshold = false;
    });
  });
}

// ==================== ТАКТИЛЬНЫЙ СКРАББИНГ ГРАФИКА В АНАЛИТИКЕ ====================
function initChartScrubbing() {
  const area = document.getElementById('an-chart-touch-area');
  if (!area) return;
  let lastIdx = -1;

  function scrubAtClientX(clientX) {
    const pts = window._anChartPoints || [];
    if (!pts.length) return;
    const rect = area.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const svgX = ratio * 300;

    let nearestIdx = 0;
    let minDist = Infinity;
    pts.forEach((p, idx) => {
      const d = Math.abs(p.x - svgX);
      if (d < minDist) { minDist = d; nearestIdx = idx; }
    });

    const pt = pts[nearestIdx];
    if (nearestIdx !== lastIdx) {
      lastIdx = nearestIdx;
      vibro('selection');
    }

    const lineEl = document.getElementById('an-scrub-line');
    const haloEl = document.getElementById('an-scrub-halo');
    const dotEl = document.getElementById('an-scrub-dot');
    const headEl = document.getElementById('an-chart-headline');

    if (lineEl) { lineEl.setAttribute('x1', pt.x); lineEl.setAttribute('x2', pt.x); lineEl.classList.remove('hidden'); }
    if (haloEl) { haloEl.setAttribute('cx', pt.x); haloEl.setAttribute('cy', pt.y); haloEl.classList.remove('hidden'); }
    if (dotEl) { dotEl.setAttribute('cx', pt.x); dotEl.setAttribute('cy', pt.y); dotEl.classList.remove('hidden'); }
    if (headEl) {
      headEl.innerHTML = `<span class="text-brand">${fmtR(pt.val)}</span> <span class="text-xs font-medium text-sub">· ${humanDate(pt.dateIso)}</span>`;
    }
  }

  function endScrub() {
    lastIdx = -1;
    document.getElementById('an-scrub-line')?.classList.add('hidden');
    document.getElementById('an-scrub-halo')?.classList.add('hidden');
    document.getElementById('an-scrub-dot')?.classList.add('hidden');
    const headEl = document.getElementById('an-chart-headline');
    if (headEl && window._anChartDefaultHeadline) {
      headEl.textContent = window._anChartDefaultHeadline;
    }
  }

  area.addEventListener('pointerdown', (e) => {
    area.setPointerCapture?.(e.pointerId);
    scrubAtClientX(e.clientX);
  });
  area.addEventListener('pointermove', (e) => {
    if (e.buttons > 0 || e.pointerType === 'touch') scrubAtClientX(e.clientX);
  });
  area.addEventListener('pointerup', endScrub);
  area.addEventListener('pointercancel', endScrub);
  area.addEventListener('pointerleave', endScrub);
}

// ==================== ЖИВОЙ ОТКЛИК ПРИ ВВОДЕ РАСХОДА ====================
let lastLiveBrandSig = '';
function onLiveExpenseInput() {
  const raw = (document.getElementById('inp-expense-text')?.value || '').trim();
  const box = document.getElementById('live-expense-preview');
  if (!box) return;
  if (!raw) {
    box.innerHTML = '';
    lastLiveBrandSig = '';
    return;
  }

  const recognized = FM.parseExpenses(raw).map(item=>({title:item.merchant,amt:item.amount,cat:classifyCategory(item.merchant)}));

  const sig = recognized.map(r => `${r.title}:${r.cat}`).join('|');
  if (sig && sig !== lastLiveBrandSig) {
    lastLiveBrandSig = sig;
    vibro('selection');
  }

  box.innerHTML = recognized.map(r => `
    <div class="live-brand-pill input-surface px-2.5 py-1.5 flex items-center gap-2 text-xs border border-[#00D6C3]/30">
      ${merchantBadge(r.title, r.cat, 'expense')}
      <div>
        <div class="font-bold text-main leading-tight">${r.title}</div>
        <div class="text-[10px] text-brand">${(CATS[r.cat] || CATS.other).name}${r.amt > 0 ? ` · -${fmtR(r.amt)}` : ''}</div>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// ==================== УДЕРЖАНИЕ ДЛЯ ПОПОЛНЕНИЯ ПОДУШКИ ====================
let goalHoldTimer = null;
let goalHoldAccum = 0;

function startGoalHold(e) {
  e.preventDefault();
  if (goalHoldTimer) return;
  goalHoldAccum = 0;
  const fill = document.getElementById('goal-hold-fill');
  const lbl = document.getElementById('goal-hold-label');
  vibro('light');

  goalHoldTimer = setInterval(() => {
    goalHoldAccum += 100;
    vibro('selection');
    const pct = Math.min(100, (goalHoldAccum / 2000) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `Откладываем: +${fmtR(goalHoldAccum)} (отпустите для зачисления)`;
  }, 165);
}

function stopGoalHold() {
  if (!goalHoldTimer) return;
  clearInterval(goalHoldTimer);
  goalHoldTimer = null;
  const fill = document.getElementById('goal-hold-fill');
  const lbl = document.getElementById('goal-hold-label');
  if (fill) fill.style.width = '0%';
  if (lbl) lbl.textContent = 'Удерживайте, чтобы отложить (+100 ₽/тик)';

  if (goalHoldAccum > 0) {
    const toAdd = goalHoldAccum;
    goalHoldAccum = 0;
    vibro('success');
    quickTopupGoal(toAdd);
  }
}

setTheme();
applyMotionPref();
applyStealthUI();
initHeroCard3D();
initShakeToStealth();

// ==================== ИНТЕРАКТИВНАЯ ТЕПЛОВАЯ КАРТА ТРАТ (12 НЕДЕЛЬ) ====================
let selectedHeatmapIso = null;

function formatHeatmapTooltipDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wdShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dt.getDay()];
  const mNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${wdShort}, ${d} ${mNames[m - 1]}`;
}

function selectHeatmapDay(iso, triggerHaptic = true) {
  const dataMap = window._hmDayData || {};
  const info = dataMap[iso];
  if (!info || info.isFuture) return;

  if (selectedHeatmapIso !== iso) {
    selectedHeatmapIso = iso;
    if (triggerHaptic) vibro('selection');
  }

  document.querySelectorAll('#hm-grid-matrix .hm-cell').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.iso === iso);
  });

  const card = document.getElementById('hm-tooltip-card');
  if (!card) return;
  card.classList.remove('hidden');

  document.getElementById('hm-tt-date').textContent = formatHeatmapTooltipDate(iso);
  document.getElementById('hm-tt-sum').textContent = fmtR(info.sum);

  const catsEl = document.getElementById('hm-tt-cats');
  if (info.sum <= 0) {
    catsEl.textContent = 'Без трат — отличный день для бюджета!';
    catsEl.className = 'text-[11px] text-brand truncate';
  } else {
    const catNames = info.categories.map(cid => (CATS[cid] || CATS.other).name);
    catsEl.textContent = `${catNames.join(', ')} (${info.txCount} опер.)`;
    catsEl.className = 'text-[11px] text-sub truncate';
  }
}

function dismissHeatmapTooltip() {
  selectedHeatmapIso = null;
  document.getElementById('hm-tooltip-card')?.classList.add('hidden');
  document.querySelectorAll('#hm-grid-matrix .hm-cell').forEach(el => el.classList.remove('is-selected'));
}

function openSelectedHeatmapDay() {
  if (!selectedHeatmapIso) return;
  vibro('light');
  const [y, m] = selectedHeatmapIso.split('-').map(Number);
  state.calYear = y;
  state.calMonth = m - 1;
  state.calSelected = selectedHeatmapIso;
  goTab('calendar');
}

function renderActivityHeatmap() {
  const matrixEl = document.getElementById('hm-grid-matrix');
  if (!matrixEl) return;

  // Вычисляем понедельник текущей недели (конец 12-й колонки)
  const now = new Date(TODAY + 'T00:00:00');
  const jsDay = now.getDay(); // 0=Вс .. 6=Сб
  const monOffset = jsDay === 0 ? 6 : jsDay - 1;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - monOffset);

  // Понедельник 11 недель назад (старт 1-й колонки, всего 12 недель = 84 дня)
  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - 11 * 7);
  const startIso = localDateISO(startMonday);

  // Агрегируем расходы по дням за последние 12 недель
  const expenses = FM.transactions(state.transactions,startIso,TODAY).filter(t => t.type === 'expense');
  const dayStats = {};
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]; // Пн..Вс

  expenses.forEach(t => {
    if (!dayStats[t.date]) {
      dayStats[t.date] = { sum: 0, txCount: 0, categories: new Set() };
    }
    dayStats[t.date].sum = FM.add(dayStats[t.date].sum,t.amount);
    dayStats[t.date].txCount += 1;
    dayStats[t.date].categories.add(t.category || 'other');

    const [yy, mm, dd] = t.date.split('-').map(Number);
    const dt = new Date(yy, mm - 1, dd);
    const wdIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
    weekdayTotals[wdIdx] = FM.add(weekdayTotals[wdIdx],t.amount);
  });

  const dataMap = {};
  let noSpendDays = 0;
  const cellsHtml = [];

  // CSS Grid заполняется по строкам (row = 0..6 [Пн..Вс], col = 0..11 [Недели 1..12])
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 12; col++) {
      const cellDate = new Date(startMonday);
      cellDate.setDate(startMonday.getDate() + col * 7 + row);
      const iso = localDateISO(cellDate);
      const isFuture = iso > TODAY;
      const isToday = iso === TODAY;
      const st = dayStats[iso] || { sum: 0, txCount: 0, categories: new Set() };

      if (!isFuture && st.sum === 0) noSpendDays++;

      let lvl = 0;
      if (st.sum >= 7000) lvl = 4;
      else if (st.sum >= 3000) lvl = 3;
      else if (st.sum >= 1000) lvl = 2;
      else if (st.sum > 0) lvl = 1;

      dataMap[iso] = {
        iso,
        sum: st.sum,
        txCount: st.txCount,
        categories: Array.from(st.categories),
        isFuture
      };

      const extraCls = isFuture
        ? 'opacity-20 pointer-events-none'
        : (isToday ? 'ring-1 ring-[#00D6C3]/80' : '');
      const selCls = selectedHeatmapIso === iso ? 'is-selected' : '';

      const waveDelay = (col + row) * 10;
      cellsHtml.push(
        `<div data-iso="${iso}" onclick="selectHeatmapDay('${iso}', true)" style="animation-delay: ${waveDelay}ms;" class="hm-cell hm-cell-anim hm-lvl-${lvl} ${extraCls} ${selCls}" title="${iso}: ${st.sum} ₽"></div>`
      );
    }
  }

  window._hmDayData = dataMap;
  matrixEl.innerHTML = cellsHtml.join('');

  // Нижняя сводка метрик
  document.getElementById('hm-stat-nospend').textContent = `${noSpendDays} дн. 🔥`;

  const fullWeekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const maxWdVal = Math.max(...weekdayTotals);
  const peakWdIdx = weekdayTotals.indexOf(maxWdVal);
  document.getElementById('hm-stat-peakday').textContent = maxWdVal > 0 ? fullWeekdays[peakWdIdx] : 'Нет данных';

  const avgCheck = expenses.length > 0
    ? Math.round(FM.sum(expenses,t=>t.amount) / expenses.length)
    : 0;
  document.getElementById('hm-stat-avgcheck').textContent = fmtR(avgCheck);

  if (selectedHeatmapIso && dataMap[selectedHeatmapIso]) {
    selectHeatmapDay(selectedHeatmapIso, false);
  }
  lucide.createIcons();
}

function initHeatmapScrubbing() {
  const matrix = document.getElementById('hm-grid-matrix');
  if (!matrix) return;

  function handlePoint(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    const cell = target?.closest?.('.hm-cell');
    if (cell && cell.dataset.iso) {
      selectHeatmapDay(cell.dataset.iso, true);
    }
  }

  matrix.addEventListener('pointerdown', (e) => {
    handlePoint(e.clientX, e.clientY);
  });
  matrix.addEventListener('pointermove', (e) => {
    if (e.buttons > 0 || e.pointerType === 'touch') {
      handlePoint(e.clientX, e.clientY);
    }
  });
}

function initPullToRefresh() {
  const ptr = document.getElementById('ptr-indicator');
  if (!ptr) return;
  let startY = 0;
  let pulling = false;
  let armed = false;

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY > 2) return;
    if (document.querySelector('.modal-sheet') && Array.from(document.querySelectorAll('[id^="modal-"]')).some(m => !m.classList.contains('hidden'))) return;
    startY = e.touches[0].clientY;
    pulling = true;
    armed = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 18 && window.scrollY <= 2) {
      const clamped = Math.min(90, dy);
      ptr.style.opacity = String(Math.min(1, (clamped - 18) / 52));
      ptr.style.transform = `translate(-50%, ${Math.round((clamped - 18) * 0.35 - 12)}px)`;
      if (clamped >= 72 && !armed) {
        armed = true;
        vibro('medium');
      } else if (clamped < 72 && armed) {
        armed = false;
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    if (armed) {
      armed = false;
      ptr.style.opacity = '1';
      ptr.style.transform = 'translate(-50%, 8px)';
      try { await runAnimatedBankSync(); } catch (e) {}
    }
    ptr.style.opacity = '0';
    ptr.style.transform = 'translate(-50%, -16px)';
  }, { passive: true });
}

initPullToRefresh();
initTactileSheets();
initVoicePullCordPhysics();
initChartScrubbing();
initHeatmapScrubbing();
initCardSpotlights();
initOnboardingFlow();
organizeSimplifiedLayout();
updateSyncQueueUI();
renderAll(false);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    organizeSimplifiedLayout();
    renderAll(false);
  });
}

// Cloud is optional: render local data first, then try Telegram-only sync.
if (localStorage.getItem('fp_onboarded') === '1') syncWithBackend(false);
