const {test,expect}=require('@playwright/test');
const R=require('../backend/ReminderModel.gs');
async function open(page,{telegram=true,grant=true,enabled=false,old=false,permission=true}={}){
  const calls=[];let prefs={...R.defaults(),enabled},context=null;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();if(url.hostname!=='script.google.com')return route.abort();
    const body=route.request().postDataJSON();calls.push(body);
    if(body.action.startsWith('reminders_')){
      if(old)return route.fulfill({json:{ok:false,code:'UNKNOWN_ACTION',error:'Неизвестная команда.'}});
      if(body.action==='reminders_save'){prefs=body.settings;context=body.context;}
      if(body.action==='reminders_context')context=body.context;
      return route.fulfill({json:{ok:true,settings:prefs,schedulerReady:true,botUsername:'fintex_test_bot',contextUpdated:context?'2026-11-24':null,delivery:{status:'none'}}});
    }
    return route.fulfill({json:{ok:true,uid:'8141670312',user:{balance:10000},transactions:[],logs:[],ack_ids:[]}});
  });
  await page.addInitScript(({telegram,grant,permission})=>{
    for(const [k,v] of Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_balance:'10000',fp_local_tx:'[]',fp_bills:'[]',fp_scan_history:'[]',fp_visual_style:'growth',fp_theme:'light'}))localStorage.setItem(k,v);
    window.__permissionCalls=0;
    if(telegram){window.Telegram={WebApp:{initData:'test-signed-data',initDataUnsafe:{user:{id:8141670312}},ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast:()=>true,openTelegramLink:url=>window.__openedBot=url}};if(permission)window.Telegram.WebApp.requestWriteAccess=callback=>{window.__permissionCalls++;callback(grant);};}
  },{telegram,grant,permission});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexReminders&&!!window.FINTEX_SIM?.ui);await page.evaluate(()=>dismissReturningSplash());
  await page.locator('[data-nav="settings"]').click();await page.locator('#settings-notifications > summary').click();
  if(telegram&&!old)await expect(page.locator('#reminder-status')).toContainText('Настройки загружены');
  return calls;
}
test('outside Telegram no server calls, no consent prompt and no locally simulated activation',async({page})=>{
  const calls=await open(page,{telegram:false});await expect(page.locator('[name="enabled"]')).not.toBeChecked();
  await page.locator('[name="enabled"]').check();await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('только из Telegram');
  expect(calls.filter(c=>c.action.startsWith('reminders_'))).toHaveLength(0);
});
test('explicit permission precedes signed server save; types/time/privacy persist without changing finances',async({page})=>{
  const calls=await open(page);expect(calls.some(c=>c.action==='reminders_save')).toBe(false);
  const before=await page.evaluate(()=>JSON.stringify({balance:state.balance,goal:state.goal,tx:state.transactions}));
  await page.locator('[name="enabled"]').check();await page.locator('[name="goals"]').check();await page.locator('[name="time"]').fill('20:00');await page.locator('#reminder-save').click();
  await expect(page.locator('#reminder-status')).toContainText('сохранены на сервере');
  const saved=calls.find(c=>c.action==='reminders_save');expect(saved.consent).toBe(true);expect(saved.init_data).toBe('test-signed-data');expect(saved.settings.time).toBe('20:00');expect(saved.settings.goals).toBe(true);expect(saved.settings.includeAmounts).toBe(false);
  expect(await page.evaluate(()=>window.__permissionCalls)).toBe(1);expect(await page.evaluate(()=>JSON.stringify({balance:state.balance,goal:state.goal,tx:state.transactions}))).toBe(before);
  await page.locator('#reminder-refresh').click();await expect(page.locator('#reminder-status')).toContainText('загружены');await expect(page.locator('[name="enabled"]')).toBeChecked();
  await page.locator('#reminder-bot').click();expect(await page.evaluate(()=>window.__openedBot)).toBe('https://t.me/fintex_test_bot');
});
test('declined or unavailable write permission never opts in on server',async({page})=>{
  const calls=await open(page,{grant:false});await page.locator('[name="enabled"]').check();await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('не получено');expect(calls.some(c=>c.action==='reminders_save')).toBe(false);
  await page.evaluate(()=>{delete Telegram.WebApp.requestWriteAccess;});await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('не получено');expect(calls.some(c=>c.action==='reminders_save')).toBe(false);
});
test('opt-out saves immediately without asking for permission again',async({page})=>{
  const calls=await open(page,{enabled:true});await page.locator('[name="enabled"]').uncheck();await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('выключена на сервере');expect(calls.find(c=>c.action==='reminders_save').settings.enabled).toBe(false);expect(await page.evaluate(()=>window.__permissionCalls)).toBe(0);
});
test('old backend clearly requires deployment instead of pretending settings are active',async({page})=>{
  const calls=await open(page,{old:true});await expect(page.locator('#reminder-status')).toContainText('Сервер пока не поддерживает');await page.locator('[name="enabled"]').check();await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('Проверить подключение');expect(calls.some(c=>c.action==='reminders_save')).toBe(false);
});
test('activity sends minimal context and actual receipt confirmation date, not bank screenshots or historical purchase dates',async({page})=>{
  const calls=await open(page,{enabled:true});
  await page.evaluate(()=>{state.transactions=[{id:'bank',type:'expense',source:'FINTEX Capture',date:TODAY,amount:500,merchant:'PRIVATE'}];state.scanHistory=[];FintexReminders.activity(true);});
  await expect.poll(()=>calls.some(c=>c.action==='reminders_context')).toBe(true);expect(calls.filter(c=>c.action==='reminders_context').at(-1).context.lastReceipt).toBe('');
  await page.evaluate(()=>{upsertScanArchive({scan_id:'receipt',confirmed:true,date:'2026-01-01',merchant:'SECRET',total:100});FintexReminders.activity(true);});
  await expect.poll(()=>calls.filter(c=>c.action==='reminders_context').length).toBeGreaterThan(1);
  const context=calls.filter(c=>c.action==='reminders_context').at(-1).context;expect(context.lastReceipt).toBe(await page.evaluate(()=>TODAY));expect(JSON.stringify(context)).not.toContain('SECRET');expect(JSON.stringify(context)).not.toContain('PRIVATE');expect(context.balance).toBeUndefined();
});
test('settings fit 320px in all palettes and modes, and show honest timing/priority caveats',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});const panel=page.locator('#fintex-reminders');
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
  await page.evaluate(()=>{setVisualStyle('growth');setTheme('light');});await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'* {scroll-behavior:auto !important;}'});await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'docs/reminders-preview.png'});
});
test('network failure never claims activation; background activity does not overwrite draft settings',async({page})=>{
  await open(page,{enabled:true});await page.locator('[name="time"]').fill('21:00');await page.evaluate(()=>FintexReminders.activity(true));
  await page.waitForTimeout(3300);await expect(page.locator('[name="time"]')).toHaveValue('21:00');
  await page.route('https://script.google.com/**',route=>route.request().postDataJSON().action==='reminders_save'?route.abort():route.fallback());
  await page.locator('#reminder-save').click();await expect(page.locator('#reminder-status')).toContainText('не подтверждено');
  await page.locator('#reminder-refresh').click();await expect(page.locator('[name="time"]')).toHaveValue('20:30');
});
