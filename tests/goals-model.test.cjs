const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../goals-model.js'),M=require('../finance-math.js');
test('all savings envelopes are reserved exactly once without changing legacy behavior',()=>{
  assert.equal(M.goalSavings({saved:100.01}),100.01);
  const goal={saved:100.01,pockets:[{saved:200.02},{saved:0},{saved:-1000},{saved:Infinity}]};
  assert.equal(M.goalSavings(goal),300.03);
  const m=M.metrics({balance:1000.05,goal,transactions:[],bills:[{amount:50,due_date:'2026-11-24'}],payday:'2026-12-04'},'2026-11-24');
  assert.equal(m.freePool,650.02);assert.equal(m.reserved,350.03);assert.equal(goal.saved,100.01);
});
test('forecast uses explicit monthly contribution, integer kopecks and clamps month ends',()=>{
  assert.deepEqual(G.forecast({target:100,saved:10,monthly:30},'2026-11-24'),{remaining:90,months:3,date:'2027-02-24'});
  assert.equal(G.forecast({target:1,monthly:1},'2027-01-31').date,'2027-02-28');
  assert.equal(G.forecast({target:1,monthly:1},'2028-01-31').date,'2028-02-29');
  assert.equal(G.forecast({target:1,monthly:1},'2026-12-31').date,'2027-01-31');
  assert.equal(G.forecast({target:.3,saved:.1,monthly:.1},'2026-11-24').months,2);
});
test('no invented forecast without a plan, overfunding and extreme inputs remain safe',()=>{
  assert.equal(G.forecast({target:100,saved:1},'2026-11-24').date,null);
  assert.equal(G.forecast({target:100,saved:1,monthly:-1},'2026-11-24').months,null);
  assert.equal(G.forecast({target:100,saved:150,monthly:1},'2026-11-24').months,0);
  assert.equal(G.forecast({target:1e12,monthly:.01},'2026-11-24').date,null);
  assert.equal(G.forecast({target:100,monthly:Infinity},'2026-11-24').date,null);
});
