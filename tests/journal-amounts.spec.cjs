const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_onboarded:'1',fp_motion:'0',fp_name:'Анна',fp_visual_style:'forest',fp_theme:'dark',fp_balance:'100000',fp_local_tx:JSON.stringify([
    {id:'advance',date:'2026-11-18',merchant:'Аванс',type:'income',amount:100000,category:'income'},
    {id:'pharmacy',date:'2026-11-18',merchant:'Аптека',type:'expense',amount:800,category:'health'},
    {id:'fuel',date:'2026-11-18',merchant:'АЗС',type:'expense',amount:300,category:'transport'},
    {id:'kopecks',date:'2026-11-17',merchant:'Кофейня',type:'expense',amount:285.5,category:'cafe'}
  ])}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexGoals&&!!window.FintexAnalyticsPro);await page.evaluate(()=>dismissReturningSplash());await page.addStyleTag({content:'html { scroll-behavior: auto !important; }'});
}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,tx:state.transactions,goal:state.goal,stored:localStorage.getItem('fp_local_tx')}));
test('screenshot amounts get real grouping, separate accounting signs and readable fixed kopecks without changing values',async({page})=>{
  await open(page);const before=await snapshot(page),amount=page.locator('[data-operation-row=advance] .tx-amount');
  await expect(amount).toHaveAttribute('aria-label','+100 000 ₽');await expect(amount.locator('.number-sign')).toHaveText('+');await expect(amount.locator('.number-group')).toHaveText(['100','000']);expect(await amount.locator('.number-separator').evaluate(el=>parseFloat(getComputedStyle(el).width))).toBeGreaterThan(3);
  await expect(page.locator('[data-operation-row=kopecks] .tx-amount')).toHaveAttribute('aria-label','−285,50 ₽');await expect(page.locator('[data-operation-row=kopecks] .number-minor')).toHaveText(',50');await expect(page.locator('[data-operation-row=pharmacy] .number-minor')).toHaveCount(0);
  const totals=page.locator('.tx-day-totals').first();await expect(totals).toContainText('Доходы');await expect(totals).toContainText('Расходы');await expect(totals.locator('[data-journal-prefix="−"]')).toHaveAttribute('aria-label','−1 100 ₽');
  const right=await page.locator('.tx-amount .number-currency').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().right));expect(Math.max(...right)-Math.min(...right)).toBeLessThan(.6);expect(await amount.evaluate(el=>parseFloat(getComputedStyle(el).letterSpacing)||0)).toBe(0);
  expect(await snapshot(page)).toBe(before);
});
test('journal money stays contained and menu targets remain separate in six palettes, narrow screens and very large amounts',async({page})=>{
  await open(page);await page.evaluate(()=>{state.transactions.unshift({id:'large',date:'2026-11-18',merchant:'Очень длинное название операции с подробностями',type:'expense',amount:999999999999.99,category:'other'});renderHome();});const before=await snapshot(page);
  for(const width of [320,390,448]){await page.setViewportSize({width,height:844});for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    const rows=await page.locator('.tx-swipe-content').evaluateAll(els=>els.map(el=>{const a=el.querySelector('.tx-amount').getBoundingClientRect(),menu=el.querySelector('.tx-row-menu').getBoundingClientRect(),open=el.querySelector('.tx-row-open').getBoundingClientRect();return {fits:el.scrollWidth<=el.clientWidth,separate:a.right+3<=menu.left,contained:a.left>=open.left-1&&a.right<=open.right+1,target:menu.width>=44};}));expect(rows.every(r=>r.fits&&r.separate&&r.contained&&r.target)).toBe(true);expect(await page.locator('.tx-day-totals').first().evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }}expect(await snapshot(page)).toBe(before);
});
test('refined amounts keep operation actions, keyboard opening and stealth semantics',async({page})=>{
  await open(page);const before=await snapshot(page);await page.locator('[data-operation-row=fuel] .tx-row-open').focus();await page.keyboard.press('Enter');await expect(page.locator('#modal-tx')).toBeVisible();await page.keyboard.press('Escape');await page.locator('[data-operation-row=pharmacy] .tx-row-menu').click();await expect(page.locator('[data-operation-row=pharmacy] .tx-swipe-actions')).toHaveAttribute('aria-hidden','false');await page.evaluate(()=>{cancelTxSwipe();toggleStealthMode(true);});
  for(const amount of await page.locator('#tx-feed .journal-number').all()){await expect(amount).toHaveAttribute('aria-label','Сумма скрыта');await expect.poll(()=>amount.evaluate(el=>parseFloat(getComputedStyle(el).filter.match(/blur\(([^p]+)/)?.[1])||0)).toBeGreaterThanOrEqual(7);}
  expect(await snapshot(page)).toBe(before);
});
test('review previews reproduce the supplied three-operation day in dark Forest and the light palette',async({page})=>{
  await open(page);for(const mode of ['dark','light']){await page.evaluate(mode=>setTheme(mode),mode);await page.locator('.tx-day-card').first().screenshot({path:`.cache/v66-journal-${mode}.png`,style:'body > nav, #capture-fab { visibility: hidden !important; }'});}
});
