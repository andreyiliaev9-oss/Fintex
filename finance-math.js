/* Shared, deterministic ruble arithmetic. Persisted schema stays in rubles;
 * additions/subtractions are done in integer kopecks. No storage or network. */
(function(root){
  'use strict';
  const DAY=86400000;
  function finite(value,fallback=0){const n=(typeof value==='number'||typeof value==='string'&&value.trim()!=='')?Number(value):NaN;return Number.isFinite(n)&&Math.abs(n)<=1e12?n:fallback;}
  function minor(value){const n=finite(value);return Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON*Math.abs(n))*100);}
  const money=value=>minor(value)/100;
  const add=(...values)=>values.reduce((sum,value)=>sum+minor(value),0)/100;
  function sum(items,get=x=>x){return items.reduce((total,item)=>total+minor(get(item)),0)/100;}
  function parse(value){const s=String(value??'').trim().replace(/[ \u00a0\u202f]/g,'').replace(',','.');return /^-?\d+(?:\.\d{1,2})?$/.test(s)&&Number.isFinite(Number(s))&&Math.abs(Number(s))<=1e12?money(s):null;}
  function ordinal(iso){if(typeof iso!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;const [y,m,d]=iso.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));return date.toISOString().slice(0,10)===iso?date.getTime()/DAY:null;}
  const shift=(iso,days)=>ordinal(iso)===null?null:new Date((ordinal(iso)+Math.trunc(days))*DAY).toISOString().slice(0,10);
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function txKey(tx){const raw=tx.date||tx.createdAt||tx.timestamp;if(ordinal(raw)!==null)return raw;if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(raw)||ordinal(raw.slice(0,10))===null)return null;const d=new Date(raw);return Number.isFinite(d.getTime())?key(d):null;}
  function daysUntil(iso,today){const end=ordinal(iso),start=ordinal(today);return end===null||start===null?1:Math.max(1,end-start);}
  function nextMonth(iso,anchor){if(ordinal(iso)===null)return null;const [y,m,d]=iso.split('-').map(Number);const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(Math.max(1,Math.trunc(finite(anchor,d))),last))).toISOString().slice(0,10);}
  function transactions(list,from,to){return (Array.isArray(list)?list:[]).filter(t=>t&&['income','expense'].includes(t.type)&&minor(t.amount)>0&&(!t.currency||['RUB','₽','РУБ'].includes(String(t.currency).toUpperCase()))).map(t=>({...t,amount:money(t.amount),date:txKey(t)})).filter(t=>t.date&&(!from||t.date>=from)&&(!to||t.date<=to));}
  const isBill=t=>!!t.bill_id || /^Платёж(?:$| \+)/.test(String(t.source||''));
  function goalSavings(goal){return add(Math.max(0,money(goal?.saved)),sum(Array.isArray(goal?.pockets)?goal.pockets:[],g=>Math.max(0,money(g?.saved))));}
  function metrics(state,today){
    const history=transactions(state.transactions,null,today).filter(t=>t.type==='expense');
    const variable=history.filter(t=>!isBill(t));
    const todaySpent=sum(variable.filter(t=>t.date===today),t=>t.amount);
    const totalTodaySpent=sum(history.filter(t=>t.date===today),t=>t.amount);
    const days=daysUntil(state.payday,today),horizon=shift(today,days);
    const billsReserved=sum((state.bills||[]).filter(b=>!b.is_paid&&ordinal(b.due_date)!==null&&b.due_date<=horizon),b=>Math.max(0,finite(b.amount)));
    const goalReserved=goalSavings(state.goal);
    const reserved=add(billsReserved,goalReserved), balance=money(state.balance);
    const freePool=Math.max(0,add(balance,-reserved));
    const dailyCap=Math.floor(Math.max(0,minor(balance)-minor(reserved)+minor(todaySpent))/days)/100;
    const dailyLeft=Math.max(0,add(dailyCap,-todaySpent));
    const pct=dailyCap>0?Math.min(100,Math.round(todaySpent/dailyCap*100)):todaySpent>0?100:0;
    const recent=variable.filter(t=>t.date>=shift(today,-29));
    const hasData=recent.length>0;
    const earliest=recent.reduce((min,t)=>t.date<min?t.date:min,today);
    const elapsedDays=ordinal(today)-ordinal(earliest)+1;
    const dailyBurn=hasData?money(sum(recent,t=>t.amount)/elapsedDays):0;
    // Current bank balance already contains today's payments and purchases.
    const remainingSpend=add(Math.max(0,add(dailyBurn,-todaySpent)),money(dailyBurn*(days-1)));
    const forecastBalance=hasData?add(balance,-billsReserved,-remainingSpend):null;
    return {todaySpent,totalTodaySpent,billsReserved,goalReserved,reserved,freePool,days,dailyCap,dailyLeft,pct,hasData,dailyBurn,forecastBalance};
  }
  function parseExpenses(raw){
    return String(raw||'').split(/;|\n|,(?!\d)|\s+и\s+(?=[а-яa-z])/i).map(text=>{
      if (/\d[.,]\d{3,}|-\s*\d|\d[eE][+-]?\d/.test(text)) return null;
      const matches=[...text.matchAll(/\d[\d \u00a0\u202f]*(?:[.,]\d{1,2})?(?![\d.,])/g)];
      const match=matches[matches.length-1];if(!match)return null;
      const amount=parse(match[0]);if(amount===null||amount<=0)return null;
      const merchant=(text.slice(0,match.index)+text.slice(match.index+match[0].length)).replace(/₽|руб(?:лей|ля|ль)?\.?/gi,'').trim()||'Покупка';
      return {merchant:merchant.charAt(0).toUpperCase()+merchant.slice(1),amount};
    }).filter(Boolean);
  }
  // Deliberately narrow import grammar: never guess money from an account,
  // transaction date or balance column in an unknown bank CSV layout.
  function parseStatement(text,today){
    return String(text||'').split(/\r?\n/).flatMap(line=>{
      const fields=line.trim().split(/[;\t]/).map(s=>s.trim().replace(/^"|"$/g,''));
      let date=today,merchant,raw;
      if(fields.length===3){[date,merchant,raw]=fields;}
      else if(fields.length===2){[merchant,raw]=fields;}
      else return [];
      const amount=parse(String(raw).replace(/^\+/,''));
      if(!merchant || ordinal(date)===null || date>today || amount===null || amount===0)return [];
      return [{date,merchant,amount:Math.abs(amount),type:String(raw).startsWith('+')?'income':'expense'}];
    });
  }
  const api={goalSavings,finite,minor,money,add,sum,parse,ordinal,shift,key,txKey,daysUntil,nextMonth,transactions,isBill,metrics,parseExpenses,parseStatement};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FintexMath=api;
})(typeof window==='undefined'?globalThis:window);
