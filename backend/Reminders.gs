/** Opt-in Telegram reminders; owner installs the clock trigger once. No public webhook. */
var REMINDER_COLUMNS=['user_id','settings_json','context_json','delivery_json','updated_at'];
function reminderSheet(db){return getOrCreateSheet(db.ss,'Reminders',REMINDER_COLUMNS);}
function reminderJson(raw,fallback){try{var v=JSON.parse(String(raw||''));return v&&typeof v==='object'&&!Array.isArray(v)?v:fallback;}catch(e){return fallback;}}
function reminderFind(sh,uid){var rows=sh.getDataRange().getValues();for(var i=1;i<rows.length;i++)if(String(rows[i][0])===uid)return {row:i+1,settings:reminderJson(rows[i][1],FintexReminderModel.defaults()),context:reminderJson(rows[i][2],{}),delivery:reminderJson(rows[i][3],{})};return null;}
function reminderWrite(sh,uid,r){var values=[uid,JSON.stringify(r.settings),JSON.stringify(r.context),JSON.stringify(r.delivery),new Date().toISOString()];if(r.row)sh.getRange(r.row,1,1,5).setValues([values]);else{sh.appendRow(values);r.row=sh.getLastRow();}}
function reminderLocal(now,timezone){return {date:Utilities.formatDate(new Date(now),timezone,'yyyy-MM-dd'),time:Utilities.formatDate(new Date(now),timezone,'HH:mm')};}
function reminderReady(){return ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='sendFintexReminders';});}
function reminderStatus(r){return {ok:true,configured:!!r.row,botUsername:PropertiesService.getScriptProperties().getProperty('FINTEX_BOT_USERNAME')||'',settings:r.settings,schedulerReady:reminderReady(),delivery:{status:r.delivery.status||'none',lastAt:r.delivery.lastAt||null,error:r.delivery.error||''},contextUpdated:r.context.lastSeen||null};}
function reminderAction(db,uid,action,body){
  var sh=reminderSheet(db),r=reminderFind(sh,uid)||{settings:FintexReminderModel.defaults(),context:{},delivery:{}};
  if(action==='reminders_get')return reminderStatus(r);
  if(action==='reminders_save'){
    var p;try{p=FintexReminderModel.settings(body.settings);reminderLocal(Date.now(),p.timezone);}catch(e){authError('INVALID_REMINDERS','Проверьте настройки: '+e.message);}
    // Authenticated self-service consent only. Never trust a supplied chat_id/UID.
    if(p.enabled&&body.consent!==true)authError('REMINDER_CONSENT_REQUIRED','Подтвердите включение напоминаний.');
    if(p.enabled&&!r.settings.enabled){r.delivery.registered=reminderLocal(Date.now(),p.timezone).date;r.delivery.consentedAt=new Date().toISOString();r.delivery.consentVersion=1;}
    r.settings=p;
  }else if(action==='reminders_context'){
    if(!r.settings.enabled)return {ok:true,skipped:true};
  }else authError('UNKNOWN_ACTION','Неизвестная команда.');
  var local=reminderLocal(Date.now(),r.settings.timezone);
  if(r.settings.enabled)r.context=FintexReminderModel.context(body.context,local.date,r.context);
  else r.context={};
  reminderWrite(sh,uid,r);return reminderStatus(r);
}
/** Run manually as owner AFTER deployment. Re-running never creates duplicate clocks. */
function setupFintexReminders(){
  authProperties();reminderSheet(getDb());
  var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+authProperties().bot+'/getMe',{muteHttpExceptions:true});
  var answer;try{answer=JSON.parse(response.getContentText());}catch(e){}
  if(response.getResponseCode()!==200||!answer||!answer.ok)throw new Error('Не удалось проверить бота. Проверьте свойства скрипта.');
  if(answer.result&&/^[A-Za-z0-9_]{5,32}$/.test(answer.result.username||''))PropertiesService.getScriptProperties().setProperty('FINTEX_BOT_USERNAME',answer.result.username);
  var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='sendFintexReminders';});
  if(!triggers.length)ScriptApp.newTrigger('sendFintexReminders').timeBased().everyMinutes(15).create();
  else triggers.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);});
  return {ok:true,intervalMinutes:15};
}
function stopFintexReminders(){ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='sendFintexReminders')ScriptApp.deleteTrigger(t);});return {ok:true};}
function reminderCloudContext(rows,uid,c,today){
  var out=Object.assign({},c);
  rows.forEach(function(r){if(String(r[1])!==uid)return;var d=serverIso(r[2]);if(!serverDate(d)||d>today)return;
    if(String(r[7])==='expense'&&!/transfer|refund|atm/i.test(String(r[8]))){if(!out.lastExpense||d>out.lastExpense)out.lastExpense=d;}
  });return out;
}
function reminderReport(item,rows,uid){
  var income=0,expense=0,seen=Object.create(null);
  rows.forEach(function(r){var d=serverIso(r[2]),amount=serverMoney(r[5]);if(String(r[1])!==uid||!serverDate(d)||d<item.from||d>item.to||amount===null||amount<=0||/transfer|refund|atm/i.test(String(r[8]))||seen[String(r[0])])return;seen[String(r[0])]=true;if(String(r[7])==='income')income=serverAdd(income,amount);if(String(r[7])==='expense')expense=serverAdd(expense,amount);});
  return '\nВ облачном журнале '+item.from+' — '+item.to+' на момент отправки: доходы '+income.toFixed(2)+' ₽, расходы '+expense.toFixed(2)+' ₽. Локальные несинхронизированные записи и накопления вне журнала не учтены.';
}
function sendFintexReminders(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    var now=Date.now(),started=now,db=getDb(),sh=reminderSheet(db),rows=sh.getDataRange().getValues(),total=rows.length-1;if(total<=0)return;
    var props=PropertiesService.getScriptProperties(),cursor=Math.max(0,Math.floor(Number(props.getProperty('FINTEX_REMINDERS_CURSOR'))||0))%total,txs=db.txs.getDataRange().getValues().slice(1),bot=authProperties().bot;
    // Small Apps Script deployment: bounded work, round-robin across users.
    for(var count=0;count<Math.min(total,20)&&Date.now()-started<240000;count++){
      var index=(cursor+count)%total+1,raw=rows[index],uid=String(raw[0]),r={row:index+1,settings:reminderJson(raw[1],{}),context:reminderJson(raw[2],{}),delivery:reminderJson(raw[3],{})};
      props.setProperty('FINTEX_REMINDERS_CURSOR',String((index)%total));
      if(!/^\d+$/.test(uid)||r.settings.enabled!==true)continue;
      try{
        var p=FintexReminderModel.settings(r.settings),local=reminderLocal(now,p.timezone),c=reminderCloudContext(txs,uid,r.context,local.date);c.registered=r.delivery.registered;
        var item=FintexReminderModel.due(p,c,r.delivery,local,now);if(!item)continue;
        var text=item.text;if(item.kind==='reports'&&p.includeAmounts)text+=reminderReport(item,txs,uid);
        // Reserve BEFORE network I/O: at-most-one attempt/day even on ambiguous timeout.
        var s=r.delivery;s.lastAt=now;s.lastDay=local.date;s.status='pending';s.error='';s.sent=s.sent||{};s.sent[item.key]=now;s.byKind=s.byKind||{};s.byKind[item.kind]=now;
        var keys=Object.keys(s.sent).sort(function(a,b){return s.sent[b]-s.sent[a];});keys.slice(80).forEach(function(k){delete s.sent[k];});
        reminderWrite(sh,uid,r);
        var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+bot+'/sendMessage',{method:'post',contentType:'application/json',muteHttpExceptions:true,payload:JSON.stringify({chat_id:uid,text:text,disable_web_page_preview:true,reply_markup:{inline_keyboard:[[{text:'Открыть FINTEX →',web_app:{url:'https://andreyiliaev9-oss.github.io/Fintex/'}}]]}})});
        var code=response.getResponseCode(),answer;try{answer=JSON.parse(response.getContentText());}catch(e){answer={};}
        if(code===200&&answer.ok===true){s.status='sent';}
        else if(code===403||(code===400&&/chat not found|user is deactivated/i.test(String(answer.description||'')))){s.status='blocked';s.error='BOT_BLOCKED';r.settings.enabled=false;r.context={};}
        else if(code===429){s.status='limited';s.error='RATE_LIMIT';s.retryAfter=now+Math.min(86400,Math.max(60,Number(answer.parameters&&answer.parameters.retry_after)||3600))*1000;}
        else{s.status='failed';s.error='DELIVERY_FAILED';}
        reminderWrite(sh,uid,r);
      }catch(e){
        // Never log exceptions containing Bot API URL/token or request contents.
        if(r.delivery.status==='pending'){r.delivery.status='unknown';r.delivery.error='DELIVERY_UNCERTAIN';reminderWrite(sh,uid,r);}
      }
    }
  }finally{lock.releaseLock();}
}
