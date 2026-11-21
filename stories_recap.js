/* ============================================================================
 * FINTEX Stories — Кинематографические итоги месяца (stories_recap.js)
 * Автономный модуль: кнопка входа + полноэкранные сторис с прогресс-барами и тапами.
 * ============================================================================ */

(function initFintexStories() {
  const CSS_ID = 'fintex-stories-styles';
  if (!document.getElementById(CSS_ID)) {
    const st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = `
      @keyframes storySlidePop {
        0%   { opacity: 0; transform: scale(0.95) translateY(14px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      .fintex-story-anim {
        animation: storySlidePop 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .fintex-story-backdrop {
        background: radial-gradient(circle at 50% 20%, #0D2D28 0%, #050B09 62%, #020505 100%);
      }
    `;
    document.head.appendChild(st);
  }

  let currentIdx = 0;
  let slidesData = [];
  let autoTimer = null;

  function fmt(n, prefix = '') {
    if (typeof fmtR === 'function') return fmtR(n, prefix);
    const v = Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${prefix}${v} ₽`;
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildRecapSlides() {
    const s = window.state || {};
    const txs = Array.isArray(s.transactions) ? s.transactions : [];
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const monthTitle = `${mNames[now.getMonth()]} ${now.getFullYear()}`;

    const monthTxs = txs.filter(t => String(t.date || '').startsWith(ym));
    const useTxs = monthTxs.length ? monthTxs : txs;
    const periodLabel = monthTxs.length ? monthTitle : 'За всё время';

    const expenses = useTxs.filter(t => t.type === 'expense');
    const incomes = useTxs.filter(t => t.type === 'income');
    const totalExp = expenses.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const totalInc = incomes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const netDiff = totalInc - totalExp;

    // Главный магазин
    const byMerch = {};
    expenses.forEach(t => {
      const m = (t.merchant || 'Покупка').trim();
      if (!byMerch[m]) byMerch[m] = { sum: 0, count: 0 };
      byMerch[m].sum += Number(t.amount) || 0;
      byMerch[m].count += 1;
    });
    const topMerchEntry = Object.entries(byMerch).sort((a, b) => b[1].sum - a[1].sum)[0];

    // Дни без трат в текущем месяце до сегодня
    const todayDay = now.getDate();
    const spendDays = new Set(expenses.filter(t => String(t.date || '').startsWith(ym)).map(t => t.date));
    const noSpendDays = Math.max(0, todayDay - spendDays.size);

    // Рейтинг и финансовая подушка
    const rating = typeof calcDetailedRating === 'function' ? calcDetailedRating() : { ready: false };
    const goalSaved = Number(s.goal?.saved) || 0;
    const goalTarget = Math.max(1, Number(s.goal?.target) || 10000);
    const goalPct = Math.min(100, Math.round((goalSaved / goalTarget) * 100));

    return [
      {
        tag: `ИТОГИ • ${periodLabel.toUpperCase()}`,
        accent: '#00D6C3',
        title: s.name ? `${esc(s.name)}, вот ваш финансовый пульс` : 'Ваш финансовый пульс',
        bigValue: fmt(totalExp),
        bigLabel: `Всего расходов (${expenses.length} опер.)`,
        cards: [
          { k: 'Поступления', v: `+${fmt(totalInc)}`, c: 'text-emerald-400' },
          { k: 'Баланс потока', v: `${netDiff >= 0 ? '+' : '−'}${fmt(Math.abs(netDiff))}`, c: netDiff >= 0 ? 'text-brand' : 'text-rose-400' }
        ],
        tip: netDiff >= 0
          ? 'Отличный темп: доходы перекрывают расходы с запасом.'
          : 'Расходы превысили поступления — проверьте крупные траты.'
      },
      {
        tag: 'ГЛАВНАЯ ТОЧКА ТРАТ',
        accent: '#F2C65D',
        title: topMerchEntry ? esc(topMerchEntry[0]) : 'Пока нет покупок',
        bigValue: topMerchEntry ? fmt(topMerchEntry[1].sum) : '0 ₽',
        bigLabel: topMerchEntry ? `Посещений за период: ${topMerchEntry[1].count}` : 'Добавьте чек или операцию',
        cards: [
          { k: 'Дней без трат', v: `${noSpendDays} дн. 🔥`, c: 'text-gold' },
          { k: 'Средний чек', v: expenses.length ? fmt(Math.round(totalExp / expenses.length)) : '0 ₽', c: 'text-main' }
        ],
        tip: topMerchEntry
          ? `На «${esc(topMerchEntry[0])}» пришлось ${totalExp > 0 ? Math.round((topMerchEntry[1].sum / totalExp) * 100) : 0}% всех трат.`
          : 'Сканируйте чеки, чтобы видеть персональную статистику.'
      },
      {
        tag: 'ЗАПАС ПРОЧНОСТИ',
        accent: '#20C997',
        title: esc(s.goal?.title || 'Финансовая подушка'),
        bigValue: `${goalPct}%`,
        bigLabel: `Накоплено ${fmt(goalSaved)} из ${fmt(goalTarget)}`,
        cards: [
          { k: 'Рейтинг FINTEX', v: rating.ready ? `${rating.total} / 100` : 'В расчёте', c: 'text-brand' },
          { k: 'На карте сейчас', v: fmt(s.balance || 0), c: 'text-gold' }
        ],
        tip: goalPct >= 100
          ? 'Цель выполнена! Можно задать новую финансовую высоту.'
          : `До цели осталось ${fmt(Math.max(0, goalTarget - goalSaved))}.`
      }
    ];
  }

  function ensureModal() {
    let modal = document.getElementById('modal-fintex-stories');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'modal-fintex-stories';
    modal.className = 'fixed inset-0 z-[80] hidden fintex-story-backdrop text-white flex flex-col justify-between px-5 py-6 select-none';
    modal.innerHTML = `
      <div class="space-y-3 relative z-20">
        <div id="story-progress-bars" class="grid grid-cols-3 gap-1.5"></div>
        <div class="flex items-center justify-between">
          <span id="story-tag" class="text-[10px] font-extrabold tracking-[0.2em] text-brand">FINTEX STORIES</span>
          <button type="button" onclick="window.FINTEX_STORIES.close()" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">✕</button>
        </div>
      </div>

      <div id="story-body" class="my-auto relative z-20 fintex-story-anim"></div>

      <div class="relative z-20 flex items-center justify-between text-[11px] text-sub">
        <span>← Назад</span>
        <span id="story-counter">1 / 3</span>
        <span>Дальше →</span>
      </div>

      <!-- Зоны тапа влево/вправо -->
      <div onclick="window.FINTEX_STORIES.prev()" class="fixed inset-y-16 left-0 w-1/3 z-10 cursor-pointer"></div>
      <div onclick="window.FINTEX_STORIES.next()" class="fixed inset-y-16 right-0 w-2/3 z-10 cursor-pointer"></div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderSlide() {
    const sl = slidesData[currentIdx];
    if (!sl) return;
    clearTimeout(autoTimer);

    const barsEl = document.getElementById('story-progress-bars');
    if (barsEl) {
      barsEl.innerHTML = slidesData.map((_, i) => `
        <div class="h-1 rounded-full bg-white/15 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-300" style="width: ${i <= currentIdx ? '100%' : '0%'}; background: ${sl.accent};"></div>
        </div>
      `).join('');
    }

    document.getElementById('story-tag').textContent = sl.tag;
    document.getElementById('story-counter').textContent = `${currentIdx + 1} / ${slidesData.length}`;

    const bodyEl = document.getElementById('story-body');
    bodyEl.classList.remove('fintex-story-anim');
    void bodyEl.offsetWidth;
    bodyEl.classList.add('fintex-story-anim');

    bodyEl.innerHTML = `
      <div class="rounded-[28px] p-6 border border-white/15 bg-white/[0.04] backdrop-blur-xl space-y-5 shadow-2xl">
        <div class="text-lg font-extrabold leading-snug text-white">${sl.title}</div>
        <div class="py-2">
          <div class="text-4xl font-extrabold tracking-tight tabular-nums" style="color: ${sl.accent};">${sl.bigValue}</div>
          <div class="text-xs text-sub mt-1">${sl.bigLabel}</div>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          ${sl.cards.map(c => `
            <div class="rounded-2xl p-3 bg-black/40 border border-white/10">
              <div class="text-[10px] uppercase text-sub">${c.k}</div>
              <div class="text-sm font-extrabold tabular-nums mt-0.5 ${c.c}">${c.v}</div>
            </div>
          `).join('')}
        </div>
        <div class="text-xs text-white/80 leading-relaxed pt-2 border-t border-white/10">
          ${sl.tip}
        </div>
      </div>
    `;

    autoTimer = setTimeout(() => window.FINTEX_STORIES.next(), 6500);
  }

  function injectEntryButton() {
    const anView = document.getElementById('view-analytics');
    if (anView && !document.getElementById('stories-entry-btn')) {
      const btn = document.createElement('button');
      btn.id = 'stories-entry-btn';
      btn.type = 'button';
      btn.onclick = () => window.FINTEX_STORIES.open();
      btn.className = 'w-full rounded-2xl p-3.5 border border-[#F2C65D]/40 flex items-center justify-between text-left tap';
      btn.style.background = 'linear-gradient(125deg, rgba(242,198,93,0.16) 0%, rgba(0,214,195,0.12) 100%)';
      btn.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-[#F2C65D]/20 text-gold flex items-center justify-center font-extrabold text-sm shrink-0">✦</div>
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-main">FINTEX Stories · Итоги месяца</div>
            <div class="text-[10px] text-sub truncate">Красивый разбор трат, главного магазина и рейтинга</div>
          </div>
        </div>
        <span class="text-[11px] font-bold text-gold shrink-0">Смотреть →</span>
      `;
      anView.insertBefore(btn, anView.firstChild);
    }
  }

  window.FINTEX_STORIES = {
    open() {
      try { if (typeof vibro === 'function') vibro('medium'); } catch (e) {}
      slidesData = buildRecapSlides();
      currentIdx = 0;
      const modal = ensureModal();
      modal.classList.remove('hidden');
      renderSlide();
    },
    close() {
      clearTimeout(autoTimer);
      document.getElementById('modal-fintex-stories')?.classList.add('hidden');
    },
    next() {
      try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
      if (currentIdx < slidesData.length - 1) {
        currentIdx++;
        renderSlide();
      } else {
        this.close();
      }
    },
    prev() {
      try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
      if (currentIdx > 0) {
        currentIdx--;
        renderSlide();
      }
    }
  };

  const origAfter = window.FINTEX_EXT?.onAfterRender;
  if (window.FINTEX_EXT) {
    window.FINTEX_EXT.onAfterRender = function () {
      try { origAfter?.(); } catch (e) {}
      injectEntryButton();
    };
  }
  injectEntryButton();
})();
