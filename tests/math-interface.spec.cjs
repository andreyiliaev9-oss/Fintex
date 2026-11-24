const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.addInitScript(()=>{localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_name','Тест');localStorage.setItem('fp_motion','0');});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FINTEX_SIM?.ui);await page.evaluate(()=>dismissReturningSplash());
  await page.evaluate(()=>{state.balance=100;state.transactions=[];state.bills=[];state.goal={title:'Резерв',target:10000,saved:0};state.payday=offsetDateISO(10);persistAll();renderAll(false);});
}
test('negative balance, kopecks, deletion and repeated undo preserve the ledger',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    addOrMergeTransactions([{merchant:'Кофе',amount:150.25,date:TODAY,type:'expense'}],'Вручную');
    const after=state.balance,id=state.transactions[0].id;
    deleteTxById(id);const deleted=state.balance;undoLastTxDelete();undoLastTxDelete();
    return {after,deleted,final:state.balance,count:state.transactions.length};
  });
  expect(result).toEqual({after:-50.25,deleted:100,final:-50.25,count:1});
});
test('intentional identical purchases are distinct but retrying the same imported hash is idempotent',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    const t={merchant:'Кофе',amount:.1,date:TODAY,type:'expense'};
    addOrMergeTransactions([t,t],'Вручную');
    const manual=state.transactions.length;
    const imported={...t,amount:.2,dedup_hash:'stable-import-id'};
    addOrMergeTransactions([imported],'Импорт');addOrMergeTransactions([imported],'Импорт');
    return {manual,count:state.transactions.length,balance:state.balance,ids:new Set(state.transactions.map(t=>t.id)).size};
  });
  expect(result).toEqual({manual:2,count:3,balance:99.6,ids:3});
});
test('bill payment is guarded; delete/undo restores bill state as well as cash',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    state.bills=[{id:'one',title:'Счёт',amount:150.01,due_date:TODAY,is_recurring:false,is_paid:false}];
    payBill('one');payBill('one');const paid={balance:state.balance,count:state.transactions.length,isPaid:state.bills[0].is_paid};
    deleteTxById(state.transactions[0].id);const deleted={balance:state.balance,isPaid:state.bills[0].is_paid};undoLastTxDelete();undoLastTxDelete();
    return {paid,deleted,final:state.balance,isPaid:state.bills[0].is_paid};
  });
  expect(result).toEqual({paid:{balance:-50.01,count:1,isPaid:true},deleted:{balance:100,isPaid:false},final:-50.01,isPaid:true});
});
test('reserve transfers do not create money; direct spending and undo restore both balances',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    document.getElementById('inp-goal-target').value='0.01';saveGoalSettings();
    state.goal.saved=.01;openGoalDetailsModal();
    if(document.getElementById('gd-bar').style.width!=='100%')throw new Error('Sub-ruble goal percentage');
    state.goal.saved=0;
    quickTopupGoal(40.25);quickTopupGoal(Infinity);quickTopupGoal(1000);
    const funded={balance:state.balance,saved:state.goal.saved};withdrawFromGoal(.25,true);const id=state.transactions[0].id;
    const spent={balance:state.balance,saved:state.goal.saved};deleteTxById(id);const deleted={balance:state.balance,saved:state.goal.saved};undoLastTxDelete();
    return {funded,spent,deleted,final:{balance:state.balance,saved:state.goal.saved}};
  });
  expect(result).toEqual({funded:{balance:100,saved:40.25},spent:{balance:99.75,saved:40},deleted:{balance:100,saved:40.25},final:{balance:99.75,saved:40}});
});
test('reconciliation uses edited balance and preserves a sub-ruble adjustment; speech and SMS preserve kopecks',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    selectDetectedBalance(200);document.getElementById('inp-reconcile').value='99.75';document.getElementById('bal-log-diff-chk').checked=true;applyReconcile();
    return {balance:state.balance,amount:state.transactions[0]?.amount,type:state.transactions[0]?.type,voice:parseSpokenRussianExpenses('кофе 150,25').map(t=>t.amount),sms:parseBankSmsOrClipboard('Покупка 123,45 RUB. Магазин. Баланс 99,75 RUB')};
  });
  expect(result.balance).toBe(99.75);expect(result.amount).toBe(.25);expect(result.type).toBe('expense');expect(result.voice).toEqual([150.25]);expect(result.sms.amount).toBe(123.45);expect(result.sms.cardBalance).toBe(99.75);
});
test('simulator modules load once, without overwriting UI after initialization',async({page})=>{
  await open(page);const scripts=await page.evaluate(()=>['sim_engine.js','sim_ui.js','sim_charts.js','sim_pro.js'].map(name=>[...document.scripts].filter(s=>s.src.includes('/'+name)).length));expect(scripts).toEqual([1,1,1,1]);
});
test('future dates and foreign currencies do not enter ruble ledger; one-kopeck price changes are retained',async({page})=>{
  await open(page);
  const result=await page.evaluate(()=>{
    addOrMergeTransactions([{merchant:'Будущее',amount:100,date:offsetDateISO(1),type:'expense'},{merchant:'USD',amount:100,date:TODAY,type:'expense',currency:'USD'}],'Вручную');
    state.priceHistory={};recordProductPrice('Молоко',100,'Магазин',TODAY);recordProductPrice('Молоко',100.01,'Магазин',TODAY);recordProductPrice('Молоко',100.01,'Магазин',TODAY);recordProductPrice('Молоко',Infinity,'Магазин',TODAY);
    return {balance:state.balance,count:state.transactions.length,prices:Object.values(state.priceHistory)[0].records.map(x=>x.price)};
  });
  expect(result).toEqual({balance:100,count:0,prices:[100,100.01]});
});
test('batch delete and undo restore dependent recurring bill cycles in chronological order',async({page})=>{
  await open(page);
  await page.clock.install({time:new Date('2026-01-31T12:00:00Z')});
  await page.evaluate(()=>{state.bills=[{id:'rec',title:'Подписка',amount:10.01,due_date:'2026-01-31',is_recurring:true,is_paid:false}];payBill('rec');});
  await page.clock.setSystemTime(new Date('2026-02-28T12:00:00Z'));
  const result=await page.evaluate(()=>{
    payBill('rec');const paid={balance:state.balance,due:state.bills[0].due_date};
    // The feed can have arbitrary ordering after a previous undo.
    state.transactions.reverse();deleteTxsBatch(state.transactions.map(t=>t.id));const deleted={balance:state.balance,due:state.bills[0].due_date};
    undoLastTxDelete();undoLastTxDelete();return {paid,deleted,final:{balance:state.balance,due:state.bills[0].due_date}};
  });
  expect(result).toEqual({paid:{balance:79.98,due:'2026-03-31'},deleted:{balance:100,due:'2026-01-31'},final:{balance:79.98,due:'2026-03-31'}});
});
