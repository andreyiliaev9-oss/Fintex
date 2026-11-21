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

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(242, 198, 93, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Синхронизируем золотистый оттенок с главной карточкой #hero-balance-card и --gold (#F2C65D)
  function resolveGoldPalette() {
    const rootStyle = getComputedStyle(document.documentElement);
    const cssGold = rootStyle.getPropertyValue('--gold').trim();
    const heroCard = document.querySelector('#hero-balance-card, .fintex-hero');

    let mainGold = cssGold || '#F2C65D';
    if (!cssGold && heroCard) {
      const reserveLabel = heroCard.querySelector('.text-gold');
      if (reserveLabel) {
        const computedColor = getComputedStyle(reserveLabel).color;
        if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
          mainGold = computedColor;
        }
      }
    }

    const isHex = mainGold.startsWith('#');
    return {
      light: '#FBE39D',
      main: mainGold,
      deep: '#C99722',
      glow: isHex ? hexToRgba(mainGold, 0.24) : 'rgba(242, 198, 93, 0.24)',
      border: isHex ? hexToRgba(mainGold, 0.34) : 'rgba(242, 198, 93, 0.34)',
      glass: 'rgba(255, 248, 230, 0.055)'
    };
  }

  function injectStyles() {
    const existing = document.getElementById('fintex-stories-style');
    if (existing) existing.remove();
    const g = resolveGoldPalette();

    const style = document.createElement('style');
    style.id = 'fintex-stories-style';
    style.textContent = `
      .ftx-story-trigger {
        border: 1px solid ${g.border};
        background: linear-gradient(135deg, rgba(242, 198, 93, 0.18), rgba(201, 151, 34, 0.08));
        color: ${g.main};
        box-shadow: 0 0 14px ${g.glow};
      }
      .ftx-story-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background:
          radial-gradient(circle at 50% 14%, ${g.glow} 0%, rgba(14, 13, 10, 0.97) 52%, #050A09 100%);
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
        background: linear-gradient(90deg, ${g.deep}, ${g.main}, ${g.light});
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
        background: rgba(242, 198, 93, 0.14);
        border: 1px solid ${g.border};
      }
      .ftx-story-close {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(255, 248, 230, 0.16);
        background: rgba(255, 248, 230, 0.07);
        color: #EAE2D3;
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
        background: linear-gradient(160deg, rgba(242, 198, 93, 0.14) 0%, ${g.glass} 48%, rgba(10, 12, 11, 0.76) 100%);
        border: 1px solid ${g.border};
        box-shadow:
          0 24px 60px rgba(0, 0, 0, 0.58),
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
        font-size: 36px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.12;
        margin: 8px 0 14px;
        background: linear-gradient(135deg, #FFFDF8 15%, ${g.light} 60%, ${g.main} 100%);
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
        background: rgba(13, 15, 13, 0.62);
        border: 1px solid rgba(242, 198, 93, 0.22);
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
        border: 1px solid rgba(242, 198, 93, 0.25);
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
        color: rgba(242, 198, 93, 0.68);
        padding-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // Добавляем компактную золотую кнопку запуска сторис в шапку #home-header
  function mountHeaderTrigger() {
    injectStyles();
    if (document.getElementById('hdr-stories-btn')) return;
    const header = document.getElementById('home-header');
    if (!header) return;
    const actionPill = header.lastElementChild;
    if (!actionPill) return;

    const btn = document.createElement('button');
    btn.id = 'hdr-stories-btn';
    btn.type = 'button';
    btn.title = 'Итоги в формате Stories';
    btn.className = 'w-8 h-8 rounded-xl ftx-story-trigger flex items-center justify-center tap shrink-0';
    btn.innerHTML = `
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" stroke-dasharray="42 10"></circle>
        <path d="M12 7.5v9M8.5 11l3.5-3.5 3.5 3.5"></path>
      </svg>
    `;
    btn.addEventListener('click', openStories);
    actionPill.insertBefore(btn, actionPill.firstChild);
  }

  function loadAppState() {
    const extractTxs = (obj) =>
      Array.isArray(obj?.transactions) ? obj.transactions : Array.isArray(obj?.txs) ? obj.txs : null;

    if (window.state && extractTxs(window.state)) return window.state;
    for (const key of ['fintex_state', 'fintex_data', 'state']) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && extractTxs(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return { txs: [], currency: '₽', goalTarget: 10000, goalSaved: 0 };
  }

  function formatMoney(num, currency) {
    return `${Math.round(num).toLocaleString('ru-RU')} ${currency}`;
  }

  function buildSlides() {
    const st = loadAppState();
    const cur = st.currency || '₽';
    const allTxs = Array.isArray(st.transactions) ? st.transactions : Array.isArray(st.txs) ? st.txs : [];
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });

    const monthTxs = allTxs.filter((t) =>
      String(t.date || t.createdAt || '').startsWith(ym)
    );

    let spent = 0;
    let income = 0;
    const byShop = {};
    const byCat = {};
    const activeDays = new Set();

    monthTxs.forEach((t) => {
      const amt = Math.abs(Number(t.amount) || 0);
      const isInc = t.type === 'income' || t.kind === 'income' || (Number(t.amount) > 0 && t.type !== 'expense' && t.kind !== 'expense');
      if (isInc) {
        income += amt;
      } else {
        spent += amt;
        const day = String(t.date || t.createdAt || '').slice(0, 10);
        if (day) activeDays.add(day);
        const shop = (t.merchant || t.title || t.name || t.note || 'Без названия').trim();
        const cat = (t.category || t.cat || 'Прочее').trim();
        byShop[shop] = (byShop[shop] || 0) + amt;
        byCat[cat] = (byCat[cat] || 0) + amt;
      }
    });

    const topShop = Object.entries(byShop).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const passedDays = Math.max(1, now.getDate());
    const zeroSpendDays = Math.max(0, passedDays - activeDays.size);
    const netFlow = income - spent;

    const goalTarget = Number(st.goal?.target || st.goalTarget || st.savingsGoal || 10000);
    const goalSaved = Number(st.goal?.saved ?? st.goalSaved ?? st.reserve ?? Math.max(0, netFlow));
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
    let axis = null;
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

      if (axis === 'y' && deltaY > 85) {
        closeStories();
        return;
      }
      overlay.style.transform = 'translateY(0)';
      overlay.style.opacity = '1';

      if (axis === 'x' && Math.abs(deltaX) > 45) {
        const dir = deltaX < 0 ? 1 : -1;
        stage.style.transform = `translateX(${dir * -110}%)`;
        setTimeout(() => goTo(currentIdx + dir, overlay), 140);
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
          <button class="ftx-story-close" type="button" aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHeaderTrigger);
  } else {
    mountHeaderTrigger();
  }

  window.FintexStories = { open: openStories, close: closeStories, mountTrigger: mountHeaderTrigger };
  window.openStoriesRecap = openStories;
  window.openStories = openStories;
})();
