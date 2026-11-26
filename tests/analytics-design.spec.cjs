const {test,expect}=require('@playwright/test');
const M=require('../finance-math.js');
async function open(page,{empty=false}={}){
  await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  const tx=[];
  if(!empty){for(let i=0;i<70;i++){const date=M.shift('2026-11-24',-i);tx.push({id:'e'+i,type:'expense',amount:[540,1320,780,2100,460,920,360][i%7],date,merchant:'Покупка '+i,category:['Продукты','Кафе и рестораны','Транспорт','Покупки'][i%4]});}tx.push({id:'salary',date:'2026-11-05',type:'income',amount:98000,category:'Доход',merchant:'Зарплата'});}
  await page.addInitScript(tx=>{for(const [k,v] of Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_balance:'74580',fp_visual_style:'forest',fp_theme:'light',fp_local_tx:JSON.stringify(tx)}))localStorage.setItem(k,v);},tx);
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FINTEX_SIM?.ui);await page.evaluate(()=>{dismissReturningSplash();goTab('analytics');});
}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,bills:state.bills}));
test('editorial overview plots real daily expenses, preserves amounts, periods and the ledger',async({page})=>{
  await open(page);const before=await snapshot(page);
  await expect(page.locator('.ftx-ap-stat').first()).toHaveCSS('border-top-width','0px');
  await expect(page.locator('.ftx-ap-stat').first()).toHaveCSS('border-radius','0px');
  await expect(page.locator('.ap-period-information')).toBeVisible();
  for(const [period,days]of [['week',7],['month',30],['quarter',90],['year',365]]){
    await page.locator(`[data-period="${period}"]`).click();
    const data=await page.evaluate(days=>{const d=FintexAnalyticsPro.analyze(days);return {spent:d.spent,income:d.income,categories:d.categories,net:d.net};},days);
    await expect(page.locator('.ftx-ap-big')).toHaveText(data.spent.toLocaleString('ru-RU')+' ₽');
    await expect(page.locator('.ap-day-bar')).toHaveCount(days);expect(await page.locator('.ap-day-bar').evaluateAll(els=>els.every(el=>Number.isFinite(Number(el.getAttribute('height')))))).toBe(true);
    expect(await page.locator('.ap-donut-segment').count()).toBe(data.categories.length);
    const widths=await page.locator('.ap-donut-segment').evaluateAll(els=>els.reduce((sum,el)=>sum+parseFloat(el.getAttribute('stroke-dasharray')),0));expect(widths).toBeCloseTo(100,5);
    expect(await page.locator('.ap-category-amount').first().textContent()).toBe(Math.round(data.categories[0].total).toLocaleString('ru-RU')+' ₽');
  }
  await page.locator('[data-period="month"]').click();await page.locator('.ap-forecast-method summary').click();await expect(page.locator('.ap-forecast-method p')).toBeVisible();
  expect(await snapshot(page)).toBe(before);
});
test('categories support keyboard drilldown and all detail/rhythm interactions remain usable',async({page})=>{
  await open(page);await page.locator('[data-goto="categories"]').click();const category=page.locator('[data-cat]').first();await category.focus();await page.keyboard.press('Enter');await expect(category).toHaveAttribute('aria-expanded','true');await expect(category).toBeFocused();await expect(category.locator('.ftx-ap-drill')).toBeVisible();
  await page.keyboard.press('Space');await expect(category).toHaveAttribute('aria-expanded','false');
  await page.locator('[data-subtab="rhythm"]').click();await expect(page.locator('.ftx-ap-weekday')).toHaveCount(7);await expect(page.locator('.ftx-ap-heat-cell')).toHaveCount(84);
  const cell=page.locator('[data-hdate="2026-11-23"]');await cell.click();await expect(cell).toHaveClass(/sel/);await expect(cell).toBeFocused();await expect(page.locator('.ftx-ap-day-detail')).toContainText('23 ноября');
});
test('all analytics subviews fit 320px in every palette and mode, including long numbers',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.evaluate(()=>{state.balance=123456789012.34;state.transactions.push({id:'large',date:'2026-11-24',type:'expense',amount:9876543210.12,category:'Очень длинное название категории для проверки'});});
  await page.setViewportSize({width:320,height:740});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);FintexAnalyticsPro.render();},{style,mode});
    for(const subtab of ['categories','rhythm','overview']){
      await page.locator(`[data-subtab="${subtab}"]`).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${style}/${mode}/${subtab}`).toBe(320);
      const overflow=await page.locator('.ftx-ap-card').evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1));expect(overflow).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});
test('empty analytics has honest designed placeholders and privacy hides the new data graphics',async({page})=>{
  await open(page,{empty:true});await expect(page.locator('.ap-trend-empty')).toBeVisible();await expect(page.locator('.ap-day-bar')).toHaveCount(0);await expect(page.locator('.ap-distribution-visual')).toHaveCount(0);await expect(page.locator('.ftx-ap-empty')).toContainText('Добавьте расходы');
  await page.evaluate(()=>{state.transactions=[{id:'e',date:'2026-11-24',amount:900,type:'expense',category:'Продукты'}];FintexAnalyticsPro.render();togglePrivacy();});
  await expect(page.locator('.ap-trend')).toBeHidden();await expect(page.locator('.ap-distribution-visual')).toBeHidden();await expect(page.locator('.ftx-ap-big')).toHaveCSS('filter',/blur/);
});
test('analytics previews reflect populated light and dark complementary themes',async({page})=>{
  await open(page);await page.setViewportSize({width:390,height:1100});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});
  for(const [style,mode,file] of [['forest','light','analytics-overview-preview'],['sapphire','dark','analytics-dark-preview']]){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);goTab('analytics');window.scrollTo(0,0);},{style,mode});
    await page.screenshot({path:`docs/${file}.png`,fullPage:false});
  }
});
test('spending-period controls show exact dates, equal prior windows and no misleading calendar labels',async({page})=>{
  await open(page);
  for(const [id,days]of [['week',7],['month',30],['quarter',90],['year',365]]){
    await page.locator(`[data-period="${id}"]`).click();await expect(page.locator(`[data-period="${id}"]`)).toHaveText(`${days} дней`);
    await expect(page.locator('.ap-period-title')).toContainText('Включая сегодня');
    const first=M.shift('2026-11-24',1-days),previousEnd=M.shift(first,-1),previousStart=M.shift(first,-days);
    const label=key=>new Date(key+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}).replace('.','');
    await expect(page.locator('.ap-period-dates strong')).toHaveText(`${label(first)} — ${label('2026-11-24')}`);
    await page.locator('.ap-comparison summary').click();await expect(page.locator('.ap-comparison')).toContainText(`${label(previousStart)} — ${label(previousEnd)}`);
    const data=await page.evaluate(days=>FintexAnalyticsPro.analyze(days),days);await expect(page.locator('.ap-comparison strong')).toHaveText(Math.round(data.prevSpent).toLocaleString('ru-RU')+' ₽');
  }
});
test('distribution uses Russian built-in names, matching ring shares and works in all six themes',async({page})=>{
  await open(page);await page.evaluate(()=>{state.transactions=['food','taxi','cafe','fun','subs','shop','health','other'].map((category,i)=>({id:'c'+i,category,date:'2026-11-24',type:'expense',amount:(i+1)*100}));FintexAnalyticsPro.render();});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    const card=page.locator('.ap-distribution');const text=await card.innerText();expect(text).not.toMatch(/[a-z]/i);await expect(card.locator('.ap-donut-segment')).toHaveCount(8);
    const total=await card.locator('.ap-donut-segment').evaluateAll(els=>els.reduce((s,el)=>s+parseFloat(el.getAttribute('stroke-dasharray')),0));expect(total).toBeCloseTo(100,5);
    await expect(card.locator('.ap-distribution-rest')).toContainText('Ещё 4 катег.');
    await page.setViewportSize({width:320,height:740});expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.evaluate(()=>{setVisualStyle('forest');setTheme('light');});await page.setViewportSize({width:390,height:1000});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});await page.locator('.ap-distribution').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/expense-structure-preview.png'});
});
test('daily columns support pointer, keyboard and exact kopecks without mutating the ledger',async({page})=>{
  await open(page);await page.evaluate(()=>{state.transactions=[{id:'a',date:'2026-11-23',type:'expense',amount:1234.56,category:'food'},{id:'b',date:'2026-11-23',type:'expense',amount:10.1,category:'food'},{id:'salary',date:'2026-11-24',type:'income',amount:60000}];FintexAnalyticsPro.render();});
  const before=await snapshot(page),slider=page.locator('.ap-chart-range');
  await slider.focus();await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.ap-trend-value')).toHaveText('1 244,66 ₽');await expect(page.locator('.ap-trend-count')).toHaveText('Записей: 2');
  await slider.focus();await page.keyboard.press('End');await expect(slider).toHaveAttribute('aria-valuenow','29');await expect(page.locator('.ap-trend-value')).toHaveText('0 ₽');await expect(page.locator('.ap-trend-count')).toHaveText('Нет записанных расходов');await expect(slider).toHaveAttribute('aria-valuetext',/24 ноября.*0 ₽/);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('.ap-trend-value')).toHaveText('1 244,66 ₽');await expect(page.locator('.ap-day-bar.is-selected')).toHaveAttribute('data-day-index','28');
  await page.keyboard.press('Home');await expect(slider).toHaveAttribute('aria-valuenow','0');
  await page.locator('.ap-plot-surface').scrollIntoViewIfNeeded();const box=await page.locator('.ap-plot-surface').boundingBox();await page.mouse.click(box.x+box.width-1,box.y+50);await expect(slider).toHaveAttribute('aria-valuenow','29');await page.mouse.move(box.x+box.width-1,box.y+50);await page.mouse.down();await page.mouse.move(box.x+1,box.y+50,{steps:8});await page.mouse.up();await expect(slider).toHaveAttribute('aria-valuenow','0');
  for(const period of ['week','quarter','year','month']){await page.locator(`[data-period="${period}"]`).click();expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);expect(await page.locator('.ap-day-bar').count()).toBeGreaterThan(0);}
  expect(await snapshot(page)).toBe(before);
});
test('period information excludes income and describes the actual expense median and busiest day',async({page})=>{
  await open(page);await page.evaluate(()=>{state.transactions=[{id:'a',date:'2026-11-22',type:'expense',amount:100},{id:'b',date:'2026-11-23',type:'expense',amount:200},{id:'c',date:'2026-11-23',type:'expense',amount:50.5},{id:'salary',date:'2026-11-24',type:'income',amount:98000}];FintexAnalyticsPro.render();});
  const card=page.locator('.ap-period-information');await expect(card.locator('.ap-period-metrics strong').nth(0)).toHaveText('3');await expect(card.locator('.ap-period-metrics strong').nth(1)).toHaveText('2 из 30');await expect(card.locator('.ap-period-peak strong')).toHaveText('23 ноября');await expect(card.locator('.ap-period-peak b')).toHaveText('250,5 ₽');await expect(card.locator('.ap-period-typical strong')).toHaveText('175,25 ₽');
  await card.locator('summary').click();await expect(card.locator('.ftx-ap-insight').first()).toBeVisible();
  await page.evaluate(()=>{state.transactions=[];FintexAnalyticsPro.render();});await expect(card.locator('.ap-period-metrics strong').first()).toHaveText('0');await expect(card.locator('.ap-period-typical strong')).toHaveText('—');await expect(card).toContainText('Пока нет расходных записей');
});
test('refined chart and period information fit all palettes, preserve privacy, and provide focused previews',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    await expect(page.locator('[data-chart-step="1"]')).toHaveCSS('min-height','44px');
    for(const selector of ['.ap-trend','.ap-period-information'])expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.evaluate(()=>togglePrivacy());await expect(page.locator('.ap-trend')).toBeHidden();await expect(page.locator('.ap-period-information')).toBeHidden();await expect(page.locator('.ap-chart-range')).toBeHidden();
  await page.evaluate(()=>{togglePrivacy();setVisualStyle('forest');setTheme('light');});await page.setViewportSize({width:390,height:1000});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});
  await page.locator('.ap-expense-hero').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/expense-chart-preview.png'});
  await page.locator('.ap-period-information').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/period-information-preview.png'});
});
test.describe('touch chart interaction',()=>{
  test.use({hasTouch:true});
  test('a touch selects a column while vertical page scrolling remains enabled',async({page})=>{
    await open(page);await page.locator('.ap-plot-surface').scrollIntoViewIfNeeded();const plot=page.locator('.ap-plot-surface'),box=await plot.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+60);await expect(page.locator('.ap-chart-range')).toHaveAttribute('aria-valuenow','15');await expect(plot).toHaveCSS('touch-action','pan-y');
  });
});

test('sparse history uses independent columns, no native slider, and a compact dark card',async({page})=>{
  await open(page,{empty:true});await page.evaluate(()=>{state.transactions=[{id:'s1',date:'2026-11-18',type:'expense',amount:9800,category:'food'},{id:'s2',date:'2026-11-20',type:'expense',amount:7000,category:'shop'},{id:'s3',date:'2026-11-21',type:'expense',amount:232,category:'cafe'}];setVisualStyle('forest');setTheme('dark');FintexAnalyticsPro.render();});
  await expect(page.locator('.ftx-ap-big')).toHaveText('17 032 ₽');await expect(page.locator('.ap-day-bar:not(.ap-day-unrecorded)')).toHaveCount(3);await expect(page.locator('.ap-day-unrecorded')).toHaveCount(27);await expect(page.locator('.ap-trend-value')).toHaveText('232 ₽');await expect(page.locator('.ap-trend input[type="range"]')).toHaveCount(0);await expect(page.locator('.ap-chart-line')).toHaveCount(0);
  const before=await snapshot(page);await page.locator('[data-chart-step="-1"]').click();await expect(page.locator('.ap-trend-value')).toHaveText('7 000 ₽');await page.locator('[data-chart-step="1"]').click();await expect(page.locator('.ap-trend-value')).toHaveText('232 ₽');expect(await snapshot(page)).toBe(before);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});const box=await page.locator('.ap-expense-hero').boundingBox();expect(box.height).toBeLessThan(620);expect(await page.locator('.ap-expense-hero').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
  await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});await page.locator('.ap-expense-hero').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/expense-sparse-dark-preview.png'});
});
