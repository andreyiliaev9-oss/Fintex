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
  await expect(page.locator('.ap-observations')).toHaveCSS('border-top-width','0px');
  for(const [period,days]of [['week',7],['month',30],['quarter',90],['year',365]]){
    await page.locator(`[data-period="${period}"]`).click();
    const data=await page.evaluate(days=>{const d=FintexAnalyticsPro.analyze(days);return {spent:d.spent,income:d.income,categories:d.categories,net:d.net};},days);
    await expect(page.locator('.ftx-ap-big')).toHaveText(data.spent.toLocaleString('ru-RU')+' ₽');
    const path=await page.locator('.ap-chart-line').getAttribute('d');expect((path.match(/L/g)||[]).length).toBe(days-1);expect(path).not.toMatch(/NaN|Infinity/);
    expect(await page.locator('.ap-composition > span').count()).toBe(data.categories.length);
    const widths=await page.locator('.ap-composition > span').evaluateAll(els=>els.reduce((sum,el)=>sum+parseFloat(el.style.width),0));expect(widths).toBeCloseTo(100,5);
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
  await open(page,{empty:true});await expect(page.locator('.ap-trend-empty')).toBeVisible();await expect(page.locator('.ap-chart-line')).toHaveCount(0);await expect(page.locator('.ap-composition')).toHaveCount(0);await expect(page.locator('.ftx-ap-empty')).toContainText('Добавьте расходы');
  await page.evaluate(()=>{state.transactions=[{id:'e',date:'2026-11-24',amount:900,type:'expense',category:'Продукты'}];FintexAnalyticsPro.render();togglePrivacy();});
  await expect(page.locator('.ap-trend')).toBeHidden();await expect(page.locator('.ap-composition')).toBeHidden();await expect(page.locator('.ftx-ap-big')).toHaveCSS('filter',/blur/);
});
test('analytics previews reflect populated light and dark complementary themes',async({page})=>{
  await open(page);await page.setViewportSize({width:390,height:1100});await page.addStyleTag({content:'html {scroll-behavior:auto !important}'});
  for(const [style,mode,file] of [['forest','light','analytics-overview-preview'],['sapphire','dark','analytics-dark-preview']]){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);goTab('analytics');window.scrollTo(0,0);},{style,mode});
    await page.screenshot({path:`docs/${file}.png`,fullPage:false});
  }
});
