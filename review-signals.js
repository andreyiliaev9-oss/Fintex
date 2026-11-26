/* Observations only. Never confirms bank charges, removes records or changes money. */
(function(root){
  'use strict';
  function build(expenses){
    const groups=new Map(),categories=new Map();let total=0;
    for(const tx of expenses){
      const amount=Math.round(Number(tx.amount)*100);if(!Number.isSafeInteger(amount)||amount<=0)continue;
      total+=amount;categories.set(tx.category,(categories.get(tx.category)||0)+amount);
      const merchant=String(tx.merchant||'').trim(),key=JSON.stringify([tx.date,merchant.toLocaleLowerCase('ru-RU'),amount]);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(tx);
    }
    const signals=[];
    for(const rows of groups.values())if(rows.length>1){
      const times=rows.map(t=>t.time).filter(t=>typeof t==='string'&&/^\d{2}:\d{2}(?::\d{2})?$/.test(t));
      // An identical recorded time is a reason to review, still not proof of a duplicate.
      const sameTime=new Set(times).size<times.length;
      signals.push({kind:'similar',level:sameTime?'review':'info',merchant:String(rows[0].merchant||''),date:rows[0].date,amount:Number(rows[0].amount),count:rows.length});
    }
    if(expenses.length>=2)for(const [category,amount]of categories){const share=Math.round(amount/total*100);if(share>=55)signals.push({kind:'share',level:'info',category,amount:amount/100,share});}
    return signals;
  }
  const api={build};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexReviewSignals=api;
})(typeof window==='undefined'?globalThis:window);
