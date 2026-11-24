/* FINTEX Analytics Pro — фирменная аналитика
 * Сохраняет совместимость с window.state.transactions и публичным API renderAnalytics.
 */
(function () {
  'use strict';

  const PERIODS = [
    { id: 'week', label: 'Неделя', days: 7 },
    { id: 'month', label: 'Месяц', days: 30 },
    { id: 'quarter', label: 'Квартал', days: 90 },
    { id: 'year', label: 'Год', days: 365 }
  ];
  const SUBTABS = [
    { id: 'overview', label: 'Обзор' },
    { id: 'categories', label: 'Категории' },
    { id: 'rhythm', label: 'Ритм' }
  ];

  const CATEGORY_META = [
    { name: 'Продукты', icon: 'shopping-basket', color: 'var(--accent)', bg: 'rgba(0,214,195,.13)', keys: ['продукт', 'питан', 'бакалея', 'супермаркет', 'пятероч', 'пятёроч', 'магнит', 'перекрест', 'перекрёст', 'лента', 'ашан', 'дикси', 'вкусвилл', 'еда домой'] },
    { name: 'Кафе и рестораны', icon: 'utensils', color: 'var(--gold)', bg: 'rgba(242,198,93,.14)', keys: ['кафе', 'ресторан', 'кофе', 'общепит', 'еда вне дома', 'фастфуд', 'доставка еды', 'столов', 'бар', 'перекус', 'макдон', 'вкусно — и точка', 'бургер', 'пицц'] },
    { name: 'Транспорт', icon: 'car-front', color: '#64B5F6', bg: 'rgba(100,181,246,.14)', keys: ['транспорт', 'такси', 'бензин', 'топлив', 'азс', 'метро', 'автобус', 'трамвай', 'проезд', 'каршеринг', 'парков'] },
    { name: 'Дом и ЖКХ', icon: 'house', color: '#A7D88D', bg: 'rgba(167,216,141,.14)', keys: ['жкх', 'коммун', 'жиль', 'квартир', 'аренд', 'дом', 'ремонт', 'мебел', 'хозтовар', 'бытов', 'интернет домой'] },
    { name: 'Покупки', icon: 'shopping-bag', color: '#C4A7FF', bg: 'rgba(196,167,255,.14)', keys: ['покуп', 'магазин', 'одежд', 'обув', 'маркетплейс', 'wildberries', 'вайлдберриз', 'озон', 'ozon', 'техник', 'электроник', 'аксессуар'] },
    { name: 'Здоровье', icon: 'heart-pulse', color: '#F28B9A', bg: 'rgba(242,139,154,.14)', keys: ['здоров', 'аптек', 'лекар', 'медицин', 'врач', 'клиник', 'стомат', 'анализ'] },
    { name: 'Развлечения', icon: 'gamepad-2', color: '#D6A6FF', bg: 'rgba(214,166,255,.14)', keys: ['развлеч', 'кино', 'игр', 'подписк', 'стрим', 'музык', 'концерт', 'театр', 'хобби'] },
    { name: 'Связь и сервисы', icon: 'smartphone', color: '#77C9E8', bg: 'rgba(119,201,232,.14)', keys: ['связ', 'телефон', 'мобиль', 'оператор', 'сервис', 'облак', 'программ', 'хостинг'] },
    { name: 'Образование', icon: 'graduation-cap', color: '#E9B86C', bg: 'rgba(233,184,108,.14)', keys: ['образован', 'обучен', 'курс', 'учеб', 'книг', 'школ', 'университет'] },
    { name: 'Переводы и финансы', icon: 'arrow-left-right', color: '#F0D27B', bg: 'rgba(240,210,123,.14)', keys: ['перевод', 'комисс', 'банк', 'кредит', 'долг', 'финанс', 'налог'] },
    { name: 'Прочее', icon: 'circle-ellipsis', color: '#9BAFA9', bg: 'rgba(155,175,169,.12)', keys: [] }
  ];

  let activePeriod = 'month';
  let activeSubtab = 'overview';
  let expandedCategory = null;
  let selectedHeatDate = null;

  const COLORS = {
    bg: '#071916', surface: '#0B211D', surface2: '#102B25', border: 'rgba(0,214,195,.16)',
    mint: 'var(--accent)', gold: 'var(--gold)', text: '#F3F8F5', muted: '#91A69F', red: '#FF777F'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function getState() {
    if (window.state && Array.isArray(window.state.transactions)) return window.state;
    for (const key of ['fintex_state', 'fintex_data', 'state']) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (parsed && Array.isArray(parsed.transactions)) return parsed;
      } catch (_) {}
    }
    return { transactions: [], currency: '₽' };
  }
  function parseTxDate(tx) {
    const raw = tx.date || tx.createdAt || tx.timestamp;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function isIncome(tx) {
    if (tx.type === 'income') return true;
    if (tx.type === 'expense') return false;
    return Number(tx.amount) > 0 && tx.category === 'Доход';
  }
  function fmt(num, currency) {
    return `${Math.round(Number(num) || 0).toLocaleString('ru-RU')} ${currency || '₽'}`;
  }
  function categoryMeta(rawName) {
    const raw = String(rawName || 'Прочее').trim();
    const normalized = raw.toLocaleLowerCase('ru-RU');
    if (normalized === 'доход' || normalized === 'income') return { name: 'Доход', icon: 'wallet', color: COLORS.mint, bg: 'rgba(0,214,195,.13)' };
    const match = CATEGORY_META.find(meta => meta.keys.some(key => normalized.includes(key)));
    if (match) return match;
    // Неизвестную пользовательскую категорию сохраняем, не подменяя её догадкой.
    return { name: raw || 'Прочее', icon: 'circle-ellipsis', color: '#9BAFA9', bg: 'rgba(155,175,169,.12)' };
  }

  function injectStyles() {
    if (document.getElementById('ftx-analytics-pro-style')) return;
    const style = document.createElement('style');
    style.id = 'ftx-analytics-pro-style';
    style.textContent = `
      .ftx-ap{--ap-mint:var(--accent);--ap-gold:var(--gold);--ap-bg:#071916;--ap-surface:#0B211D;--ap-line:rgba(0,214,195,.16);color:#F3F8F5;padding:10px 0 92px;font-family:inherit}
      .ftx-ap *{box-sizing:border-box}.ftx-ap button{font:inherit;-webkit-tap-highlight-color:transparent}
      .ftx-ap-pills{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:4px;background:rgba(0,0,0,.22);border:1px solid var(--ap-line);border-radius:15px;margin-bottom:10px}
      .ftx-ap-pill{border:0;background:transparent;color:#91A69F;font-size:12px;font-weight:650;padding:9px 3px;border-radius:11px;cursor:pointer;transition:all .22s ease}
      .ftx-ap-pill.active{color:#041311;background:linear-gradient(120deg,var(--accent),#70E8D8);box-shadow:0 4px 16px rgba(0,214,195,.18)}
      .ftx-ap-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:13px}
      .ftx-ap-tab{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);color:#9BAFA9;font-size:12px;font-weight:700;padding:10px 5px;border-radius:12px;cursor:pointer;transition:all .2s ease}
      .ftx-ap-tab.active{border-color:rgba(0,214,195,.45);color:#EFFFFB;background:linear-gradient(135deg,rgba(0,214,195,.16),rgba(242,198,93,.07));box-shadow:inset 0 0 0 1px rgba(0,214,195,.06)}
      .ftx-ap-card{background:linear-gradient(145deg,rgba(15,55,46,.82),rgba(8,27,23,.96) 72%);border:1px solid var(--ap-line);border-radius:19px;padding:15px;margin-bottom:11px;box-shadow:0 10px 28px rgba(0,0,0,.12)}
      .ftx-ap-card.gold{border-color:rgba(242,198,93,.28);background:linear-gradient(145deg,rgba(78,59,22,.24),rgba(8,27,23,.96) 76%)}
      .ftx-ap-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#91A69F;font-weight:750}
      .ftx-ap-big{font-size:clamp(26px,7vw,34px);font-weight:850;letter-spacing:-.045em;margin:5px 0 8px;color:#F7FBF8;line-height:1.12;font-variant-numeric:tabular-nums}
      .ftx-ap-delta{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:5px 9px;border-radius:99px;background:rgba(0,214,195,.12);color:#69E8D9;border:1px solid rgba(0,214,195,.18)}
      .ftx-ap-delta.warn{background:rgba(255,119,127,.12);color:#FF9DA3;border-color:rgba(255,119,127,.25)}
      .ftx-ap-summary-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:11px}
      .ftx-ap-stat{min-width:0;background:linear-gradient(145deg,rgba(17,49,41,.9),rgba(9,29,25,.96));border:1px solid rgba(255,255,255,.065);border-radius:16px;padding:12px}
      .ftx-ap-stat-label{font-size:10px;color:#91A69F;line-height:1.35}.ftx-ap-stat-value{font-size:15px;font-weight:800;margin-top:5px;letter-spacing:-.02em;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
      .ftx-ap-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px;font-size:13px;font-weight:800;color:#F3F8F5}
      .ftx-ap-section-sub{font-size:10px;color:#91A69F;font-weight:550}
      .ftx-ap-insight{display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055);font-size:12px;line-height:1.45;color:#D5E2DC}
      .ftx-ap-insight:last-child{border-bottom:0;padding-bottom:0}.ftx-ap-insight-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none;background:var(--accent);box-shadow:0 0 9px rgba(0,214,195,.35)}
      .ftx-ap-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:3px}.ftx-ap-btn{border:1px solid rgba(0,214,195,.25);background:linear-gradient(130deg,rgba(0,214,195,.13),rgba(0,214,195,.045));color:#8CEDE1;font-size:11px;font-weight:750;padding:12px 7px;border-radius:13px;cursor:pointer}
      .ftx-ap-cat{display:flex;gap:11px;align-items:center;background:linear-gradient(120deg,rgba(13,43,36,.96),rgba(8,27,23,.96));border:1px solid rgba(255,255,255,.065);border-radius:16px;padding:12px;margin-bottom:8px;cursor:pointer;transition:transform .2s,border-color .2s,background .2s}
      .ftx-ap-cat:active{transform:scale(.985)}.ftx-ap-cat.open{border-color:rgba(0,214,195,.32);background:linear-gradient(120deg,rgba(14,54,45,.98),rgba(8,27,23,.98))}
      .ftx-ap-cat-icon{width:39px;height:39px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex:none}
      .ftx-ap-cat-icon i,.ftx-ap-cat-icon svg{width:18px;height:18px}.ftx-ap-cat-main{min-width:0;flex:1}.ftx-ap-cat-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:750}.ftx-ap-cat-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ftx-ap-cat-sum{font-size:12px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}.ftx-ap-cat-meta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:10px;color:#91A69F}.ftx-ap-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.075);overflow:hidden;margin-top:7px}.ftx-ap-bar-fill{height:100%;border-radius:99px;transition:width .55s cubic-bezier(.2,.8,.2,1)}
      .ftx-ap-drill{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07);font-size:11px;color:#B8C9C2}.ftx-ap-tx{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.045)}.ftx-ap-tx:last-child{border-bottom:0}.ftx-ap-tx-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ftx-ap-tx-sum{white-space:nowrap;font-weight:700;color:#EAF5F0}
      .ftx-ap-empty{text-align:center;color:#91A69F;padding:24px 12px;font-size:12px;line-height:1.5}
      .ftx-ap-legend{display:flex;align-items:center;gap:5px;font-size:9px;color:#91A69F}.ftx-ap-legend-dot{width:8px;height:8px;border-radius:3px}
      .ftx-ap-weekdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;align-items:end}.ftx-ap-weekday{min-width:0;text-align:center}.ftx-ap-weekday-track{height:94px;display:flex;align-items:flex-end;justify-content:center;background:rgba(255,255,255,.035);border-radius:9px;overflow:hidden}.ftx-ap-weekday-fill{width:100%;min-height:3px;border-radius:7px 7px 2px 2px;transition:height .5s ease}.ftx-ap-weekday-name{font-size:9px;color:#91A69F;margin-top:7px}.ftx-ap-weekday-value{font-size:9px;color:#D5E2DC;font-weight:700;margin-top:4px;white-space:nowrap}
      .ftx-ap-heat-wrap{overflow-x:auto;padding-bottom:3px}.ftx-ap-heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);grid-auto-columns:minmax(0,1fr);gap:5px;min-width:250px;margin:12px 0}.ftx-ap-heat-cell{width:100%;aspect-ratio:1;border-radius:5px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.025);cursor:pointer;transition:transform .16s,border-color .16s}.ftx-ap-heat-cell.l1{background:rgba(0,214,195,.20)}.ftx-ap-heat-cell.l2{background:rgba(0,214,195,.48)}.ftx-ap-heat-cell.l3{background:linear-gradient(135deg,var(--accent),var(--gold));box-shadow:0 0 9px rgba(0,214,195,.18)}.ftx-ap-heat-cell.sel{border:2px solid var(--gold);transform:scale(1.12)}
      .ftx-ap-day-detail{margin-top:10px;padding:11px;border-radius:13px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.055)}
      .ftx-ap-day-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:800;margin-bottom:5px}.ftx-ap-day-total{color:var(--gold);font-variant-numeric:tabular-nums}
      .ftx-ap-meter{height:7px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:8px}.ftx-ap-meter>span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#00A899,var(--accent),var(--gold))}
      .ftx-ap-note{font-size:10px;color:#91A69F;line-height:1.45;margin-top:8px}
      @media(prefers-reduced-motion:reduce){.ftx-ap *{transition:none!important;animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function analyzeData(days) {
    const st = getState();
    const currency = st.currency || '₽';
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const prevStart = new Date(start.getTime() - days * 86400000);
    let spent = 0, income = 0, prevSpent = 0;
    const byCat = {};
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    const byDate = {};
    const activeDates = new Set();
    const currentTxs = [];

    (st.transactions || []).forEach(tx => {
      const date = parseTxDate(tx);
      if (!date) return;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (!amount) return;
      const incomeTx = isIncome(tx);
      if (date >= start && date <= now) {
        currentTxs.push({ ...tx, _date: date, _amt: amount, _inc: incomeTx });
        if (incomeTx) {
          income += amount;
          return;
        }
        spent += amount;
        const dateKey = localDateKey(date);
        activeDates.add(dateKey);
        byWeekday[date.getDay()] += amount;
        if (!byDate[dateKey]) byDate[dateKey] = { total: 0, list: [] };
        byDate[dateKey].total += amount;
        byDate[dateKey].list.push({ title: tx.merchant || tx.title || tx.note || tx.category || 'Покупка', amount, category: tx.category || 'Прочее' });
        const meta = categoryMeta(tx.category || 'Прочее');
        const key = meta.name;
        if (!byCat[key]) byCat[key] = { total: 0, items: [], meta };
        byCat[key].total += amount;
        byCat[key].items.push({ title: tx.merchant || tx.title || tx.note || key, amount, date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) });
      } else if (date >= prevStart && date < start && !incomeTx) {
        prevSpent += amount;
      }
    });

    const categories = Object.entries(byCat).map(([name, data]) => ({
      name, total: data.total, pct: spent > 0 ? data.total / spent * 100 : 0,
      items: data.items.sort((a, b) => b.amount - a.amount).slice(0, 8), meta: data.meta
    })).sort((a, b) => b.total - a.total);
    const deltaPct = prevSpent > 0 ? Math.round((spent - prevSpent) / prevSpent * 100) : 0;
    const burnRate = spent / Math.max(1, days);
    const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(0, monthDays - now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthSpent = 0, monthIncome = 0;
    (st.transactions || []).forEach(tx => {
      const date = parseTxDate(tx);
      if (!date || date < monthStart || date > now) return;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (isIncome(tx)) monthIncome += amount; else monthSpent += amount;
    });
    const monthElapsed = Math.max(1, now.getDate());
    const monthDailyRate = monthSpent / monthElapsed;
    const projectedBalance = monthIncome - monthSpent - monthDailyRate * daysLeft;
    const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weekdayLong = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
    const peakIndex = byWeekday.indexOf(Math.max(...byWeekday));
    const quietDays = Math.max(0, days - activeDates.size);
    const insights = [];
    if (categories[0]) insights.push({ text: `Больше всего денег ушло на категорию «${categories[0].name}» — ${Math.round(categories[0].pct)}% всех расходов.`, color: categories[0].meta.color });
    if (byWeekday[peakIndex] > 0) insights.push({ text: `Самый затратный день недели — ${weekdayLong[peakIndex]}.`, color: COLORS.gold });
    if (spent > 0) insights.push({ text: `В среднем расходы составляют ${fmt(burnRate, currency)} в день.`, color: COLORS.mint });
    insights.push({ text: `Дней без покупок: ${quietDays} из ${days}.`, color: '#91A69F' });

    return { st, currency, now, spent, income, net: income - spent, deltaPct, prevSpent, burnRate, projectedBalance, categories, insights, byWeekday, weekdayNames, byDate, activeDates, currentTxs, allTxs: st.transactions || [] };
  }

  function renderPeriodControls() {
    return `<div class="ftx-ap-pills" role="group" aria-label="Период аналитики">${PERIODS.map(p => `<button type="button" class="ftx-ap-pill ${p.id === activePeriod ? 'active' : ''}" data-period="${p.id}" aria-pressed="${p.id === activePeriod}">${p.label}</button>`).join('')}</div>`;
  }
  function renderTabs() {
    return `<div class="ftx-ap-tabs" role="tablist">${SUBTABS.map(t => `<button type="button" class="ftx-ap-tab ${t.id === activeSubtab ? 'active' : ''}" data-subtab="${t.id}" role="tab" aria-selected="${t.id === activeSubtab}">${t.label}</button>`).join('')}</div>`;
  }

  function renderOverview(data, period) {
    const deltaLabel = data.prevSpent > 0
      ? `${data.deltaPct > 0 ? '+' : ''}${data.deltaPct}% к предыдущему периоду`
      : 'Пока нет данных для сравнения';
    const deltaClass = data.deltaPct > 0 ? 'warn' : '';
    const topCats = data.categories.slice(0, 4).map(cat => `
      <div style="display:flex;align-items:center;gap:9px;margin:10px 0">
        <span style="width:8px;height:8px;border-radius:3px;background:${cat.meta.color};flex:none"></span>
        <span style="font-size:11px;color:#C8D8D1;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cat.name)}</span>
        <span style="font-size:11px;font-weight:750;color:#F3F8F5">${Math.round(cat.pct)}%</span>
      </div>`).join('');
    return `
      <div class="ftx-ap-card gold">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="ftx-ap-kicker">Расходы за период · ${period.label.toLocaleLowerCase('ru-RU')}</div>
          <span class="ftx-ap-brand-label">FINTEX</span>
        </div>
        <div class="ftx-ap-big">${fmt(data.spent, data.currency)}</div>
        <span class="ftx-ap-delta ${deltaClass}">${data.deltaPct > 0 ? '↑' : data.deltaPct < 0 ? '↓' : '•'} ${esc(deltaLabel)}</span>
        <div style="display:flex;gap:16px;margin-top:15px;padding-top:12px;border-top:1px solid rgba(242,198,93,.14)">
          <div style="flex:1"><div class="ftx-ap-stat-label">Доходы</div><div style="font-size:14px;font-weight:800;color:var(--accent);margin-top:3px">${fmt(data.income, data.currency)}</div></div>
          <div style="flex:1"><div class="ftx-ap-stat-label">Разница</div><div style="font-size:14px;font-weight:800;color:${data.net >= 0 ? 'var(--gold)' : 'var(--danger)'};margin-top:3px">${data.net > 0 ? '+' : ''}${fmt(data.net, data.currency)}</div></div>
        </div>
      </div>
      <div class="ftx-ap-summary-row">
        <div class="ftx-ap-stat"><div class="ftx-ap-stat-label">Средние расходы в день</div><div class="ftx-ap-stat-value" style="color:var(--accent)">${fmt(data.burnRate, data.currency)}</div></div>
        <div class="ftx-ap-stat"><div class="ftx-ap-stat-label">Прогноз остатка к концу месяца</div><div class="ftx-ap-stat-value" style="color:${data.projectedBalance < 0 ? 'var(--danger)' : 'var(--gold)'}">${fmt(data.projectedBalance, data.currency)}</div></div>
      </div>
      <div class="ftx-ap-card">
        <div class="ftx-ap-section-title"><span>Куда уходят деньги</span><span class="ftx-ap-section-sub">Топ категорий</span></div>
        ${topCats || '<div class="ftx-ap-empty">Добавьте расходы — здесь появится их распределение</div>'}
        ${data.categories.length ? `<button type="button" class="ftx-ap-btn" data-goto="categories" style="width:100%;margin-top:8px">Все категории →</button>` : ''}
      </div>
      <div class="ftx-ap-card">
        <div class="ftx-ap-section-title"><span>Что важно заметить</span><span class="ftx-ap-section-sub">Анализ периода</span></div>
        ${data.insights.map(item => `<div class="ftx-ap-insight"><span class="ftx-ap-insight-dot" style="background:${item.color}"></span><span>${esc(item.text)}</span></div>`).join('')}
      </div>
      <div class="ftx-ap-actions">
        <button type="button" class="ftx-ap-btn" data-act="stories">Итоги в Stories</button>
        <button type="button" class="ftx-ap-btn" data-act="sim">Дерево будущего</button>
      </div>`;
  }

  function renderCategories(data) {
    if (!data.categories.length) return `<div class="ftx-ap-card"><div class="ftx-ap-empty">За выбранный период расходов пока нет.<br>Добавьте операцию — и FINTEX покажет, на что уходят деньги.</div></div>`;
    return `
      <div class="ftx-ap-card">
        <div class="ftx-ap-section-title"><span>Структура расходов</span><span class="ftx-ap-section-sub">${data.categories.length} катег.</span></div>
        <div style="font-size:10px;color:#91A69F;line-height:1.45;margin-top:-5px;margin-bottom:12px">Нажмите на категорию, чтобы посмотреть операции внутри неё.</div>
        ${data.categories.map(cat => {
          const isOpen = expandedCategory === cat.name;
          const meta = cat.meta;
          return `<div class="ftx-ap-cat ${isOpen ? 'open' : ''}" data-cat="${esc(cat.name)}" aria-expanded="${isOpen}">
            <div class="ftx-ap-cat-icon" style="color:${meta.color};background:${meta.bg};border:1px solid ${meta.color}33"><i data-lucide="${meta.icon}"></i></div>
            <div class="ftx-ap-cat-main">
              <div class="ftx-ap-cat-top"><span class="ftx-ap-cat-name">${esc(cat.name)}</span><span class="ftx-ap-cat-sum" style="color:${meta.color}">${fmt(cat.total, data.currency)}</span></div>
              <div class="ftx-ap-bar"><div class="ftx-ap-bar-fill" style="width:${Math.max(1, cat.pct)}%;background:linear-gradient(90deg,${meta.color}99,${meta.color})"></div></div>
              <div class="ftx-ap-cat-meta"><span>${Math.round(cat.pct)}% всех расходов</span><span>${cat.items.length}${cat.items.length === 8 ? '+' : ''} операций в списке</span></div>
              ${isOpen ? `<div class="ftx-ap-drill">${cat.items.map(item => `<div class="ftx-ap-tx"><span class="ftx-ap-tx-title">${esc(item.title)} · ${esc(item.date)}</span><span class="ftx-ap-tx-sum">${fmt(item.amount, data.currency)}</span></div>`).join('')}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="ftx-ap-note">Категории сгруппированы по названию операции. Неизвестные названия сохраняются как есть — FINTEX не приписывает им неподтверждённый смысл.</div>`;
  }

  function renderWeekdayRhythm(data) {
    const max = Math.max(1, ...data.byWeekday);
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
    const peak = data.byWeekday.indexOf(max);
    return `<div class="ftx-ap-card">
      <div class="ftx-ap-section-title"><span>Расходы по дням недели</span><span class="ftx-ap-section-sub">За выбранный период</span></div>
      <div class="ftx-ap-weekdays">${weekdayOrder.map(day => {
        const value = data.byWeekday[day];
        const pct = value ? Math.max(4, value / max * 100) : 0;
        const isPeak = day === peak && value > 0;
        const color = isPeak ? 'linear-gradient(180deg,var(--gold),#B88928)' : 'linear-gradient(180deg,var(--accent),#087D70)';
        return `<div class="ftx-ap-weekday"><div class="ftx-ap-weekday-track"><div class="ftx-ap-weekday-fill" style="height:${pct}%;background:${color};opacity:${value ? 1 : .12}"></div></div><div class="ftx-ap-weekday-name" style="color:${isPeak ? 'var(--gold)' : ''};font-weight:${isPeak ? 800 : 600}">${data.weekdayNames[day]}</div><div class="ftx-ap-weekday-value">${value ? compactMoney(value) : '—'}</div></div>`;
      }).join('')}</div>
      <div class="ftx-ap-legend" style="margin-top:11px"><span class="ftx-ap-legend-dot" style="background:var(--accent)"></span> Обычная активность <span class="ftx-ap-legend-dot" style="background:var(--gold);margin-left:8px"></span> Самый затратный день</div>
      <div class="ftx-ap-note">Сравниваются суммарные расходы по дням недели. Это помогает заметить повторяющиеся привычки, а не оценивать отдельную покупку.</div>
    </div>`;
  }
  function compactMoney(value) {
    const n = Number(value) || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.', ',')}м`;
    if (n >= 10000) return `${Math.round(n / 1000)}к`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}к`;
    return String(Math.round(n));
  }

  function renderHeatmap(data) {
    const map = {};
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 83);
    (data.allTxs || []).forEach(tx => {
      if (isIncome(tx)) return;
      const date = parseTxDate(tx);
      if (!date) return;
      const key = localDateKey(date);
      if (!map[key]) map[key] = { total: 0, list: [] };
      const amount = Math.abs(Number(tx.amount) || 0);
      map[key].total += amount;
      map[key].list.push({ title: tx.merchant || tx.title || tx.category || 'Покупка', amount });
    });
    const totals = Object.values(map).map(item => item.total).filter(Boolean);
    const max = Math.max(1, ...totals);
    const todayKey = localDateKey(now);
    if (!selectedHeatDate || selectedHeatDate < localDateKey(start) || selectedHeatDate > todayKey) selectedHeatDate = todayKey;
    const cells = [];
    const monthLabels = [];
    for (let i = 0; i < 84; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = localDateKey(date);
      const total = map[key]?.total || 0;
      const ratio = total / max;
      const level = total === 0 ? '' : ratio < .34 ? 'l1' : ratio < .68 ? 'l2' : 'l3';
      if (date.getDate() === 1 || i === 0) monthLabels.push({ index: i, label: date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') });
      cells.push(`<button type="button" class="ftx-ap-heat-cell ${level} ${selectedHeatDate === key ? 'sel' : ''}" data-hdate="${key}" title="${date.toLocaleDateString('ru-RU')}: ${fmt(total, data.currency)}" aria-label="${date.toLocaleDateString('ru-RU')}, ${fmt(total, data.currency)}"></button>`);
    }
    const selected = map[selectedHeatDate] || { total: 0, list: [] };
    const selectedDate = new Date(`${selectedHeatDate}T12:00:00`);
    const dateLabel = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const listHtml = selected.list.length
      ? selected.list.sort((a, b) => b.amount - a.amount).slice(0, 8).map(item => `<div class="ftx-ap-tx"><span class="ftx-ap-tx-title">${esc(item.title)}</span><span class="ftx-ap-tx-sum">${fmt(item.amount, data.currency)}</span></div>`).join('')
      : '<div style="font-size:11px;color:#91A69F;padding:5px 0">В этот день расходов не было</div>';
    return `<div class="ftx-ap-card">
      <div class="ftx-ap-section-title"><span>Карта финансовой активности</span><span class="ftx-ap-section-sub">12 недель</span></div>
      <div class="ftx-ap-heat-wrap"><div class="ftx-ap-heat">${cells.join('')}</div></div>
      <div class="ftx-ap-legend" style="justify-content:flex-end;margin-top:7px"><span>Меньше</span><i class="ftx-ap-legend-dot" style="background:rgba(0,214,195,.2)"></i><i class="ftx-ap-legend-dot" style="background:rgba(0,214,195,.48)"></i><i class="ftx-ap-legend-dot" style="background:linear-gradient(135deg,var(--accent),var(--gold))"></i><span>Больше</span></div>
      <div class="ftx-ap-day-detail"><div class="ftx-ap-day-head"><span>${esc(dateLabel)}</span><span class="ftx-ap-day-total">${fmt(selected.total, data.currency)}</span></div>${listHtml}</div>
      <div class="ftx-ap-note">Нажмите на любую ячейку, чтобы посмотреть покупки за конкретную дату. Яркость показывает относительный объём расходов за последние 12 недель.</div>
    </div>`;
  }

  function renderRhythm(data) {
    return `${renderWeekdayRhythm(data)}${renderHeatmap(data)}`;
  }

  function findAnalyticsContainer() {
    const selectors = ['#analytics-content', '#analyticsContent', '#view-analytics', '#tab-analytics', '#screen-analytics', '#analytics', '[data-tab="analytics"]'];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function renderProAnalytics(targetEl) {
    const container = targetEl || findAnalyticsContainer();
    if (!container) return;
    injectStyles();
    const period = PERIODS.find(p => p.id === activePeriod) || PERIODS[1];
    const data = analyzeData(period.days);
    let body = '';
    if (activeSubtab === 'overview') body = renderOverview(data, period);
    else if (activeSubtab === 'categories') body = renderCategories(data);
    else body = renderRhythm(data);

    container.innerHTML = `<div class="page-heading"><h2>Аналитика</h2><p>Ваши деньги в деталях</p></div><div class="ftx-ap">${renderPeriodControls()}${renderTabs()}${body}</div>`;
    container.querySelectorAll('[data-period]').forEach(button => {
      button.addEventListener('click', () => { activePeriod = button.dataset.period; renderProAnalytics(container); });
    });
    container.querySelectorAll('[data-subtab]').forEach(button => {
      button.addEventListener('click', () => { activeSubtab = button.dataset.subtab; renderProAnalytics(container); });
    });
    container.querySelectorAll('[data-cat]').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.cat;
        expandedCategory = expandedCategory === name ? null : name;
        renderProAnalytics(container);
      });
    });
    container.querySelectorAll('[data-hdate]').forEach(cell => {
      cell.addEventListener('click', () => { selectedHeatDate = cell.dataset.hdate; renderProAnalytics(container); });
    });
    container.querySelectorAll('[data-goto="categories"]').forEach(button => {
      button.addEventListener('click', () => { activeSubtab = 'categories'; renderProAnalytics(container); });
    });
    const storiesButton = container.querySelector('[data-act="stories"]');
    if (storiesButton) storiesButton.addEventListener('click', () => (window.openStoriesRecap || window.openStories || (() => {}))());
    const simButton = container.querySelector('[data-act="sim"]');
    if (simButton) simButton.addEventListener('click', () => {
      if (window.SIM?.ui?.openModal) window.SIM.ui.openModal();
      else if (window.SIM?.ui?.open) window.SIM.ui.open();
      else if (window.openSimulator) window.openSimulator();
    });
    try { if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } }); } catch (_) {}
  }

  const originalRenderAnalytics = window.renderAnalytics;
  window.renderAnalytics = function (...args) {
    if (typeof originalRenderAnalytics === 'function') {
      try { originalRenderAnalytics.apply(this, args); } catch (_) {}
    }
    renderProAnalytics(args[0] instanceof HTMLElement ? args[0] : null);
  };
  window.FintexAnalyticsPro = { render: renderProAnalytics };
})();
