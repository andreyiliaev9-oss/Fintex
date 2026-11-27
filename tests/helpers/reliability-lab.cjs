/* Synthetic lab only. Real client cloud.js + signed requests + repository GAS code.
 * Playwright substitutes transport; gas-fixture substitutes Google/Telegram services.
 * No production endpoint or spreadsheet can be reached by these contexts. */
const {expect}=require('@playwright/test');
const {fixture}=require('./gas-fixture.cjs');
const fs=require('node:fs/promises');
const UID='8141670312';
function reliabilityLab(browser){
 const server=fixture();server.setup();server.sheets.get('Users').data[1][3]=1000;
 const clients=[],events=[];
 async function client({storageState,fresh=false}={}){
  const context=await browser.newContext({storageState,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  const device={context,page,online:true,dropNext:false,loseMutationResponses:false,hold:null};clients.push(device);
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
   if(url.hostname!=='script.google.com'||request.method()!=='POST')return route.abort();
   if(!device.online)return route.abort('internetdisconnected');
   // Do not alter request JSON or replace FintexCloud.request: authenticate exactly
   // the signed body produced by the real client, using a test-only bot key.
   const body=request.postDataJSON(),result=server.post(body);
   events.push({device:clients.indexOf(device)+1,action:body.action,ok:result.ok,mutations:(body.mutations||[]).map(m=>({id:m.id,txId:m.txId})),status:(result.results||[]).map(r=>r.status)});
   if(device.hold&&body.action==='ledger_sync'){
    const hold=device.hold;device.hold=null;hold.started();await hold.wait;
   }
   if((device.dropNext||device.loseMutationResponses)&&body.action==='ledger_sync'&&body.mutations?.length){device.dropNext=false;return route.abort('connectionreset');}
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
  });
  await context.addInitScript(({fresh,uid})=>{
   window.Telegram={WebApp:{ready(){},expand(){},initData:'',initDataUnsafe:{user:{id:Number(uid)}}}};
   if(fresh||localStorage.getItem('fp_name'))return;
   Object.entries({fp_onboarded:'1',fp_name:'Тестовый профиль',fp_motion:'0',fp_tour_v1:'complete',fp_balance:'1000',fp_local_tx:'[]',fp_bills:'[]',fp_goal:JSON.stringify({title:'Тестовый резерв',target:10000,saved:0})}).forEach(([k,v])=>localStorage.setItem(k,v));
  },{fresh,uid:UID});
  device.ready=async()=>{await page.waitForFunction(()=>!!window.FintexDaily&&!!window.FintexBackup&&!!window.FintexSync);await page.evaluate(()=>dismissReturningSplash());};
  device.signIn=()=>page.evaluate(value=>Telegram.WebApp.initData=value,server.initData());
  device.sync=()=>page.evaluate(()=>FintexSync.sync());
  device.offline=async value=>{device.online=!value;await context.setOffline(value);};
  device.snapshot=()=>page.evaluate(()=>({balance:state.balance,transactions:JSON.parse(JSON.stringify(state.transactions)),queue:JSON.parse(localStorage.getItem('fp_ledger_sync_v1')||'null'),paused:localStorage.getItem('fp_cloud_paused_restore')}));
  device.add=async(amount='100,25',name='Тестовая покупка')=>{await page.locator('[data-nav=home]').click();await page.locator('#hdr-plus-btn').click();await page.locator('#flow-amount').fill(amount);await page.locator('#flow-name').fill(name);await page.locator('#flow-save').click();await expect(page.locator('#daily-flow')).toBeHidden();return page.evaluate(()=>state.transactions[0].id);};
  device.edit=async(id,amount)=>{await page.evaluate(id=>FintexDaily.open({id}),id);await page.locator('#flow-amount').fill(String(amount));await page.locator('#flow-save').click();await expect(page.locator('#daily-flow')).toBeHidden();};
  device.conflicts=async()=>{await page.evaluate(()=>{goTab('settings');document.getElementById('settings-sync').open=true;});return page.locator('#ledger-conflicts');};
  device.exportFile=async()=>{await page.evaluate(()=>{goTab('settings');document.getElementById('settings-backup').open=true;});const wait=page.waitForEvent('download');await page.locator('#backup-export').click();const download=await wait,path=await download.path();return {path,file:JSON.parse(await fs.readFile(path,'utf8'))};};
  device.restoreFile=async(path,{fresh=false}={})=>{
   await page.locator('#backup-file').setInputFiles(path);await expect(page.locator('#backup-dialog')).toBeVisible();
   if(!fresh){const wait=page.waitForEvent('download');await page.locator('#backup-safety-export').click();await (await wait).path();}
   await page.locator('#backup-confirm').check();await Promise.all([page.waitForEvent('load'),page.locator('#backup-replace').click()]);await device.ready();
  };
  device.holdResponse=()=>{let started,release;const began=new Promise(r=>started=r),wait=new Promise(r=>release=r);device.hold={started,wait};return {began,release};};
  await page.goto('http://127.0.0.1:3100/');await device.ready();
  return device;
 }
 return {server,events,client,cloud:()=>server.auth('ledger_sync',{mutations:[]}),async close(){for(const d of clients)await d.context.close();}};
}
module.exports={reliabilityLab};
