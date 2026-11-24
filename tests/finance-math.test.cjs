const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../finance-math.js');
const today='2026-11-24';
const tx=(amount,date=today,more={})=>({amount,date,type:'expense',...more});
const state=(more={})=>({balance:1000,payday:'2026-12-04',goal:{saved:0},bills:[],transactions:[],...more});

test('kopeck arithmetic preserves signed balances and reversibility without floating point residue',()=>{
  assert.equal(M.add(.1,.2),.3);assert.equal(M.add(100,-150.25),-50.25);
  assert.equal(M.money(1.005),1.01);assert.equal(M.money(-1.005),-1.01);
  assert.equal(M.parse('1 234,56'),1234.56);assert.equal(M.parse('NaN'),null);
  for(let i=1;i<5000;i+=13){const balance=(i-2500)/100,expense=(i*17%90000)/100;assert.equal(M.add(M.add(balance,-expense),expense),balance);}
});
test('calendar arithmetic clamps month ends and preserves recurrence anchors independently of DST',()=>{
  assert.equal(M.nextMonth('2026-01-31'),'2026-02-28');
  assert.equal(M.nextMonth('2026-02-28',31),'2026-03-31');
  assert.equal(M.nextMonth('2028-01-31'),'2028-02-29');
  assert.equal(M.daysUntil('2026-03-30','2026-03-27'),3);
  assert.equal(M.daysUntil('2026-10-27','2026-10-24'),3);
  assert.equal(M.ordinal('2026-02-31'),null);assert.equal(M.daysUntil('bad',today),1);
});
test('zero money yields zero daily allowance, not an invented ruble',()=>{
  const m=M.metrics(state({balance:0}),today);assert.equal(m.dailyCap,0);assert.equal(m.dailyLeft,0);assert.equal(m.pct,0);assert.equal(m.forecastBalance,null);
  assert.equal(M.metrics(state({balance:-500}),today).dailyLeft,0);
});
test('daily budget reserves savings and bills due by payday only, rounding down to a kopeck',()=>{
  const m=M.metrics(state({balance:1000.01,goal:{saved:200},bills:[{amount:100,due_date:today},{amount:9999,due_date:'2027-01-01'},{amount:9999,due_date:today,is_paid:true}]}),today);
  assert.equal(m.reserved,300);assert.equal(m.freePool,700.01);assert.equal(m.dailyCap,70);assert.equal(m.dailyLeft,70);
  assert.ok(M.minor(m.dailyCap)*m.days<=M.minor(m.freePool));
});
test('forecast does not subtract today twice or extrapolate years-old/future expenses into current spending',()=>{
  const m=M.metrics(state({transactions:[tx('100'),tx(99999,'2026-12-01'),tx(99999,'2025-01-01'),tx(Infinity),tx(999,'bad')]}),today);
  assert.equal(m.todaySpent,100);assert.equal(m.dailyBurn,100);assert.equal(m.dailyCap,110);assert.equal(m.forecastBalance,100);
  const sameDay=M.metrics(state({payday:today,transactions:[tx(100)]}),today);assert.equal(sameDay.forecastBalance,1000);
  assert.equal(M.metrics(state({transactions:[tx(500,'2025-01-01')]}),today).hasData,false);
});
test('paid scheduled bills are not also counted as ordinary budget consumption or variable burn',()=>{
  const before=M.metrics(state({bills:[{amount:100,due_date:today,is_recurring:true}]}),today);
  const after=M.metrics(state({balance:900,bills:[{amount:100,due_date:'2026-12-24',is_recurring:true}],transactions:[tx(100,today,{source:'Платёж'})]}),today);
  assert.equal(before.freePool,after.freePool);assert.equal(before.dailyCap,after.dailyCap);assert.equal(after.todaySpent,0);assert.equal(after.totalTodaySpent,100);
});
test('expense parsing preserves decimal comma/dot, multiple purchases and rejects negative/excess precision',()=>{
  assert.deepEqual(M.parseExpenses('Кофе 350,50, такси 200.25; хлеб 49,25').map(x=>x.amount),[350.5,200.25,49.25]);
  assert.equal(M.parseExpenses('Ноутбук 1 234,56')[0].amount,1234.56);
  for(const text of ['Кофе -100','Кофе 1.234','Кофе 1e6','Кофе Infinity'])assert.equal(M.parseExpenses(text).length,0,text);
});
test('today spending cannot create a positive allowance when savings and bills exceed available cash',()=>{
  const m=M.metrics(state({balance:50,goal:{saved:200},transactions:[tx(100)]}),today);
  assert.equal(m.freePool,0);assert.equal(m.dailyCap,0);assert.equal(m.dailyLeft,0);
});
test('statement import never treats dates or account numbers as amounts and recognizes signed income',()=>{
  const items=M.parseStatement('2026-11-23;Магазин;-123,45\nЗарплата;+50 000,01\n24.11.2026,4081781000000,100\n2026-12-01;Будущее;10\nbad;Дата;10\nКофе;1.234\nКофе;Infinity',today);
  assert.deepEqual(items,[{date:'2026-11-23',merchant:'Магазин',amount:123.45,type:'expense'},{date:today,merchant:'Зарплата',amount:50000.01,type:'income'}]);
});
test('adding receipt details to a paid bill cannot reclassify it as a second variable expense',()=>{
  const m=M.metrics(state({transactions:[tx(100,today,{source:'Платёж + Чек'})]}),today);
  assert.equal(m.totalTodaySpent,100);assert.equal(m.todaySpent,0);assert.equal(m.dailyBurn,0);
});
