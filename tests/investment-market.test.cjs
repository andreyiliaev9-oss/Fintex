const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../investment-market.js');
const core=require('../investments.js');
const order=(p,overrides={})=>({id:'trade-'+p.trades.length,generation:p.generation,revision:p.trades.length,acknowledged:true,instrumentId:'XNAS:AAPL',side:'buy',priceMinor:10000,quantity:2,...overrides});

test('reference catalogue has unique exchange-qualified identifiers and no built-in prices',()=>{
  assert.equal(market.stocks.length,8);assert.equal(new Set(market.stocks.map(s=>s.id)).size,8);
  for(const s of market.stocks){assert.ok(['RUB','USD','EUR'].includes(s.currency));assert.ok(s.source.startsWith('https://'));assert.equal(s.price,undefined);assert.ok(s.id.includes(':'));}
});
test('manual price parser rejects invalid decimals, excess precision and unsafe amounts',()=>{
  assert.equal(market.minor('100,25'),10025);assert.equal(market.minor('0.01'),1);
  for(const n of ['0','-1','1.111','1e3','NaN','Infinity','10000000.01','1,000,000'])assert.throws(()=>market.minor(n));
  for(const q of [0,-1,1.5,NaN,'1e3',1000001])assert.throws(()=>market.quantity(q));
  assert.throws(()=>market.costs(10,'2'));assert.throws(()=>market.costs(1e9,1e6));
});
test('buy, partial sale and final sale account for fees and allocate all basis in integer units',()=>{
  let p=market.newPractice();const initial=structuredClone(p);
  p=market.execute(p,order(p));assert.deepEqual(initial.trades,[]);
  let s=market.summary(p);assert.equal(s.cash.USD,979940);assert.equal(s.positions['XNAS:AAPL'].cost,20060);
  p=market.execute(p,order(p,{side:'sell',quantity:1,priceMinor:12000}));s=market.summary(p);
  assert.equal(s.realized.USD,1934);assert.deepEqual(s.positions['XNAS:AAPL'],{quantity:1,cost:10030});
  p=market.execute(p,order(p,{side:'sell',quantity:1}));s=market.summary(p);
  assert.deepEqual(s.positions['XNAS:AAPL'],{quantity:0,cost:0});assert.equal(s.cash.USD,1001874);assert.equal(s.realized.USD,1874);
  assert.equal(s.cash.RUB,10000000);assert.equal(s.cash.EUR,1000000);
});
test('practice rejects overspend, naked sale, wrong generations, unconfirmed and stale requests',()=>{
  const p=market.newPractice();
  assert.throws(()=>market.execute(p,order(p,{priceMinor:1000000})),/Не хватает/);
  assert.throws(()=>market.execute(p,order(p,{side:'sell'})),/больше акций/);
  assert.throws(()=>market.execute(p,order(p,{generation:'old'})),/сброшен/);
  assert.throws(()=>market.execute(p,order(p,{acknowledged:false})),/Подтвердите/);
  assert.throws(()=>market.execute(p,order(p,{revision:1})),/изменился/);
  assert.throws(()=>market.execute(p,order(p,{instrumentId:'unknown'})),/не найдена/);
  assert.throws(()=>market.execute(p,order(p,{quantity:'2'})),/целым/);
});
test('idempotent retry cannot execute twice or change the original order',()=>{
  const p=market.newPractice(),o=order(p);const next=market.execute(p,o);
  assert.deepEqual(market.execute(next,o),next);
  assert.throws(()=>market.execute(next,{...o,priceMinor:1}),/отличается/);
  const invalid=structuredClone(next);invalid.trades.push(invalid.trades[0]);assert.throws(()=>market.summary(invalid));
});
test('legacy lessons and notes migrate without loss and corrupted trade data is preserved',()=>{
  const n={id:'note',createdAt:new Date().toISOString(),company:'Apple',thesis:'Понять риск',horizon:'год',risk:'падение'};
  let raw=JSON.stringify({version:1,cashKopecks:core.INITIAL_CASH,completed:['fees'],journal:[n]});
  const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};
  const result=core.read(storage);assert.equal(result.error,'');assert.equal(result.data.version,2);
  assert.deepEqual(result.data.completed,['fees']);assert.deepEqual(result.data.journal,[n]);assert.equal(JSON.parse(raw).version,1);
  const o=order(result.data.practice);result.data.practice=market.execute(result.data.practice,o);core.write(storage,result.data);
  assert.equal(core.read(storage).data.practice.trades.length,1);
  const data=JSON.parse(raw);data.practice.trades[0].quantity='2';raw=JSON.stringify(data);
  assert.ok(core.read(storage).error);assert.equal(JSON.parse(raw).practice.trades[0].quantity,'2');
});

test('repeated partial sales allocate the exact remaining cost without rounding money into existence',()=>{
  let p=market.newPractice();p=market.execute(p,order(p,{quantity:7,priceMinor:12345}));
  for(let i=0;i<7;i++)p=market.execute(p,order(p,{side:'sell',quantity:1,priceMinor:13001+i}));
  const s=market.summary(p);assert.deepEqual(s.positions['XNAS:AAPL'],{quantity:0,cost:0});
  assert.equal(s.cash.USD-market.INITIAL.USD,s.realized.USD);
  assert.ok(Number.isSafeInteger(s.cash.USD));
});
