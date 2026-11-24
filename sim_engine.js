/* ============================================================================
 * FINTEX Life Simulator — Шаг 1: Изолированный математический движок (sim_engine.js)
 * Модель будущего на основе реальных данных FINTEX без изменения счетов и истории.
 * ============================================================================ */

window.FINTEX_SIM = window.SIM = Object.assign(window.FINTEX_SIM || {}, {
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

    const M = window.FintexMath;
    const today = M.key(new Date());
    const recent = M.transactions(txs, M.shift(today,-29), today);
    const recentExpenses = recent.filter(t=>t.type==='expense' && !M.isBill(t));
    const recentIncomes = recent.filter(t=>t.type==='income');
    const totalExp30 = M.sum(recentExpenses,t=>t.amount);
    const totalInc30 = M.sum(recentIncomes,t=>t.amount);
    const activeBillsMonthly = M.sum(bills.filter(b=>!b.is_paid && b.is_recurring),b=>Math.max(0,M.finite(b.amount)));
    const m = typeof calcMetrics === 'function' ? calcMetrics() : M.metrics(s,today);
    const hasEnoughExpenseData = recentExpenses.length >= 3;
    const estMonthlyVariableSpend = hasEnoughExpenseData ? totalExp30 : M.money(m.dailyCap*30);

    const hasIncomeData = recentIncomes.length > 0;
    const estMonthlyIncome = hasIncomeData
      ? totalInc30
      : M.add(estMonthlyVariableSpend,activeBillsMonthly);

    const balance = M.money(s.balance);
    const cushionSaved = Math.max(0, M.money(goal.saved));
    const baseScore = typeof calcDetailedRating === 'function' ? (calcDetailedRating().total ?? 50) : 50;

    return {
      capturedAt: new Date().toISOString(),
      balance,
      cushionSaved,
      liquidBalance: M.add(balance,-cushionSaved),
      oneOffBills: bills.filter(b=>!b.is_paid && !b.is_recurring && M.ordinal(b.due_date)!==null).map(b=>({amount:Math.max(0,M.money(b.amount)),day:Math.max(0,M.ordinal(b.due_date)-M.ordinal(today))})),
      goalTitle: goal.title || 'Финансовая подушка',
      goalTarget: Math.max(0.01, M.money(goal.target) || 10000),
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
    const M=window.FintexMath;
    const P=Math.max(0,M.finite(principal));
    const n=Math.min(1200,Math.max(1,Math.round(M.finite(months,12))));
    const r=Math.min(1000,Math.max(0,M.finite(annualRatePct)))/1200;
    if (!P) return 0;
    if (!r) return M.money(P/n);
    // Stable for tiny rates and long terms: avoids Infinity/Infinity and 0/0.
    return M.money(P*r / -Math.expm1(-n*Math.log1p(r)));
  },

  // Детерминированное моделирование сценария на заданный горизонт (в днях)
  simulateScenario(scenario = {}, mode = 'base') {
    const M=window.FintexMath;
    const snap = this.captureRealitySnapshot();
    const horizonDays = Math.min(1825,Math.max(7,Math.round(M.finite(scenario.horizonDays,90))));
    const events = Array.isArray(scenario.events) ? scenario.events : [];

    // Коэффициенты чувствительности для 3 вариантов будущего
    const mult = mode === 'optimistic'
      ? { inc: 1.08, exp: 0.92, extraOneOff: 0.90 }
      : mode === 'pessimistic'
        ? { inc: 0.88, exp: 1.14, extraOneOff: 1.15 }
        : { inc: 1.00, exp: 1.00, extraOneOff: 1.00 };

    let cash = M.money(snap.liquidBalance ?? M.add(snap.balance,-snap.cushionSaved));
    let cushion = snap.cushionSaved;
    let assetsValue = 0;
    let debtRemaining = 0;
    let monthlyIncome = snap.estMonthlyIncome * mult.inc;
    let monthlyExpenses = (snap.estMonthlyVariableSpend + snap.activeBillsMonthly) * mult.exp;
    let monthlyDebtService = 0;
    const loans = [];

    let minCash = cash;
    let cashGapDay = null;
    const timeline = [];
    const appliedEvents = [];

    for (let day = 0; day <= horizonDays; day++) {
      // 1. Применяем события, наступающие в этот день
      events.filter(ev=>ev && typeof ev==='object').forEach(ev => {
        const evDay = Math.max(0, Math.round(M.finite(ev.dayOffset)));
        if (evDay !== day) return;

        const cost = Math.max(0, M.finite(ev.amount));
        const downPayment = ev.useCredit ? Math.min(cost, Math.max(0, M.finite(ev.downPayment))) : cost;
        const oneOff = M.money((downPayment + Math.max(0,M.finite(ev.oneOffExtra))) * mult.extraOneOff);
        const deltaMonthlyInc = M.finite(ev.monthlyIncomeDelta) * mult.inc;
        const deltaMonthlyExp = M.finite(ev.monthlyExpenseDelta) * mult.exp;

        if (ev.type === 'windfall') {
          cash = M.add(cash,M.money(cost * mult.inc),-Math.max(0,M.finite(ev.oneOffExtra))*mult.extraOneOff);
        } else {
          cash = M.add(cash,-oneOff);
        }

        if (ev.type!=='windfall' && ev.isAsset && cost > 0) {
          assetsValue += cost;
        }

        if (ev.type!=='windfall' && ev.useCredit && cost > downPayment) {
          const loan = cost - downPayment;
          const rate = Math.min(1000,Math.max(0,M.finite(ev.creditRate,18)));
          const months = Math.min(1200,Math.max(1,Math.round(M.finite(ev.creditMonths,36))));
          const pmt = this.calcAnnuityPayment(loan, rate, months);
          loans.push({balance:loan,rate:rate/1200,pmt,months,paid:0,start:day});
        }

        monthlyIncome = Math.max(0, monthlyIncome + deltaMonthlyInc);
        monthlyExpenses = Math.max(0, monthlyExpenses + deltaMonthlyExp);
        appliedEvents.push({ day, title: ev.title || 'Событие', type: ev.type });
      });

      // Flat ordinary cash flow is a scenario assumption; loans are repaid
      // every 30 days, with actual interest/principal split and a final payoff.
      if (day > 0) cash += (monthlyIncome-monthlyExpenses)/30;
      (snap.oneOffBills || []).forEach(bill=>{if(bill.day===day)cash=M.add(cash,-bill.amount*mult.exp);});
      loans.forEach(loan=>{
        if (loan.balance<=0 || day<=loan.start || (day-loan.start)%30!==0) return;
        const interest=M.money(loan.balance*loan.rate);
        const due=M.add(loan.balance,interest);
        const payment=loan.paid+1>=loan.months?due:Math.min(due,loan.pmt);
        cash-=payment;
        loan.balance=Math.max(0,M.add(due,-payment));loan.paid++;
      });
      debtRemaining=M.sum(loans,l=>l.balance);
      monthlyDebtService=M.sum(loans.filter(l=>l.balance>0),l=>l.pmt);

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
    const startNetWorth = Math.round(snap.balance);
    const totalMonthlyOutflow = Math.max(0,monthlyExpenses + monthlyDebtService);
    const cushionMonths = totalMonthlyOutflow>0 ? Math.round((Math.max(0,endCash+cushion)/totalMonthlyOutflow)*10)/10 : null;

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
  },

  onModuleReady() {
    try { this.ui?.injectEntryCards?.(); } catch (e) {}
    try {
      const m = document.getElementById('modal-life-sim');
      if (m && !m.classList.contains('hidden')) {
        this.ui?.render?.();
      }
    } catch (e) {}
  }
});

try { window.FINTEX_SIM.onModuleReady(); } catch (e) {}
