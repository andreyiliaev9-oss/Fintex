const {test,expect}=require('@playwright/test');
async function open(page){
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.addInitScript(()=>{Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_tour_v1:'complete',fp_balance:'75000.50',fp_bills:'[]',fp_local_tx:'[]',fp_goal:JSON.stringify({title:'Подушка спокойствия',saved:15000,target:60000,pockets:[{id:'trip',title:'Море и горы',saved:25000,target:120000,cover:'travel',monthly:5000}]})}).forEach(([k,v])=>localStorage.setItem(k,v));});
 await page.goto('/');await page.waitForFunction(()=>!!window.FintexGoals&&!!window.FintexDaily);await page.evaluate(()=>{dismissReturningSplash();state.payday=FintexMath.shift(TODAY,8);state.transactions=[{id:'long',date:TODAY,merchant:'Продукты для всей семьи на неделю',type:'expense',amount:2450.26,category:'food'},{id:'small',date:TODAY,merchant:'Кофе',type:'expense',amount:50.5,category:'cafe'},{id:'income',date:YESTERDAY,merchant:'За проект',type:'income',amount:15000,category:'other'}];renderAll(false);});await page.evaluate(()=>document.fonts.ready);
}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal,bills:state.bills}));
async function palette(page,style,mode){await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});}
async function contrast(page,selector,part='color',bg='backgroundColor'){
 return page.locator(selector).first().evaluate((el,{part,bg})=>{
  const css=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d');
  function rgb(color){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255);}
  const lum=color=>rgb(color).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const a=lum(css[part]),b=lum(bg.startsWith('--')?css.getPropertyValue(bg):css[bg]);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 },{part,bg});
}
test('daily allowance leads in DOM and visual hierarchy without financial mutations',async({page})=>{
 await open(page);const before=await snapshot(page);
 for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
  await palette(page,style,mode);expect(await contrast(page,'body','color','backgroundColor')).toBeGreaterThanOrEqual(4.5);const result=await page.evaluate(()=>{const daily=document.getElementById('hero-daily-budget'),total=document.querySelector('.balance-total');return {ordered:!!(daily.compareDocumentPosition(total)&Node.DOCUMENT_POSITION_FOLLOWING),daily:parseFloat(getComputedStyle(document.getElementById('hero-daily-left')).fontSize),balance:parseFloat(getComputedStyle(document.getElementById('hero-balance')).fontSize)};});expect(result.ordered).toBe(true);expect(result.daily).toBeGreaterThan(result.balance);
 }
 expect(await snapshot(page)).toBe(before);
});
test('journal preserves grouped amount alignment and gives long names two readable lines',async({page})=>{
 await open(page);await page.setViewportSize({width:390,height:844});
 const rows=page.locator('#tx-feed .tx-amount');const edges=await rows.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().right));expect(Math.max(...edges)-Math.min(...edges)).toBeLessThan(1);
 await expect(page.locator('[data-operation-row=long] .tx-amount .number-group')).toHaveCount(2);await expect(page.locator('[data-operation-row=long] .tx-amount')).toHaveAttribute('aria-label','−2 450,26 ₽');
 const name=page.locator('[data-operation-row=long] .tx-merchant-name');expect(await name.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(25);await expect(name).toHaveCSS('-webkit-line-clamp','2');
 const cards=page.locator('.tx-day-card');expect(await cards.nth(1).evaluate(el=>el.getBoundingClientRect().top-el.previousElementSibling.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(20);
});
test('primary goal has a larger cover, factual remaining amount and private values',async({page})=>{
 await open(page);const main=page.locator('#savings-goals [data-sg-open=primary]');await expect(main.locator('.sg-priority')).toHaveText('Основная цель');await expect(main.locator('.sg-card-remaining')).toContainText('45 000');
 expect(await main.locator('.sg-cover').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(180);await page.evaluate(()=>toggleStealthMode(true));await expect(main.locator('.sg-card-remaining')).toHaveCSS('filter','blur(8px)');await expect(main.locator('.sg-card-amount')).toHaveCSS('filter','blur(8px)');
});
test('all palettes meet form text, button and field-boundary contrast thresholds',async({page})=>{
 await open(page);await page.locator('#hdr-plus-btn').click();
 for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
  await palette(page,style,mode);expect(await contrast(page,'#flow-amount'),'input '+style+mode).toBeGreaterThanOrEqual(4.5);expect(await contrast(page,'#flow-save'),'action '+style+mode).toBeGreaterThanOrEqual(4.5);expect(await contrast(page,'#flow-amount','borderTopColor'),'boundary '+style+mode).toBeGreaterThanOrEqual(3);expect(await contrast(page,'.flow-note','color','--surface-1'),'note '+style+mode).toBeGreaterThanOrEqual(4.5);
 }
});
test('legacy and native forms share close, heading and action sizes',async({page})=>{
 await open(page);const before=await snapshot(page);await page.locator('#hdr-plus-btn').click();await expect(page.locator('#daily-flow .flow-header h2')).toHaveCSS('font-size','20px');await expect(page.locator('#flow-save')).toHaveCSS('min-height','48px');await expect(page.locator('#daily-flow .flow-header [data-flow-close]')).toHaveCSS('border-radius','14px');await page.keyboard.press('Escape');
 await page.evaluate(()=>openForecastExplainModal());await expect(page.locator('#modal-forecast-info .sheet-heading')).toHaveCSS('font-size','20px');await expect(page.locator('#modal-forecast-info button[onclick*=closeModals]')).toHaveCSS('width','44px');await page.keyboard.press('Escape');
 await page.evaluate(()=>FintexGoals.open('primary'));await expect(page.locator('#sg-dialog-title')).toHaveCSS('font-size','20px');await expect(page.locator('.sg-close')).toHaveCSS('border-radius','14px');await page.keyboard.press('Escape');expect(await snapshot(page)).toBe(before);
});
test('320px themes fit home, goals and editor including extreme figures',async({page})=>{
 await open(page);await page.setViewportSize({width:320,height:568});const before=await snapshot(page);
 for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
  await palette(page,style,mode);for(const selector of ['#hero-balance-card','#savings-goals','#tx-feed'])expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.evaluate(()=>FintexGoals.open('primary'));await page.locator('[data-sg-edit]').click();expect(await page.locator('#savings-goals-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.keyboard.press('Escape');
 }
 expect(await snapshot(page)).toBe(before);await page.evaluate(()=>{state.balance=999999999999.99;state.goal.target=999999999999.99;state.goal.saved=888888888888.88;renderAll(false);});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('native and legacy entrances are finite, geometry-stable and cancel with reduced motion',async({page})=>{
 await open(page);const before=await snapshot(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();FintexDaily.open();});
 const dialog=page.locator('#daily-flow');await expect.poll(()=>dialog.evaluate(el=>el.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBeGreaterThan(0);
 const frames=await dialog.evaluate(el=>el.getAnimations().find(a=>a.id==='fintex-interface-motion').effect.getKeyframes());expect(frames.every(f=>!f.height&&!f.width&&!f.transform)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>dialog.evaluate(el=>el.getAnimations().length)).toBe(0);await page.keyboard.press('Escape');await page.evaluate(()=>openForecastExplainModal());expect(await page.locator('#modal-forecast-info .modal-sheet').evaluate(el=>el.getAnimations().length)).toBe(0);await page.keyboard.press('Escape');expect(await snapshot(page)).toBe(before);
});
