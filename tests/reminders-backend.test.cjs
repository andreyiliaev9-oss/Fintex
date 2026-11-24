const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,UID}=require('./helpers/reminder-backend.cjs'),R=require('../backend/ReminderModel.gs');
const prefs=()=>({...R.defaults(),timezone:'UTC',time:'12:00',reports:false,receipts:false,enabled:true});
const enable=(f,more={})=>f.auth('reminders_save',{settings:{...prefs(),...more},consent:true,context:{lastExpense:'2026-11-23',bills:[]}});
const row=f=>f.sheets.get('Reminders').data[1];
test('reminder endpoints require signed self identity and explicit consent; ingest tokens/GET cannot enable messages',()=>{
  const f=fixture();f.setup();
  assert.equal(f.post({action:'reminders_save',settings:prefs(),consent:true,user_id:UID}).ok,false);
  assert.equal(f.auth('reminders_save',{settings:prefs(),consent:false}).code,'REMINDER_CONSENT_REQUIRED');
  assert.equal(f.auth('reminders_save',{settings:prefs(),consent:true,user_id:'999'}).code,'TELEGRAM_INVALID');
  assert.equal(f.auth('reminders_get').settings.enabled,false);assert.equal(f.auth('reminders_get').schedulerReady,false);
  assert.equal(enable(f).ok,true);assert.equal(row(f)[0],UID);
  const other=f.post({action:'reminders_get',init_data:f.initData('999')});assert.equal(other.settings.enabled,false);
});
test('owner installer is idempotent, validates bot first, touches only its own trigger and does not send a user message',()=>{
  const f=fixture();f.ctx.setupFintexReminders();f.ctx.setupFintexReminders();assert.equal(f.triggers.length,1);assert.equal(f.messages.length,0);
  f.triggers.push({getHandlerFunction:()=> 'otherTask'});f.ctx.stopFintexReminders();assert.equal(f.triggers.length,1);assert.equal(f.triggers[0].getHandlerFunction(),'otherTask');
  assert.equal(f.auth('reminders_get').botUsername,'fintex_test_bot');
});
test('clock sends only to authenticated owner of row, with open-app button; repeated ticks and preference changes cannot duplicate',()=>{
  const f=fixture();f.setup();enable(f);f.ctx.sendFintexReminders();f.ctx.sendFintexReminders();assert.equal(f.messages.length,1);assert.equal(f.messages[0].chat_id,UID);assert.match(f.messages[0].text,/Проверьте/);
  assert.equal(f.messages[0].reply_markup.inline_keyboard[0][0].web_app.url,'https://andreyiliaev9-oss.github.io/Fintex/');
  enable(f,{time:'12:30'});f.tick(31*60000);f.ctx.sendFintexReminders();assert.equal(f.messages.length,1);
  assert.equal(JSON.parse(row(f)[3]).status,'sent');
});
test('blocked bot stops future sends and drops context; 429 obeys retry-after; ambiguous delivery is never blindly retried',()=>{
  for(const [code,throws,status] of [[403,false,'blocked'],[400,false,'blocked'],[429,false,'limited'],[500,false,'failed'],[200,true,'unknown']]){
    const f=fixture();enable(f);f.setDelivery(code,throws);f.ctx.sendFintexReminders();f.ctx.sendFintexReminders();assert.equal(f.messages.length,1);const d=JSON.parse(row(f)[3]);assert.equal(d.status,status);
    if(code===403||code===400){assert.equal(JSON.parse(row(f)[1]).enabled,false);assert.deepEqual(JSON.parse(row(f)[2]),{});}
    if(code===429)assert.equal(d.retryAfter,d.lastAt+7200000);
    assert.ok(!JSON.stringify(row(f)).includes('sensitive token'));
  }
});
test('opt-out is server-side, deletes context and cannot be undone by a queued context request',()=>{
  const f=fixture();enable(f);assert.equal(f.auth('reminders_save',{settings:{...prefs(),enabled:false}}).ok,true);
  assert.equal(f.auth('reminders_context',{context:{goalActive:true}}).skipped,true);assert.deepEqual(JSON.parse(row(f)[2]),{});
  f.ctx.sendFintexReminders();assert.equal(f.messages.length,0);
});
test('latest cloud expense suppresses stale client check; UTC/local date and DST are evaluated in selected timezone',()=>{
  const f=fixture();f.setup();enable(f);
  f.auth('push_tx',{balance:100,transactions:[{id:'tx_today',date:'2026-11-24',amount:1,type:'expense'}]});f.ctx.sendFintexReminders();assert.equal(f.messages.length,0);
  assert.equal(f.ctx.reminderLocal(Date.UTC(2026,2,29,0,30),'Europe/Warsaw').time,'01:30');
  assert.equal(f.ctx.reminderLocal(Date.UTC(2026,2,29,1,30),'Europe/Warsaw').time,'03:30');
  assert.equal(f.ctx.reminderLocal(Date.UTC(2026,10,24,23,30),'Europe/Warsaw').date,'2026-11-25');
});
test('optional numerical reports use only this users recorded cloud transactions and disclose incomplete coverage',()=>{
  const f=fixture();f.setup();f.auth('push_tx',{balance:100,transactions:[{id:'tx_income',date:'2026-11-24',amount:100.25,type:'income'},{id:'tx_expense',date:'2026-11-24',amount:10.1,type:'expense'},{id:'tx_transfer',date:'2026-11-24',amount:900,type:'income',op_kind:'transfer_in'}]});
  enable(f,{reports:true,reportFrequency:'daily',reportTime:'12:00',includeAmounts:true});f.ctx.sendFintexReminders();assert.equal(f.messages.length,1);assert.match(f.messages[0].text,/100.25 ₽/);assert.match(f.messages[0].text,/10.10 ₽/);assert.match(f.messages[0].text,/несинхронизированные/);assert.ok(!f.messages[0].text.includes('900'));
});
test('scheduler writes no financial data, and installer download matches server modules',()=>{
  const f=fixture();f.setup();const before=JSON.stringify([...f.sheets].filter(([k])=>k!=='Reminders').map(([k,v])=>[k,v.data]));enable(f);f.ctx.sendFintexReminders();assert.equal(JSON.stringify([...f.sheets].filter(([k])=>k!=='Reminders').map(([k,v])=>[k,v.data])),before);
  const bundle=fs.readFileSync('downloads/Fintex-Code.gs','utf8');assert.equal(bundle,fs.readFileSync('downloads/Fintex-Code.txt','utf8'));for(const file of ['Auth.gs','ReminderModel.gs','Reminders.gs','Code.gs'])assert.ok(bundle.includes(fs.readFileSync('backend/'+file,'utf8')));
});
test('bounded round-robin cursor reaches later users without repeated attempts for earlier users',()=>{
  const f=fixture();for(let i=0;i<25;i++){
    const uid=String(1000+i);const result=f.post({action:'reminders_save',init_data:f.initData(uid),consent:true,settings:prefs(),context:{lastExpense:'2026-11-23'}});assert.equal(result.ok,true);
  }
  f.ctx.sendFintexReminders();assert.equal(f.messages.length,20);f.ctx.sendFintexReminders();assert.equal(f.messages.length,25);assert.equal(new Set(f.messages.map(m=>m.chat_id)).size,25);
});
test('long-running batch refreshes time for each user and never starts later deliveries during quiet hours',()=>{
  const f=fixture();f.tick((9*60+59)*60000); // 21:59 UTC
  for(const uid of ['1001','1002'])f.post({action:'reminders_save',init_data:f.initData(uid),consent:true,settings:{...prefs(),time:'21:30'},context:{lastExpense:'2026-11-23'}});
  const fetch=f.ctx.UrlFetchApp.fetch;f.ctx.UrlFetchApp.fetch=function(...args){const response=fetch(...args);f.tick(60000);return response;};
  f.ctx.sendFintexReminders();assert.equal(f.messages.length,1);assert.equal(f.messages[0].chat_id,'1001');
});
test('clock is rechecked after persisting a reservation; a slow sheet write cannot cause a late send',()=>{
  const f=fixture();f.tick((9*60+59)*60000);enable(f,{time:'21:30'});
  const write=f.ctx.reminderWrite;let slow=true;f.ctx.reminderWrite=function(...args){write(...args);if(slow&&args[2].delivery.status==='pending'){slow=false;f.tick(60000);}};
  f.ctx.sendFintexReminders();assert.equal(f.messages.length,0);assert.equal(JSON.parse(row(f)[3]).status,'skipped');assert.equal(JSON.parse(row(f)[3]).error,'WINDOW_PASSED');
});
