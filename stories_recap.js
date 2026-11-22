(function () {
  'use strict';

  const SLIDE_DURATION = 5500;
  let rafId = null;
  let currentIdx = 0;
  let slideStart = 0;
  let elapsedBeforePause = 0;
  let isPaused = false;
  let slidesData = [];
  let gestureAbort = null;

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveGoldPalette() {
    const rootStyle = getComputedStyle(document.documentElement);
    const heroCard = document.querySelector(
      '.hero-card, .main-card, .balance-card, [data-hero-card], .card-gold'
    );
    let primaryGold =
      rootStyle.getPropertyValue('--gold').trim() ||
      rootStyle.getPropertyValue('--accent-gold').trim();

    if (!primaryGold && heroCard) {
      const cardBorder = getComputedStyle(heroCard).borderColor;
      if (cardBorder && cardBorder !== 'rgba(0, 0, 0, 0)' && cardBorder !== 'transparent') {
        primaryGold = cardBorder;
      }
    }

    return {
      light: '#F7DF94',
      main: primaryGold || '#E2B857',
      deep: '#B88928',
      glow: 'rgba(226, 184, 87, 0.24)',
      border: 'rgba(247, 223, 148, 0.3)',
      glass: 'rgba(255, 248, 230, 0.05)'
    };
  }

  function injectStyles() {
    if (document.getElementById('fintex-stories-style')) return;
    const g = resolveGoldPalette();

    const style = document.createElement('style');
    style.id = 'fintex-stories-style';
    style.textContent = `
      .ftx-story-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background:
          radial-gradient(circle at 50% 18%, ${g.glow} 0%, rgba(16, 14, 10, 0.97) 54%, #09090B 100%);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: calc(env(safe-area-inset-top, 12px) + 8px) 16px calc(env(safe-area-inset-bottom, 16px) + 18px);
        color: #FAF6EE;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        opacity: 0;
        transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ftx-story-overlay.is-visible {
        opacity: 1;
      }
      .ftx-story-progress {
        display: grid;
        gap: 6px;
        z-index: 3;
      }
      .ftx-story-bar {
        height: 3px;
        border-radius: 99px;
        background: rgba(255, 248, 230, 0.16);
        overflow: hidden;
      }
      .ftx-story-bar-fill {
        height: 100%;
        width: 0%;
        border-radius: 99px;
        background: linear-gradient(90deg, ${g.deep}, ${g.light});
        box-shadow: 0 0 10px ${g.glow};
      }
      .ftx-story-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        will-change: transform, opacity;
      }
      .ftx-story-card {
        width: 100%;
        max-width: 390px;
        padding: 34px 24px 28px;
        border-radius: 28px;
        background: linear-gradient(165deg, rgba(247, 223, 148, 0.14) 0%, ${g.glass} 46%, rgba(11, 10, 8, 0.78) 100%);
        border: 1px solid ${g.border};
        box-shadow:
          0 28px 64px rgba(0, 0, 0, 0.6),
          inset 0 1px 0 rgba(255, 244, 212, 0.26);
        text-align: center;
      }
      .ftx-story-kicker {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: ${g.light};
        margin-bottom: 14px;
        font-weight: 700;
        opacity: 0.9;
      }
      .ftx-story-hero {
        font-size: 40px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 6px 0 14px;
        background: linear-gradient(135deg, #FFFDF8 18%, ${g.light} 68%, ${g.main} 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        word-break: break-word;
      }
      .ftx-story-desc {
        font-size: 15px;
        line-height: 1.5;
        color: #CFC6B8;
        margin: 0 auto;
        max-width: 290px;
      }
      .ftx-story-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-top: 26px;
        padding-top: 18px;
        border-top: 1px solid rgba(247, 223, 148, 0.16);
      }
      .ftx-story-metric {
        padding: 0 8px;
      }
      .ftx-story-metric:first-child {
        border-right: 1px solid rgba(247, 223, 148, 0.14);
      }
      .ftx-story-metric-val {
        font-size: 17px;
        font-weight: 700;
        color: #FAF6EE;
      }
      .ftx-story-metric-lbl {
        font-size: 11px;
        color: #9E9484;
        margin-top: 4px;
      }
      .ftx-story-goal-track {
        height: 8px;
        border-radius: 99px;
        background: rgba(255, 248, 230, 0.1);
        overflow: hidden;
        margin: 22px 0 6px;
      }
      .ftx-story-goal-fill {
        height: 100%;
        border-radius: 99px;
        background: linear-gradient(90deg, ${g.deep}, ${g.main}, ${g.light});
        transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
    `;
    document.head.appendChild(style);
  }

  function loadAppState() {
    const candidates = [];
    try {
      if (typeof state !== 'undefined' && state && typeof state === 'object') candidates.push(state);
    } catch (_) {}
    if (window.state && typeof window.state === 'object') candidates.push(window.state);
    if (window.appState && typeof window.appState === 'object') candidates.push(window.appState);

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const raw = localStorage.getItem(k);
        if (!raw || (raw[0] !== '{' && raw[0] !== '[')) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            candidates.push({ transactions: parsed });
          } else if (parsed && typeof parsed === 'object') {
            candidates.push(parsed);
          }
        } catch (_) {}
      }
    } catch (_) {}

    let best = null;
    let bestLen = -1;
    for (const c of candidates) {
      const list = Array.isArray(c.transactions)
        ? c.transactions
        : Array.isArray(c.txs)
          ? c.txs
          : Array.isArray(c.operations)
            ? c.operations
            : null;
      if (list && list.length > bestLen) {
        best = { ...c, transactions: list };
        bestLen = list.length;
      }
    }

    return best || { transactions: [], currency: '₽', goalTarget: 100000, goalSaved: 0 };
  }

  function parseTxDate(tx) {
    const raw = tx.date ?? tx.createdAt ?? tx.timestamp ?? tx.dt ?? tx.time;
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    if (typeof raw === 'number') {
      const ms = raw < 1e11 ? raw * 1000 : raw;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const str = String(raw).trim();
    const ruMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ruMatch) {
      const d = new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatMoney(num, currency) {
    return `${Math.round(num).toLocaleString('ru-RU')} ${currency}`;
  }

  function buildSlides() {
    const st = loadAppState();
    const cur = st.currency || '₽';
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });

    const allTxs = st.transactions || [];
    const hasNegativeAmounts = allTxs.some((t) => Number(t.amount) < 0);

    const monthTxs = allTxs.filter((t) => {
      const d = parseTxDate(t);
      if (!d) return true;
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });

    let spent = 0;
    let income = 0;
    const byShop = {};
    const byCat = {};
    const activeDays = new Set();

    monthTxs.forEach((t) => {
      const rawAmt = Number(t.amount ?? t.sum ?? t.value ?? 0);
      if (!rawAmt) return;
      const amt = Math.abs(rawAmt);

      let isInc = false;
      if (t.type === 'income' || t.kind === 'income' || t.isIncome === true || t.direction === 'in') {
        isInc = true;
      } else if (t.type === 'expense' || t.kind === 'expense' || t.direction === 'out') {
        isInc = false;
      } else if (hasNegativeAmounts) {
        isInc = rawAmt > 0;
      } else {
        isInc = /доход|зарплат|поступлен|кэшбэк|возврат/i.test(String(t.category || t.title || ''));
      }

      if (isInc) {
        income += amt;
      } else {
        spent += amt;
        const d = parseTxDate(t);
        if (d) {
          activeDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
        const shop = String(
          t.merchant || t.shop || t.store || t.title || t.name || t.note || t.category || 'Покупка'
        ).trim();
        const cat = String(t.category || 'Прочее').trim();
        byShop[shop] = (byShop[shop] || 0) + amt;
        byCat[cat] = (byCat[cat] || 0) + amt;
      }
    });

    const topShop = Object.entries(byShop).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const passedDays = Math.max(1, now.getDate());
    const zeroSpendDays = Math.max(0, passedDays - activeDays.size);
    const netFlow = income - spent;

    const goalTarget = Number(
      st.goalTarget || st.savingsGoal || st.cushionTarget || st.target || 100000
    );
    const goalSaved = Number(
      st.goalSaved ?? st.cushion ?? st.reserve ?? st.saved ?? Math.max(0, netFlow)
    );
    const goalPct = Math.min(100, Math.round((goalSaved / Math.max(1, goalTarget)) * 100));

    return [
      {
        kicker: `Итоги · ${monthName}`,
        hero: formatMoney(spent, cur),
        desc:
          netFlow >= 0
            ? `Вы в плюсе на ${formatMoney(netFlow, cur)} — баланс держится в золотой зоне.`
            : `Расходы превысили поступления на ${formatMoney(Math.abs(netFlow), cur)}.`,
        stats: [
          { val: formatMoney(income, cur), lbl: 'Поступления' },
          { val: `${monthTxs.length}`, lbl: 'Операций' }
        ]
      },
      {
        kicker: 'Лидер расходов',
        hero: topShop ? esc(topShop[0]) : 'Пока тихо',
        desc: topShop
          ? `На эту точку ушло ${formatMoney(topShop[1], cur)} за текущий месяц.`
          : 'В этом месяце ещё не зафиксировано крупных покупок.',
        stats: [
          { val: topCat ? esc(topCat[0]) : '—', lbl: 'Топ-категория' },
          {
            val: topCat && spent > 0 ? `${Math.round((topCat[1] / spent) * 100)}%` : '0%',
            lbl: 'Доля трат'
          }
        ]
      },
      {
        kicker: 'Финансовая выдержка',
        hero: `${zeroSpendDays} дн.`,
        desc:
          zeroSpendDays >= 5
            ? 'Отличный темп: дни без покупок напрямую усиливают свободный лимит.'
            : 'Каждый день без импульсивных трат укрепляет ваш остаток.',
        stats: [
          { val: `${passedDays} дн.`, lbl: 'Прошло в месяце' },
          { val: `${Math.round((zeroSpendDays / passedDays) * 100)}%`, lbl: 'Индекс тишины' }
        ]
      },
      {
        kicker: 'Финансовая подушка',
        hero: `${goalPct}%`,
        desc: `Накоплено ${formatMoney(goalSaved, cur)} из целевых ${formatMoney(goalTarget, cur)}.`,
        goalPct
      }
    ];
  }

  function renderSlide(index, overlay) {
    const slide = slidesData[index];
    const stage = overlay.querySelector('.ftx-story-stage');

    const statsHtml = slide.stats
      ? `<div class="ftx-story-metrics">
          ${slide.stats
            .map(
              (s) => `
            <div class="ftx-story-metric">
              <div class="ftx-story-metric-val">${s.val}</div>
              <div class="ftx-story-metric-lbl">${esc(s.lbl)}</div>
            </div>`
            )
            .join('')}
        </div>`
      : '';

    const goalHtml =
      typeof slide.goalPct === 'number'
        ? `<div class="ftx-story-goal-track">
            <div class="ftx-story-goal-fill" style="width:${slide.goalPct}%"></div>
          </div>`
        : '';

    stage.style.transition = 'none';
    stage.style.transform = 'translateX(0px) rotate(0deg)';
    stage.innerHTML = `
      <div class="ftx-story-card">
        <div class="ftx-story-kicker">${esc(slide.kicker)}</div>
        <div class="ftx-story-hero">${slide.hero}</div>
        <p class="ftx-story-desc">${esc(slide.desc)}</p>
        ${goalHtml}
        ${statsHtml}
      </div>
    `;
  }

  function startTimer(overlay) {
    cancelAnimationFrame(rafId);
    slideStart = performance.now();
    elapsedBeforePause = 0;
    isPaused = false;

    const fills = overlay.querySelectorAll('.ftx-story-bar-fill');
    fills.forEach((f, i) => {
      f.style.width = i < currentIdx ? '100%' : '0%';
    });

    function tick(now) {
      if (!document.body.contains(overlay)) return;
      if (isPaused) {
        slideStart = now - elapsedBeforePause;
        rafId = requestAnimationFrame(tick);
        return;
      }
      elapsedBeforePause = now - slideStart;
      const pct = Math.min(100, (elapsedBeforePause / SLIDE_DURATION) * 100);
      if (fills[currentIdx]) fills[currentIdx].style.width = `${pct}%`;

      if (pct >= 100) {
        goTo(currentIdx + 1, overlay);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function goTo(nextIdx, overlay) {
    if (nextIdx < 0) {
      renderSlide(0, overlay);
      startTimer(overlay);
      return;
    }
    if (nextIdx >= slidesData.length) {
      closeStories();
      return;
    }
    currentIdx = nextIdx;
    renderSlide(currentIdx, overlay);
    startTimer(overlay);
  }

  function attachGestures(overlay) {
    if (gestureAbort) gestureAbort.abort();
    gestureAbort = new AbortController();
    const { signal } = gestureAbort;

    const stage = overlay.querySelector('.ftx-story-stage');
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let deltaX = 0;
    let deltaY = 0;
    let axis = null;
    let dragging = false;

    function onStart(x, y) {
      startX = x;
      startY = y;
      deltaX = 0;
      deltaY = 0;
      axis = null;
      dragging = true;
      startTime = performance.now();
      isPaused = true;
      stage.style.transition = 'none';
      overlay.style.transition = 'none';
    }

    function onMove(x, y) {
      if (!dragging) return;
      deltaX = x - startX;
      deltaY = y - startY;

      if (!axis && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
        axis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
      }

      if (axis === 'x') {
        const edgeResistance =
          (currentIdx === 0 && deltaX > 0) || (currentIdx === slidesData.length - 1 && deltaX < 0)
            ? 0.35
            : 0.92;
        const shift = deltaX * edgeResistance;
        stage.style.transform = `translateX(${shift}px) rotate(${shift * 0.022}deg)`;
      } else if (axis === 'y' && deltaY > 0) {
        const pull = Math.min(220, deltaY);
        overlay.style.transform = `translateY(${pull}px)`;
        overlay.style.opacity = String(Math.max(0.35, 1 - pull / 360));
      }
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      isPaused = false;
      const duration = performance.now() - startTime;

      overlay.style.transition = 'opacity 0.24s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
      stage.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';

      if (axis === 'y' && deltaY > 80) {
        closeStories();
        return;
      }
      overlay.style.transform = 'translateY(0)';
      overlay.style.opacity = '1';

      if (axis === 'x' && Math.abs(deltaX) > 42) {
        const dir = deltaX < 0 ? 1 : -1;
        stage.style.transform = `translateX(${dir * -110}%)`;
        setTimeout(() => goTo(currentIdx + dir, overlay), 130);
        return;
      }

      if (!axis && duration < 220 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        const isLeftTap = startX < window.innerWidth * 0.32;
        goTo(currentIdx + (isLeftTap ? -1 : 1), overlay);
        return;
      }

      stage.style.transform = 'translateX(0px) rotate(0deg)';
    }

    overlay.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true, signal });

    overlay.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true, signal });

    overlay.addEventListener('touchend', onEnd, { signal });
    overlay.addEventListener('touchcancel', onEnd, { signal });

    overlay.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY), { signal });
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY), { signal });
    window.addEventListener('mouseup', onEnd, { signal });
  }

  function closeStories() {
    cancelAnimationFrame(rafId);
    if (gestureAbort) {
      gestureAbort.abort();
      gestureAbort = null;
    }
    const overlay = document.getElementById('ftx-stories-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 240);
  }

  function openStories() {
    closeStories();
    injectStyles();
    slidesData = buildSlides();
    currentIdx = 0;

    const overlay = document.createElement('div');
    overlay.id = 'ftx-stories-overlay';
    overlay.className = 'ftx-story-overlay';
    overlay.innerHTML = `
      <div class="ftx-story-progress" style="grid-template-columns: repeat(${slidesData.length}, 1fr)">
        ${slidesData.map(() => `<div class="ftx-story-bar"><div class="ftx-story-bar-fill"></div></div>`).join('')}
      </div>
      <div class="ftx-story-stage"></div>
    `;

    document.body.appendChild(overlay);
    attachGestures(overlay);
    renderSlide(0, overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    startTimer(overlay);
  }

  window.FintexStories = { open: openStories, close: closeStories };
  window.openStoriesRecap = openStories;
  window.openStories = openStories;
})();
