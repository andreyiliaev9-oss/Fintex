/* ============================================================================
 * FINTEX Life Simulator — Шаг 2: Интерфейс конструктора и библиотека сценариев (sim_ui.js)
 * Подключается автоматически через extensions.js поверх sim_engine.js.
 * ============================================================================ */

(function initFintexSimulatorUI() {
  const SIM = window.FINTEX_SIM;
  if (!SIM) return;

  SIM.ui = {
    draft: {
      id: null,
      title: 'Новый жизненный сценарий',
      horizonDays: 90,
      events: []
    },
    activeMode: 'base',
    editingEventIdx: null,

    esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    fmt(n, prefix = '') {
      if (typeof fmtR === 'function') return fmtR(n, prefix);
      return `${prefix}${Math.round(Number(n) || 0)} ₽`;
    },

    injectEntryCards() {
      // 1. Кнопка запуска в разделе Аналитика (сразу под шапкой Финансового центра)
      const anView = document.getElementById('view-analytics');
      if (anView && !document.getElementById('sim-entry-analytics')) {
        const card = document.createElement('div');
        card.id = 'sim-entry-analytics';
        card.className = 'card-surface p-4 border border-[#00D6C3]/30 space-y-2.5 cursor-pointer tap';
        card.onclick = () => SIM.ui.openModal();
        card.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-[#00D6C3]/15 text-brand flex items-center justify-center shrink-0">
                <i data-lucide="git-branch" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-main">FINTEX Life Simulator</span>
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F2C65D]/20 text-gold">Модели будущего</span>
                </div>
                <div class="text-[11px] text-sub truncate">Покупка авто, переезд, смена работы, кредиты и риски</div>
              </div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-brand shrink-0"></i>
          </div>
        `;
        const firstCard = anView.querySelector('.card-surface');
        if (firstCard) anView.insertBefore(card, firstCard);
        else anView.appendChild(card);
      }

      // 2. Компактная плашка на Главной (под карточкой счёта / источниками)
      const homeView = document.getElementById('view-home');
      const goalCard = document.getElementById('goal-card');
      if (homeView && !document.getElementById('sim-entry-home')) {
        const pill = document.createElement('button');
        pill.id = 'sim-entry-home';
        pill.type = 'button';
        pill.className = 'w-full card-surface px-3.5 py-2.5 flex items-center justify-between text-xs border border-[#00D6C3]/25 tap';
        pill.onclick = () => SIM.ui.openModal();
        pill.innerHTML = `
          <span class="flex items-center gap-2 font-semibold text-main">
            <i data-lucide="git-branch" class="w-4 h-4 text-brand"></i>
            <span>Life Simulator · Проверить решение до покупки</span>
          </span>
          <span class="text-[10px] font-bold text-brand">Открыть →</span>
        `;
        if (goalCard && goalCard.parentNode === homeView) {
          homeView.insertBefore(pill, goalCard);
        } else {
          homeView.appendChild(pill);
        }
      }

      try { if (window.lucide) lucide.createIcons(); } catch (e) {}
    },

    ensureModalDOM() {
      if (document.getElementById('modal-life-sim')) return;
      const modal = document.createElement('div');
      modal.id = 'modal-life-sim';
      modal.className = 'hidden fixed inset-0 z-50 modal-overlay flex items-end justify-center';
      modal.onclick = (e) => { if (e.target === modal) SIM.ui.closeModal(); };

      modal.innerHTML = `
        <div class="modal-sheet w-full max-w-md max-h-[92vh] overflow-y-auto p-4 space-y-3.5">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-main">Life Simulator</h3>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand">Изолированная модель</span>
              </div>
              <p class="text-[11px] text-sub">Виртуальный расчёт без изменения реальных счетов</p>
            </div>
            <button type="button" onclick="FINTEX_SIM.ui.closeModal()" class="w-8 h-8 rounded-full input-surface flex items-center justify-center text-sub">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Горизонт и название сценария -->
          <div class="card-surface p-3 space-y-2.5">
            <div class="flex items-center gap-2">
              <input id="sim-sc-title" type="text" placeholder="Название сценария (например, Покупка авто)" oninput="FINTEX_SIM.ui.updateDraftMeta()" class="flex-1 input-surface px-3 py-2 text-xs font-semibold" />
              <button type="button" onclick="FINTEX_SIM.ui.saveCurrentScenario()" class="px-3 py-2 rounded-xl btn-teal-soft text-xs font-bold shrink-0">Сохранить</button>
            </div>
            <div class="grid grid-cols-4 gap-1.5" id="sim-horizons-row">
              <button type="button" data-h="30" onclick="FINTEX_SIM.ui.setHorizon(30)" class="sim-h-btn py-1.5 rounded-lg text-[11px] font-bold input-surface text-sub">30 дн.</button>
              <button type="button" data-h="90" onclick="FINTEX_SIM.ui.setHorizon(90)" class="sim-h-btn py-1.5 rounded-lg text-[11px] font-bold btn-turquoise">90 дн.</button>
              <button type="button" data-h="180" onclick="FINTEX_SIM.ui.setHorizon(180)" class="sim-h-btn py-1.5 rounded-lg text-[11px] font-bold input-surface text-sub">6 мес.</button>
              <button type="button" data-h="365" onclick="FINTEX_SIM.ui.setHorizon(365)" class="sim-h-btn py-1.5 rounded-lg text-[11px] font-bold input-surface text-sub">1 год</button>
            </div>
          </div>

          <!-- Переключатель 3 веток будущего -->
          <div class="grid grid-cols-3 gap-1.5" id="sim-modes-row">
            <button type="button" data-m="optimistic" onclick="FINTEX_SIM.ui.setMode('optimistic')" class="sim-m-btn py-1.5 rounded-xl text-[11px] font-bold input-surface text-sub">Оптимистичный</button>
            <button type="button" data-m="base" onclick="FINTEX_SIM.ui.setMode('base')" class="sim-m-btn py-1.5 rounded-xl text-[11px] font-bold btn-turquoise">Базовый</button>
            <button type="button" data-m="pessimistic" onclick="FINTEX_SIM.ui.setMode('pessimistic')" class="sim-m-btn py-1.5 rounded-xl text-[11px] font-bold input-surface text-sub">Негативный</button>
          </div>

          <!-- Контейнер для SVG-графика (Шаг 3) и сравнения (Шаг 4) -->
          <div id="sim-visual-slot"></div>

          <!-- Главные финансовые показатели результата -->
          <div id="sim-results-box" class="card-surface p-3.5 space-y-2.5"></div>

          <!-- События в текущем сценарии -->
          <div class="card-surface p-3.5 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-main">События сценария (<span id="sim-ev-count">0</span>)</span>
              <button type="button" onclick="FINTEX_SIM.ui.toggleEventForm(true)" class="px-2.5 py-1 rounded-lg btn-turquoise text-[11px]">+ Событие</button>
            </div>

            <!-- Форма добавления/редактирования события -->
            <div id="sim-event-form" class="hidden input-surface p-3 space-y-2 border border-[#00D6C3]/35">
              <div class="grid grid-cols-2 gap-1.5">
                <select id="sim-ev-type" class="input-surface px-2.5 py-2 text-xs font-semibold">
                  ${Object.values(SIM.CATEGORIES).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
                <input id="sim-ev-day" type="number" min="0" value="0" placeholder="Через дней (0 = сегодня)" class="input-surface px-2.5 py-2 text-xs" />
              </div>
              <input id="sim-ev-title" type="text" placeholder="Название (например, Автомобиль / Переезд)" class="w-full input-surface px-3 py-2 text-xs" />
              <div class="grid grid-cols-2 gap-1.5">
                <input id="sim-ev-amount" type="number" min="0" placeholder="Разовая сумма / цена, ₽" class="input-surface px-2.5 py-2 text-xs" />
                <input id="sim-ev-extra" type="number" min="0" placeholder="Доп. расходы (оформл.), ₽" class="input-surface px-2.5 py-2 text-xs" />
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <input id="sim-ev-inc-delta" type="number" placeholder="Изм. дохода/мес (±₽)" class="input-surface px-2.5 py-2 text-xs" />
                <input id="sim-ev-exp-delta" type="number" placeholder="Изм. расхода/мес (±₽)" class="input-surface px-2.5 py-2 text-xs" />
              </div>
              <label class="flex items-center gap-2 text-[11px] text-sub pt-0.5">
                <input id="sim-ev-is-asset" type="checkbox" class="accent-[#00D6C3]" />
                <span>Это ценный актив (учитывать в Net Worth)</span>
              </label>
              <label class="flex items-center gap-2 text-[11px] text-sub">
                <input id="sim-ev-use-credit" type="checkbox" onchange="document.getElementById('sim-credit-fields').classList.toggle('hidden', !this.checked)" class="accent-[#00D6C3]" />
                <span>Оформить в кредит / рассрочку</span>
              </label>
              <div id="sim-credit-fields" class="hidden grid grid-cols-3 gap-1.5 pt-1">
                <input id="sim-ev-down" type="number" min="0" placeholder="Первый взнос ₽" class="input-surface px-2 py-1.5 text-[11px]" />
                <input id="sim-ev-rate" type="number" step="0.1" value="18" placeholder="Ставка %" class="input-surface px-2 py-1.5 text-[11px]" />
                <input id="sim-ev-months" type="number" min="1" value="36" placeholder="Срок мес." class="input-surface px-2 py-1.5 text-[11px]" />
              </div>
              <div class="flex gap-2 pt-1">
                <button type="button" onclick="FINTEX_SIM.ui.commitEventForm()" class="flex-1 py-2 rounded-xl btn-turquoise text-xs">Применить событие</button>
                <button type="button" onclick="FINTEX_SIM.ui.toggleEventForm(false)" class="px-3 py-2 rounded-xl input-surface text-xs text-sub">Отмена</button>
              </div>
            </div>

            <div id="sim-events-list" class="space-y-1.5"></div>
          </div>

          <!-- Библиотека сохранённых сценариев -->
          <div class="card-surface p-3.5 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-main">Библиотека сценариев</span>
              <button type="button" onclick="FINTEX_SIM.ui.newDraft()" class="text-[11px] font-semibold text-brand">+ Чистый сценарий</button>
            </div>
            <div id="sim-library-list" class="space-y-1.5"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    openModal(scenarioId = null) {
      try { if (typeof vibro === 'function') vibro('light'); } catch (e) {}
      this.ensureModalDOM();
      if (scenarioId) {
        const found = SIM.loadScenarios().find(x => x.id === scenarioId);
        if (found) this.draft = JSON.parse(JSON.stringify(found));
      } else if (!this.draft.events.length) {
        this.draft = {
          id: null,
          title: 'Покупка автомобиля',
          horizonDays: 90,
          events: [{
            type: 'purchase',
            dayOffset: 14,
            title: 'Автомобиль',
            amount: 1200000,
            oneOffExtra: 45000,
            monthlyIncomeDelta: 0,
            monthlyExpenseDelta: 12000,
            isAsset: true,
            useCredit: true,
            downPayment: 300000,
            creditRate: 19,
            creditMonths: 48
          }]
        };
      }
      document.getElementById('sim-sc-title').value = this.draft.title;
      document.getElementById('modal-life-sim').classList.remove('hidden');
      this.render();
    },

    closeModal() {
      const el = document.getElementById('modal-life-sim');
      if (el) el.classList.add('hidden');
    },

    newDraft() {
      this.draft = { id: null, title: 'Новый сценарий', horizonDays: 90, events: [] };
      document.getElementById('sim-sc-title').value = this.draft.title;
      this.toggleEventForm(true);
      this.render();
    },

    updateDraftMeta() {
      this.draft.title = document.getElementById('sim-sc-title')?.value || 'Новый сценарий';
    },

    setHorizon(days) {
      try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
      this.draft.horizonDays = days;
      this.render();
    },

    setMode(mode) {
      try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
      this.activeMode = mode;
      this.render();
    },

    toggleEventForm(show, editIdx = null) {
      const form = document.getElementById('sim-event-form');
      if (!form) return;
      this.editingEventIdx = editIdx;
      form.classList.toggle('hidden', !show);
      if (show) {
        const ev = editIdx !== null ? this.draft.events[editIdx] : null;
        document.getElementById('sim-ev-type').value = ev?.type || 'purchase';
        document.getElementById('sim-ev-day').value = ev?.dayOffset ?? 0;
        document.getElementById('sim-ev-title').value = ev?.title || '';
        document.getElementById('sim-ev-amount').value = ev?.amount || '';
        document.getElementById('sim-ev-extra').value = ev?.oneOffExtra || '';
        document.getElementById('sim-ev-inc-delta').value = ev?.monthlyIncomeDelta || '';
        document.getElementById('sim-ev-exp-delta').value = ev?.monthlyExpenseDelta || '';
        document.getElementById('sim-ev-is-asset').checked = Boolean(ev?.isAsset);
        document.getElementById('sim-ev-use-credit').checked = Boolean(ev?.useCredit);
        document.getElementById('sim-credit-fields').classList.toggle('hidden', !ev?.useCredit);
        document.getElementById('sim-ev-down').value = ev?.downPayment || '';
        document.getElementById('sim-ev-rate').value = ev?.creditRate || 18;
        document.getElementById('sim-ev-months').value = ev?.creditMonths || 36;
      }
    },

    commitEventForm() {
      const type = document.getElementById('sim-ev-type').value;
      const cat = SIM.CATEGORIES[type] || SIM.CATEGORIES.purchase;
      const ev = {
        type,
        dayOffset: Math.max(0, Number(document.getElementById('sim-ev-day').value) || 0),
        title: document.getElementById('sim-ev-title').value.trim() || cat.name,
        amount: Math.max(0, Number(document.getElementById('sim-ev-amount').value) || 0),
        oneOffExtra: Math.max(0, Number(document.getElementById('sim-ev-extra').value) || 0),
        monthlyIncomeDelta: Number(document.getElementById('sim-ev-inc-delta').value) || 0,
        monthlyExpenseDelta: Number(document.getElementById('sim-ev-exp-delta').value) || 0,
        isAsset: document.getElementById('sim-ev-is-asset').checked,
        useCredit: document.getElementById('sim-ev-use-credit').checked,
        downPayment: Math.max(0, Number(document.getElementById('sim-ev-down').value) || 0),
        creditRate: Math.max(0, Number(document.getElementById('sim-ev-rate').value) || 0),
        creditMonths: Math.max(1, Number(document.getElementById('sim-ev-months').value) || 12)
      };
      if (this.editingEventIdx !== null) this.draft.events[this.editingEventIdx] = ev;
      else this.draft.events.push(ev);
      this.draft.events.sort((a, b) => a.dayOffset - b.dayOffset);
      this.toggleEventForm(false);
      try { if (typeof vibro === 'function') vibro('success'); } catch (e) {}
      this.render();
    },

    removeEvent(idx) {
      this.draft.events.splice(idx, 1);
      this.render();
    },

    saveCurrentScenario() {
      this.updateDraftMeta();
      const saved = SIM.saveScenario(this.draft);
      this.draft.id = saved.id;
      this.render();
      try { if (typeof toast === 'function') toast('Сценарий сохранён в библиотеку'); } catch (e) {}
    },

    removeSavedScenario(id) {
      SIM.deleteScenario(id);
      if (this.draft.id === id) this.draft.id = null;
      this.render();
    },

    render() {
      // Подсветка активного горизонта и ветки
      document.querySelectorAll('.sim-h-btn').forEach(btn => {
        const active = Number(btn.dataset.h) === Number(this.draft.horizonDays);
        btn.className = `sim-h-btn py-1.5 rounded-lg text-[11px] font-bold ${active ? 'btn-turquoise' : 'input-surface text-sub'}`;
      });
      document.querySelectorAll('.sim-m-btn').forEach(btn => {
        const active = btn.dataset.m === this.activeMode;
        btn.className = `sim-m-btn py-1.5 rounded-xl text-[11px] font-bold ${active ? 'btn-turquoise' : 'input-surface text-sub'}`;
      });

      const allRes = SIM.simulateAllModes(this.draft);
      const res = allRes[this.activeMode] || allRes.base;
      const gapAlert = res.cashGapDay !== null
        ? `<div class="p-2.5 rounded-xl bg-red-500/15 border border-red-400/30 text-[11px] text-red-300 font-semibold">Риск кассового разрыва на ${res.cashGapDay}-й день (минимум: ${this.fmt(res.minCash)})</div>`
        : `<div class="p-2 rounded-xl bg-[#00D6C3]/10 text-[11px] text-brand font-medium">Кассовых разрывов на горизонте ${res.horizonDays} дн. не обнаружено ✓</div>`;

      const qualityNote = !res.snapshot.dataQuality.hasEnoughExpenseData
        ? `<div class="text-[10px] text-gold">Внимание: мало данных за 30 дней (${res.snapshot.dataQuality.txCount30} опер.) — базовый расход оценён от дневной нормы.</div>`
        : `<div class="text-[10px] text-dim">База расчёта: ${res.snapshot.dataQuality.txCount30} подтверждённых операций за 30 дн.</div>`;

      document.getElementById('sim-results-box').innerHTML = `
        ${gapAlert}
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Остаток денег через ${res.horizonDays} дн.</div>
            <div class="text-sm font-extrabold tabular-nums ${res.endCash < 0 ? 'text-red-400' : 'text-main'}">${this.fmt(res.endCash)}</div>
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Чистый капитал (Net Worth)</div>
            <div class="text-sm font-extrabold tabular-nums text-brand">${this.fmt(res.endNetWorth)} <span class="text-[10px]">(${res.netWorthDelta >= 0 ? '+' : ''}${this.fmt(res.netWorthDelta)})</span></div>
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Денежный поток / мес.</div>
            <div class="text-xs font-bold tabular-nums ${res.monthlyNetFlow >= 0 ? 'text-brand' : 'text-gold'}">${res.monthlyNetFlow >= 0 ? '+' : ''}${this.fmt(res.monthlyNetFlow)}</div>
            ${res.monthlyDebtService > 0 ? `<div class="text-[9px] text-sub">Кредиты: -${this.fmt(res.monthlyDebtService)}/мес</div>` : ''}
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Подушка / FINTEX Score</div>
            <div class="text-xs font-bold tabular-nums text-main">${res.cushionMonths} мес. · <span class="text-brand">${res.simScore}/100</span></div>
          </div>
        </div>
        ${qualityNote}
      `;

      // Список событий сценария
      document.getElementById('sim-ev-count').textContent = this.draft.events.length;
      const evListEl = document.getElementById('sim-events-list');
      evListEl.innerHTML = this.draft.events.length
        ? this.draft.events.map((ev, i) => {
            const cat = SIM.CATEGORIES[ev.type] || SIM.CATEGORIES.purchase;
            return `
              <div class="input-surface p-2.5 flex items-center justify-between gap-2 text-xs">
                <div class="min-w-0" onclick="FINTEX_SIM.ui.toggleEventForm(true, ${i})">
                  <div class="font-bold text-main truncate">${this.esc(ev.title)} <span class="text-[10px] text-brand font-normal">· день ${ev.dayOffset}</span></div>
                  <div class="text-[10px] text-sub truncate">${cat.name}${ev.amount ? ` · ${this.fmt(ev.amount)}` : ''}${ev.useCredit ? ` (кредит)` : ''}</div>
                </div>
                <button type="button" onclick="FINTEX_SIM.ui.removeEvent(${i})" class="text-red-400 text-[11px] px-2 py-1 shrink-0">Удалить</button>
              </div>
            `;
          }).join('')
        : `<div class="text-[11px] text-sub text-center py-2">Добавьте событие (покупку, смену работы, переезд или риск)</div>`;

      // Библиотека сохранённых сценариев
      const lib = SIM.loadScenarios();
      const libEl = document.getElementById('sim-library-list');
      libEl.innerHTML = lib.length
        ? lib.map(sc => `
            <div class="input-surface p-2.5 flex items-center justify-between gap-2 text-xs">
              <div onclick="FINTEX_SIM.ui.openModal('${this.esc(sc.id)}')" class="min-w-0 flex-1 cursor-pointer">
                <div class="font-semibold text-main truncate">${this.esc(sc.title)}</div>
                <div class="text-[10px] text-sub">Горизонт ${sc.horizonDays} дн. · событий: ${(sc.events || []).length}</div>
              </div>
              <button type="button" onclick="FINTEX_SIM.ui.removeSavedScenario('${this.esc(sc.id)}')" class="text-red-400 text-[11px] px-2">×</button>
            </div>
          `).join('')
        : `<div class="text-[11px] text-sub">Сохранённых сценариев пока нет</div>`;

      // Хук для Шага 3 и Шага 4 (график и сравнение)
      try { SIM.charts?.renderVisualSlot?.(this.draft, allRes, this.activeMode); } catch (e) {}
      try { if (window.lucide) lucide.createIcons(); } catch (e) {}
    }
  };

  SIM.onAfterRender = function () {
    SIM.ui.injectEntryCards();
  };

  SIM.ui.injectEntryCards();
})();
