const {test,expect}=require('@playwright/test');
async function open(page){
  await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_visual_style:'forest',fp_theme:'light',fp_balance:'75420.51',fp_bills:'[]',fp_local_tx:JSON.stringify([
    {id:'salary',date:'2026-11-24',time:'12:00',merchant:'Зарплата',type:'income',amount:85000.75,category:'income'},
    {id:'food',date:'2026-11-24',time:'11:30',merchant:'ВкусВилл',type:'expense',amount:2450.26,category:'food'},
    {id:'coffee',date:'2026-11-24',time:'09:30',merchant:'Кофейня у парка',type:'expense',amount:285.5,category:'cafe'},
    {id:'taxi',date:'2026-11-23',merchant:'Такси',type:'expense',amount:680,category:'taxi'},
    {id:'income',date:'2026-11-23',merchant:'За проект',type:'income',amount:15000,category:'income'},
    {id:'old',date:'2026-11-22',merchant:'Дом',type:'expense',amount:1499.99,category:'home'}
  ])}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FintexGoals);await page.evaluate(()=>dismissReturningSplash());
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal,bills:state.bills}));
async function motion(page){await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();window.__opEffects=[];const orig=Element.prototype.animate;Element.prototype.animate=function(...args){const a=orig.apply(this,args);window.__opEffects.push({a,target:this});return a;};});}
test('journal keeps exact signs and kopecks, clearer subunits and keyboard-openable records',async({page})=>{
  await open(page);const before=await snapshot(page);
  await expect(page.locator('[data-operation-row=salary] .tx-amount')).toHaveAttribute('aria-label','+85 000,75 ₽');await expect(page.locator('[data-operation-row=food] .tx-amount')).toHaveAttribute('aria-label','−2 450,26 ₽');
  const ratio=await page.locator('[data-operation-row=food] .tx-amount').evaluate(el=>parseFloat(getComputedStyle(el.querySelector('.number-minor')).fontSize)/parseFloat(getComputedStyle(el).fontSize));expect(ratio).toBeGreaterThanOrEqual(.8);
  await expect(page.locator('.tx-day-card').first().locator('.tx-day-totals')).toContainText('2 735,76');await expect(page.locator('.tx-day-kicker').first()).toHaveText('3 показано');
  const row=page.locator('[data-operation-row=food] .tx-swipe-content');await row.focus();await page.keyboard.press('Enter');await expect(page.locator('#modal-tx')).toBeVisible();expect(await snapshot(page)).toBe(before);
});
test('replay choreographs rows, icons, actual amounts and light sweep, with finite timing and no writes',async({page})=>{
  await open(page);const before=await snapshot(page);await motion(page);await page.locator('#tx-feed').scrollIntoViewIfNeeded();await page.locator('#history-replay').click();
  const effects=await page.evaluate(()=>window.__opEffects.filter(x=>x.a.id.startsWith('fintex-operation-')).map(x=>({id:x.a.id,cls:x.target.className,timing:x.a.effect.getTiming(),frames:x.a.effect.getKeyframes()})));
  expect(effects.some(e=>e.id==='fintex-operation-reveal')).toBe(true);for(const cls of ['tx-amount','tx-merchant-mark','tx-arrival-glow'])expect(effects.some(e=>e.cls.includes(cls))).toBe(true);
  for(const e of effects){expect(e.timing.iterations).toBe(1);expect(e.timing.duration).toBeLessThanOrEqual(750);expect(e.frames.every(f=>!f.filter||!f.filter.includes('blur'))).toBe(true);}
  expect(await snapshot(page)).toBe(before);await expect(page.locator('[data-operation-row=food] .tx-amount')).toHaveAttribute('aria-label','−2 450,26 ₽');
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('fintex-operation-')).length)).toBe(0);await expect(page.locator('#history-replay')).toBeHidden();
});
test('arrival animates only new records and reduced motion cancels all layers',async({page})=>{
  await open(page);await motion(page);await page.locator('#tx-feed').scrollIntoViewIfNeeded();
  const effects=await page.evaluate(()=>{window.__opEffects=[];state.transactions.unshift({id:'new',date:TODAY,time:'23:59',merchant:'Новая покупка',type:'expense',amount:.01,category:'other'});renderHome();return window.__opEffects.filter(x=>x.a.id==='fintex-operation-reveal').map(x=>x.target.dataset.operationRow);});expect(effects).toEqual(['new']);
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('fintex-operation-')).length)).toBe(0);await expect(page.locator('[data-operation-row=new] .tx-amount')).toHaveAttribute('aria-label','−0,01 ₽');
  await page.evaluate(()=>{window.__opEffects=[];replayOperationHistory();});expect(await page.evaluate(()=>window.__opEffects.filter(x=>x.a.id.startsWith('fintex-operation-')).length)).toBe(0);
});
test('cashflow has exact comparable tracks, real difference, precise typography and no false account balance',async({page})=>{
  await open(page);const before=await snapshot(page);await page.evaluate(()=>goTab('analytics'));
  await expect(page.locator('.ftx-ap-big')).toHaveText('4 915,75 ₽');await expect(page.locator('[data-flow=income] .number-display')).toHaveAttribute('aria-label','100 000,75 ₽');await expect(page.locator('.ap-cashflow-net .number-display')).toHaveAttribute('aria-label','+95 085 ₽');await expect(page.locator('.ap-cashflow-note')).toContainText('Это не остаток');
  const widths=await page.locator('.ap-cashflow-track > span').evaluateAll(els=>els.map(el=>parseFloat(el.style.width)));expect(widths[0]).toBe(100);expect(widths[1]).toBeCloseTo(4.915713,4);
  await page.evaluate(()=>{state.transactions=state.transactions.filter(t=>t.type==='expense');FintexAnalyticsPro.render();});await expect(page.locator('.ap-cashflow-net .number-display')).toHaveAttribute('aria-label','-4 915,75 ₽');await expect(page.locator('[data-flow=income] .number-display')).toHaveText('0 ₽');
  // Restore fixture only to check that presentation never wrote the ledger to storage.
  expect(await page.evaluate(()=>localStorage.getItem('fp_local_tx'))).toBe(JSON.stringify(JSON.parse(before).transactions));
});
test('journal and overview fit all six themes at 320px, with extreme amounts and privacy',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{state.transactions.unshift({id:'huge',date:TODAY,time:'23:59',merchant:'Очень длинное название магазина для проверки',type:'expense',amount:123456789012.34,category:'other'});renderAll(false);});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);goTab('home');},{style,mode});expect(await page.locator('#tx-feed').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
    await page.evaluate(()=>goTab('analytics'));expect(await page.locator('.ap-cashflow').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
  }
  await page.evaluate(()=>toggleStealthMode(true));await expect(page.locator('.ftx-ap-big')).toHaveAttribute('aria-label','Сумма скрыта');await expect(page.locator('.ap-cashflow-track').first()).toBeHidden();await page.evaluate(()=>goTab('home'));await expect(page.locator('.tx-amount').first()).toHaveAttribute('aria-label','Сумма скрыта');
});
test('journal and money-flow previews show the refined visual system',async({page})=>{
  await open(page);await page.locator('#tx-feed').evaluate(el=>el.parentElement.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/journal-preview.png'});
  await page.evaluate(()=>{setTheme('dark');goTab('analytics');});await page.locator('.ap-cashflow').evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:'docs/cashflow-preview.png'});
});
test('income and selected backgrounds stay opaque over swipe actions, and replay controls fit with motion on',async({page})=>{
  await open(page);await motion(page);await page.setViewportSize({width:320,height:844});await page.locator('#tx-feed').scrollIntoViewIfNeeded();
  expect(await page.locator('.tx-feed-header').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const alpha=await page.locator('[data-operation-row=salary] .tx-swipe-content').evaluate(el=>getComputedStyle(el).backgroundColor);expect(alpha).not.toMatch(/rgba\(.*0\.\d+\)/);
  await page.evaluate(()=>toggleTxSelectMode(true,'salary'));expect(await page.locator('[data-operation-row=salary] .tx-swipe-content').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});
test('cashflow bars animate once from their real widths and stop when motion is disabled',async({page})=>{
  await open(page);await motion(page);const before=await snapshot(page);await page.evaluate(()=>goTab('analytics'));await page.locator('.ap-cashflow').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>window.__opEffects.filter(x=>x.target.matches('.ap-cashflow-track > span')).length)).toBe(2);
  const timing=await page.evaluate(()=>window.__opEffects.filter(x=>x.target.matches('.ap-cashflow-track > span')).map(x=>x.a.effect.getTiming()));expect(timing.every(t=>t.iterations===1&&t.duration<=700)).toBe(true);
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBe(0);expect(await snapshot(page)).toBe(before);
});
