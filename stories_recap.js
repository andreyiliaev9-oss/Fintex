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
  let domObserver = null;

  const CAT_LABELS = {
    food: 'Продукты',
    taxi: 'Транспорт',
    cafe: 'Рестораны',
    fun: 'Развлечения',
    subs: 'Подписки',
    shop: 'Покупки',
    health: 'Здоровье',
    other: 'Прочее'
  };

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(242, 198, 93, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Палитра 1-в-1 синхронизирована с главной карточкой #hero-balance-card и капсулой «Резерв» (#F2C65D + #040B0A + #00D6C3)
  function resolveHeroPalette() {
    const rootStyle = getComputedStyle(document.documentElement);
    const cssGold = rootStyle.getPropertyValue('--gold').trim();
    const cssBrand = rootStyle.getPropertyValue('--brand').trim();
    const heroCard = document.getElementById('hero-balance-card') || document.querySelector('.fintex-hero');

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

    const brandTeal = cssBrand || '#00D6C3';
    const isHex = mainGold.startsWith('#');
    const isTealHex = brandTeal.startsWith('#');

    return {
      goldLight: '#FBE39D',
      goldMain: mainGold,
      goldDeep: '#C99722',
      goldGlow: isHex ? hexToRgba(mainGold, 0.24) : 'rgba(242, 198, 93, 0.24)',
      goldBorder: isHex ? hexToRgba(mainGold, 0.30) : 'rgba(242, 198, 93, 0.30)',
      goldBorderStrong: isHex ? hexToRgba(mainGold, 0.45) : 'rgba(242, 198, 93, 0.45)',
      goldSoftBg: isHex ? hexToRgba(mainGold, 0.14) : 'rgba(242, 198, 93, 0.14)',
      tealMain: brandTeal,
      tealGlow: isTealHex ? hexToRgba(brandTeal, 0.22) : 'rgba(0, 214, 195, 0.22)',
      tealSoftBg: isTealHex ? hexToRgba(brandTeal, 0.12) : 'rgba(0, 214, 195, 0.12)',
      cardBase: 'rgba(7, 20, 18, 0.96)',
      cardAbyss: '#040B0A',
      specularTop: 'rgba(255, 255, 255, 0.18)',
      outerBorder: 'rgba(255, 255, 255, 0.14)'
    };
  }

  function injectStyles() {
    const existing = document.getElementById('fintex-stories-style');
    if (existing) existing.remove();
    const p = resolveHeroPalette();

    const style = document.createElement('style');
    style.id = 'fintex-stories-style';
    style.textContent = `
      .ftx-stories-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 11px 14px;
        border-radius: 22px;
        border: 1px solid ${p.goldBorder};
        background:
          radial-gradient(120% 110% at 100% 0%, ${p.goldSoftBg} 0%, ${p.tealSoftBg} 38%, ${p.cardBase} 74%, ${p.cardAbyss} 100%);
        box-shadow:
          0 16px 34px -16px ${p.goldGlow},
          inset 0 1px 0 ${p.specularTop};
        cursor: pointer;
        text-align: left;
      }
      .ftx-stories-ring {
        width: 38px;
        height: 38px;
        border-radius: 9999px;
        padding: 2px;
        background: conic-gradient(from 140deg, ${p.goldDeep}, ${p.goldMain}, ${p.goldLight}, ${p.goldMain}, ${p.goldDeep});
        box-shadow: 0 0 14px ${p.goldGlow};
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ftx-stories-ring-inner {
        width: 100%;
        height: 100%;
        border-radius: 9999px;
        background: ${p.cardAbyss};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${p.goldMain};
      }
      .ftx-stories-pill {
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #041311;
        background: linear-gradient(120deg, ${p.goldDeep} 0%, ${p.goldMain} 55%, ${p.goldLight} 100%);
        box-shadow: 0 4px 12px ${p.goldGlow};
        flex-shrink: 0;
      }
      .ftx-story-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background:
          radial-gradient(110% 75% at 85% 8%, ${p.goldGlow} 0%, transparent 52%),
          radial-gradient(100% 70% at 15% 18%, ${p.tealGlow} 0%, transparent 55%),
          linear-gradient(180deg, #071412 0%, ${p.cardAbyss} 100%);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: calc(env(safe-area-inset-top, 14px) + 10px) 16px calc(env(safe-area-inset-bottom, 16px) + 14px);
        color: #FFFFFF;
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
        background: rgba(255, 255, 255, 0.14);
        overflow: hidden;
      }
      .ftx-story-bar-fill {
        height: 100%;
        width: 0%;
        border-radius: 99px;
        background: linear-gradient(90deg, ${p.goldDeep} 0%, ${p.goldMain} 55%, ${p.goldLight} 100%);
        box-shadow: 0 0 10px ${p.goldGlow};
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
        padding: 5px 12px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: ${p.goldMain};
        background: linear-gradient(135deg, ${p.goldSoftBg} 0%, rgba(0, 0, 0, 0.42) 100%);
        border: 1px solid ${p.goldBorder};
        backdrop-filter: blur(10px);
      }
      .ftx-story-close {
        width: 34px;
        height: 34px;
        border-radius: 9999px;
        border: 1px solid ${p.outerBorder};
        background: rgba(0, 0, 0, 0.42);
        color: rgba(255, 255, 255, 0.82);
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
        position: relative;
        width: 100%;
        max-width: 400px;
        padding: 28px 22px;
        border-radius: 28px;
        background:
          radial-gradient(120% 100% at 100% 0%, rgba(242, 198, 93, 0.18) 0%, rgba(0, 214, 195, 0.12) 38%, ${p.cardBase} 72%, ${p.cardAbyss} 100%);
        border: 1px solid ${p.goldBorderStrong};
        box-shadow:
          0 24px 50px -18px ${p.goldGlow},
          0 18px 42px -20px ${p.tealGlow},
          inset 0 1px 0 ${p.specularTop};
        text-align: center;
        overflow: hidden;
      }
      .ftx-story-card::before {
        content: '';
        position: absolute;
        right: -44px;
        top: -44px;
        width: 160px;
        height: 160px;
        border-radius: 9999px;
        background: radial-gradient(circle, ${p.goldGlow} 0%, transparent 70%);
        filter: blur(16px);
        pointer-events: none;
      }
      .ftx-story-card::after {
        content: '';
        position: absolute;
        left: -40px;
        bottom: -52px;
        width: 150px;
        height: 150px;
        border-radius: 9999px;
        background: radial-gradient(circle, ${p.tealGlow} 0%, transparent 70%);
        filter: blur(18px);
        pointer-events: none;
      }
      .ftx-story-kicker {
        position: relative;
        z-index: 1;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: ${p.goldMain};
        margin-bottom: 10px;
        font-weight: 700;
      }
      .ftx-story-hero {
        position: relative;
        z-index: 1;
        font-size: 36px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.12;
        margin: 8px 0 14px;
        background: linear-gradient(135deg, #FFFFFF 12%, ${p.goldLight} 58%, ${p.goldMain} 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .ftx-story-desc {
        position: relative;
        z-index: 1;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.72);
        margin: 0 auto;
        max-width: 300px;
      }
      .ftx-story-pill-row {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .ftx-story-stat {
        flex: 1 1 116px;
        padding: 11px 14px;
        border-radius: 18px;
        background: linear-gradient(135deg, ${p.goldSoftBg} 0%, rgba(0, 0, 0, 0.42) 100%);
        border: 1px solid ${p.goldBorder};
        backdrop-filter: blur(10px);
        min-width: 112px;
      }
      .ftx-story-stat-val {
        font-size: 15px;
        font-weight: 800;
        color: #FFFFFF;
        font-variant-numeric: tabular-nums;
      }
      .ftx-story-stat-lbl {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${p.goldMain};
        opacity: 0.85;
        margin-top: 3px;
      }
      .ftx-story-goal-track {
        position: relative;
        z-index: 1;
        height: 8px;
        border-radius: 99px;
        background: rgba(0, 0, 0, 0.50);
        overflow: hidden;
        margin: 18px 0 8px;
        border: 1px solid ${p.goldBorder};
      }
      .ftx-story-goal-fill {
        height: 100%;
        border-radius: 99px;
        background: linear-gradient(90deg, ${p.tealMain} 0%, ${p.goldMain} 65%, ${p.goldLight} 100%);
        transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ftx-story-hint {
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: rgba(242, 198, 93, 0.78);
        padding-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  function mountStoriesTrigger() {
    injectStyles();
    if (document.getElementById('ftx-stories-entry')) return;

    const viewHome = document.getElementById('view-home');
    const heroStage = document.getElementById('hero-card-stage');
    if (!viewHome) return;

    const now = new Date();
    const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });

    const btn = document.createElement('button');
    btn.id = 'ftx-stories-entry';
    btn.type = 'button';
    btn.className = 'ftx-stories-banner tap card-enter';
    btn.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="ftx-stories-ring">
          <div class="ftx-stories-ring-inner">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          </div>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-extrabold text-white truncate">Финансовые итоги · ${esc(monthName)}</div>
          <div class="text-[11px] text-sub truncate mt-0.5">4 слайда о тратах, выдержке и подушке</div>
        </div>
      </div>
      <span class="ftx-stories-pill">Stories</span>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStories();
    });

    if (heroStage && heroStage.parentNode === viewHome) {
      viewHome.insertBefore(btn, heroStage);
    } else {
      viewHome.insertBefore(btn, viewHome.firstChild);
    }
  }

  function startPersistenceGuard() {
    mountStoriesTrigger();

    if (window.FINTEX_EXT && typeof window.FINTEX_EXT.onAfterRender === 'function' && !window.FINTEX_EXT._storiesHooked) {
      const origAfterRender = window.FINTEX_EXT.onAfterRender.bind(window.FINTEX_EXT);
      window.FINTEX_EXT.onAfterRender = function (...args) {
        const res = origAfterRender(...args);
        mountStoriesTrigger();
        return res;
      };
      window.FINTEX_EXT._storiesHooked = true;
    }

    const targetNode = document.getElementById('view-home') || document.body;
    if (!domObserver && targetNode) {
      domObserver = new MutationObserver(() => {
        if (!document.getElementById('ftx-stories-entry')) {
          mountStoriesTrigger();
        }
      });
      domObserver.observe(targetNode, { childList: true });
    }
  }

  // Чтение реального состояния FINTEX из точных ключей localStorage (app.js: fp_local_tx, fp_goal, fp_balance, fp_bills)
  function loadAppState() {
    const liveState = window.state && Array.isArray(window.state.transactions) ? window.state : null;

    const storedTxs = safeParse(localStorage.getItem('fp_local_tx'), null);
    const storedGoal = safeParse(localStorage.getItem('fp_goal'), null);
    const storedBills = safeParse(localStorage.getItem('fp_bills'), null);
    const storedBalance = localStorage.getItem('fp_balance');

    const transactions = liveState
      ? liveState.transactions
      : Array.isArray(storedTxs)
        ? storedTxs
        : [];

    const goal = (liveState && liveState.goal)
      ? liveState.goal
      : (storedGoal && typeof storedGoal === 'object')
        ? storedGoal
        : { title: 'Финансовая подушка', saved: 0, target: 10000 };

    const bills = (liveState && Array.isArray(liveState.bills))
      ? liveState.bills
      : Array.isArray(storedBills)
        ? storedBills
        : [];

    const balance = liveState && typeof liveState.balance === 'number'
      ? liveState.balance
      : storedBalance !== null
        ? Number(storedBalance) || 0
        : 0;

    return {
      transactions,
      goal,
      bills,
      balance,
      currency: '₽'
    };
  }

  function formatMoney(num, currency) {
    return `${Math.round(Number(num) || 0).toLocaleString('ru-RU')} ${currency}`;
  }

  function resolveCategoryLabel(rawCat) {
    const key = String(rawCat || 'other').trim();
    if (window.CATS && window.CATS[key]?.name) return window.CATS[key].name;
    if (CAT_LABELS[key]) return CAT_LABELS[key];
    return key || 'Прочее';
  }

  function resolveMerchantLabel(rawMerchant) {
    const base = String(rawMerchant || 'Без названия').trim();
    if (typeof window.normalizeMerchantName === 'function') {
      return window.normalizeMerchantName(base);
    }
    return base || 'Без названия';
  }

  function buildSlides() {
    const st = loadAppState();
    const cur = st.currency || '₽';
    const allTxs = Array.isArray(st.transactions) ? st.transactions : [];
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
      if (amt <= 0) return;

      const isInc =
        t.type === 'income' ||
        t.kind === 'income' ||
        (Number(t.amount) > 0 && t.type !== 'expense' && t.kind !== 'expense');

      if (isInc) {
        income += amt;
      } else {
        spent += amt;
        const day = String(t.date || t.createdAt || '').slice(0, 10);
        if (day) activeDays.add(day);

        const shop = resolveMerchantLabel(t.merchant || t.title || t.name || t.note);
        const cat = resolveCategoryLabel(t.category || t.cat);
        byShop[shop] = (byShop[shop] || 0) + amt;
        byCat[cat] = (byCat[cat] || 0) + amt;
      }
    });

    const topShop = Object.entries(byShop).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const passedDays = Math.max(1, now.getDate());
    const zeroSpendDays = Math.max(0, passedDays - activeDays.size);
    const netFlow = income - spent;

    const goalObj = st.goal || {};
    const goalTitle = String(goalObj.title || 'Финансовая подушка').trim();
    const goalTarget = Math.max(1, Number(goalObj.target) || 10000);
    const goalSaved = Math.max(0, Number(goalObj.saved) || 0);
    const goalPct = Math.min(100, Math.round((goalSaved / goalTarget) * 100));

    return [
      {
        badge: `Итоги · ${monthName}`,
        kicker: 'Денежный поток месяца',
        hero: formatMoney(spent, cur),
        desc:
          monthTxs.length === 0
            ? 'За этот месяц операций пока нет — добавьте чек или запись, чтобы увидеть динамику.'
            : netFlow >= 0
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
          ? `На эту точку ушло ${formatMoney(topShop[1], cur)} за текущий месяц.`
          : 'В этом месяце ещё не зафиксировано трат по магазинам.',
        stats: [
          { val: topCat ? esc(topCat[0]) : '—', lbl: 'Топ-категория' },
          {
            val: topCat && spent > 0 ? `${Math.round((topCat[1] / spent) * 100)}%` : '0%',
            lbl: 'Доля трат'
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
        badge: goalTitle,
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
    document.addEventListener('DOMContentLoaded', startPersistenceGuard);
  } else {
    startPersistenceGuard();
  }

  window.FintexStories = { open: openStories, close: closeStories, mountTrigger: mountStoriesTrigger };
  window.openStoriesRecap = openStories;
  window.openStories = openStories;
})();
