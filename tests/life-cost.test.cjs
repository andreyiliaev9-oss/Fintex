const test = require('node:test');
const assert = require('node:assert/strict');
const work = require('../life-cost.js');

test('working time uses explicit monthly net income and hours for the same period', () => {
  assert.deepEqual(work.calculate('3000','80000','160'), {minutes:360,hourlyRate:500});
  assert.equal(work.formatTime(work.calculate('750','80000','160').minutes),'1 ч 30 мин');
  assert.equal(work.calculate('1 250,50','80 000','160').minutes,150.06);
  assert.equal(work.calculate('500','100000','80').minutes,24);
});
test('time display rounds to minutes, never turns a tiny positive purchase into zero, and handles zero', () => {
  assert.equal(work.formatTime(0),'0 мин');
  assert.equal(work.formatTime(0.001),'Меньше 1 мин');
  assert.equal(work.formatTime(59.8),'1 ч');
  assert.equal(work.formatTime(1440),'24 ч');
  assert.equal(work.formatTime(Infinity),'—');
});
test('invalid amounts and income, impossible hours and extra precision are rejected without Infinity', () => {
  for (const bad of ['', '-1','Infinity','NaN','1e5','1.234','<script>', '0x10']) {
    assert.ok(work.calculate(bad,'80000','160').error, `price: ${bad}`);
    assert.ok(work.profile(bad,'160').error, `income: ${bad}`);
    assert.ok(work.profile('80000',bad).error, `hours: ${bad}`);
  }
  assert.ok(work.profile(0,160).error);
  assert.ok(work.profile(80000,0).error);
  assert.ok(work.profile(80000,744.01).error);
  assert.ok(work.profile(1000000001,160).error);
  assert.ok(work.calculate(1000000001,80000,160).error);
  assert.ok(!work.profile(80000,744).error);
  assert.ok(!work.profile('80\u202f000,50','152,5').error);
});
test('work profile writes only its own key and never stores purchase prices', () => {
  const values = new Map([['fp_balance','22200'],['fp_local_tx','[]']]);
  const storage = {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)};
  assert.deepEqual(work.read(storage),{data:null});
  assert.ok(work.write(storage,'80000','160').data);
  assert.deepEqual(work.read(storage).data,{version:1,monthlyIncome:80000,monthlyHours:160});
  assert.equal(values.size,3);
  assert.equal(values.get('fp_balance'),'22200');
  assert.equal(values.get('fp_local_tx'),'[]');
  const saved=values.get(work.KEY);
  assert.ok(work.write(storage,'-1','160').error);
  assert.equal(values.get(work.KEY),saved);
});
test('corrupt and unavailable storage is reported without silently overwriting it', () => {
  for (const value of ['bad','{}','null','{"version":1,"monthlyIncome":0,"monthlyHours":160}','{"version":1,"monthlyIncome":"80000","monthlyHours":160}']) {
    let writes=0;
    assert.ok(work.read({getItem:()=>value,setItem:()=>writes++}).error);
    assert.equal(writes,0);
  }
  const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  assert.ok(work.read(blocked).error);
  assert.ok(work.write(blocked,'80000','160').error);
});
