const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../behavior-model.js'),M=require('../finance-math.js');
const today='2026-11-04';
function history(){
  const tx=[];for(let date='2026-05-01';date<=today;date=M.shift(date,1)){
    const day=Number(date.slice(8)),weekend=[0,6].includes(new Date(date+'T00:00:00Z').getUTCDay());
    if(day===1)tx.push({id:'salary_'+date,type:'income',amount:60000,date,merchant:'Зарплата',category:'other'});
    tx.push({id:'expense_'+date,type:'expense',amount:(day<=5?400:100)*(weekend?2:1),date,merchant:'Продукты',category:'food'});
    if(new Date(date+'T00:00:00Z').getUTCDay()===3)tx.push({id:'delivery_'+date,type:'expense',amount:300,date,merchant:'Яндекс Еда',category:'cafe'});
    if(day>=25)for(let i=0;i<3;i++)tx.push({id:'small_'+date+'_'+i,type:'expense',amount:50,date,merchant:'Мелкая покупка',category:'shop'});
  }
  tx.push({id:'big',type:'expense',amount:7000,date:'2026-11-03',merchant:'Запланированная покупка?',category:'food'});return tx;
}
const analyze=(more={})=>B.analyze({transactions:history(),today,...more});
test('longitudinal patterns cite repeated independent intervals and expose the current salary scenario',()=>{
  const r=analyze();const ids=r.insights.map(x=>x.id);
  for(const id of ['weekend','payday','month-end','delivery'])assert.ok(ids.includes(id),id);
  for(const i of r.insights){assert.ok(i.evidence.samples>=3);assert.ok(i.evidence.from<=i.evidence.to);}
  assert.equal(r.currentScenario.days,4);assert.equal(r.currentScenario.income,60000);
  assert.ok(r.unusual.some(t=>t.id==='big'));assert.ok(r.planning.monthly>0);
});
test('short or sparse histories do not fabricate behavioral traits or a savings pace',()=>{
  for(const transactions of [[],history().filter(t=>t.date>='2026-10-25'),history().filter(t=>t.date.endsWith('-01'))]){
    const r=B.analyze({transactions,today});assert.equal(r.profile.saving,null);assert.equal(r.profile.spending,null);assert.equal(r.planning,null);assert.equal(r.currentScenario,null);assert.equal(r.unusual.length,0);
  }
});
test('income alone is not salary; bills, refunds, transfers, future/invalid dates and foreign currencies are excluded from habits',()=>{
  const transactions=history().map(t=>t.type==='income'?{...t,merchant:'Пополнение'}:t);
  const clean=B.analyze({transactions,today});assert.ok(!clean.insights.some(i=>i.id==='payday'));assert.equal(clean.currentScenario,null);
  const noisy=[...transactions,{id:'future',type:'expense',amount:999999,date:'2026-11-05',category:'food'}, {id:'bad',type:'expense',amount:999999,date:'2026-02-30'}, {id:'foreign',type:'expense',amount:999999,date:'2026-11-02',currency:'USD'}, ...['transfer_in','transfer_out','refund','atm'].map((op_kind,i)=>({id:'exclude'+i,type:'expense',amount:999999,op_kind,date:'2026-11-02',category:'food'}))];
  assert.deepEqual(B.analyze({transactions:noisy,today}),clean);
  const bills=B.analyze({transactions:[...transactions,{id:'bill',bill_id:'monthly',type:'expense',amount:1000000,date:'2026-11-01',category:'food'}],today});assert.equal(bills.expenseCount,clean.expenseCount);assert.equal(bills.unusual.length,clean.unusual.length);
});
test('unusual amount uses prior comparable purchases, not future/self data, and planned marks do not change ledger totals',()=>{
  const r=analyze(),planned=analyze({planned:{big:true}});
  assert.ok(r.unusual.find(t=>t.id==='big').count>=12);assert.ok(!planned.unusual.some(t=>t.id==='big'));
  assert.equal(planned.records,r.records);assert.equal(planned.activeDays,r.activeDays);
  const isolated=B.analyze({transactions:[{id:'x',date:today,type:'expense',amount:7000,category:'food'}],today});assert.equal(isolated.unusual.length,0);
});
test('feedback affects visibility and order, never computed evidence; cooldown expires',()=>{
  const original=analyze(),changed=analyze({feedback:{weekend:{dismissedUntil:'2026-12-04'},delivery:{useful:true}}});
  assert.ok(!changed.insights.some(x=>x.id==='weekend'));assert.equal(changed.insights[0].id,'delivery');assert.equal(changed.hiddenCount,1);
  assert.deepEqual(changed.insights.find(x=>x.id==='delivery').evidence,original.insights.find(x=>x.id==='delivery').evidence);
  assert.ok(analyze({feedback:{weekend:{dismissedUntil:'2026-11-03'}}}).insights.some(i=>i.id==='weekend'));
});
test('savings regularity starts from explicitly observed events, not goal balance or apparent free cash',()=>{
  assert.equal(analyze({goal:{saved:100000}}).profile.saving,null);
  const events=[];for(let m=5;m<=10;m++){const prefix=`2026-${String(m).padStart(2,'0')}`;events.push({date:prefix+'-03',delta:1000},{date:prefix+'-10',delta:-200});}
  const r=analyze({observedSince:'2026-05-01',savingsEvents:events});assert.equal(r.profile.saving.months,5);assert.equal(r.profile.saving.positive,5);assert.equal(r.planning.basis,'saving');assert.equal(r.planning.monthly,800);
  assert.equal(analyze({observedSince:'2026-11-01',savingsEvents:events}).profile.saving,null);
});
test('duplicate IDs and input order do not amplify observations; model is pure',()=>{
  const transactions=history(),copy=JSON.stringify(transactions);const a=B.analyze({transactions,today}),b=B.analyze({transactions:[...transactions].reverse().concat(transactions.filter(t=>t.id==='big')),today});
  assert.deepEqual(a,b);assert.equal(JSON.stringify(transactions),copy);
});
test('insufficient category baselines do not masquerade as zero unusual spending',()=>{
  const transactions=history().map((t,i)=>({...t,category:'unique_'+i}));const r=B.analyze({transactions,today});assert.equal(r.profile.unusual,null);assert.equal(r.unusual.length,0);
});
test('known lack of net cushion saving is not overridden by theoretical free cash flow',()=>{
  const r=analyze({observedSince:'2026-05-01',savingsEvents:[]});assert.equal(r.profile.saving.positive,0);assert.equal(r.planning,null);
  const tiny=history().map(t=>({...t,amount:t.type==='income'?1:.01}));const low=B.analyze({transactions:tiny,today});assert.ok(low.planning===null||low.planning.monthly>=.01);
});
test('all periods are bounded, missing today fails closed, and payday dismissal also hides its scenario',()=>{
  assert.throws(()=>B.analyze({transactions:history()}),/today/);const r=analyze({feedback:{payday:{dismissedUntil:'2026-12-01'}}});assert.equal(r.currentScenario,null);
  const s=analyze({observedSince:'2020-01-01',savingsEvents:[]});assert.ok(s.profile.saving.from>=M.shift(today,-182));
  assert.ok(B.analyze({today:'2028-03-01'}).records===0);
});
