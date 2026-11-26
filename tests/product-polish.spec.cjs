const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_balance:'10000',fp_bills:'[]',fp_local_tx:JSON.stringify([{id:'shop',date:new Date().toISOString().slice(0,10),type:'expense',amount:2450.26,merchant:'Магазин',category:'food',items:[{name:'Молоко',price:150},{name:'Зелёный чай',price:250}]},{id:'cash',date:new Date().toISOString().slice(0,10),type:'income',amount:5000,merchant:'За проект',category:'income'}])}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FintexGoals);await page.evaluate(()=>dismissReturningSplash());await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}));
async function swipe(page,{dx=-190,dy=0,cancel=false,multi=false}={}){
  await page.evaluate(({dx,dy,cancel,multi})=>{
    const el=document.querySelector('[data-operation-row=shop] .tx-swipe-content');
    const t=(x,y,id=1)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});const start=t(240,330);
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[start],changedTouches:[start]}));const end=t(240+dx,330+dy);
    el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:multi?[end,t(150,330,2)]:[end],changedTouches:[end]}));
    el.dispatchEvent(new TouchEvent(cancel?'touchcancel':'touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[end]}));
  },{dx,dy,cancel,multi});
}
test('a long operation swipe reveals explicit actions, never deletes or changes sections, and supports undo',async({page})=>{
  await open(page);const before=await snapshot(page);await page.locator('#tx-feed').scrollIntoViewIfNeeded();await swipe(page);
  await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav','home');expect(await snapshot(page)).toBe(before);const row=page.locator('[data-operation-row=shop]');await expect(row.locator('.tx-row-menu')).toHaveAttribute('aria-expanded','true');await expect(row.locator('.tx-swipe-actions')).toHaveAttribute('aria-hidden','false');
  await row.locator('button[aria-label="Удалить операцию: Магазин"]').click();await expect(page.locator('[data-operation-row=shop]')).toHaveCount(0);await page.locator('#operation-undo-apply').click();const normalize=s=>{const v=JSON.parse(s);v.transactions.sort((a,b)=>a.id.localeCompare(b.id));return v;};expect(normalize(await snapshot(page))).toEqual(normalize(before));
});
test('vertical, cancelled and multi-touch gestures keep records and reset row transforms',async({page})=>{
  await open(page);const before=await snapshot(page);
  for(const input of [{dx:-35,dy:150},{cancel:true},{multi:true}]){await swipe(page,input);await expect(page.locator('[data-operation-row=shop] .tx-row-menu')).toHaveAttribute('aria-expanded','false');expect(await snapshot(page)).toBe(before);}
  await swipe(page);await page.evaluate(()=>goTab('calendar'));await page.evaluate(()=>goTab('home'));await expect(page.locator('[data-operation-row=shop] .tx-row-menu')).toHaveAttribute('aria-expanded','false');expect(await snapshot(page)).toBe(before);
});
test('keyboard action menu exposes only deliberate actions and Escape restores the launcher',async({page})=>{
  await open(page);const button=page.locator('[data-operation-row=shop] .tx-row-menu'),before=await snapshot(page);await expect(page.locator('[data-operation-row=shop] .tx-swipe-actions')).toHaveAttribute('inert','');await button.focus();await page.keyboard.press('Enter');await expect(button).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(button).toHaveAttribute('aria-expanded','false');await expect(button).toBeFocused();expect(await snapshot(page)).toBe(before);
});
test('mouse dragging an operation cannot trigger deletion or tab navigation',async({page})=>{
  await open(page);const before=await snapshot(page);const row=page.locator('[data-operation-row=shop] .tx-row-open');await row.scrollIntoViewIfNeeded();const r=await row.boundingBox();await page.mouse.move(r.x+r.width-10,r.y+20);await page.mouse.down();await page.mouse.move(r.x+10,r.y+20,{steps:7});await page.mouse.up();expect(await snapshot(page)).toBe(before);await expect(page.locator('[data-operation-row=shop] .tx-row-menu')).toHaveAttribute('aria-expanded','true');
});
test('receipt products, Russian sums and clearable no-result states work without resetting the selected date',async({page})=>{
  await open(page);const before=await snapshot(page);await page.locator('[aria-label="Поиск операций"]').click();const input=page.locator('#search-input');await expect(input).toBeFocused();
  for(const query of ['МОЛОКО','зеленый чай','2 450,26 ₽']){await input.fill(query);await expect(page.locator('[data-operation-row]')).toHaveCount(1);await expect(page.locator('[data-operation-row=shop]')).toBeVisible();}
  await page.evaluate(()=>{state.journalDay={date:TODAY,type:'expense'};renderHome();});await input.fill('<несуществующий>');await expect(page.locator('#tx-feed')).toContainText('Совпадений нет');await expect(page.locator('#tx-feed')).not.toContainText('Операций пока нет');await expect(page.locator('#tx-feed img')).toHaveCount(0);await page.locator('#journal-search-status button').click();await expect(input).toHaveValue('');await expect(page.locator('#journal-day-filter')).toContainText('Расходы');await expect(page.locator('[data-operation-row]')).toHaveCount(1);expect(await snapshot(page)).toBe(before);
});
test('empty-day action preselects the calendar date without adding an operation',async({page})=>{
  await open(page);const before=await snapshot(page);await page.evaluate(()=>{state.journalDay={date:FintexMath.shift(TODAY,-10),type:'all'};renderHome();});await page.locator('.journal-empty-add').click();await expect(page.locator('#daily-flow')).toBeVisible();expect(await page.locator('#flow-date').inputValue()).toBe(await page.evaluate(()=>FintexMath.shift(TODAY,-10)));expect(await snapshot(page)).toBe(before);
});
test('legacy sheets have dialog names, contained focus, Escape and restoration without a scroll jump',async({page})=>{
  await open(page);const launcher=page.locator('[data-operation-row=shop] .tx-row-open');await launcher.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);await launcher.click();const root=page.locator('#modal-tx');await expect(root).toHaveAttribute('role','dialog');await expect(root).toHaveAttribute('aria-modal','true');await expect(root).toHaveAttribute('aria-labelledby','mtx-name');await expect(page.locator('main')).toHaveAttribute('inert','');
  const buttons=root.locator('button:visible');await buttons.last().focus();await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(buttons.last()).toBeFocused();await page.keyboard.press('Escape');await expect(root).toBeHidden();await expect(launcher).toBeFocused();await expect(page.locator('main')).not.toHaveAttribute('inert','');expect(await page.evaluate(()=>scrollY)).toBe(scroll);
});
test('Escape invokes the actual close control, and native goal dialogs retain their own focus lifecycle',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__voiceStopped=0;window.stopVoiceRecognition=()=>window.__voiceStopped++;document.getElementById('modal-voice').classList.remove('hidden');});await expect(page.locator('#modal-voice')).toHaveAttribute('aria-modal','true');await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__voiceStopped)).toBe(1);await expect(page.locator('#modal-voice')).toBeHidden();
  await page.evaluate(()=>FintexGoals.open());await expect(page.locator('#savings-goals-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#savings-goals-dialog')).toBeHidden();await expect(page.locator('html')).not.toHaveClass(/fintex-modal-open/);
});
test('interrupted goal holds do not reserve money, including when a sheet closes',async({page})=>{
  await open(page);await page.clock.install();const before=await snapshot(page);await page.evaluate(()=>{openGoalDetailsModal();startGoalHold({preventDefault(){}});});await page.clock.fastForward(550);await page.evaluate(()=>document.getElementById('goal-hold-btn').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true})));expect(await snapshot(page)).toBe(before);
  await page.evaluate(()=>startGoalHold({preventDefault(){}}));await page.clock.fastForward(550);await page.evaluate(()=>closeModals());await page.clock.fastForward(1000);expect(await snapshot(page)).toBe(before);
});
test('phone sheets scroll internally when the viewport is short and keep close controls usable',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:480});await page.evaluate(()=>openGoalDetailsModal());const sheet=page.locator('#modal-goal-detail .modal-sheet');expect((await sheet.boundingBox()).height).toBeLessThanOrEqual(480*.92+1);expect(await sheet.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);await sheet.locator('button[onclick="saveGoalSettings()"]').scrollIntoViewIfNeeded();await expect(sheet.locator('button[onclick="saveGoalSettings()"]')).toBeInViewport();await page.keyboard.press('Escape');await expect(sheet).toBeHidden();
});
test.describe('real touch arbitration',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('an actual finger drag on an operation never enters section navigation or deletes data',async({page})=>{
    await open(page);const before=await snapshot(page);const row=page.locator('[data-operation-row=shop] .tx-row-open');await row.scrollIntoViewIfNeeded();const r=await row.boundingBox(),x=r.x+r.width-10,y=r.y+r.height/2,session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(const dx of [30,60,100,140,175])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-dx,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('[data-operation-row=shop] .tx-row-menu')).toHaveAttribute('aria-expanded','true');await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav','home');await expect(page.locator('#modal-tx')).toBeHidden();expect(await snapshot(page)).toBe(before);
  });
});
