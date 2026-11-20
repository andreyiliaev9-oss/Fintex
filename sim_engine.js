/* ============================================================================
 * FINTEX Life Simulator — Шаг 1: Изолированный математический движок (sim_engine.js)
 * Модель будущего на основе реальных данных FINTEX без изменения счетов и истории.
 * ============================================================================ */

window.FINTEX_SIM = window.FINTEX_SIM || {
  version: '1.0',
  STORAGE_KEY: 'fp_sim_scenarios_v1',

  CATEGORIES: {
    purchase: { id: 'purchase', name: 'Покупка / Имущество', icon: 'car', color: '#F2C65D' },
    work:     { id: 'work',     name: 'Работа и доход',      icon: 'briefcase', color: '#00D6C3' },
    move:     { id: 'move',     name: 'Переезд и жильё',     icon: 'map-pin', color: '#38BDF8' },
    family:   { id: 'family',   name: 'Семья и быт',         icon: 'users', color: '#A78BFA' },
    windfall: { id: 'windfall', name: 'Крупное поступление', icon: 'trending-up', color: '#20C997' },
    risk:     { id: 'risk',     name: 'Финансовый риск',     icon: 'shield-alert', color: '#FB7185' }
  },

  // Снимок актуальной финансовой ситуации (только чтение, с прозрачностью источников)
  captureRealitySnapshot() {
    const s = window.state || {};
    const txs = Array.isArray(s.transactions) ? s.transactions : [];
    const bills = Array.isArray(s.bills) ? s.bills : [];
    const goal = s.goal || { title: 'Финансовая подушка', saved: 0, target: 10000 };

    const cutoff30 = typeof offsetDateISO === 'function' ? offsetDateISO(-30) : '';
    const recentExpenses = txs.filter(t => t.type === 'expense' && (!cutoff30 || t.date >= cutoff30));
    const recentIncomes = txs.filter(t => t.type === 'income' && (!cutoff30 || t.date >= cutoff30));

    const totalExp30 = recentExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalInc30 = recentIncomes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const activeBillsMonthly = bills.filter(b => !b.is_paid).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    // Оценка базовых ежемесячных трат (если истории мало, берём ориентир от дневного лимита)
    const m = typeof calcMetrics === 'function' ? calcMetrics() : { dailyCap: 1000, reserved: 0, freePool: Number(s.balance) || 0 };
    const hasEnoughExpenseData = recentExpenses.length >= 3;
    const estMonthlyVariableSpend = hasEnoughExpenseData
      ? Math.round(totalExp30)
      : Math.round((m.dailyCap || 1000) * 30);

    const hasIncomeData = recentIncomes.length > 0;
    const estMonthlyIncome = hasIncomeData
      ? Math.round(totalInc30)
      : Math.round(estMonthlyVariableSpend + activeBillsMonthly);

    const balance = Math.max(0, Number(s.balance) || 0);
    const cushionSaved = Math.max(0, Number(goal.saved) || 0);
    const baseScore = typeof calcDetailedRating === 'function' ? (calcDetailedRating().total ?? 50) : 50;

    return {
      capturedAt: new Date().toISOString(),
      balance,
      cushionSaved,
      goalTitle: goal.title || 'Финансовая подушка',
      goalTarget: Math.max(1, Number(goal.target) || 10000),
      activeBillsMonthly,
      estMonthlyVariableSpend,
      estMonthlyIncome,
      baseScore,
      dataQuality: {
        hasEnoughExpenseData,
        hasIncomeData,
        txCount30: recentExpenses.length + recentIncomes.length
      }
    };
  },

  // Аннуитетный ежемесячный платёж по кредиту
  calcAnnuityPayment(principal, annualRatePct, months) {
    const P = Math.max(0, Number(principal) || 0);
    const n = Math.max(1, Math.round(Number(months) || 12));
    const r = Math.max(0, Number(annualRatePct) || 0) / 100 / 12;
    if (P === 0) return 0;
    if (r === 0) return Math.round(P / n);
    const k = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(P * k);
  },

  // Детерминированное моделирование сценария на заданный горизонт (в днях)
  simulateScenario(scenario, mode = 'base') {
    const snap = this.captureRealitySnapshot();
    const horizonDays = Math.max(7, Number(scenario.horizonDays) || 90);
    const events = Array.isArray(scenario.events) ? scenario.events : [];

    // Коэффициенты чувствительности для 3 вариантов будущего
    const mult = mode === 'optimistic'
      ? { inc: 1.08, exp: 0.92, extraOneOff: 0.90 }
      : mode === 'pessimistic'
        ? { inc: 0.88, exp: 1.14, extraOneOff: 1.15 }
        : { inc: 1.00, exp: 1.00, extraOneOff: 1.00 };

    let cash = snap.balance;
    let cushion = snap.cushionSaved;
    let assetsValue = 0;
    let debtRemaining = 0;
    let monthlyIncome = snap.estMonthlyIncome * mult.inc;
    let monthlyExpenses = (snap.estMonthlyVariableSpend + snap.activeBillsMonthly) * mult.exp;
    let monthlyDebtService = 0;

    let minCash = cash;
    let cashGapDay = null;
    const timeline = [];
    const appliedEvents = [];

    for (let day = 0; day <= horizonDays; day++) {
      // 1. Применяем события, наступающие в этот день
      events.forEach(ev => {
        const evDay = Math.max(0, Math.round(Number(ev.dayOffset) || 0));
        if (evDay !== day) return;

        const cost = Math.max(0, Number(ev.amount) || 0);
        const downPayment = ev.useCredit ? Math.min(cost, Math.max(0, Number(ev.downPayment) || 0)) : cost;
        const oneOff = Math.round((downPayment + (Number(ev.oneOffExtra) || 0)) * mult.extraOneOff);
        const deltaMonthlyInc = (Number(ev.monthlyIncomeDelta) || 0) * mult.inc;
        const deltaMonthlyExp = (Number(ev.monthlyExpenseDelta) || 0) * mult.exp;

        if (ev.type === 'windfall') {
          cash += Math.round(cost * mult.inc);
        } else {
          cash -= oneOff;
        }

        if (ev.isAsset && cost > 0) {
          assetsValue += cost;
        }

        if (ev.useCredit && cost > downPayment) {
          const loan = cost - downPayment;
          const pmt = this.calcAnnuityPayment(loan, ev.creditRate || 18, ev.creditMonths || 36);
          debtRemaining += loan;
          monthlyDebtService += pmt;
        }

        monthlyIncome = Math.max(0, monthlyIncome + deltaMonthlyInc);
        monthlyExpenses = Math.max(0, monthlyExpenses + deltaMonthlyExp);
        appliedEvents.push({ day, title: ev.title || 'Событие', type: ev.type });
      });

      // 2. Ежедневный денежный поток (шаг 1 день)
      if (day > 0) {
        const netDaily = (monthlyIncome - monthlyExpenses - monthlyDebtService) / 30;
        cash += netDaily;
        if (monthlyDebtService > 0 && debtRemaining > 0) {
          debtRemaining = Math.max(0, debtRemaining - (monthlyDebtService * 0.65) / 30);
        }
      }

      if (cash < minCash) minCash = cash;
      if (cash < 0 && cashGapDay === null) cashGapDay = day;

      if (day === 0 || day === horizonDays || day % Math.max(1, Math.floor(horizonDays / 12)) === 0) {
        timeline.push({
          day,
          cash: Math.round(cash),
          netWorth: Math.round(cash + cushion + assetsValue - debtRemaining)
        });
      }
    }

    const endCash = Math.round(cash);
    const endNetWorth = Math.round(cash + cushion + assetsValue - debtRemaining);
    const startNetWorth = Math.round(snap.balance + snap.cushionSaved);
    const totalMonthlyOutflow = Math.max(1, Math.round(monthlyExpenses + monthlyDebtService));
    const cushionMonths = Math.round(((Math.max(0, endCash) + cushion) / totalMonthlyOutflow) * 10) / 10;

    // Виртуальный индекс устойчивости (0-100)
    let simScore = snap.baseScore;
    if (cashGapDay !== null) simScore -= 28;
    else if (endCash < totalMonthlyOutflow * 0.5) simScore -= 12;
    if (monthlyIncome > totalMonthlyOutflow) simScore += 6;
    if (debtRemaining > monthlyIncome * 6) simScore -= 10;
    simScore = Math.max(5, Math.min(100, Math.round(simScore)));

    return {
      mode,
      horizonDays,
      snapshot: snap,
      endCash,
      minCash: Math.round(minCash),
      cashGapDay,
      endNetWorth,
      netWorthDelta: endNetWorth - startNetWorth,
      assetsValue: Math.round(assetsValue),
      debtRemaining: Math.round(debtRemaining),
      monthlyIncome: Math.round(monthlyIncome),
      monthlyExpenses: Math.round(monthlyExpenses),
      monthlyDebtService: Math.round(monthlyDebtService),
      monthlyNetFlow: Math.round(monthlyIncome - monthlyExpenses - monthlyDebtService),
      cushionMonths,
      simScore,
      scoreDelta: simScore - snap.baseScore,
      appliedEvents,
      timeline
    };
  },

  // Расчёт сразу трёх веток будущего (Базовый, Оптимистичный, Негативный)
  simulateAllModes(scenario) {
    return {
      base: this.simulateScenario(scenario, 'base'),
      optimistic: this.simulateScenario(scenario, 'optimistic'),
      pessimistic: this.simulateScenario(scenario, 'pessimistic')
    };
  },

  // Библиотека сохранённых сценариев (изолирована от fp_local_tx)
  loadScenarios() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  saveScenario(sc) {
    const list = this.loadScenarios();
    const item = {
      id: sc.id || 'sim_' + Date.now(),
      title: (sc.title || 'Новый сценарий').trim(),
      horizonDays: Number(sc.horizonDays) || 90,
      events: Array.isArray(sc.events) ? sc.events : [],
      updatedAt: new Date().toISOString()
    };
    const idx = list.findIndex(x => x.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list.slice(0, 25)));
    return item;
  },

  deleteScenario(id) {
    const list = this.loadScenarios().filter(x => x.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
  }
};
