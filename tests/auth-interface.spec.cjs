const {test,expect}=require('@playwright/test');
async function open(page,{telegram=true,offline=false,oldFlags=true}={}){
  const calls=[];
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
    if(url.hostname!=='script.google.com')return route.abort();
    const body=route.request().postDataJSON();calls.push(body);
    if(offline)return route.abort();
    return route.fulfill({json:body.action==='init'?{ok:true,uid:'8141670312',user:{balance:22200},transactions:[],logs:[]}:{ok:true,ack_ids:[]}});
  });
  await page.addInitScript(({telegram,oldFlags})=>{
    localStorage.setItem('fp_name','Анна');localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_motion','0');
    localStorage.setItem('fp_balance','12345.67');localStorage.setItem('fp_local_tx','[]');
    if(oldFlags){localStorage.setItem('fp_auth_required','1');localStorage.setItem('fp_auth_uid','8141670312');localStorage.setItem('fp_auth_lock_event','old-lock');}
    if(telegram)window.Telegram={WebApp:{initData:'test-signed-data',initDataUnsafe:{user:{id:8141670312}},ready(){},expand(){},colorScheme:'dark',onEvent(){},setHeaderColor(){},setBackgroundColor(){}}};
  },{telegram,oldFlags});
  await page.goto('/');await page.waitForFunction(()=>!!window.FINTEX_SIM?.ui&&!!window.FintexCloud);
  await expect(page.locator('#hero-balance')).toBeVisible();return calls;
}
test('opens immediately with old PIN flags and offline server, retaining local records',async({page})=>{
  const calls=await open(page,{offline:true});
  await expect(page.locator('#fintex-auth')).toHaveCount(0);
  expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
  expect(await page.evaluate(()=>localStorage.getItem('fp_balance'))).toBe('12345.67');
  expect(calls.every(c=>!c.action.startsWith('auth_'))).toBe(true);
  await page.reload();await expect(page.locator('#hero-balance')).toBeVisible();
});
test('browser without Telegram opens locally even with old required-password flags',async({page})=>{
  const calls=await open(page,{telegram:false});expect(calls).toEqual([]);
  expect(await page.evaluate(()=>window.FintexCloud.canSync())).toBe(false);
  await page.locator('[data-nav="settings"]').click();
  await expect(page.locator('#auth-change')).toHaveCount(0);
  await expect(page.locator('#settings-security')).toHaveCount(0);
});
test('cloud requests carry signed Telegram data, never passwords or sessions',async({page})=>{
  const calls=await open(page);
  await expect.poll(()=>calls.some(c=>c.action==='init')).toBe(true);
  for(const c of calls){expect(c.init_data).toBe('test-signed-data');expect(c.password).toBeUndefined();expect(c.session).toBeUndefined();}
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#hero-balance')).toBeVisible();
});
test('another Telegram account never uploads the previous accounts records',async({page})=>{
  await open(page,{telegram:false});
  await page.evaluate(()=>{window.Telegram={WebApp:{initData:'another-signed-data',initDataUnsafe:{user:{id:999}}}};});
  expect(await page.evaluate(()=>window.FintexCloud.canSync())).toBe(false);
  await expect(page.locator('#hero-balance')).toBeVisible();
});
test('styles at 320px remain accessible without an auth screen',async({page})=>{
  await open(page,{telegram:false});await page.setViewportSize({width:320,height:700});
  for(const style of ['forest','sapphire'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    await expect(page.locator('#hero-balance')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.hasAttribute('data-auth-locked'))).toBe(false);
  }
});
test('synced text cannot become executable markup in financial views',async({page})=>{
  await open(page,{telegram:false});
  const result=await page.evaluate(()=>{
    const payload='<img src=x onerror="window.__injected=1">';
    state.transactions=[{id:'safe_remote_tx',date:TODAY,type:'expense',amount:1,merchant:payload,category:'subs',source:'Облако',items:[{name:payload,price:1}]}];
    state.autopilotLogs=[{timestamp:new Date().toISOString(),status:payload,summary:payload,bank:payload,error_code:payload,raw_preview:payload}];
    renderAll(false);openTxModal('safe_remote_tx');renderAutopilotLogs();
    return {images:document.querySelectorAll('#mtx-items-list img,#an-detective-list img,#an-subs-list img,#autopilot-logs-list img').length,injected:window.__injected||0};
  });expect(result).toEqual({images:0,injected:0});
});

test('notification rollback leaves the app openable offline with no reminder UI or subscription requests',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const calls=await open(page,{offline:true});await page.evaluate(()=>dismissReturningSplash());
  await page.locator('[data-nav="settings"]').click();
  await expect(page.locator('#settings-notifications,#fintex-reminders,#reminder-form')).toHaveCount(0);
  expect(await page.evaluate(()=>typeof window.FintexReminders)).toBe('undefined');
  expect(await page.locator('script[src*="reminders.js"]').count()).toBe(0);
  expect(calls.some(c=>String(c.action).startsWith('reminders_'))).toBe(false);
  await page.locator('[data-nav="home"]').click();await expect(page.locator('#hero-balance')).toBeVisible();
  expect(errors).toEqual([]);
});
