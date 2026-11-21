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

  // Синхронизируем золотистый оттенок с главной карточкой или используем калиброванный Champagne Gold
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
      glow: 'rgba(226, 184, 87, 0.22)',
      border: 'rgba(247, 223, 148, 0.28)',
      glass: 'rgba(255, 248, 230, 0.055)'
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
          radial-gradient(circle at 50% 14%, ${g.glow} 0%, rgba(18, 15, 10, 0.96) 52%, #09090B 100%);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: calc(env(safe-area-inset-top, 14px) + 10px) 16px calc(env(safe-area-inset-bottom, 16px) + 14px);
        color: #FAF6EE;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        opacity: 0;
        transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
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
      .ftx-story-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        z-index: 3;
      }
      .ftx-story-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: 99px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: ${g.light};
        background: rgba(226, 184, 87, 0.12);
        border: 1px solid ${g.border};
      }
      .ftx-story-close {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(255, 248, 230, 0.14);
        background: rgba(255, 248, 230, 0.06);
        color: #EAE2D3;
        font-size: 18px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
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
        max-width: 400px;
        padding: 28px 22px;
        border-radius: 26px;
        background: linear-gradient(160deg, rgba(247, 223, 148, 0.12) 0%, ${g.glass} 48%, rgba(12, 11, 9, 0.68) 100%);
        border: 1px solid ${g.border};
        box-shadow:
          0 24px 60px rgba(0, 0, 0, 0.55),
          inset 0 1px 0 rgba(255, 244, 212, 0.24);
        text-align: center;
      }
      .ftx-story-kicker {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: ${g.main};
        margin-bottom: 10px;
        font-weight: 600;
      }
      .ftx-story-hero {
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.12;
        margin: 8px 0 14px;
        background: linear-gradient(135deg, #FFFDF8 15%, ${g.light} 65%, ${g.main} 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .ftx-story-desc {
        font-size: 15px;
        line-height: 1.5;
        color: #C7BEB0;
        margin: 0 auto;
        max-width: 300px;
      }
      .ftx-story-pill-row {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .ftx-story-stat {
        padding: 10px 14px;
        border-radius: 16px;
        background: rgba(15, 14, 11, 0.58);
        border: 1px solid rgba(247, 223, 148, 0.18);
        min-width: 112px;
      }
      .ftx-story-stat-val {
        font-size: 16px;
        font-weight: 700;
        color: #FAF6EE;
      }
      .ftx-story-stat-lbl {
        font-size: 11px;
        color: #9E9484;
        margin-top: 3px;
      }
      .ftx-story-goal-track {
        height: 10px;
        border-radius: 99px;
        background: rgba(255, 248, 230, 0.1);
        overflow: hidden;
        margin: 18px 0 8px;
        border: 1px solid rgba(247, 223, 148, 0.2);
      }
      .ftx-story-goal-fill {
        height: 100%;
        border-radius: 99px;
        background: linear-gradient(90deg, ${g.deep}, ${g.main}, ${g.light});
        transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ftx-story-hint {
        text-align: center;
        font-size: 12px;
        letter-spacing: 0.04em;
        color: rgba(247, 223, 148, 0.6);
        padding-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  function loadAppState() {
    if (window.state && Array.isArray(window.state.transactions)) return window.state;
    for (const key of ['fintex_state', 'fintex_data', 'state']) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.transactions)) return parsed;
        }
      } catch (_) {}
    }
    return { transactions: [], currency: '₽', goalTarget: 100000, goalSaved: 0 };
  }

  function formatMoney(num, currency) {
    return `${Math.round(num).toLocaleString('ru-RU')} ${currency}`;
  }

  function buildSlides() {
    const st = loadAppState();
    const cur = st.currency || '₽';
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });

    const monthTxs = (st.transactions || []).filter((t) =>
      String(t.date || t.createdAt || '').startsWith(ym)
    );

    let spent = 0;
    let income = 0;
    const byShop = {};
    const byCat = {};
    const activeDays = new Set();

    monthTxs.forEach((t) => {
      const amt = Math.abs(Number(t.amount) || 0);
      const isInc = t.type === 'income' || (Number(t.amount) > 0 && t.type !== 'expense');
      if (isInc) {
        income += amt;
      } else {
        spent += amt;
        const day = String(t.date || t.createdAt || '').slice(0, 10);
        if (day) activeDays.add(day);
        const shop = (t.merchant || t.title || t.note || 'Без названия').trim();
        const cat = (t.category || 'Прочее').trim();
        byShop[shop] = (byShop[shop] || 0) + amt;
        byCat[cat] = (byCat[cat] || 0) + amt;
      }
    });

    const topShop = Object.entries(byShop).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const passedDays = Math.max(1, now.getDate());
    const zeroSpendDays = Math.max(0, passedDays - activeDays.size);
    const netFlow = income - spent;

    const goalTarget = Number(st.goalTarget || st.savingsGoal || 100000);
    const goalSaved = Number(st.goalSaved || st.reserve || Math.max(0, netFlow));
    const goalPct = Math.min(100, Math.round((goalSaved / Math.max(1, goalTarget)) * 100));

    return [
      {
        badge: `Итоги · ${monthName}`,
        kicker: 'Денежный поток месяца',
        hero: formatMoney(spent, cur),
        desc:
          netFlow >= 0
            ? `Вы в плюсе на ${formatMoney(netFlow, cur)} — бюджет держится в золотой зоне.`
            : `Расходы превысили поступления на ${formatMoney(Math.abs(netFlow), cur)}.`,
        stats: [
          { val: formatMoney(income, cur), lbl: 'Поступления' },
          { val: `${monthTxs.length}`, lbl: 'Операций' }
        ]
      },
      {
        badge: 'Главные точки трат',
        kicker: 'Лидер расходов',
        hero: topShop ? esc(topShop[0]) : 'Пока тихо',
        desc: topShop
          ? `На эту локацию ушло ${formatMoney(topShop[1], cur)} за текущий месяц.`
          : 'В этом месяце ещё не зафиксировано крупных покупок.',
        stats: [
          { val: topCat ? esc(topCat[0]) : '—', lbl: 'Топ-категория' },
          {
            val: topCat && spent > 0 ? `${Math.round((topCat[1] / spent) * 100)}%` : '0%',
            lbl: 'Доля бюджета'
          }
        ]
      },
      {
        badge: 'Финансовая выдержка',
        kicker: 'Дни без единой траты',
        hero: `${zeroSpendDays} дн.`,
        desc:
          zeroSpendDays >= 5
            ? 'Отличный ритм: паузы в покупках напрямую усиливают ваш дневной лимит.'
            : 'Каждый день без импульсивных трат увеличивает свободный остаток.',
        stats: [
          { val: `${passedDays} дн.`, lbl: 'Прошло в месяце' },
          { val: `${Math.round((zeroSpendDays / passedDays) * 100)}%`, lbl: 'Индекс тишины' }
        ]
      },
      {
        badge: 'Финансовая подушка',
        kicker: 'Прогресс к цели',
        hero: `${goalPct}%`,
        desc: `Накоплено ${formatMoney(goalSaved, cur)} из целевых ${formatMoney(goalTarget, cur)}.`,
        goalPct
      }
    ];
  }

  function renderSlide(index, overlay) {
    const slide = slidesData[index];
    const stage = overlay.querySelector('.ftx-story-stage');
    const badge = overlay.querySelector('.ftx-story-badge');
    const hint = overlay.querySelector('.ftx-story-hint');

    badge.textContent = slide.badge;
    hint.textContent =
      index === slidesData.length - 1
        ? 'Свайп влево или вниз, чтобы закрыть'
        : '← Свайп для переключения · Удержание для паузы →';

    const statsHtml = slide.stats
      ? `<div class="ftx-story-pill-row">
          ${slide.stats
            .map(
              (s) => `
            <div class="ftx-story-stat">
              <div class="ftx-story-stat-val">${s.val}</div>
              <div class="ftx-story-stat-lbl">${esc(s.lbl)}</div>
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
    stage.style.transform = 'translateX(0px) scale(1)';
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
    let axis = null; // 'x' | 'y'
    let dragging = false;

    function onStart(x, y, target) {
      if (target.closest('.ftx-story-close')) return;
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
        const rot = shift * 0.025;
        stage.style.transform = `translateX(${shift}px) rotate(${rot}deg)`;
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

      overlay.style.transition = 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      stage.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';

      // Закрытие свайпом вниз
      if (axis === 'y' && deltaY > 85) {
        closeStories();
        return;
      }
      overlay.style.transform = 'translateY(0)';
      overlay.style.opacity = '1';

      // Горизонтальный свайп
      if (axis === 'x' && Math.abs(deltaX) > 45) {
        const dir = deltaX < 0 ? 1 : -1;
        stage.style.transform = `translateX(${dir * -110}%)`;
        setTimeout(() => goTo(currentIdx + dir, overlay), 140);
        return;
      }

      // Быстрый тап по краям экрана
      if (!axis && duration < 220 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        const isLeftTap = startX < window.innerWidth * 0.32;
        goTo(currentIdx + (isLeftTap ? -1 : 1), overlay);
        return;
      }

      stage.style.transform = 'translateX(0px) rotate(0deg)';
    }

    overlay.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY, e.target);
    }, { passive: true, signal });

    overlay.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true, signal });

    overlay.addEventListener('touchend', onEnd, { signal });
    overlay.addEventListener('touchcancel', onEnd, { signal });

    overlay.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY, e.target), { signal });
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
    setTimeout(() => overlay.remove(), 250);
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
      <div>
        <div class="ftx-story-progress" style="grid-template-columns: repeat(${slidesData.length}, 1fr)">
          ${slidesData.map(() => `<div class="ftx-story-bar"><div class="ftx-story-bar-fill"></div></div>`).join('')}
        </div>
        <div class="ftx-story-header">
          <span class="ftx-story-badge"></span>
          <button class="ftx-story-close" type="button" aria-label="Закрыть">✕</button>
        </div>
      </div>
      <div class="ftx-story-stage"></div>
      <div class="ftx-story-hint"></div>
    `;

    overlay.querySelector('.ftx-story-close').addEventListener('click', closeStories);
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
