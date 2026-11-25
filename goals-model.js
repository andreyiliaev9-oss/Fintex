/* Goal scenarios: integer kopecks, no storage, no implied investment return. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./finance-math.js'):root.FintexMath;
  function forecast(goal,today){
    const remaining=Math.max(0,M.add(goal.target,-Math.max(0,M.money(goal.saved))));
    const monthly=Math.max(0,M.money(goal.monthly));
    if(!remaining)return {remaining,months:0,date:today};
    if(!monthly)return {remaining,months:null,date:null};
    const months=Math.ceil(M.minor(remaining)/M.minor(monthly));
    if(months>1200||M.ordinal(today)===null)return {remaining,months,date:null};
    const [y,m,d]=today.split('-').map(Number),end=new Date(Date.UTC(y,m-1+months+1,0));
    const date=new Date(Date.UTC(y,m-1+months,Math.min(d,end.getUTCDate()))).toISOString().slice(0,10);
    return {remaining,months,date};
  }
  const api={forecast};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FintexGoalsModel=api;
})(typeof window!=='undefined'?window:globalThis);
