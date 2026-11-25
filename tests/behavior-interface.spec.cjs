const {test,expect}=require('@playwright/test');
const M=require('../finance-math.js');
function history(){const tx=[];for(let date='2026-05-01';date<='2026-11-04';date=M.shift(date,1)){
  const day=Number(date.slice(8)),wd=new Date(date+'T00:00:00Z').getUTCDay();
  if(day===1)tx.push({id:'salary_'+date,type:'income',amount:60000,date,merchant:'Зарплата',category:'other'});
  tx.push({id:'expense_'+date,type:'expense',amount:(day<=5?400:100)*([0,6].includes(wd)?2:1),date,merchant:'Продукты',category:'food'});
  if(wd===3)tx.push({id:'delivery_'+date,type:'expense',amount:300,date,merchant:'Яндекс Еда',category:'cafe'});
  if(day>=25)for(let i=0;i<3;i++)tx.push({id:'small_'+date+'_'+i,type:'expense',amount:50,date,merchant:'Мелкая покупка',category:'shop'});
}tx.push({id:'big',type:'expense',amount:7000,date:'2026-11-03',merchant:'Большая покупка',category:'food'});return tx;}
async function open(page,{empty=false}={}){
  await page.clock.install({time:new Date('2026-11-04T12:00:00Z')});
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(tx=>{if(localStorage.getItem('behavior_fixture'))return;localStorage.setItem('behavior_fixture','1');
    for(const [k,v] of Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_balance:'250000',fp_local_tx:JSON.stringify(tx),fp_visual_style:'growth',fp_theme:'light'}))localStorage.setItem(k,v);
  },empty?[]:history());
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexBehavior&&!!window.FintexAnalyticsPro&&!!window.FINTEX_SIM?.ui);
  await page.evaluate(()=>dismissReturningSplash());await page.locator('[data-nav="analytics"]').click();
  await expect(page.locator('#fintex-behavior')).toBeVisible();
}
const snapshot=page=>page.evaluate(()=>JSON.stringify({balance:state.balance,goal:state.goal,transactions:state.transactions}));
test('patterns and explicit feedback persist, planned purchase is not a psychological trait or ledger edit',async({page})=>{
  await open(page);const before=await snapshot(page),panel=page.locator('#fintex-behavior');
  await expect(panel.locator('.behavior-insight')).toHaveCount(4);await expect(panel.locator('.behavior-scenario')).toContainText('Первые дни после зарплаты');
  await panel.locator('[data-behavior-useful="delivery"]').click();await expect(panel.locator('.behavior-insight').first()).toContainText('Доставка');
  await panel.locator('[data-behavior-dismiss="weekend"]').click();await expect(panel.locator('.behavior-insight')).toHaveCount(3);
  await panel.locator('[data-behavior-planned="big"]').click();await expect(panel.locator('.behavior-unusual')).toHaveCount(0);
  expect(await snapshot(page)).toBe(before);
  await page.reload();await page.waitForFunction(()=>!!window.FintexAnalyticsPro);await page.evaluate(()=>{dismissReturningSplash();goTab('analytics');});
  await expect(panel.locator('[data-behavior-useful="delivery"]')).toHaveAttribute('aria-pressed','true');await expect(panel.locator('[data-behavior-dismiss="weekend"]')).toHaveCount(0);
  await panel.locator('[data-behavior-restore]').click();await expect(panel.locator('.behavior-insight')).toHaveCount(4);
});
test('empty state and invalid plans are honest; valid plan is illustrative and reset preserves money',async({page})=>{
  await open(page,{empty:true});const before=await snapshot(page),panel=page.locator('#fintex-behavior');
  await expect(panel).toContainText('Повторяющиеся закономерности пока не подтверждены');await expect(panel).toContainText('Недостаточно истории');
  await panel.locator('.behavior-planner > summary').click();await panel.locator('[name="remaining"]').fill('100000');await panel.locator('[name="monthly"]').fill('-1');
  await panel.getByRole('button',{name:'Сохранить мой план'}).click();await expect(panel.locator('.behavior-status')).toContainText('положительные суммы');
  await panel.locator('[name="monthly"]').fill('5000,50');await panel.getByRole('button',{name:'Сохранить мой план'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).plan.monthly)).toBe(5000.5);expect(await snapshot(page)).toBe(before);
  await panel.getByRole('button',{name:'Сохранить мой план'}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).planChanges)).toBe(1);
  await panel.locator('.behavior-settings > summary').click();page.once('dialog',d=>d.accept());await panel.locator('[data-behavior-reset]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).plan)).toBeUndefined();expect(await snapshot(page)).toBe(before);
});
test('only actual validated cushion actions are observed, undo is accounted for, opt-out stops collection',async({page})=>{
  await open(page,{empty:true});
  await page.evaluate(()=>{quickTopupGoal(1000);closeModals();withdrawFromGoal(200,true);closeModals();});
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).savingsEvents.map(e=>e.delta))).toEqual([1000,-200]);
  await page.evaluate(()=>{const tx=state.transactions.find(t=>t.goal_withdrawal);deleteTxsBatch([tx.id]);undoLastTxDelete();});
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).savingsEvents.map(e=>e.delta))).toEqual([1000,-200,200,-200]);
  await page.evaluate(()=>{quickTopupGoal(999999999);withdrawFromGoal(0);closeModals();});
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).savingsEvents.length)).toBe(4);
  const panel=page.locator('#fintex-behavior');await panel.locator('.behavior-settings > summary').click();await panel.locator('[data-behavior-disable]').click();
  await page.evaluate(()=>{quickTopupGoal(100);closeModals();});expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).savingsEvents.length)).toBe(4);
  await panel.locator('[data-behavior-enable]').click();expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).savingsEvents)).toEqual([]);
});
test('panel fits narrow screens in every complementary theme; privacy hides text amounts and forms',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});const panel=page.locator('#fintex-behavior');
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.evaluate(()=>togglePrivacy());await expect(panel.locator('.behavior-insight').first()).toBeHidden();await expect(panel.locator('.behavior-planner')).toBeHidden();
  await page.evaluate(()=>{togglePrivacy();setVisualStyle('growth');setTheme('light');});await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'* { scroll-behavior: auto !important; }'});await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/behavior-preview.png'});
});
test('malicious transaction labels stay plain text and storage failure gives recoverable feedback',async({page})=>{
  await open(page);await page.evaluate(()=>{state.transactions.find(t=>t.id==='big').merchant='<img src=x onerror="window.__unsafe=true">';FintexAnalyticsPro.render();});
  await expect(page.locator('.behavior-unusual h4')).toContainText('<img');expect(await page.evaluate(()=>window.__unsafe)).toBeUndefined();
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('quota');};});await page.locator('[data-behavior-useful="delivery"]').click();await expect(page.locator('.behavior-status')).toContainText('Не удалось');
});
test('refined observations have Russian labels and accessible evidence disclosures that survive reactions',async({page})=>{
  await open(page);const panel=page.locator('#fintex-behavior');await expect(panel.locator('h3')).toContainText('Поведенческий');
  expect(await panel.innerText()).not.toMatch(/[a-z]/i);
  await expect(panel.locator('.behavior-metrics > div')).toHaveCount(3);
  const evidence=panel.locator('[data-behavior-detail="delivery"]');await evidence.locator('summary').click();await expect(evidence.locator('.behavior-evidence')).toBeVisible();
  await panel.locator('[data-behavior-useful="delivery"]').click();await expect(evidence).toHaveAttribute('open');
  const profile=panel.locator('[data-behavior-detail="profile-unusual"]');await profile.locator('summary').click();await expect(profile.locator('.behavior-evidence')).toBeVisible();
  const unusual=panel.locator('.behavior-unusual-list');await unusual.locator('summary').click();await expect(unusual).not.toHaveAttribute('open');
  await page.locator('[data-period="week"]').click();await expect(profile).toHaveAttribute('open');await expect(unusual).not.toHaveAttribute('open');
  await page.evaluate(()=>{setVisualStyle('forest');setTheme('light');});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});await page.setViewportSize({width:390,height:1000});await panel.locator('.behavior-insights').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/behavior-observations-preview.png'});
});
test('savings pace has a live personal scenario, persists only on save, and fits every theme',async({page})=>{
  await open(page,{empty:true});const before=await snapshot(page),planner=page.locator('.behavior-planner');await planner.locator('summary').click();await expect(planner.locator('[data-savings-duration]')).toHaveText('—');
  await planner.locator('[name="remaining"]').fill('100000');await planner.locator('[name="monthly"]').fill('5000');await expect(planner.locator('[data-savings-duration]')).toHaveText('20 мес.');
  expect(await page.evaluate(()=>JSON.parse(localStorage.fp_behavior_v1).plan)).toBeUndefined();expect(await snapshot(page)).toBe(before);
  await planner.locator('[name="monthly"]').fill('0');await expect(planner.locator('[data-savings-duration]')).toHaveText('—');await planner.locator('[name="monthly"]').fill('5000,50');await planner.getByRole('button',{name:'Сохранить мой план'}).click();await expect(planner.locator('[data-savings-duration]')).toHaveText('20 мес.');
  expect(await snapshot(page)).toBe(before);await page.setViewportSize({width:320,height:740});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});expect(await planner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
  await page.evaluate(()=>{setVisualStyle('forest');setTheme('light');});await page.setViewportSize({width:390,height:1000});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});await planner.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/savings-pace-preview.png'});
  await page.evaluate(()=>togglePrivacy());await expect(planner).toBeHidden();
});
