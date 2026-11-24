/* A visual reading of recorded cash flow, not a credit score or a forecast. */
(function (root) {
  'use strict';
  const variants = {
    sapling: {name:'Молодое дерево', note:'Добавьте доходы и расходы за 30 дней — дерево подстроится под их соотношение.'},
    birch: {name:'Берёза', note:'За 30 дней записано больше расходов, чем доходов. Это может быть месяц крупной покупки.'},
    spruce: {name:'Ель', note:'Доходы и расходы за 30 дней близки: на расходы уходит больше 90% поступлений.'},
    maple: {name:'Клён', note:'За 30 дней на расходы уходит больше 70% и до 90% поступлений — часть дохода остаётся.'},
    oak: {name:'Дуб', note:'За 30 дней расходы составляют не больше 70% поступлений — есть запас между доходами и тратами.'}
  };
  const localKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function txDate(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y,m,d]=raw.split('-').map(Number), date=new Date(y,m-1,d);
      return localKey(date) === raw ? date : null;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) return null;
    // Reject invalid calendar dates even if Date would roll them into a new month.
    if (!txDate(raw.slice(0,10))) return null;
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function summarize(transactions, now = new Date()) {
    const end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const from = new Date(now.getFullYear(),now.getMonth(),now.getDate()-29);
    let incomeCents=0, expenseCents=0, incomeCount=0, expenseCount=0;
    for (const tx of Array.isArray(transactions) ? transactions : []) {
      if (!tx || typeof tx !== 'object') continue;
      const kind=String(tx.op_kind || tx.kind || '').toLowerCase();
      if (/transfer|перевод|refund|возврат|atm/.test(kind)) continue;
      if (tx.currency && !['RUB','₽','РУБ'].includes(String(tx.currency).toUpperCase())) continue;
      const type=String(tx.type || '').toLowerCase();
      if (!['income','expense','доход','расход'].includes(type)) continue;
      const date=txDate(tx.date || tx.createdAt || tx.timestamp);
      if (!date || date < from || date >= end) continue;
      if (!['number','string'].includes(typeof tx.amount) || String(tx.amount).trim() === '') continue;
      const amount=Math.abs(Number(tx.amount));
      const cents=Math.round(amount*100);
      if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents <= 0) continue;
      if (type==='income' || type==='доход') {
        if (!Number.isSafeInteger(incomeCents+cents)) continue;
        incomeCents+=cents; incomeCount++;
      } else {
        if (!Number.isSafeInteger(expenseCents+cents)) continue;
        expenseCents+=cents; expenseCount++;
      }
    }
    // Without both sides of the ledger, don't imply that no recorded spending
    // is financial success, or that no recorded salary is zero actual income.
    let variant='sapling', ratio=null;
    if (incomeCount && expenseCount) {
      ratio=expenseCents/incomeCents;
      variant=ratio>1?'birch':ratio>.9?'spruce':ratio>.7?'maple':'oak';
    }
    return {variant,ratio,income:incomeCents/100,expenses:expenseCents/100,incomeCount,expenseCount,from:localKey(from),to:localKey(new Date(now)),...variants[variant]};
  }
  const api={summarize,variants};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  root.FintexTreeModel=api;
})(typeof window==='undefined'?globalThis:window);
