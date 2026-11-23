/* ============================================================================
 * FINTEX Life Simulator — Интуитивный интерфейс с пресетами и ползунками (sim_ui.js)
 * ============================================================================ */

(function initFintexSimulatorUI() {
  const SIM = (window.FINTEX_SIM = window.SIM = window.FINTEX_SIM || {});

  SIM.PRESETS = {
    purchase: {
      id: 'purchase',
      label: 'Покупка',
      sub: 'Авто или техника',
      icon: 'car',
      title: 'Покупка авто / техники',
      horizonDays: 180,
      sliders: [
        { key: 'amount', label: 'Стоимость покупки', min: 30000, max: 3000000, step: 10000, unit: '₽' },
        { key: 'downPayment', label: 'Первый взнос', min: 0, max: 1500000, step: 10000, unit: '₽' },
        { key: 'dayOffset', label: 'Через сколько дней', min: 0, max: 180, step: 5, unit: 'дн.' }
      ],
      buildEvent(vals) {
        const price = Number(vals.amount) || 500000;
        const down = Math.min(price, Number(vals.downPayment) || 0);
        const useCredit = down < price;
        return {
          type: 'purchase',
          dayOffset: Number(vals.dayOffset) || 14,
          title: price >= 400000 ? 'Покупка авто' : 'Крупная покупка',
          amount: price,
          oneOffExtra: Math.round(price * 0.03),
          monthlyIncomeDelta: 0,
          monthlyExpenseDelta: price >= 400000 ? 10000 : 0,
          isAsset: price >= 100000,
          useCredit,
          downPayment: down,
          creditRate: 18,
          creditMonths: 36
        };
      }
    },
    move: {
      id: 'move',
      label: 'Переезд',
      sub: 'Новое жильё',
      icon: 'map-pin',
      title: 'Переезд и аренда',
      horizonDays: 180,
      sliders: [
        { key: 'amount', label: 'Залог и переезд', min: 10000, max: 300000, step: 5000, unit: '₽' },
        { key: 'monthlyExpenseDelta', label: 'Новая аренда в мес.', min: 15000, max: 150000, step: 2500, unit: '₽/м' },
        { key: 'dayOffset', label: 'Через сколько дней', min: 0, max: 180, step: 5, unit: 'дн.' }
      ],
      buildEvent(vals) {
        return {
          type: 'move',
          dayOffset: Number(vals.dayOffset) || 30,
          title: 'Переезд',
          amount: Number(vals.amount) || 60000,
          oneOffExtra: 0,
          monthlyIncomeDelta: 0,
          monthlyExpenseDelta: Number(vals.monthlyExpenseDelta) || 35000,
          isAsset: false,
          useCredit: false
        };
      }
    },
    work: {
      id: 'work',
      label: 'Новая работа',
      sub: 'Рост дохода',
      icon: 'briefcase',
      title: 'Смена работы / рост дохода',
      horizonDays: 180,
      sliders: [
        { key: 'monthlyIncomeDelta', label: 'Прибавка к доходу', min: -30000, max: 150000, step: 5000, unit: '₽/м' },
        { key: 'amount', label: 'Пауза без зарплаты', min: 0, max: 100000, step: 5000, unit: '₽' },
        { key: 'dayOffset', label: 'Через сколько дней', min: 0, max: 180, step: 5, unit: 'дн.' }
      ],
      buildEvent(vals) {
        const delta = Number(vals.monthlyIncomeDelta) || 30000;
        return {
          type: 'work',
          dayOffset: Number(vals.dayOffset) || 15,
          title: delta >= 0 ? 'Рост дохода' : 'Снижение дохода',
          amount: Number(vals.amount) || 0,
          oneOffExtra: 0,
          monthlyIncomeDelta: delta,
          monthlyExpenseDelta: 0,
          isAsset: false,
          useCredit: false
        };
      }
    },
    risk: {
      id: 'risk',
      label: 'Стресс-тест',
      sub: 'Потеря дохода',
      icon: 'shield-alert',
      title: 'Проверка запаса прочности',
      horizonDays: 90,
      sliders: [
        { key: 'amount', label: 'Непредвиденный расход', min: 0, max: 300000, step: 5000, unit: '₽' },
        { key: 'monthlyIncomeDelta', label: 'Потеря дохода в мес.', min: -150000, max: 0, step: 5000, unit: '₽/м' },
        { key: 'dayOffset', label: 'Когда наступит', min: 0, max: 60, step: 5, unit: 'дн.' }
      ],
      buildEvent(vals) {
        return {
          type: 'risk',
          dayOffset: Number(vals.dayOffset) || 0,
          title: 'Стресс-сценарий',
          amount: Number(vals.amount) || 30000,
          oneOffExtra: 0,
          monthlyIncomeDelta: Number(vals.monthlyIncomeDelta) || -40000,
          monthlyExpenseDelta: 0,
          isAsset: false,
          useCredit: false
        };
      }
    }
  };

  SIM.ui = {
    activePreset: 'purchase',
    sliderVals: {
      purchase: { amount: 800000, downPayment: 250000, dayOffset: 15 },
      move: { amount: 60000, monthlyExpenseDelta: 35000, dayOffset: 30 },
      work: { monthlyIncomeDelta: 30000, amount: 0, dayOffset: 15 },
      risk: { amount: 25000, monthlyIncomeDelta: -45000, dayOffset: 0 }
    },
    draft: {
      id: null,
      title: 'Покупка авто / техники',
      horizonDays: 180,
      events: []
    },
    activeMode: 'base',
    advancedOpen: false,

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

    buildDecisionTreeBannerHtml(idAttr) {
      return `
        <div id="${idAttr}" onclick="window.FINTEX_SIM.ui.openModal()" class="relative overflow-hidden rounded-[22px] p-4 cursor-pointer tap border border-[#00D6C3]/35" style="background: radial-gradient(110% 120% at 100% 50%, rgba(0, 214, 195, 0.20) 0%, rgba(242, 198, 93, 0.10) 45%, rgba(9, 22, 19, 0.96) 100%); box-shadow: 0 14px 32px -14px rgba(0, 214, 195, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);">
          <div class="flex items-center justify-between gap-3 relative z-10">
            <div class="flex items-center gap-3 min-w-0">
              <!-- Миниатюрное светящееся SVG-дерево будущего -->
              <div class="w-12 h-12 rounded-2xl bg-[#051210]/90 border border-[#00D6C3]/40 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(0,214,195,0.28)]">
                <svg class="w-8 h-8" viewBox="0 0 36 36" fill="none">
                  <path d="M5 18H14" stroke="#00D6C3" stroke-width="2.4" stroke-linecap="round" />
                  <path d="M14 18C19 18 22 9 29 9" stroke="#20C997" stroke-width="2" stroke-linecap="round" />
                  <path d="M14 18H30" stroke="#00D6C3" stroke-width="2.2" stroke-linecap="round" />
                  <path d="M14 18C19 18 22 27 29 27" stroke="#FB7185" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 2" />
                  <circle cx="14" cy="18" r="3.2" fill="#F2C65D" />
                  <circle cx="29" cy="9" r="2.2" fill="#20C997" />
                  <circle cx="30" cy="18" r="2.4" fill="#00D6C3" />
                  <circle cx="29" cy="27" r="2" fill="#FB7185" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-extrabold text-white tracking-tight">Дерево будущего</span>
                  <span class="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F2C65D]/20 text-gold border border-[#F2C65D]/35">Симулятор</span>
                </div>
                <div class="text-[11px] text-white/70 truncate mt-0.5">Покупка, переезд или новая работа — 3 ветки исхода</div>
              </div>
            </div>
            <div class="w-8 h-8 rounded-full bg-[#00D6C3]/15 border border-[#00D6C3]/35 text-brand flex items-center justify-center shrink-0">
              <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
            </div>
          </div>
        </div>
      `;
    },

    injectEntryCards() {
      const homeAnchor = document.getElementById('sim-home-anchor');
      if (homeAnchor) {
        homeAnchor.innerHTML = '';
        homeAnchor.classList.add('hidden');
      }
      document.getElementById('sim-entry-home')?.remove();

      const anView = document.getElementById('view-analytics');
      if (anView && !document.getElementById('sim-entry-analytics')) {
        const wrap = document.createElement('div');
        wrap.innerHTML = this.buildDecisionTreeBannerHtml('sim-entry-analytics').trim();
        const firstCard = anView.querySelector('.card-surface');
        if (firstCard) anView.insertBefore(wrap.firstChild, firstCard);
        else anView.appendChild(wrap.firstChild);
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
        <div class="modal-sheet w-full max-w-md max-h-[92vh] overflow-y-auto p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-main">Дерево будущего</h3>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand">Безопасно</span>
              </div>
              <p class="text-[11px] text-sub">Выберите событие и подвиньте ползунки — дерево перестроится само</p>
            </div>
            <button type="button" onclick="FINTEX_SIM.ui.closeModal()" class="w-8 h-8 rounded-full input-surface flex items-center justify-center text-sub">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- 4 готовых сценария в 1 касание -->
          <div class="grid grid-cols-2 gap-1.5" id="sim-presets-grid"></div>

          <!-- Горизонт прогноза -->
          <div class="grid grid-cols-4 gap-1.5" id="sim-horizons-row">
            <button type="button" data-h="30" onclick="FINTEX_SIM.ui.setHorizon(30)" class="sim-h-btn py-1.5 rounded-xl text-[11px] font-bold input-surface text-sub">1 мес.</button>
            <button type="button" data-h="90" onclick="FINTEX_SIM.ui.setHorizon(90)" class="sim-h-btn py-1.5 rounded-xl text-[11px] font-bold input-surface text-sub">3 мес.</button>
            <button type="button" data-h="180" onclick="FINTEX_SIM.ui.setHorizon(180)" class="sim-h-btn py-1.5 rounded-xl text-[11px] font-bold btn-turquoise">6 мес.</button>
            <button type="button" data-h="365" onclick="FINTEX_SIM.ui.setHorizon(365)" class="sim-h-btn py-1.5 rounded-xl text-[11px] font-bold input-surface text-sub">1 год</button>
          </div>

          <!-- Живые ползунки выбранного сценария -->
          <div id="sim-sliders-box" class="card-surface p-3.5 space-y-3"></div>

          <!-- Интерактивное SVG-дерево будущего (sim_charts.js) -->
          <div id="sim-visual-slot"></div>

          <!-- Короткая сводка 4 главных цифр -->
          <div id="sim-results-box" class="card-surface p-3 space-y-2"></div>

          <!-- Сворачиваемая «Тонкая настройка» для цепочек событий и библиотеки -->
          <div class="card-surface p-3 space-y-2.5">
            <button type="button" onclick="FINTEX_SIM.ui.toggleAdvanced()" class="w-full flex items-center justify-between text-xs font-bold text-sub">
              <span>Тонкая настройка и сохранённые ветки</span>
              <span id="sim-adv-arrow" class="text-brand">Развернуть ▾</span>
            </button>

            <div id="sim-advanced-pane" class="hidden space-y-2.5 pt-2 border-t divider-line">
              <div class="flex items-center gap-2">
                <input id="sim-sc-title" type="text" placeholder="Название сценария" oninput="FINTEX_SIM.ui.updateDraftMeta()" class="flex-1 input-surface px-3 py-2 text-xs font-semibold" />
                <button type="button" onclick="FINTEX_SIM.ui.saveCurrentScenario()" class="px-3 py-2 rounded-xl btn-turquoise text-xs">Сохранить</button>
              </div>
              <div id="sim-events-list" class="space-y-1.5"></div>
              <div id="sim-library-list" class="space-y-1.5"></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    selectPreset(presetId) {
      try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
      this.activePreset = presetId;
      const preset = SIM.PRESETS[presetId] || SIM.PRESETS.purchase;
      const vals = this.sliderVals[presetId] || {};
      this.draft = {
        id: null,
        title: preset.title,
        horizonDays: preset.horizonDays,
        events: [preset.buildEvent(vals)]
      };
      const titleInp = document.getElementById('sim-sc-title');
      if (titleInp) titleInp.value = this.draft.title;
      this.render();
    },

    formatSliderVal(sl, v) {
      return sl.unit === 'дн.'
        ? (v === 0 ? 'Сегодня' : `через ${v} дн.`)
        : `${v > 0 && sl.min < 0 ? '+' : ''}${this.fmt(v)}${sl.unit === '₽/м' ? '/мес' : ''}`;
    },

    onSliderInput(key, rawVal, inpEl) {
      const val = Number(rawVal);
      if (!this.sliderVals[this.activePreset]) this.sliderVals[this.activePreset] = {};
      this.sliderVals[this.activePreset][key] = val;
      const preset = SIM.PRESETS[this.activePreset] || SIM.PRESETS.purchase;
      this.draft.events = [preset.buildEvent(this.sliderVals[this.activePreset])];

      const sl = preset.sliders.find(s => s.key === key);
      if (sl) {
        const lbl = document.getElementById(`sim-sl-val-${key}`);
        if (lbl) lbl.textContent = this.formatSliderVal(sl, val);
        if (inpEl) {
          const pct = Math.max(0, Math.min(100, ((val - sl.min) / Math.max(1, sl.max - sl.min)) * 100));
          inpEl.style.setProperty('--fill-pct', `${pct.toFixed(1)}%`);
        }
      }
      this.renderOutputsOnly();
    },

    openModal(scenarioId = null) {
      try { if (typeof vibro === 'function') vibro('light'); } catch (e) {}
      this.ensureModalDOM();
      if (scenarioId) {
        const found = SIM.loadScenarios().find(x => x.id === scenarioId);
        if (found) this.draft = JSON.parse(JSON.stringify(found));
      } else if (!this.draft.events.length) {
        this.selectPreset(this.activePreset);
      }
      document.getElementById('modal-life-sim').classList.remove('hidden');
      this.render();
    },

    closeModal() {
      document.getElementById('modal-life-sim')?.classList.add('hidden');
    },

    toggleAdvanced() {
      this.advancedOpen = !this.advancedOpen;
      document.getElementById('sim-advanced-pane')?.classList.toggle('hidden', !this.advancedOpen);
      const arr = document.getElementById('sim-adv-arrow');
      if (arr) arr.textContent = this.advancedOpen ? 'Свернуть ▴' : 'Развернуть ▾';
    },

    updateDraftMeta() {
      this.draft.title = document.getElementById('sim-sc-title')?.value || 'Сценарий';
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

    saveCurrentScenario() {
      this.updateDraftMeta();
      const saved = SIM.saveScenario(this.draft);
      this.draft.id = saved.id;
      this.render();
      try { if (typeof toast === 'function') toast('Ветка сохранена в библиотеку'); } catch (e) {}
    },

    removeSavedScenario(id) {
      SIM.deleteScenario(id);
      if (this.draft.id === id) this.draft.id = null;
      this.render();
    },

    render() {
      const presetsGrid = document.getElementById('sim-presets-grid');
      if (presetsGrid) {
        presetsGrid.innerHTML = Object.values(SIM.PRESETS).map(p => {
          const active = p.id === this.activePreset;
          return `
            <button type="button" onclick="FINTEX_SIM.ui.selectPreset('${p.id}')" class="p-2.5 rounded-2xl border text-left flex items-center gap-2.5 tap ${active ? 'btn-teal-soft border-[#00D6C3]/50' : 'card-surface'}">
              <div class="w-8 h-8 rounded-xl ${active ? 'bg-[#00D6C3] text-[#041311]' : 'input-surface text-brand'} flex items-center justify-center shrink-0">
                <i data-lucide="${p.icon}" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-bold text-main truncate">${p.label}</div>
                <div class="text-[10px] text-sub truncate">${p.sub}</div>
              </div>
            </button>
          `;
        }).join('');
      }

      document.querySelectorAll('.sim-h-btn').forEach(btn => {
        const active = Number(btn.dataset.h) === Number(this.draft.horizonDays);
        btn.className = `sim-h-btn py-1.5 rounded-xl text-[11px] font-bold ${active ? 'btn-turquoise' : 'input-surface text-sub'}`;
      });

      const preset = SIM.PRESETS[this.activePreset] || SIM.PRESETS.purchase;
      const curVals = this.sliderVals[this.activePreset] || {};
      const slidersBox = document.getElementById('sim-sliders-box');
      if (slidersBox) {
        slidersBox.innerHTML = preset.sliders.map(sl => {
          const v = Number(curVals[sl.key] ?? sl.min);
          const pct = Math.max(0, Math.min(100, ((v - sl.min) / Math.max(1, sl.max - sl.min)) * 100));
          return `
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-sub font-medium">${sl.label}</span>
                <span id="sim-sl-val-${sl.key}" class="font-extrabold text-brand tabular-nums">${this.formatSliderVal(sl, v)}</span>
              </div>
              <input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${v}"
                     style="--fill-pct: ${pct.toFixed(1)}%;"
                     oninput="FINTEX_SIM.ui.onSliderInput('${sl.key}', this.value, this)"
                     class="fintex-slider" />
            </div>
          `;
        }).join('');
      }

      this.renderOutputsOnly();
    },

    renderOutputsOnly() {
      const allRes = SIM.simulateAllModes(this.draft);
      const res = allRes[this.activeMode] || allRes.base;

      document.getElementById('sim-results-box').innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Остаток денег</div>
            <div class="text-sm font-extrabold tabular-nums ${res.endCash < 0 ? 'text-red-400' : 'text-main'}">${this.fmt(res.endCash)}</div>
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Чистый капитал</div>
            <div class="text-sm font-extrabold tabular-nums text-brand">${this.fmt(res.endNetWorth)}</div>
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">Запас прочности</div>
            <div class="text-xs font-bold tabular-nums text-main">${res.cushionMonths} мес. без дохода</div>
          </div>
          <div class="input-surface p-2.5">
            <div class="text-[10px] text-sub">${res.monthlyDebtService > 0 ? 'Платёж по кредиту' : 'Баланс в месяц'}</div>
            <div class="text-xs font-bold tabular-nums ${res.monthlyDebtService > 0 ? 'text-gold' : 'text-brand'}">
              ${res.monthlyDebtService > 0 ? `-${this.fmt(res.monthlyDebtService)}/мес` : `${res.monthlyNetFlow >= 0 ? '+' : ''}${this.fmt(res.monthlyNetFlow)}/мес`}
            </div>
          </div>
        </div>
      `;

      const lib = SIM.loadScenarios();
      const libEl = document.getElementById('sim-library-list');
      if (libEl) {
        libEl.innerHTML = lib.length
          ? lib.map(sc => `
              <div class="input-surface p-2.5 flex items-center justify-between gap-2 text-xs">
                <div onclick="FINTEX_SIM.ui.openModal('${this.esc(sc.id)}')" class="min-w-0 flex-1 cursor-pointer">
                  <div class="font-semibold text-main truncate">${this.esc(sc.title)}</div>
                  <div class="text-[10px] text-sub">${sc.horizonDays} дн.</div>
                </div>
                <button type="button" onclick="FINTEX_SIM.ui.removeSavedScenario('${this.esc(sc.id)}')" class="text-red-400 text-xs px-2">×</button>
              </div>
            `).join('')
          : `<div class="text-[11px] text-sub">Нажмите «Сохранить», чтобы сравнить несколько вариантов</div>`;
      }

      try { SIM.charts?.renderVisualSlot?.(this.draft, allRes, this.activeMode); } catch (e) {}
      try { if (window.lucide) lucide.createIcons(); } catch (e) {}
    }
  };

  SIM.onAfterRender = function () {
    SIM.ui.injectEntryCards();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SIM.ui.injectEntryCards());
  } else {
    SIM.ui.injectEntryCards();
  }
})();
