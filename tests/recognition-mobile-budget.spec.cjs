const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_onboarded:'1',fp_name:'Анна',fp_motion:'0',fp_tour_v1:'complete',fp_balance:'10000',fp_bills:'[]',fp_local_tx:'[]',fp_goal:JSON.stringify({saved:0,target:10000,title:'Подушка'})}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexDaily&&!!window.FintexFormViewport);await page.evaluate(()=>dismissReturningSplash());await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
}
async function voice(page,text='кофе 150,25; такси 200'){
  await page.evaluate(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;openVoiceModal();});
  await page.locator('#voice-transcript-inp').fill(text);
}
test('voice review edits every key field and saves exact ledger values once',async({page})=>{
  await open(page);await voice(page);await expect(page.locator('[data-voice-row]')).toHaveCount(2);
  const row=page.locator('[data-voice-row]').first();await row.locator('[data-voice-field=merchant]').fill('Обед');await row.locator('[data-voice-field=amount]').fill('175,50');await row.locator('[data-voice-field=category]').selectOption('food');
  const yesterday=await page.evaluate(()=>FintexMath.shift(TODAY,-1));await row.locator('[data-voice-field=date]').fill(yesterday);
  expect(await page.evaluate(()=>state.transactions.length)).toBe(0);await page.locator('#voice-commit-btn').click();
  const data=await page.evaluate(()=>({txs:state.transactions,balance:state.balance}));expect(data.balance).toBe(9624.5);expect(data.txs).toHaveLength(2);expect(data.txs.find(t=>t.merchant==='Обед')).toMatchObject({amount:175.5,category:'food',date:yesterday,type:'expense'});
  await page.evaluate(()=>commitVoiceExpenses());expect(await page.evaluate(()=>state.transactions.length)).toBe(2);
});
test('invalid voice fields block writes; cancellation and transcript replacement are read-only',async({page})=>{
  await open(page);await voice(page,'кофе 150');const amount=page.locator('[data-voice-field=amount]');
  for(const value of ['-10','0','1,234','NaN']){await amount.fill(value);await expect(page.locator('#voice-commit-btn')).toBeDisabled();expect(await page.evaluate(()=>state.balance)).toBe(10000);}
  await amount.fill('20');await page.locator('[data-voice-field=date]').fill(await page.evaluate(()=>FintexMath.shift(TODAY,1)));await expect(page.locator('#voice-commit-btn')).toBeDisabled();
  await page.locator('#voice-transcript-inp').fill('такси 80');await expect(page.locator('[data-voice-field=amount]')).toHaveValue('80');await page.keyboard.press('Escape');expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
});
test('late speech callbacks cannot overwrite manual voice review',async({page})=>{
  await open(page);await page.evaluate(()=>{window.SpeechRecognition=class{constructor(){window.__rec=this;}start(){this.onstart();}stop(){}};openVoiceModal();window.__rec.onresult({results:[[{transcript:'кофе 150'}]]});});
  await page.locator('[data-voice-field=amount]').fill('200');await page.evaluate(()=>window.__rec.onresult({results:[[{transcript:'такси 900'}]]}));await expect(page.locator('[data-voice-field=amount]')).toHaveValue('200');await expect(page.locator('#voice-status-label')).toHaveText('Проверьте поля перед записью');
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__rec.onresult({results:[[{transcript:'такси 500'}]]}));expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
});
test('spending breakdown lists only included bills and funded goals without changing finances',async({page})=>{
  await open(page);await page.evaluate(()=>{
    state.balance=10000;state.payday=FintexMath.shift(TODAY,10);state.goal={title:'Подушка',saved:1000,target:2000,pockets:[{id:'trip',title:'Отпуск',saved:500},{id:'empty',title:'Пустая',saved:0}]};
    state.bills=[{id:'rent',title:'Аренда',amount:2000,due_date:FintexMath.shift(TODAY,10)},{id:'old',title:'Связь',amount:100,due_date:FintexMath.shift(TODAY,-1)},{id:'paid',title:'Оплаченный',amount:999,is_paid:true,due_date:TODAY},{id:'late',title:'Позже',amount:999,due_date:FintexMath.shift(TODAY,11)}];renderAll(false);
  });
  const before=await page.evaluate(()=>JSON.stringify({balance:state.balance,bills:state.bills,goal:state.goal}));await page.getByRole('button',{name:/Можно тратить/}).click();
  const box=page.locator('#forecast-math-body');await expect(box.locator('.budget-equation')).toContainText('Можно тратить');await expect(box.locator('.budget-equation .budget-math-row').last().locator('strong')).toHaveAttribute('aria-label','6 400 ₽');
  await expect(box).toContainText('Аренда');await expect(box).toContainText('Просрочен');await expect(box).toContainText('Отпуск');await expect(box).not.toContainText('Оплаченный');await expect(box).not.toContainText('Позже');await expect(box).not.toContainText('Пустая');
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>JSON.stringify({balance:state.balance,bills:state.bills,goal:state.goal}))).toBe(before);
});
test('shortfall and unset payday explain zero available, with safe user text',async({page})=>{
  await open(page);await page.evaluate(()=>{state.balance=50;state.payday='bad';state.goal={title:'<img src=x onerror=alert(1)>',saved:100};openForecastExplainModal();});
  await expect(page.locator('.budget-shortfall')).toContainText('не хватает');await expect(page.locator('.budget-note').first()).toContainText('до завтра');await expect(page.locator('.budget-reservations img')).toHaveCount(0);await expect(page.locator('.budget-reservations').last()).toContainText('<img src=x');
});
test('journal edit returns focus and scroll after row re-render; cancel also returns',async({page})=>{
  await open(page);await page.evaluate(()=>{state.homeShowAllTx=true;state.transactions=Array.from({length:35},(_,i)=>({id:'r'+i,merchant:'Покупка '+i,type:'expense',category:'other',date:TODAY,time:'12:'+String(59-i).padStart(2,'0'),amount:i+1}));renderAll(false);});
  const row=page.locator('[data-tx-open=r18]');await row.scrollIntoViewIfNeeded();await row.click();const y=await page.evaluate(()=>scrollY);
  await page.locator('#tx-edit-action').click();await page.locator('#flow-amount').fill('80');await page.locator('#flow-save').click();await expect(row).toBeFocused();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(y);
  await row.click();await page.locator('#tx-edit-action').click();await page.keyboard.press('Escape');await expect(row).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(y);
});
test('small-screen review and budget remain usable in every palette',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:568});await voice(page);
  for(const style of ['forest','sapphire','growth']){await page.evaluate(s=>setVisualStyle(s),style);for(const mode of ['light','dark']){await page.evaluate(m=>setTheme(m),mode);expect(await page.locator('#modal-voice .modal-sheet').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect(page.locator('[data-voice-field=amount]').first()).toHaveCSS('font-size','25px');}}
  await page.locator('#voice-commit-btn').scrollIntoViewIfNeeded();await expect(page.locator('#voice-commit-btn')).toBeInViewport();await page.keyboard.press('Escape');await page.evaluate(()=>openForecastExplainModal());expect(await page.locator('#modal-forecast-info .modal-sheet').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('keyboard viewport resizes native and legacy forms and reveals the active input',async({page})=>{
  await page.addInitScript(()=>{const viewport=new EventTarget();Object.assign(viewport,{height:844,offsetTop:0});Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});});
  await open(page);await page.locator('#hdr-plus-btn').click();await page.locator('#flow-name').focus();await page.evaluate(()=>{visualViewport.height=350;visualViewport.dispatchEvent(new Event('resize'));});
  await expect.poll(()=>page.locator('#daily-flow').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(350);await expect(page.locator('#flow-name')).toBeInViewport();
  await page.keyboard.press('Escape');await voice(page,'кофе 100');await expect.poll(()=>page.locator('#modal-voice .modal-sheet').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(350);
  await page.locator('[data-voice-field=amount]').focus();await expect.poll(()=>page.locator('[data-voice-field=amount]').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(350);
  await page.evaluate(()=>{visualViewport.height=844;visualViewport.dispatchEvent(new Event('resize'));});await expect.poll(()=>page.locator('html').evaluate(el=>el.style.getPropertyValue('--form-viewport-bottom'))).toBe('0px');
});
