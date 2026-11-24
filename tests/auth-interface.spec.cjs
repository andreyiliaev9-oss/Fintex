const {test,expect}=require('@playwright/test');
const PASSWORD='Мой зелёный пароль';
async function open(page,{configured=true,offline=false,legacy=false,telegram=true}={}){
  const calls=[];let sessionCount=0,current=PASSWORD;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
    if(url.hostname!=='script.google.com')return route.abort();
    const body=route.request().postDataJSON();calls.push(body);
    if(offline)return route.abort();
    if(legacy)return route.fulfill({json:{ok:true,user:{},transactions:[]}});
    let data;
    switch(body.action){
      case 'auth_status':data={ok:true,password_set:configured,uid:'8141670312'};break;
      case 'auth_setup':current=body.password;configured=true;data={ok:true,session:'memory-only-'+(++sessionCount),expires_in:1800,webhook_token:'a'.repeat(64)};break;
      case 'auth_login':data=body.password===current?{ok:true,session:'memory-only-'+(++sessionCount),expires_in:1800}:{ok:false,code:'WRONG_PASSWORD',error:'Неверный пароль.'};break;
      case 'auth_reset_request':data={ok:true,retry_after:60,expires_in:600};break;
      case 'auth_reset':data=body.code==='123456'?{ok:true,session:'memory-only-'+(++sessionCount),expires_in:1800,webhook_token:'b'.repeat(64)}:{ok:false,code:'WRONG_CODE',error:'Неверный код.'};if(data.ok)current=body.new_password;break;
      case 'auth_change':data=body.password===current?{ok:true,session:'memory-only-'+(++sessionCount),expires_in:1800}:{ok:false,code:'WRONG_PASSWORD',error:'Неверный пароль.'};if(data.ok)current=body.new_password;break;
      case 'auth_logout':data={ok:true};break;
      case 'push_tx':data={ok:true,ack_ids:body.transactions.map(t=>t.id)};break;
      case 'init':data={ok:true,user:{balance:22200},transactions:[],logs:[]};break;
      default:data={ok:false,error:'Unexpected action'};
    }
    return route.fulfill({json:data});
  });
  await page.addInitScript(({telegram})=>{
    localStorage.setItem('fp_name','Анна');localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_motion','0');
    if(telegram)window.Telegram={WebApp:{initData:'test-signed-data',initDataUnsafe:{user:{id:8141670312}},ready(){},expand(){},colorScheme:'dark',onEvent(){},setHeaderColor(){},setBackgroundColor(){}}};
  },{telegram});
  await page.goto('/');
  await page.waitForFunction(()=>!!window.FINTEX_SIM?.ui&&!!window.FintexAuth);
  if(telegram)await expect(page.locator('#auth-title')).not.toHaveText('Минуточку…');
  return calls;
}
async function login(page,password=PASSWORD){await page.locator('#auth-password').fill(password);await page.getByRole('button',{name:'Войти',exact:false}).click();await expect(page.locator('#fintex-auth')).toBeHidden();}

test('password gate hides balances, prevents background sync and keeps secrets out of persistent storage',async({page})=>{
  const calls=await open(page);await expect(page.locator('#auth-title')).toHaveText('С возвращением');
  await expect(page.locator('#hero-balance')).toBeHidden();expect(await page.locator('main').evaluate(el=>el.inert)).toBe(true);
  expect(calls.map(c=>c.action)).toEqual(['auth_status']);
  await page.locator('#auth-password').fill('wrong password');await page.getByRole('button',{name:'Войти'}).click();await expect(page.locator('#auth-status')).toHaveText('Неверный пароль.');
  await login(page);await expect(page.locator('#hero-balance')).toBeVisible();expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
  await expect.poll(()=>calls.some(c=>c.action==='init'&&c.session==='memory-only-1')).toBe(true);
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain(PASSWORD);expect(storage).not.toContain('memory-only');expect(storage).not.toContain('test-signed-data');
  await page.reload();await expect(page.locator('#auth-title')).toHaveText('С возвращением');
});
test('first setup validates confirmation and stores only the separate ingest key',async({page})=>{
  const calls=await open(page,{configured:false});await expect(page.locator('#auth-title')).toHaveText('Защитим ваш Fintex');
  await page.locator('#auth-new').fill(PASSWORD);await page.locator('#auth-confirm').fill('не совпадает пароль');await page.getByRole('button',{name:'Создать пароль'}).click();await expect(page.locator('#auth-status')).toContainText('должны совпадать');
  expect(calls.filter(c=>c.action==='auth_setup')).toHaveLength(0);
  await page.locator('#auth-confirm').fill(PASSWORD);await page.getByRole('button',{name:'Создать пароль'}).click();await expect(page.locator('#fintex-auth')).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('fp_api_token'))).toBe('a'.repeat(64));
});
test('reset explicitly sends to Telegram, enforces resend cooldown and accepts a six-digit code',async({page})=>{
  const calls=await open(page);await page.getByRole('button',{name:'Забыли пароль?'}).click();
  expect(calls.some(c=>c.action==='auth_reset_request')).toBe(false);
  await page.locator('#auth-send').click();await expect(page.locator('#auth-status')).toContainText('Код отправлен');await expect(page.locator('#auth-send')).toBeDisabled();
  await page.locator('#auth-code').fill('000000');await page.locator('#auth-new').fill('Новый пароль на вход');await page.locator('#auth-confirm').fill('Новый пароль на вход');await page.getByRole('button',{name:'Обновить пароль и войти'}).click();await expect(page.locator('#auth-status')).toHaveText('Неверный код.');
  await page.locator('#auth-code').fill('123456');await page.locator('#auth-new').fill('Новый пароль на вход');await page.locator('#auth-confirm').fill('Новый пароль на вход');await page.getByRole('button',{name:'Обновить пароль и войти'}).click();await expect(page.locator('#fintex-auth')).toBeHidden();
  expect(calls.filter(c=>c.action==='auth_reset_request')).toHaveLength(1);
});
test('change password can be cancelled, needs the current password and logout removes access',async({page})=>{
  const calls=await open(page);await login(page);await page.locator('[data-nav="settings"]').click();await page.locator('#settings-security summary').click();
  await page.locator('#auth-change').click();await expect(page.locator('#auth-title')).toHaveText('Новый пароль — спокойно');await page.getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('#fintex-auth')).toBeHidden();
  await page.locator('#auth-change').click();await page.locator('#auth-current').fill(PASSWORD);await page.locator('#auth-new').fill('Другой длинный пароль');await page.locator('#auth-confirm').fill('Другой длинный пароль');await page.getByRole('button',{name:'Сохранить новый пароль'}).click();await expect(page.locator('#fintex-auth')).toBeHidden();
  expect(calls.some(c=>c.action==='auth_change'&&c.session)).toBe(true);await page.locator('#auth-logout').click();await expect(page.locator('#auth-title')).toHaveText('С возвращением');
  expect(await page.evaluate(()=>window.FintexAuth.canSync())).toBe(false);
});
test('network failure or legacy server never opens the financial screen',async({page})=>{
  await open(page,{legacy:true});await expect(page.locator('#auth-title')).toHaveText('Не удалось подключиться');await expect(page.locator('#auth-status')).toContainText('Обновите сервер');await expect(page.locator('#hero-balance')).toBeHidden();
});
test('offline login remains locked and does not offer a bypass',async({page})=>{
  await open(page,{offline:true});await expect(page.locator('#auth-title')).toHaveText('Не удалось подключиться');await expect(page.locator('#hero-balance')).toBeHidden();await expect(page.locator('[data-action="cancel"]')).toHaveCount(0);
});
test('guest mode is explicitly local and makes no cloud requests; protected browser profile requires Telegram',async({page})=>{
  const calls=await open(page,{telegram:false});await expect(page.locator('#fintex-auth')).toBeHidden();expect(calls).toEqual([]);
  await page.evaluate(()=>localStorage.setItem('fp_auth_required','1'));await page.reload();await expect(page.locator('#auth-title')).toHaveText('Откройте Fintex в Telegram');await expect(page.locator('#hero-balance')).toBeHidden();
});
test('backgrounding clears the memory session and immediately hides financial data',async({page})=>{
  await open(page);await login(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#auth-title')).toHaveText('С возвращением');expect(await page.evaluate(()=>window.FintexAuth.canSync())).toBe(false);
});
test('entry is usable at 320px in both styles and modes, with reveal and keyboard focus',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:700});
  for(const style of ['forest','sapphire'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    expect(await page.locator('#fintex-auth').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await expect(page.locator('#auth-password')).toBeVisible();
  }
  await page.locator('[data-reveal="auth-password"]').click();await expect(page.locator('#auth-password')).toHaveAttribute('type','text');
  await page.locator('[data-reveal="auth-password"]').click();await expect(page.locator('#auth-password')).toHaveAttribute('type','password');
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement.closest('#fintex-auth')!==null)).toBe(true);
});
test('a second Telegram account cannot unlock or upload another accounts local records',async({page})=>{
  const calls=await open(page);await login(page);
  await page.evaluate(()=>{localStorage.setItem('fp_auth_uid','99999');state.balance=12345.67;persistAll();});
  const before=calls.length;await page.reload();await expect(page.locator('#auth-title')).toHaveText('Не удалось подключиться');await expect(page.locator('#auth-status')).toContainText('другой учётной записи');await expect(page.locator('#hero-balance')).toBeHidden();
  expect(calls.slice(before).map(c=>c.action)).toEqual(['auth_status']);expect(await page.evaluate(()=>localStorage.getItem('fp_balance'))).toBe('12345.67');
});
test('synced text cannot become executable markup in operation details, analytics or logs',async({page})=>{
  await open(page);await login(page);
  const result=await page.evaluate(()=>{
    const payload='<img src=x onerror="window.__injected=1">';
    state.transactions=[{id:'safe_remote_tx',date:TODAY,type:'expense',amount:1,merchant:payload,category:'subs',source:'Облако',items:[{name:payload,price:1}]}];
    state.autopilotLogs=[{timestamp:new Date().toISOString(),status:payload,summary:payload,bank:payload,error_code:payload,raw_preview:payload}];
    renderAll(false);openTxModal('safe_remote_tx');renderAutopilotLogs();
    return {images:document.querySelectorAll('#mtx-items-list img,#an-detective-list img,#an-subs-list img,#autopilot-logs-list img').length,injected:window.__injected||0};
  });
  expect(result).toEqual({images:0,injected:0});
});
