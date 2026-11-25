const {test,expect}=require('@playwright/test');
const dialog=p=>p.locator('#savings-goals-dialog');
async function open(page){
  await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{if(localStorage.getItem('sg_test_seed'))return;localStorage.setItem('sg_test_seed','1');Object.entries({fp_onboarded:'1',fp_name:'Анна',fp_motion:'0',fp_visual_style:'forest',fp_theme:'light',fp_balance:'10000',fp_bills:'[]',fp_local_tx:'[]',fp_goal:JSON.stringify({title:'Моя подушка',saved:1250.25,target:10000})}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexGoals&&!!window.FintexAnalyticsPro);await page.evaluate(()=>dismissReturningSplash());
}
async function create(page,{title='Отпуск у моря',target='12000',monthly='2000'}={}){
  await page.locator('#savings-goals [data-sg-add]').click();await page.locator('#sg-goal-name').fill(title);await page.locator('#sg-target').fill(target);await page.locator('#sg-monthly').fill(monthly);await page.locator('#sg-edit-form [type=submit]').click();await expect(page.locator('#sg-dialog-title')).toHaveText(title);
}
const financial=p=>p.evaluate(()=>({balance:state.balance,transactions:state.transactions,free:calcMetrics().freePool,reserved:calcMetrics().goalReserved,goal:state.goal}));
test('legacy cushion is untouched on load, multiple goals reserve cash without changing ledger or balance',async({page})=>{
  await open(page);const original=await financial(page);expect(original.goal).toEqual({title:'Моя подушка',saved:1250.25,target:10000});expect(original.free).toBe(8749.75);
  await create(page);await expect(page.locator('.sg-forecast')).toContainText('24 мая 2027');
  await page.locator('#sg-amount').fill('1000,25');await page.locator('#sg-transfer-form [type=submit]').click();
  let current=await financial(page);expect(current.balance).toBe(original.balance);expect(current.transactions).toEqual(original.transactions);expect(current.goal.saved).toBe(1250.25);expect(current.goal.pockets[0].saved).toBe(1000.25);expect(current.free).toBe(7749.5);
  await expect(page.locator('.sg-detail-progress')).toContainText('1 000,25');
  await page.locator('#sg-amount').fill('0,25');await page.locator('[data-sg-release]').click();current=await financial(page);expect(current.goal.pockets[0].saved).toBe(1000);expect(current.free).toBe(7749.75);
  await page.locator('[data-sg-close]').click();await page.reload();await page.waitForFunction(()=>!!window.FintexGoals);expect((await financial(page)).goal.pockets[0].saved).toBe(1000);expect((await financial(page)).goal.saved).toBe(1250.25);
});
test('validation and explicit deletion prevent overspending, fabricated income and accidental reserve loss',async({page})=>{
  await open(page);await create(page);const before=await financial(page);
  for(const bad of ['0','-1','Infinity','1.001','9000']){await page.locator('#sg-amount').fill(bad);await page.locator('#sg-transfer-form [type=submit]').click();expect(await financial(page)).toEqual(before);}
  await page.locator('#sg-amount').fill('1');await page.locator('[data-sg-release]').click();expect(await financial(page)).toEqual(before);
  await page.locator('#sg-amount').fill('750');await page.locator('#sg-transfer-form [type=submit]').click();await page.locator('[data-sg-edit]').click();
  await page.locator('#sg-target').fill('-1');await page.locator('#sg-edit-form [type=submit]').click();await expect(page.locator('[data-sg-status]')).toContainText('Проверьте');
  await page.locator('.sg-delete summary').click();await expect(page.locator('.sg-delete')).toContainText('Баланс карты и операции не изменятся');await page.locator('[data-sg-delete]').click();
  const after=await financial(page);expect(after.balance).toBe(before.balance);expect(after.transactions).toEqual(before.transactions);expect(after.free).toBe(before.free);expect(after.goal.pockets).toHaveLength(0);expect(after.goal.saved).toBe(1250.25);
});
test('primary goal can be styled and planned in place; cancel never saves edits',async({page})=>{
  await open(page);await page.locator('#savings-goals [data-sg-open=primary]').click();await expect(page.locator('.sg-forecast')).toContainText('Добавьте плановый взнос');await page.locator('[data-sg-edit]').click();
  await page.locator('#sg-goal-name').fill('Подушка семьи');await page.locator('#sg-monthly').fill('500');await page.locator('[data-sg-cover=home]').click();await page.locator('#sg-edit-form [type=submit]').click();
  expect((await financial(page)).goal).toMatchObject({title:'Подушка семьи',monthly:500,cover:'home',saved:1250.25});await expect(page.locator('.sg-detail-art img')).toHaveAttribute('src','assets/goals/home.svg');
  await page.locator('[data-sg-edit]').click();await page.locator('#sg-goal-name').fill('Не сохранять');await page.keyboard.press('Escape');await expect(dialog(page)).not.toBeVisible();expect((await financial(page)).goal.title).toBe('Подушка семьи');
  await page.evaluate(()=>openGoalDetailsModal());await expect(page.locator('#modal-goal-detail')).toBeVisible();await page.locator('.sg-manage').click();await expect(dialog(page)).toBeVisible();await expect(page.locator('#modal-goal-detail')).toBeHidden();
});
test('photo upload compresses locally; removal is saved explicitly and invalid files do not change the goal',async({page})=>{
  await open(page);await create(page);await page.locator('[data-sg-edit]').click();
  const png=await page.locator('[data-sg-cover=travel] img').screenshot();
  await page.locator('#sg-photo').setInputFiles({name:'trip.png',mimeType:'image/png',buffer:png});await expect(page.locator('[data-sg-status]')).toContainText('Фото готово');await expect(page.locator('#sg-cover-preview')).toHaveAttribute('src',/^data:image\/jpeg/);expect((await financial(page)).goal.pockets[0].photo).toBe('');
  await page.locator('#sg-edit-form [type=submit]').click();expect((await financial(page)).goal.pockets[0].photo).toMatch(/^data:image\/jpeg/);
  await page.locator('[data-sg-edit]').click();await page.locator('#sg-photo').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(page.locator('[data-sg-status]')).toContainText('Выберите JPG');
  await page.locator('[data-sg-clear-photo]').click();await page.locator('#sg-edit-form [type=submit]').click();expect((await financial(page)).goal.pockets[0].photo).toBe('');
});
test('completion has finite celebratory motion; disabling motion cancels it without changing data',async({page})=>{
  await open(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  await create(page,{target:'500'});await page.locator('#sg-amount').fill('500');await page.locator('#sg-transfer-form [type=submit]').click();await expect(page.locator('.sg-badge').last()).toContainText('достигнута');await expect(page.locator('.sg-spark')).toHaveCount(10);
  const before=await financial(page);const iterations=await dialog(page).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').map(a=>a.effect.getTiming().iterations));expect(iterations.length).toBeGreaterThan(0);expect(iterations.every(n=>n===1)).toBe(true);
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});await expect(page.locator('.sg-spark')).toHaveCount(0);expect(await dialog(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);expect(await financial(page)).toEqual(before);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-sg-edit]').click();expect(await dialog(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
});
test('goal gallery and editor fit narrow screens and all themes, with no HTML injection',async({page})=>{
  await open(page);await create(page,{title:'<img src=x onerror=alert(1)>',target:'999999999999.99',monthly:'0.01'});await expect(page.locator('#sg-dialog-title img')).toHaveCount(0);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});for(const theme of ['light','dark']){await page.evaluate(t=>setTheme(t),theme);expect(await dialog(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}}
  await page.locator('[data-sg-close]').click();await expect(page.locator('#savings-goals')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('storage failure keeps existing goals, financial reserve and unsaved form intact',async({page})=>{
  await open(page);await create(page);await page.locator('[data-sg-edit]').click();await page.locator('#sg-goal-name').fill('Не удалось сохранить');const before=await financial(page);
  await page.evaluate(()=>{const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fp_goal')throw new DOMException('Quota','QuotaExceededError');return real.call(this,k,v);};});
  await page.locator('#sg-edit-form [type=submit]').click();await expect(page.locator('[data-sg-status]')).toContainText('хранилище заполнено');expect(await financial(page)).toEqual(before);await expect(page.locator('#sg-goal-name')).toHaveValue('Не удалось сохранить');
});
test('goal amounts respect stealth mode and saved transfer focus returns to a live trigger',async({page})=>{
  await open(page);await page.evaluate(()=>toggleStealthMode(true));await expect(page.locator('.sg-summary strong')).toHaveCSS('filter','blur(8px)');await page.evaluate(()=>toggleStealthMode(true));
  await create(page);await page.locator('#sg-amount').fill('500');await page.locator('#sg-transfer-form [type=submit]').click();await page.locator('[data-sg-close]').click();await expect(page.locator('#savings-goals [data-sg-list]')).toBeFocused();
});
test('calendar selection and existing modal openings receive finite feedback with motion enabled',async({page})=>{
  await open(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();goTab('calendar');});await page.locator('#cal-cells [data-cal-date]').nth(12).click();
  await expect.poll(()=>page.locator('#cal-day-section').evaluate(el=>el.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBeGreaterThan(0);
  await page.evaluate(()=>openGoalDetailsModal());await expect.poll(()=>page.locator('#modal-goal-detail .modal-sheet').evaluate(el=>el.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBeGreaterThan(0);
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBe(0);
});
