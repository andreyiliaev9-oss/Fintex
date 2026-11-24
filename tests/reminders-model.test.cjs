const test=require('node:test'),assert=require('node:assert/strict'),R=require('../backend/ReminderModel.gs');
const now=Date.UTC(2026,10,24,20,35),local={date:'2026-11-24',time:'20:35'},base=()=>({...R.defaults(),enabled:true,timezone:'UTC'}),ctx=()=>({lastSeen:'2026-11-24',registered:'2026-11-20',lastExpense:'2026-11-23',lastReceipt:'2026-11-20',bills:[]});
test('reminders are off by default; settings enforce types, supported timezone, daytime and selected types',()=>{
  assert.equal(R.defaults().enabled,false);assert.equal(R.due(R.defaults(),ctx(),{},local,now),null);
  for(const patch of [{enabled:'true'},{timezone:'Bad/Zone'},{time:'23:00'},{time:'08:59'},{reportTime:'19:99'},{reportFrequency:'hourly'},{receipts:false,expenses:false,bills:false,reports:false,goals:false}])assert.throws(()=>R.settings({...base(),...patch}));
  assert.equal(R.settings(base()).timezone,'UTC');
});
test('receipt inactivity is conditional language, does not invent detected purchases, and begins after three days',()=>{
  const p={...base(),expenses:false,reports:false,bills:false};assert.equal(R.due(p,{...ctx(),lastReceipt:'2026-11-23'}, {},local,now),null);
  const r=R.due(p,ctx(),{},local,now);assert.equal(r.kind,'receipts');assert.match(r.text,/Если были покупки/);assert.match(r.text,/Если покупок не было/);
  assert.equal(R.due(p,{...ctx(),lastReceipt:'',registered:local.date},{},local,now),null);
});
test('expense check is suppressed by a recorded operation today; no-activity snapshots expire after seven days',()=>{
  const p={...base(),receipts:false};assert.equal(R.due(p,{...ctx(),lastExpense:local.date},{},local,now),null);
  assert.equal(R.due(p,{...ctx(),lastSeen:'2026-11-16'},{},local,now),null);
  assert.equal(R.due(p,ctx(),{},local,now).kind,'expenses');
});
test('global quiet hours, late-window expiry, local-day dedup and rolling cooldown fail closed',()=>{
  for(const time of ['08:59','22:00','20:29'])assert.equal(R.due(base(),ctx(),{},{...local,time},now),null);
  assert.equal(R.due(base(),ctx(),{lastDay:local.date},local,now),null);
  assert.equal(R.due(base(),ctx(),{lastAt:now-19*3600000},local,now),null);
  assert.equal(R.due(base(),ctx(),{retryAfter:now+1000},local,now),null);
});
test('due bills have stable event keys and priority; already attempted bill never repeats',()=>{
  const c={...ctx(),bills:[{id:'b1',due:'2026-11-26'}]},r=R.due(base(),c,{},local,now);assert.equal(r.kind,'bills');
  assert.notEqual(R.due(base(),c,{sent:{[r.key]:now-86400000}},local,now)?.kind,'bills');
});
test('weekly report wins only on Sunday in its own time window, uses current partial week and no amounts by default',()=>{
  const l={date:'2026-11-29',time:'19:00'},n=Date.UTC(2026,10,29,19),r=R.due(base(),ctx(),{},l,n);assert.equal(r.kind,'reports');assert.equal(r.from,'2026-11-23');assert.equal(r.to,l.date);assert.ok(!r.text.includes('₽'));
  assert.equal(R.due(base(),ctx(),{sent:{[r.key]:n-10000}},l,n),null);
  assert.equal(R.due({...base(),reportFrequency:'daily'},ctx(),{},{date:'2026-11-24',time:'19:00'},now).kind,'reports');
});
test('choice rotation and per-kind three-day spacing reduce repetitive reminders',()=>{
  assert.equal(R.due(base(),ctx(),{byKind:{receipts:now-86400000}},local,now).kind,'expenses');
  assert.equal(R.due(base(),ctx(),{byKind:{receipts:now-86400000,expenses:now-86400000}},local,now),null);
  const w={date:'2026-11-25',time:'20:30'};assert.equal(R.due({...base(),receipts:false,expenses:false,reports:false,goals:true},{...ctx(),goalActive:true},{},w,now+86400000).kind,'goals');
});
test('context retains only minimal validated dates, ids and flags; older devices cannot erase latest recorded activity',()=>{
  const c=R.context({lastReceipt:'2026-99-99',lastExpense:'2026-11-25',lastSeen:'2099-01-01',goalActive:'true',balance:100,bills:[{id:'b1',due:'2026-11-25',amount:200,title:'private'},{id:'=FORMULA',due:'2026-11-25'}]},local.date,{lastReceipt:'2026-11-23'});
  assert.deepEqual(c,{lastSeen:local.date,lastReceipt:'2026-11-23',lastExpense:'',goalActive:false,bills:[{id:'b1',due:'2026-11-25'}]});
  assert.equal(R.date('2026-02-30'),null);assert.notEqual(R.date('2028-02-29'),null);
});
