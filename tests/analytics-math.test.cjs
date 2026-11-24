const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),M=require('../finance-math.js');
function analyze(st,days=7){
  class Clock extends Date{constructor(...args){super(...(args.length?args:[2026,10,24,12]));}}
  const ctx={window:{FintexMath:M,state:st},Date:Clock};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('analytics_pro.js','utf8'),ctx);
  return ctx.window.FintexAnalyticsPro.analyze(days);
}
const tx=(date,amount,more={})=>({date,amount,type:'expense',...more});
test('analytics current and previous periods are equal, non-overlapping local calendar windows',()=>{
  const data=analyze({balance:1000,transactions:[tx('2026-11-24',.1),tx('2026-11-18',.2),tx('2026-11-17',40),tx('2026-11-11',60),tx('2026-11-10',999),tx('2026-11-25',999),tx('2026-02-31',999),tx('2026-11-24',999,{currency:'USD'})]});
  assert.equal(data.spent,.3);assert.equal(data.prevSpent,100);assert.equal(data.currentTxs.length,2);assert.equal(data.categories[0].total,.3);assert.equal(data.net,-.3);
});
test('month forecast uses actual balance rather than double-counting recorded income or spending',()=>{
  const data=analyze({balance:5000,transactions:[tx('2026-11-01',2400),tx('2026-11-24',1000,{source:'Платёж'}),tx('2026-11-01',10000,{type:'income'})],bills:[{amount:300,due_date:'2026-11-30'},{amount:999,due_date:'2026-12-01'},{amount:999,due_date:'2026-11-24',is_paid:true}]},30);
  assert.equal(data.projectedBalance,4100);assert.equal(data.income,10000);assert.equal(data.spent,3400);
});
