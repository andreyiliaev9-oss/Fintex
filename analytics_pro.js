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

  let activePeriod = 'month';
  let activeSubtab = 'overview';
  let expandedCategory = null;
  let selectedHeatDate = null;

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('ftx-analytics-pro-style')) return;
    const style = document.createElement('style');
    style.id = 'ftx-analytics-pro-style';
    style.textContent = `
      .ftx-ap { color: #FAF6EE; padding: 12px 0 88px; font-family: inherit; }
      .ftx-ap-pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: rgba(255,248,230,0.04); padding: 4px; border-radius: 14px; border: 1px solid rgba(247,223,148,0.14); margin-bottom: 10px; }
      .ftx-ap-pill { border: 0; background: transparent; color: #9E9484; font-size: 12px; font-weight: 600; padding: 7px 4px; border-radius: 10px; cursor: pointer; transition: 0.2s; }
      .ftx-ap-pill.active { background: linear-gradient(135deg, rgba(226,184,87,0.24), rgba(184,137,40,0.14)); color: #F7DF94; box-shadow: inset 0 0 0 1px rgba(247,223,148,0.3); }
      .ftx-ap-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .ftx-ap-tab { border: 1px solid rgba(255,248,230,0.1); background: rgba(255,248,230,0.03); color: #C7BEB0; font-size: 13px; font-weight: 600; padding: 9px 6px; border-radius: 12px; cursor: pointer; transition: 0.2s; }
      .ftx-ap-tab.active { border-color: rgba(247,223,148,0.42); color: #FAF6EE; background: rgba(226,184,87,0.12); }
      .ftx-ap-card { background: linear-gradient(160deg, rgba(247,223,148,0.08) 0%, rgba(255,248,230,0.03) 55%, rgba(9,9,11,0.85) 100%); border: 1px solid rgba(247,223,148,0.22); border-radius: 20px; padding: 16px; margin-bottom: 12px; }
      .ftx-ap-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #E2B857; font-weight: 600; }
      .ftx-ap-big { font-size: 28px; font-weight: 800; margin: 4px 0 6px; background: linear-gradient(135deg, #FFFDF8 20%, #F7DF94 75%, #E2B857 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .ftx-ap-delta { display: inline-block; font-size: 12px; padding: 3px 9px; border-radius: 99px; background: rgba(226,184,87,0.12); color: #F7DF94; border: 1px solid rgba(247,223,148,0.22); }
      .ftx-ap-delta.warn { background: rgba(239,68,68,0.14); color: #FCA5A5; border-color: rgba(239,68,68,0.28); }
      .ftx-ap-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
      .ftx-ap-mini { background: rgba(15,14,11,0.65); border: 1px solid rgba(247,223,148,0.15); border-radius: 16px; padding: 12px; }
      .ftx-ap-mini-lbl { font-size: 11px; color: #9E9484; }
      .ftx-ap-mini-val { font-size: 16px; font-weight: 700; color: #FAF6EE; margin-top: 3px; }
      .ftx-ap-insight { font-size: 13px; line-height: 1.45; color: #DDD4C5; padding: 8px 0; border-bottom: 1px solid rgba(255,248,230,0.07); }
      .ftx-ap-insight:last-child { border-bottom: 0; padding-bottom: 0; }
      .ftx-ap-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
      .ftx-ap-btn { border: 1px solid rgba(247,223,148,0.34); background: linear-gradient(135deg, rgba(226,184,87,0.2), rgba(184,137,40,0.1)); color: #F7DF94; font-size: 13px; font-weight: 600; padding: 12px 10px; border-radius: 14px; cursor: pointer; text-align: center; }
      .ftx-ap-cat { background: rgba(15,14,11,0.62); border: 1px solid rgba(247,223,148,0.15); border-radius: 16px; padding: 12px 14px; margin-bottom: 9px; cursor: pointer; }
      .ftx-ap-cat-top { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
      .ftx-ap-bar { height: 6px; border-radius: 99px; background: rgba(255,248,230,0.08); overflow: hidden; }
      .ftx-ap-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #B88928, #F7DF94); }
      .ftx-ap-drill { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(247,223,148,0.14); font-size: 12px; color: #C7BEB0; }
      .ftx-ap-tx { display: flex; justify-content: space-between; padding: 5px 0; }
      .ftx-ap-heat { display: grid; grid-template-columns: repeat(12, 1fr); gap: 5px; margin: 12px 0; }
      .ftx-ap-col { display: grid; grid-template-rows: repeat(7, 1fr); gap: 5px; }
      .ftx-ap-cell { aspect-ratio: 1; border-radius: 4px; background: rgba(255,248,230,0.06); border: 1px solid transparent; cursor: pointer; }
      .ftx-ap-cell.l1 { background: rgba(226,184,87,0.22); }
      .ftx-ap-cell.l2 { background: rgba(226,184,87,0.48); }
      .ftx-ap-cell.l3 { background: rgba(247,223,148,0.85); box-shadow: 0 0 8px rgba(226,184,87,0.35); }
      .ftx-ap-cell.sel { border-color: #FFFDF8; transform: scale(1.12); }
    `;
    document.head.appendChild(style);
  }

  function getState() {
    if (window.state && Array.isArray(window.state.transactions)) return window.state;
    for (const k of ['fintex_state', 'fintex_data', 'state']) {
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || 'null');
        if (parsed && Array.isArray(parsed.transactions)) return parsed;
      } catch (_) {}
    }
    return { transactions: [], currency: '₽' };
  }

  function parseTxDate(tx) {
    const raw = tx.date || tx.createdAt || tx.timestamp;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isIncome(tx) {
    if (tx.type === 'income') return true;
    if (tx.type === 'expense') return false;
    return Number(tx.amount) > 0 && tx.category === 'Доход';
  }

  function fmt(num, cur) {
    return `${Math.round(num).toLocaleString('ru-RU')} ${cur}`;
  }

  function analyzeData(days) {
    const st = getState();
    const cur = st.currency || '₽';
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const prevStart = new Date(start.getTime() - days * 86400000);

    let spent = 0, income = 0, prevSpent = 0;
    const currentTxs = [];
    const byCat = {};
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    const activeDates = new Set();

    (st.transactions || []).forEach((tx) => {
      const d = parseTxDate(tx);
      if (!d) return;
      const amt = Math.abs(Number(tx.amount) || 0);
      const inc = isIncome(tx);

      if (d >= start && d <= now) {
        currentTxs.push({ ...tx, _date: d, _amt: amt, _inc: inc });
        if (inc) {
          income += amt;
        } else {
          spent += amt;
          activeDates.add(d.toISOString().slice(0, 10));
          byWeekday[d.getDay()] += amt;
          const cat = (tx.category || 'Прочее').trim();
          if (!byCat[cat]) byCat[cat] = { total: 0, items: [] };
          byCat[cat].total += amt;
          byCat[cat].items.push({
            title: tx.merchant || tx.title || tx.note || cat,
            amt,
            date: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
          });
        }
      } else if (d >= prevStart && d < start && !inc) {
        prevSpent += amt;
      }
    });

    const deltaPct = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : 0;
    const burnRate = spent / Math.max(1, days);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(0, daysInMonth - now.getDate());
    const projectedBalance = income - spent - burnRate * daysLeft;

    const categories = Object.entries(byCat)
      .map(([name, data]) => ({
        name,
        total: data.total,
        pct: spent > 0 ? Math.round((data.total / spent) * 100) : 0,
        items: data.items.sort((a, b) => b.amt - a.amt).slice(0, 6)
      }))
      .sort((a, b) => b.total - a.total);

    const wdNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const peakWdIdx = byWeekday.indexOf(Math.max(...byWeekday));
    const quietDays = Math.max(0, days - activeDates.size);

    const insights = [];
    if (categories[0]) {
      insights.push(`Главная статья расходов — «${categories[0].name}» (${categories[0].pct}% от всех трат).`);
    }
    if (byWeekday[peakWdIdx] > 0) {
      insights.push(`Самый затратный день недели — ${wdNames[peakWdIdx].toLowerCase()}.`);
    }
    insights.push(`Дней без единой покупки за период: ${quietDays} из ${days}.`);

    return { st, cur, spent, income, net: income - spent, deltaPct, prevSpent, burnRate, projectedBalance, categories, insights, allTxs: st.transactions || [] };
  }

  function buildHeatmap(allTxs, cur) {
    const map = {};
    allTxs.forEach((tx) => {
      if (isIncome(tx)) return;
      const d = parseTxDate(tx);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = { total: 0, list: [] };
      const amt = Math.abs(Number(tx.amount) || 0);
      map[key].total += amt;
      map[key].list.push({ title: tx.merchant || tx.title || tx.category || 'Покупка', amt });
    });

    const totals = Object.values(map).map((x) => x.total).filter((v) => v > 0);
    const maxVal = Math.max(1, ...totals);
    const today = new Date();
    const cols = [];

    for (let w = 11; w >= 0; w--) {
      const cells = [];
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(today.getTime() - (w * 7 + d) * 86400000);
        const key = dt.toISOString().slice(0, 10);
        const val = map[key]?.total || 0;
        const ratio = val / maxVal;
        const lvl = val === 0 ? '' : ratio < 0.33 ? 'l1' : ratio < 0.68 ? 'l2' : 'l3';
        cells.push(`<div class="ftx-ap-cell ${lvl} ${selectedHeatDate === key ? 'sel' : ''}" data-hdate="${key}"></div>`);
      }
      cols.push(`<div class="ftx-ap-col">${cells.join('')}</div>`);
    }

    const activeKey = selectedHeatDate || today.toISOString().slice(0, 10);
    const dayData = map[activeKey] || { total: 0, list: [] };
    const niceDate = new Date(activeKey).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    return `
      <div class="ftx-ap-card">
        <div class="ftx-ap-kicker">Активность за 12 недель</div>
        <div class="ftx-ap-heat">${cols.join('')}</div>
        <div class="ftx-ap-drill">
          <div style="display:flex;justify-content:space-between;color:#FAF6EE;font-weight:600;margin-bottom:6px;">
            <span>${esc(niceDate)}</span>
            <span>${fmt(dayData.total, cur)}</span>
          </div>
          ${
            dayData.list.length
              ? dayData.list.map((i) => `<div class="ftx-ap-tx"><span>${esc(i.title)}</span><span>${fmt(i.amt, cur)}</span></div>`).join('')
              : '<div style="color:#9E9484;">В этот день трат не было</div>'
          }
        </div>
      </div>
    `;
  }

  function findAnalyticsContainer() {
    const selectors = [
      '#analytics-content', '#analyticsContent', '#view-analytics',
      '#tab-analytics', '#screen-analytics', '#analytics', '[data-tab="analytics"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function renderProAnalytics(targetEl) {
    const container = targetEl || findAnalyticsContainer();
    if (!container) return;

    injectStyles();
    const periodObj = PERIODS.find((p) => p.id === activePeriod) || PERIODS[1];
    const data = analyzeData(periodObj.days);

    const periodsHtml = `<div class="ftx-ap-pills">
      ${PERIODS.map((p) => `<button type="button" class="ftx-ap-pill ${p.id === activePeriod ? 'active' : ''}" data-period="${p.id}">${p.label}</button>`).join('')}
    </div>`;

    const tabsHtml = `<div class="ftx-ap-tabs">
      ${SUBTABS.map((t) => `<button type="button" class="ftx-ap-tab ${t.id === activeSubtab ? 'active' : ''}" data-subtab="${t.id}">${t.label}</button>`).join('')}
    </div>`;

    let bodyHtml = '';

    if (activeSubtab === 'overview') {
      const deltaText = data.prevSpent > 0
        ? `${data.deltaPct > 0 ? '+' : ''}${data.deltaPct}% к прошлому периоду`
        : 'Нет данных за прошлый период';

      bodyHtml = `
        <div class="ftx-ap-card">
          <div class="ftx-ap-kicker">Расходы · ${periodObj.label}</div>
          <div class="ftx-ap-big">${fmt(data.spent, data.cur)}</div>
          <span class="ftx-ap-delta ${data.deltaPct > 10 ? 'warn' : ''}">${deltaText}</span>
        </div>
        <div class="ftx-ap-grid2">
          <div class="ftx-ap-mini">
            <div class="ftx-ap-mini-lbl">Скорость трат</div>
            <div class="ftx-ap-mini-val">${fmt(data.burnRate, data.cur)} / дн</div>
          </div>
          <div class="ftx-ap-mini">
            <div class="ftx-ap-mini-lbl">Прогноз к концу мес.</div>
            <div class="ftx-ap-mini-val" style="color:${data.projectedBalance < 0 ? '#FCA5A5' : '#F7DF94'}">${fmt(data.projectedBalance, data.cur)}</div>
          </div>
        </div>
        <div class="ftx-ap-card">
          <div class="ftx-ap-kicker" style="margin-bottom:6px;">Умные выводы</div>
          ${data.insights.map((txt) => `<div class="ftx-ap-insight">${esc(txt)}</div>`).join('')}
        </div>
        <div class="ftx-ap-actions">
          <button type="button" class="ftx-ap-btn" data-act="stories">Итоги в Stories</button>
          <button type="button" class="ftx-ap-btn" data-act="sim">Дерево будущего</button>
        </div>
      `;
    } else if (activeSubtab === 'categories') {
      bodyHtml = data.categories.length
        ? data.categories.map((c) => {
            const isOpen = expandedCategory === c.name;
            return `
              <div class="ftx-ap-cat" data-cat="${esc(c.name)}">
                <div class="ftx-ap-cat-top">
                  <span>${esc(c.name)} <span style="color:#9E9484;font-weight:400;">(${c.pct}%)</span></span>
                  <span style="color:#F7DF94;">${fmt(c.total, data.cur)}</span>
                </div>
                <div class="ftx-ap-bar"><div class="ftx-ap-bar-fill" style="width:${c.pct}%"></div></div>
                ${
                  isOpen
                    ? `<div class="ftx-ap-drill">
                        ${c.items.map((it) => `<div class="ftx-ap-tx"><span>${esc(it.title)} · ${it.date}</span><span>${fmt(it.amt, data.cur)}</span></div>`).join('')}
                      </div>`
                    : ''
                }
              </div>
            `;
          }).join('')
        : `<div class="ftx-ap-card" style="text-align:center;color:#9E9484;">За выбранный период расходов нет</div>`;
    } else {
      bodyHtml = buildHeatmap(data.allTxs, data.cur);
    }

    container.innerHTML = `<div class="ftx-ap">${periodsHtml}${tabsHtml}${bodyHtml}</div>`;

    container.querySelectorAll('[data-period]').forEach((btn) => {
      btn.onclick = () => { activePeriod = btn.dataset.period; renderProAnalytics(container); };
    });
    container.querySelectorAll('[data-subtab]').forEach((btn) => {
      btn.onclick = () => { activeSubtab = btn.dataset.subtab; renderProAnalytics(container); };
    });
    container.querySelectorAll('[data-cat]').forEach((card) => {
      card.onclick = () => {
        const name = card.dataset.cat;
        expandedCategory = expandedCategory === name ? null : name;
        renderProAnalytics(container);
      };
    });
    container.querySelectorAll('[data-hdate]').forEach((cell) => {
      cell.onclick = () => { selectedHeatDate = cell.dataset.hdate; renderProAnalytics(container); };
    });
    const stBtn = container.querySelector('[data-act="stories"]');
    if (stBtn) stBtn.onclick = () => (window.openStoriesRecap || window.openStories || (() => {}))();
    const simBtn = container.querySelector('[data-act="sim"]');
    if (simBtn) simBtn.onclick = () => (window.SIM?.ui?.open || window.openSimulator || (() => {}))();
  }

  const origRenderAnalytics = window.renderAnalytics;
  window.renderAnalytics = function (...args) {
    if (typeof origRenderAnalytics === 'function') {
      try { origRenderAnalytics.apply(this, args); } catch (_) {}
    }
    renderProAnalytics(args[0] instanceof HTMLElement ? args[0] : null);
  };

  window.FintexAnalyticsPro = { render: renderProAnalytics };
})();
