/* ============================================================================
 * FINTEX Life Simulator — Шаг 4: Сравнение сценариев, умные рекомендации и ИИ-ввод (sim_pro.js)
 * Подключается автоматически через extensions.js поверх sim_engine.js, sim_ui.js и sim_charts.js.
 * ============================================================================ */

(function initFintexSimulatorPro() {
  const SIM = (window.FINTEX_SIM = window.SIM = window.FINTEX_SIM || {});

  SIM.pro = {
    compareId: '',

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

    // Добавляем долгосрочные горизонты 3 года (1095 дн.) и 5 лет (1825 дн.) в панель горизонтов
    ensureLongHorizons() {
      const row = document.getElementById('sim-horizons-row');
      if (!row || row.dataset.proExtended === '1') return;
      row.dataset.proExtended = '1';
      row.className = 'grid grid-cols-6 gap-1';
      row.innerHTML = `
        <button type="button" data-h="30" onclick="FINTEX_SIM.ui.setHorizon(30)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold input-surface text-sub">30д</button>
        <button type="button" data-h="90" onclick="FINTEX_SIM.ui.setHorizon(90)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold btn-turquoise">90д</button>
        <button type="button" data-h="180" onclick="FINTEX_SIM.ui.setHorizon(180)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold input-surface text-sub">6м</button>
        <button type="button" data-h="365" onclick="FINTEX_SIM.ui.setHorizon(365)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold input-surface text-sub">1г</button>
        <button type="button" data-h="1095" onclick="FINTEX_SIM.ui.setHorizon(1095)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold input-surface text-sub">3г</button>
        <button type="button" data-h="1825" onclick="FINTEX_SIM.ui.setHorizon(1825)" class="sim-h-btn py-1.5 rounded-lg text-[10px] font-bold input-surface text-sub">5л</button>
      `;
      if (SIM.ui?.draft) {
        document.querySelectorAll('.sim-h-btn').forEach(btn => {
          const active = Number(btn.dataset.h) === Number(SIM.ui.draft.horizonDays);
          btn.className = `sim-h-btn py-1.5 rounded-lg text-[10px] font-bold ${active ? 'btn-turquoise' : 'input-surface text-sub'}`;
        });
      }
    },

    // Детерминированный парсер естественного языка для создания/обновления сценария фразой
    parseNaturalPrompt(text) {
      const raw = String(text || '').trim();
      if (!raw) return null;
      const norm = typeof wordsToNumbersRu === 'function' ? wordsToNumbersRu(raw) : raw.toLowerCase();

      // Определяем задержку старта ("через 2 мес", "через 30 дней")
      let dayOffset = 0;
      const mMonth = norm.match(/через\s+(\d+)\s*(?:мес|месяц)/i);
      const mDay = norm.match(/через\s+(\d+)\s*(?:дн|день|дня|дней)/i);
      if (mMonth) dayOffset = Number(mMonth[1]) * 30;
      else if (mDay) dayOffset = Number(mDay[1]);

      const events = [];

      // 1. Зарплата / новый доход
      const incM = norm.match(/(?:зарплат[а-я]*|доход|получать)\s*(?:—|-|будет|на)?\s*(\d[\d\s]*)/i);
      if (incM) {
        const val = Math.round(Number(incM[1].replace(/\s+/g, '')));
        if (val > 0) {
          const snap = SIM.captureRealitySnapshot();
          const isDelta = /\+|больше|выраст|прибав/i.test(norm);
          const delta = isDelta ? val : (val - snap.estMonthlyIncome);
          events.push({
            type: 'work',
            dayOffset,
            title: isDelta ? `Рост дохода (+${val} ₽/мес)` : `Новая зарплата (${val} ₽/мес)`,
            amount: 0,
            oneOffExtra: 0,
            monthlyIncomeDelta: delta,
            monthlyExpenseDelta: 0,
            isAsset: false,
            useCredit: false
          });
        }
      }

      // 2. Переезд / аренда жилья
      const rentM = norm.match(/(?:аренд[а-я]*|съ[её]м[а-я]*|квартир[а-я]*|жиль[её])\s*(?:—|-)?\s*(\d[\d\s]*)/i);
      const moveCostM = norm.match(/переезд[а-я]*\s*(?:—|-|стоимость)?\s*(\d[\d\s]*)/i);
      if (rentM || /переезд|переех/i.test(norm)) {
        const rentVal = rentM ? Math.round(Number(rentM[1].replace(/\s+/g, ''))) : 0;
        const moveOneOff = moveCostM ? Math.round(Number(moveCostM[1].replace(/\s+/g, ''))) : 0;
        events.push({
          type: 'move',
          dayOffset,
          title: 'Переезд и жильё',
          amount: moveOneOff,
          oneOffExtra: 0,
          monthlyIncomeDelta: 0,
          monthlyExpenseDelta: rentVal,
          isAsset: false,
          useCredit: false
        });
      }

      // 3. Покупка авто / техники / недвижимости
      const buyM = norm.match(/(?:купить|покупк[а-я]*|авто[а-я]*|машин[а-я]*|телефон|ноутбук|участок)\s*(?:за|—|-)?\s*(\d[\d\s]*)/i);
      if (buyM && !rentM) {
        const price = Math.round(Number(buyM[1].replace(/\s+/g, '')));
        if (price > 0) {
          const isCredit = /кредит|рассроч|ипотек/i.test(norm);
          events.push({
            type: 'purchase',
            dayOffset,
            title: /авто|машин/i.test(norm) ? 'Покупка автомобиля' : 'Крупная покупка',
            amount: price,
            oneOffExtra: 0,
            monthlyIncomeDelta: 0,
            monthlyExpenseDelta: /авто|машин/i.test(norm) ? 10000 : 0,
            isAsset: price >= 100000,
            useCredit: isCredit,
            downPayment: isCredit ? Math.round(price * 0.25) : price,
            creditRate: 18,
            creditMonths: 36
          });
        }
      }

      // 4. Потеря работы / риск
      if (/увол|потер[яю]\s+работ|без\s+доход/i.test(norm)) {
        const snap = SIM.captureRealitySnapshot();
        events.push({
          type: 'risk',
          dayOffset,
          title: 'Потеря основного дохода',
          amount: 0,
          oneOffExtra: 0,
          monthlyIncomeDelta: -snap.estMonthlyIncome,
          monthlyExpenseDelta: 0,
          isAsset: false,
          useCredit: false
        });
      }

      return events.length ? events : null;
    },

    applyNaturalPrompt() {
      const inp = document.getElementById('sim-ai-prompt-inp');
      const raw = inp?.value.trim();
      if (!raw) return;
      const parsedEvents = this.parseNaturalPrompt(raw);
      if (!parsedEvents) {
        try { if (typeof toast === 'function') toast('Укажите сумму и событие (например: Переезд через 2 мес, аренда 40000)'); } catch (e) {}
        return;
      }
      SIM.ui.draft.title = raw.slice(0, 42);
      SIM.ui.draft.events = parsedEvents;
      if (parsedEvents.some(e => e.dayOffset >= 90) && SIM.ui.draft.horizonDays < 180) {
        SIM.ui.draft.horizonDays = 365;
      }
      const titleInp = document.getElementById('sim-sc-title');
      if (titleInp) titleInp.value = SIM.ui.draft.title;
      inp.value = '';
      try { if (typeof vibro === 'function') vibro('success'); } catch (e) {}
      SIM.ui.render();
      try { if (typeof toast === 'function') toast(`Сценарий построен (${parsedEvents.length} событ.)`); } catch (e) {}
    },

    // Умные рекомендации с конкретным расчётом последствий
    buildRecommendations(draft, res) {
      const recs = [];
      const firstBigPurchase = (draft.events || []).find(e => e.type === 'purchase' && e.amount > 0);

      if (res.cashGapDay !== null) {
        const deficit = Math.abs(res.minCash);
        const monthlySave = Math.max(1, res.monthlyNetFlow);
        if (firstBigPurchase && !firstBigPurchase.useCredit) {
          const extraMonths = Math.max(1, Math.ceil(deficit / monthlySave));
          recs.push({
            title: `Отложить «${firstBigPurchase.title}» на ${extraMonths} мес. или оформить кредит`,
            desc: `Дефицит составляет ${this.fmt(deficit)}. Накопление за ${extraMonths} мес. или первый взнос 30% уберёт кассовый разрыв.`
          });
        } else {
          recs.push({
            title: `Увеличить стартовый резерв на ${this.fmt(deficit)}`,
            desc: `Текущего остатка не хватает на ${res.cashGapDay}-й день. Сократите ежемесячные расходы на ${this.fmt(Math.ceil(deficit / Math.max(1, draft.horizonDays / 30)))}/мес.`
          });
        }
      } else if (res.cushionMonths !== null && res.cushionMonths < 2) {
        recs.push({
          title: 'Укрепить финансовую подушку до 3 месяцев',
          desc: `После реализации сценария подушка покроет ${res.cushionMonths} мес. расходов — безопасный минимум от 3 мес.`
        });
      } else {
        recs.push({
          title: 'Сценарий финансово устойчив',
          desc: `Ликвидность сохраняется, подушка безопасности составляет ${res.cushionMonths === null ? 'не рассчитана без расходов' : `${res.cushionMonths} мес.`} Можно направить свободный поток в цель.`
        });
      }

      if (firstBigPurchase && firstBigPurchase.useCredit) {
        const loan = Math.max(0, firstBigPurchase.amount - (firstBigPurchase.downPayment || 0));
        const pmt = SIM.calcAnnuityPayment(loan, firstBigPurchase.creditRate ?? 18, firstBigPurchase.creditMonths || 36);
        const totalPaid = pmt * (firstBigPurchase.creditMonths || 36);
        const overpay = Math.max(0, totalPaid - loan);
        recs.push({
          title: `Кредитная нагрузка: ${this.fmt(pmt)}/мес.`,
          desc: `Переплата по процентам за ${firstBigPurchase.creditMonths || 36} мес. составит ~${this.fmt(overpay)}.`
        });
      }

      return recs;
    },

    setCompareScenario(id) {
      this.compareId = id;
      SIM.ui?.render?.();
    },

    renderProSlot(draft, allRes, activeMode) {
      this.ensureLongHorizons();
      const slot = document.getElementById('sim-pro-slot');
      if (!slot) return;

      const cur = allRes[activeMode] || allRes.base;
      const recs = this.buildRecommendations(draft, cur);
      const savedList = SIM.loadScenarios().filter(x => x.id !== draft.id);

      let compareHtml = '';
      if (savedList.length > 0) {
        const targetSc = savedList.find(x => x.id === this.compareId) || savedList[0];
        this.compareId = targetSc.id;
        // Сравниваем на одинаковом горизонте
        const alignedTarget = { ...targetSc, horizonDays: draft.horizonDays };
        const targetRes = SIM.simulateScenario(alignedTarget, activeMode);

        compareHtml = `
          <div class="input-surface p-2.5 space-y-2 border border-white/10">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold uppercase text-sub">Сравнение на горизонте ${draft.horizonDays} дн.</span>
              <select onchange="FINTEX_SIM.pro.setCompareScenario(this.value)" class="bg-black/30 text-[10px] text-brand font-semibold rounded px-2 py-0.5 max-w-[150px]">
                ${savedList.map(s => `<option value="${this.esc(s.id)}" ${s.id === targetSc.id ? 'selected' : ''}>${this.esc(s.title)}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-3 gap-1 text-[10px] tabular-nums">
              <div class="text-sub">Показатель</div>
              <div class="font-bold text-brand truncate">Текущий</div>
              <div class="font-bold text-gold truncate">${this.esc(targetSc.title)}</div>

              <div class="text-dim">Остаток</div>
              <div class="text-main font-semibold">${this.fmt(cur.endCash)}</div>
              <div class="text-main font-semibold">${this.fmt(targetRes.endCash)}</div>

              <div class="text-dim">Net Worth</div>
              <div class="text-main font-semibold">${this.fmt(cur.endNetWorth)}</div>
              <div class="text-main font-semibold">${this.fmt(targetRes.endNetWorth)}</div>

              <div class="text-dim">Поток/мес</div>
              <div class="text-main font-semibold">${this.fmt(cur.monthlyNetFlow)}</div>
              <div class="text-main font-semibold">${this.fmt(targetRes.monthlyNetFlow)}</div>

              <div class="text-dim">Score</div>
              <div class="text-main font-semibold">${cur.simScore}/100</div>
              <div class="text-main font-semibold">${targetRes.simScore}/100</div>
            </div>
          </div>
        `;
      }

      slot.innerHTML = `
        <div class="space-y-2 pt-1">
          <!-- Диалоговый конструктор сценария -->
          <div class="flex gap-1.5">
            <input id="sim-ai-prompt-inp" type="text" placeholder="Фраза: Переезд через 2 мес, аренда 40000, зп 180000" onkeydown="if(event.key==='Enter') FINTEX_SIM.pro.applyNaturalPrompt()" class="flex-1 input-surface px-2.5 py-2 text-[11px]" />
            <button type="button" onclick="FINTEX_SIM.pro.applyNaturalPrompt()" class="px-3 py-2 rounded-xl btn-teal-soft text-[11px] font-bold shrink-0">Создать</button>
          </div>

          <!-- Умные рекомендации -->
          <div class="space-y-1.5">
            ${recs.map(r => `
              <div class="input-surface p-2.5 border-l-2 border-[#00D6C3]">
                <div class="text-[11px] font-bold text-main">${this.esc(r.title)}</div>
                <div class="text-[10px] text-sub leading-snug mt-0.5">${this.esc(r.desc)}</div>
              </div>
            `).join('')}
          </div>

          ${compareHtml}
        </div>
      `;
    }
  };

  if (document.getElementById('modal-life-sim') && !document.getElementById('modal-life-sim').classList.contains('hidden')) {
    SIM.ui?.render?.();
  }
})();
