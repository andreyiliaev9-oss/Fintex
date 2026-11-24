const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {summarize,variants}=require('../financial-tree-model.js');
const now=new Date(2026,10,24,15);
const tx=(type,amount,date='2026-11-24',more={})=>({type,amount,date,...more});

test('tree species follows the relative 30-day expense share, including exact thresholds',()=>{
  for(const [expense,variant] of [[1100,'birch'],[1000.01,'birch'],[1000,'spruce'],[900.01,'spruce'],[900,'maple'],[700.01,'maple'],[700,'oak'],[1,'oak']]) {
    const result=summarize([tx('income',1000),tx('expense',expense)],now);
    assert.equal(result.variant,variant,expense);
    assert.equal(result.income,1000);assert.equal(result.expenses,expense);
  }
  assert.equal(summarize([tx('income',10000),tx('expense',8000)],now).variant,summarize([tx('income',100),tx('expense',80)],now).variant);
});
test('incomplete, empty and zero-only records stay neutral rather than implying financial success/failure',()=>{
  for(const entries of [null,{},[],[tx('income',500)],[tx('expense',500)],[tx('income',0),tx('expense',0)]]) {
    const result=summarize(entries,now);assert.equal(result.variant,'sapling');assert.equal(result.ratio,null);
  }
});
test('date window covers exactly 30 local calendar days, excluding future, invalid and missing dates',()=>{
  const entries=[tx('income',1000,'2026-10-26'),tx('expense',700,'2026-11-24'),tx('income',5000,'2026-10-25'),tx('income',5000,'2026-11-25'),tx('income',5000,'2026-02-31'),tx('income',5000,'bad'),tx('income',5000,''),tx('income',5000,'2026-02-31T12:00:00Z')];
  const result=summarize(entries,now);
  assert.equal(result.from,'2026-10-26');assert.equal(result.to,'2026-11-24');
  assert.equal(result.income,1000);assert.equal(result.expenses,700);assert.equal(result.variant,'oak');
  assert.equal(summarize([tx('income',100,'2026-11-24T12:00:00'),tx('expense',20,'2026-11-24T14:00:00')],now).variant,'oak');
});
test('transfers, cash withdrawals, refunds, non-RUB and invalid amounts do not grow the tree',()=>{
  const ignored=[tx('income',10000,undefined,{op_kind:'transfer_in'}),tx('expense',10000,undefined,{op_kind:'transfer_out'}),tx('income',10000,undefined,{op_kind:'refund'}),tx('expense',10000,undefined,{op_kind:'atm'}),tx('income',10000,undefined,{currency:'USD'}),tx('unknown',10000),tx('income',Infinity),tx('income','oops'),tx('income',{}),tx('income',Number.MAX_VALUE),tx('income',null)];
  const result=summarize([tx('income',1000),tx('expense',-800),...ignored],now);
  assert.equal(result.variant,'maple');assert.equal(result.income,1000);assert.equal(result.expenses,800);
  assert.equal(result.incomeCount,1);assert.equal(result.expenseCount,1);
});
test('rounding and selection are deterministic and do not mutate financial records',()=>{
  const entries=[tx('income',.1),tx('income',.2),tx('expense',.21)];
  const before=JSON.stringify(entries);const result=summarize(entries,now);
  assert.equal(result.income,.3);assert.equal(result.expenses,.21);assert.equal(result.variant,'oak');
  assert.equal(JSON.stringify(entries),before);
  assert.deepEqual(result,summarize(entries,now));
});
test('all five species have separate local SVG art with no remote resources',()=>{
  const artwork=new Set();
  for(const name of Object.keys(variants)) {
    const svg=fs.readFileSync(`assets/trees/${name}.svg`,'utf8');
    assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|<image|https?:\/\/(?!www.w3.org)/);
    artwork.add(svg);
  }
  assert.equal(artwork.size,5);
});
