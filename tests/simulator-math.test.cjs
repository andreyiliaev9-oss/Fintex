const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const M=require('../finance-math.js');
const fixed=new Date(2026,10,24,12);
function engine(state={}){
  class Clock extends Date { constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed.getTime();} }
  const ctx={window:{FintexMath:M,state},Date:Clock,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('sim_engine.js','utf8'),ctx);return ctx.window.FINTEX_SIM;
}
function flat(){const sim=engine();sim.captureRealitySnapshot=()=>({balance:10000,liquidBalance:8000,cushionSaved:2000,estMonthlyIncome:0,estMonthlyVariableSpend:0,activeBillsMonthly:0,baseScore:50});return sim;}
const purchase=(more={})=>({type:'purchase',amount:9000,dayOffset:0,useCredit:true,downPayment:0,creditRate:0,creditMonths:3,isAsset:true,...more});

test('annuity matches independent reference, accepts zero interest and remains finite for extremes',()=>{
  const sim=engine();assert.equal(sim.calcAnnuityPayment(100000,12,12),8884.88);assert.equal(sim.calcAnnuityPayment(1000,0,12),83.33);
  assert.equal(sim.calcAnnuityPayment(0,12,12),0);
  assert.equal(sim.calcAnnuityPayment(1000,1e-12,12),83.33);
  assert.ok(Number.isFinite(sim.calcAnnuityPayment(1000000,1000,1200)));
});
test('goal is a reserved part of bank balance, never extra net worth',()=>{
  const result=flat().simulateScenario({horizonDays:30,events:[]});
  assert.equal(result.endCash,8000);assert.equal(result.endNetWorth,10000);assert.equal(result.netWorthDelta,0);assert.equal(result.cushionMonths,null);
});
test('zero-interest principal amortizes fully and debt service stops at maturity',()=>{
  const sim=flat(),scenario={horizonDays:90,events:[purchase()]};
  const month1=sim.simulateScenario({...scenario,horizonDays:30});assert.equal(month1.debtRemaining,6000);assert.equal(month1.endCash,5000);assert.equal(month1.endNetWorth,10000);
  const final=sim.simulateScenario(scenario),later=sim.simulateScenario({...scenario,horizonDays:180});
  assert.equal(final.debtRemaining,0);assert.equal(final.monthlyDebtService,0);assert.equal(final.endCash,-1000);assert.equal(final.endNetWorth,10000);assert.equal(later.endCash,final.endCash);
});
test('interest/principal split matches amortization, including final adjustment',()=>{
  const sim=flat(),event=purchase({amount:12000,creditRate:12,creditMonths:12});
  const pmt=sim.calcAnnuityPayment(12000,12,12);
  const first=sim.simulateScenario({horizonDays:30,events:[event]});
  assert.equal(first.debtRemaining,Math.round(12000+120-pmt));
  let debt=12000,total=0;
  for(let i=0;i<12;i++){const due=M.add(debt,M.money(debt*.01)),paid=i===11?due:Math.min(due,pmt);debt=M.add(due,-paid);total=M.add(total,paid);}
  const result=sim.simulateScenario({horizonDays:360,events:[event]});
  assert.equal(result.debtRemaining,0);assert.equal(result.endCash,Math.round(8000-total));assert.equal(result.netWorthDelta,Math.round(12000-total));
});
test('loan starts on specified day, horizon is bounded and zero presets remain zero',()=>{
  const sim=flat();const before=sim.simulateScenario({horizonDays:29,events:[purchase()]});assert.equal(before.debtRemaining,9000);assert.equal(before.endCash,8000);
  assert.equal(sim.simulateScenario({horizonDays:30,events:[purchase({dayOffset:1})]}).debtRemaining,9000);
  assert.equal(sim.simulateScenario({horizonDays:Infinity}).horizonDays,90);assert.equal(sim.simulateScenario({horizonDays:1000000}).horizonDays,1825);
});
test('snapshot excludes future/old history and paid bills from variable costs; recurring and one-off costs separate',()=>{
  const tx=(type,amount,date='2026-11-24',more={})=>({type,amount,date,...more});
  const sim=engine({balance:10000,goal:{saved:2000},payday:'2026-12-04',transactions:[tx('expense',100),tx('expense',100,'2026-11-23'),tx('expense',100,'2026-10-26'),tx('expense',10000,'2026-10-25'),tx('expense',10000,'2026-12-01'),tx('expense',1000,'2026-11-24',{source:'Платёж'}),tx('income',10000)],bills:[{amount:500,is_recurring:true,due_date:'2026-12-01'},{amount:1000,is_recurring:false,due_date:'2026-12-01'}]});
  const snap=sim.captureRealitySnapshot();assert.equal(snap.estMonthlyVariableSpend,300);assert.equal(snap.activeBillsMonthly,500);assert.equal(snap.oneOffBills.length,1);assert.equal(snap.liquidBalance,8000);
});
test('multiple savings goals reduce liquid cash but do not disappear from net worth',()=>{
  const sim=engine({balance:10000,goal:{title:'Подушка',saved:1000,target:10000,pockets:[{saved:2500}]},transactions:[],bills:[]});
  const snap=sim.captureRealitySnapshot();assert.equal(snap.liquidBalance,6500);assert.equal(snap.cushionSaved,1000);assert.equal(snap.otherGoalsReserved,2500);
  sim.captureRealitySnapshot=()=>({...snap,estMonthlyIncome:0,estMonthlyVariableSpend:0,activeBillsMonthly:0});
  const result=sim.simulateScenario({horizonDays:30});assert.equal(result.endCash,6500);assert.equal(result.endNetWorth,10000);assert.equal(result.netWorthDelta,0);
});
