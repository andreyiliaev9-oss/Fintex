const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../investments.js');
const memory = () => {const data=new Map();return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)};};

test('learning account starts with integer virtual cash and no real-budget references or APIs',()=>{
  const s=core.fresh(); assert.equal(s.cashKopecks,10000000); assert.ok(core.valid(s));
  assert.deepEqual(s.journal,[]); assert.deepEqual(s.completed,[]);
  const source=fs.readFileSync('investments.js','utf8');
  assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|WebSocket|calcMetrics|persistAll)\s*\(/);
  assert.doesNotMatch(source,/fp_balance|fp_local_tx|api[_-]?key/i);
});
test('schema rejects invalid balances, unknown lessons and oversized or duplicate notes',()=>{
  for(const cashKopecks of [0,-1,NaN,10000000.01,'10000000'])assert.equal(core.valid({...core.fresh(),cashKopecks}),false);
  assert.equal(core.valid({...core.fresh(),completed:['fake']}),false);
  assert.equal(core.valid({...core.fresh(),completed:['quotes','quotes']}),false);
  const n={id:'test',createdAt:new Date().toISOString(),company:'A',thesis:'reason',horizon:'year',risk:'loss'};
  assert.ok(core.valid({...core.fresh(),journal:[n]}));
  assert.equal(core.valid({...core.fresh(),journal:[n,n]}),false);
  assert.equal(core.valid({...core.fresh(),journal:[{...n,thesis:' '.repeat(5)}]}),false);
  assert.equal(core.valid({...core.fresh(),journal:[{...n,thesis:'x'.repeat(1201)}]}),false);
  assert.equal(core.valid({...core.fresh(),journal:[{...n,createdAt:'broken'}]}),false);
});
test('storage uses only the isolated key; invalid data is preserved, not silently reset',()=>{
  const storage=memory();storage.setItem('fp_balance','34567');
  const s=core.fresh();s.completed=['fees'];core.write(storage,s);
  assert.deepEqual(core.read(storage).data,s);assert.equal(storage.getItem('fp_balance'),'34567');
  storage.setItem(core.KEY,'{broken');assert.ok(core.read(storage).error);
  assert.equal(storage.getItem(core.KEY),'{broken');
  assert.throws(()=>core.write(storage,{version:5}));assert.equal(storage.getItem(core.KEY),'{broken');
});
test('unavailable storage is reported; all five lessons have a valid answer',()=>{
  assert.ok(core.read({getItem(){throw new Error('denied');}}).error);
  assert.throws(()=>core.write({setItem(){throw new Error('quota');}},core.fresh()));
  assert.equal(core.lessons.length,5);
  for(const l of core.lessons){assert.ok(Number.isInteger(l.answer));assert.ok(l.options[l.answer]);assert.ok(l.explanation.length>30);}
});
