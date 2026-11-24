/** FINTEX v7 — единый сервер без паролей/PIN, с добровольными напоминаниями.
 * Замените весь Code.gs этим файлом; не оставляйте дубли Auth/Reminders/ReminderModel.gs.
 * Существующую таблицу и свойства скрипта сохраняйте, новую базу создавать не нужно.
 * Для напоминаний один раз запустите setupFintexReminders от имени владельца.
 * После сохранения обновите версию текущего развёртывания, сохранив /exec URL.
 */
/** FINTEX cloud access via verified Telegram initData. No passwords or PINs.
 * No token, password, initData or reset code may be logged.
 * Required Script Properties: FINTEX_BOT_TOKEN, FINTEX_AUTH_SECRET (64 hex chars).
 */
var AUTH_COLUMNS = ['user_id','salt','verifier','version','failures','blocked_until','reset_hash','reset_expires','reset_attempts','reset_next_send','hour_start','hour_count'];
function authError(code, message) { var e = new Error(message); e.code = code; throw e; }
function authProperties() {
  var p = PropertiesService.getScriptProperties();
  var bot = p.getProperty('FINTEX_BOT_TOKEN') || '';
  var secret = p.getProperty('FINTEX_AUTH_SECRET') || '';
  if (!bot || !/^[a-f0-9]{64}$/i.test(secret)) authError('AUTH_NOT_CONFIGURED', 'Администратору нужно настроить бота и секрет в свойствах Google Apps Script.');
  return { bot: bot, secret: secret };
}
function authHex(bytes) { return bytes.map(function(b){ return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function authHmac(text) { return authHex(Utilities.computeHmacSha256Signature(String(text), authProperties().secret)); }
function authEqual(a,b) {
  a=String(a); b=String(b); var diff=a.length ^ b.length;
  for(var i=0;i<Math.max(a.length,b.length);i++) diff |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0);
  return diff===0;
}
function authRandom(label) {
  return authHmac(label+'|'+Utilities.getUuid()+'|'+Utilities.getUuid()+'|'+Date.now());
}
function authTelegram(initData) {
  var props=authProperties();
  if(typeof initData!=='string' || !initData || initData.length>16384) authError('TELEGRAM_REQUIRED','Откройте Fintex заново через Telegram.');
  var fields=Object.create(null);
  try {
    initData.split('&').forEach(function(part){
      var pos=part.indexOf('='); if(pos<1) throw new Error('format');
      var key=decodeURIComponent(part.slice(0,pos).replace(/\+/g,' '));
      if(Object.prototype.hasOwnProperty.call(fields,key)) throw new Error('duplicate');
      fields[key]=decodeURIComponent(part.slice(pos+1).replace(/\+/g,' '));
    });
  } catch(e) { authError('TELEGRAM_INVALID','Не удалось подтвердить вход через Telegram.'); }
  var hash=fields.hash || ''; delete fields.hash;
  var check=Object.keys(fields).sort().map(function(k){return k+'='+fields[k];}).join('\n');
  var key=Utilities.computeHmacSha256Signature(props.bot,'WebAppData');
  var expected=authHex(Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(),key));
  if(!/^[a-f0-9]{64}$/i.test(hash) || !authEqual(expected,hash.toLowerCase())) authError('TELEGRAM_INVALID','Не удалось подтвердить вход через Telegram.');
  var age=Math.floor(Date.now()/1000)-Number(fields.auth_date);
  if(!Number.isFinite(age) || age < -60 || age>3600) authError('TELEGRAM_EXPIRED','Данные входа устарели. Закройте и заново откройте Fintex в Telegram.');
  var user;
  try { user=JSON.parse(fields.user); } catch(e) {}
  if(!user || !Number.isSafeInteger(user.id) || user.id<=0) authError('TELEGRAM_INVALID','Некорректная учётная запись Telegram.');
  return String(user.id);
}
// Existing Auth sheets are left untouched for backwards-compatible owner helpers.
// No password, PIN, reset or session API is exposed.
function authRotateWebhook(db,uid) {
  var token=authRandom('webhook'),user=findUserRow(db.users,uid);
  if(user)db.users.getRange(user.row,6).setValue(token);
  else db.users.appendRow([uid,'','Т-Банк',0,'',token,new Date().toISOString()]);
  return token;
}

/* Pure reminder policy. No network, storage, implicit permission or financial mutations. */
var FintexReminderModel = (function () {
  'use strict';
  var DAY=86400000;
  function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;var n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;}
  function shift(s,n){return new Date(date(s)+n*DAY).toISOString().slice(0,10);}
  function defaults(){return {enabled:false,receipts:true,expenses:true,bills:true,reports:true,goals:false,time:'20:30',reportTime:'19:00',reportFrequency:'weekly',timezone:'Europe/Warsaw',includeAmounts:false};}
  function settings(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Укажите настройки напоминаний.');
    var out=defaults();
    ['enabled','receipts','expenses','bills','reports','goals','includeAmounts'].forEach(function(k){if(typeof raw[k]!=='boolean')throw new Error('Некорректный переключатель: '+k);out[k]=raw[k];});
    ['time','reportTime'].forEach(function(k){if(!/^(09|1\d|20|21):[0-5]\d$/.test(raw[k]||''))throw new Error('Выберите время с 09:00 до 21:59.');out[k]=raw[k];});
    if(['weekly','daily'].indexOf(raw.reportFrequency)<0)throw new Error('Выберите ежедневный или еженедельный итог.');out.reportFrequency=raw.reportFrequency;
    if(['UTC','Europe/Warsaw','Europe/Moscow','Europe/Kaliningrad','Europe/Berlin','Europe/London','Europe/Istanbul','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Almaty','Asia/Tbilisi','Asia/Dubai','Asia/Vladivostok','Asia/Bangkok','Asia/Tokyo','America/New_York','America/Los_Angeles'].indexOf(raw.timezone)<0)throw new Error('Выберите поддерживаемый часовой пояс.');
    if(typeof raw.timezone!=='string'||raw.timezone.length>64||!/^([A-Za-z_+-]+\/)*[A-Za-z_+-]+$/.test(raw.timezone))throw new Error('Укажите часовой пояс IANA, например Europe/Warsaw.');out.timezone=raw.timezone;
    if(out.enabled&&!['receipts','expenses','bills','reports','goals'].some(function(k){return out[k];}))throw new Error('Выберите хотя бы один тип напоминаний.');
    return out;
  }
  function context(raw,today,old){
    raw=raw||{};old=old||{};var out={lastSeen:today,goalActive:raw.goalActive===true,bills:[]};
    ['lastReceipt','lastExpense'].forEach(function(k){var v=raw[k];out[k]=date(v)!==null&&v<=today?v:'';if(date(old[k])!==null&&old[k]<=today&&old[k]>out[k])out[k]=old[k];});
    if(Array.isArray(raw.bills))out.bills=raw.bills.slice(0,50).filter(function(b){return b&&typeof b.id==='string'&&/^[\w-]{1,100}$/.test(b.id)&&date(b.due)!==null&&b.due>=today&&b.due<=shift(today,366);}).map(function(b){return {id:b.id,due:b.due};});
    return out;
  }
  function due(p,c,s,local,now){
    if(!p.enabled||date(local.date)===null||!/^\d{2}:\d{2}$/.test(local.time))return null;
    var hour=Number(local.time.slice(0,2)),minute=hour*60+Number(local.time.slice(3));
    if(hour<9||hour>=22||s.lastDay===local.date||now-Number(s.lastAt||0)<20*3600000||Number(s.retryAfter||0)>now)return null;
    var sent=s.sent||{},dow=new Date(date(local.date)).getUTCDay(),week=shift(local.date,-((dow+6)%7));
    function at(time){var parts=time.split(':'),delta=minute-(Number(parts[0])*60+Number(parts[1]));return delta>=0&&delta<90;}
    function item(kind,key,text){return sent[key]?null:{kind:kind,key:key,text:text};}
    if(p.reports&&(p.reportFrequency==='daily'||dow===0)&&at(p.reportTime)){
      var report=item('reports','report_'+(p.reportFrequency==='weekly'?week:local.date),'📊 FINTEX · '+(p.reportFrequency==='weekly'?'Ваш финансовый итог за неделю':'Ваш финансовый итог за день')+'\nПосмотрите записанные доходы и расходы. Полнота учёта зависит от добавленных вами операций.');
      if(report){report.from=p.reportFrequency==='weekly'?week:local.date;report.to=local.date;return report;}
    }
    if(!at(p.time)||!c.lastSeen||date(c.lastSeen)===null||date(local.date)-date(c.lastSeen)>7*DAY)return null;
    if(p.bills){var bill=(c.bills||[]).find(function(b){return date(b.due)!==null&&b.due>=local.date&&b.due<=shift(local.date,2)&&!sent['bill_'+b.id+'_'+b.due];});if(bill)return item('bills','bill_'+bill.id+'_'+bill.due,'📅 FINTEX · Предстоящий платёж\nВ последнем синхронизированном списке есть неоплаченный платёж на '+bill.due.split('-').reverse().join('.')+'. Проверьте актуальность и оплату в приложении.');}
    var choices=[];
    var receiptBase=c.lastReceipt||c.registered;
    if(p.receipts&&date(receiptBase)!==null&&date(local.date)-date(receiptBase)>=3*DAY)choices.push({kind:'receipts',text:'🧾 FINTEX · Не забудьте загрузить чеки\nВ доступных данных давно не было новых чеков. Если были покупки, добавьте их, чтобы они попали в аналитику. Если покупок не было — ничего делать не нужно.'});
    if(p.expenses&&c.lastExpense!==local.date)choices.push({kind:'expenses',text:'💳 FINTEX · Время проверить учёт\nПроверьте, все ли сегодняшние операции добавлены. Мы не знаем, были ли неучтённые покупки; если операций не было, пропустите напоминание.'});
    if(p.goals&&c.goalActive&&dow===3)choices.push({kind:'goals',text:'🎯 FINTEX · Ваш план накоплений\nЕсли это сейчас комфортно, вернитесь к своей цели. Можно пополнить подушку, изменить темп или пропустить — решение за вами.'});
    choices=choices.filter(function(x){return !s.byKind||!s.byKind[x.kind]||now-s.byKind[x.kind]>=3*DAY;}).sort(function(a,b){return Number((s.byKind||{})[a.kind]||0)-Number((s.byKind||{})[b.kind]||0);});
    return choices.length?item(choices[0].kind,choices[0].kind+'_'+local.date,choices[0].text):null;
  }
  return {defaults:defaults,settings:settings,context:context,due:due,date:date,shift:shift};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FintexReminderModel;

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

/** FINTEX Cloud v7. Deploy Code.gs, Auth.gs, ReminderModel.gs and Reminders.gs, or the combined installer.
 * Cloud requests verify Telegram initData. No passwords or PINs. Shortcut tokens are ingest-only.
 */
var ADMIN_UID='8141670312';
function jsonResponse(obj) {return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function getOrCreateSheet(ss,name,headers) {
  var sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.appendRow(headers);sh.setFrozenRows(1);}
  var actual=sh.getDataRange().getValues()[0]||[];
  if(headers.some(function(h,i){return String(actual[i]||'')!==h;}))authError('SCHEMA_MISMATCH','Структура листа '+name+' не совпадает. Проверьте заголовки; данные не менялись.');
  return sh;
}
function getDb() {
  var props=PropertiesService.getScriptProperties(), id=props.getProperty('FINTEX_SS_ID');
  var ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  // Never silently create another database after a configuration/open error.
  if(!ss) authError('DB_NOT_CONFIGURED','Укажите FINTEX_SS_ID в свойствах скрипта.');
  return {ss:ss,
    users:getOrCreateSheet(ss,'Users',['user_id','name','bank','balance','payday','api_token','updated_at']),
    txs:getOrCreateSheet(ss,'Transactions',['id','user_id','date','time','merchant','amount','category','type','op_kind','source','dedup_hash','items_json','created_at']),
    logs:getOrCreateSheet(ss,'Logs',['log_id','timestamp','uid','source','status','bank','summary','raw_preview','error_code'])};
}
function findUserRow(sh,uid) {
  var data=sh.getDataRange().getValues();
  for(var i=1;i<data.length;i++) if(String(data[i][0])===String(uid)) return {row:i+1,values:data[i]};
  return null;
}
function serverText(value,max) {
  var text=String(value==null?'':value).slice(0,max||200);
  // Sheets must not evaluate formulas supplied as merchant names or notes.
  return /^[=+@\-]/.test(text)?"'"+text:text;
}
function serverMoney(value) {
  if((typeof value!=='number'&&typeof value!=='string') || String(value).trim()==='') return null;
  var n=Number(value);if(!Number.isFinite(n) || Math.abs(n)>1e12)return null;
  return Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON*Math.abs(n))*100)/100;
}
function serverAdd(a,b){return (Math.round(a*100)+Math.round(b*100))/100;}
function serverDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  var parts=value.split('-').map(Number),d=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  return d.toISOString().slice(0,10)===value;
}
function serverToday(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');}
function appendLog(sh,uid,source,status,bank,summary,raw,error) {
  // Bank text, credentials and reset codes are intentionally not kept in logs.
  sh.appendRow(['srv_'+Utilities.getUuid(),new Date().toISOString(),uid,source,status,serverText(bank,60),serverText(summary,200),'',error||'']);
}
function normalizeMerchantServer(raw) {
  var s=String(raw||'').replace(/(?:покупка|оплата|списание|зачисление|пополнение|карта|mir-\d+|\*\d{4}|rub|rur|руб\.?|₽)/gi,' ').replace(/\s+/g,' ').trim();
  var brands=[[/пятер[оё]?ч|пятерч|pyaterochka/i,'Пятёрочка'],[/магнит|magnit/i,'Магнит'],[/вкусвилл|vkusvill/i,'ВкусВилл'],[/перекр[её]ст/i,'Перекрёсток'],[/wildberries|вайлдберриз/i,'Wildberries'],[/ozon|озон/i,'Ozon'],[/лукойл|lukoil/i,'Лукойл']];
  for(var i=0;i<brands.length;i++) if(brands[i][0].test(s))return brands[i][1];
  return s?s.charAt(0).toUpperCase()+s.slice(1,80):'Операция по карте';
}
function classifyServerCategory(title) {
  var s=String(title||'');
  if(/пятёроч|пятероч|магнит|вкусвилл|перекрёст|продукт/i.test(s))return 'food';
  if(/бензин|азс|лукойл|газпром|такси|метро|транспорт/i.test(s))return 'taxi';
  if(/кофе|кафе|ресторан|бургер|пицц|суши/i.test(s))return 'cafe';
  if(/ozon|озон|wildberries|dns|м\.видео/i.test(s))return 'shop';
  if(/подписк|плюс|мтс|билайн|кинопоиск/i.test(s))return 'subs';
  if(/аптек|лекарств|витамин|врач/i.test(s))return 'health';return 'other';
}
function detectBankServer(txt,fallback) {
  if(/т-банк|тинькофф|t-bank|tinkoff/i.test(txt))return 'Т-Банк';
  if(/сбер|sber/i.test(txt))return 'Сбер';if(/альфа|alfa/i.test(txt))return 'Альфа-Банк';
  if(/ozon\s*банк|озон\s*банк/i.test(txt))return 'Ozon Банк';if(/втб|vtb/i.test(txt))return 'ВТБ';
  if(/газпромбанк/i.test(txt))return 'Газпромбанк';return fallback||'Т-Банк';
}
function parseIncomingSmsText(rawText,fallback) {
  var txt=String(rawText||'').replace(/\u00a0/g,' ').trim();if(txt.length<3||txt.length>4000)return null;
  var bank=detectBankServer(txt,fallback),date=serverToday();
  var time=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'HH:mm');
  var tm=txt.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);if(tm)time=('0'+tm[1]).slice(-2)+':'+tm[2];
  var dm=txt.match(/\b([0-3]?\d)[./]([01]?\d)[./](20\d{2})\b/);
  if(dm)date=dm[3]+'-'+('0'+dm[2]).slice(-2)+'-'+('0'+dm[1]).slice(-2);
  if(!serverDate(date)||date>serverToday())return null;
  var refund=/возврат|отмена\s+(?:покупки|оплаты|операции)/i.test(txt);
  var income=refund||(/пополнен|зачислен|поступил|кэшбэк|зарплат|аванс|\+\s*\d/i.test(txt)&&!/покупк|оплат|списан/i.test(txt));
  var type=income?'income':'expense';
  var main=txt.split(/баланс|доступно|остаток/i)[0];
  var match=main.match(/([+-]?\s*\d[\d ]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб\.?|RUB|RUR)/i)||main.match(/(?:покупк[а-я]*|оплат[а-я]*|списан[а-я]*|перевод|зачислен[а-я]*|возврат)\s+(\d[\d ]{0,12}(?:[.,]\d{1,2})?)/i);
  if(!match)return null;
  var amount=serverMoney(Math.abs(Number(match[1].replace(/\s/g,'').replace(',','.'))));if(amount===null||amount<=0)return null;
  var bm=txt.match(/(?:баланс|доступно|остаток)[:\s]*(-?\d[\d ]{0,12}(?:[.,]\d{1,2})?)/i);
  var balance=bm?serverMoney(Number(bm[1].replace(/\s/g,'').replace(',','.'))):null;
  var cleaned=main.replace(match[0],'').replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g,' ').replace(/\b\d{1,2}:\d{2}\b/g,' ');
  var merchant=normalizeMerchantServer(cleaned);
  var hash=authHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,[date,time,Math.round(amount*100),type,merchant,bank].join('|')));
  return {id:'wh_'+Utilities.getUuid(),date:date,time:time,merchant:merchant,amount:amount,category:income?'other':classifyServerCategory(merchant),type:type,op_kind:refund?'refund':type,source:'iOS Webhook · '+bank,bank:bank,cardBalance:balance,dedup_hash:'srv_'+hash};
}
function serverLocked(callback) {
  var lock=LockService.getScriptLock();
  try {
    if(!lock.tryLock(10000))return jsonResponse({ok:false,code:'BUSY',error:'Сервер занят. Повторите запрос.'});
    return jsonResponse(callback());
  } catch(e) {return jsonResponse({ok:false,code:e.code||'SERVER_ERROR',error:e.code?e.message:'Не удалось выполнить запрос. Попробуйте позже.'});}
  finally {if(lock.hasLock())lock.releaseLock();}
}
function doGet(e) {
  var p=(e&&e.parameter)||{};
  if(p.text&&p.uid)return serverLocked(function(){return handleWebhookIngest(String(p.uid),String(p.token||''),p.text);});
  return jsonResponse({ok:true,service:'FINTEX Cloud Backend',version:'7.0-reminders',cloud_protocol:2,reminders_protocol:1});
}
function doPost(e) {
  var body,raw=e&&e.postData&&e.postData.contents;
  try {if(!raw||raw.length>128000)throw new Error('size');body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('body');}
  catch(err){return jsonResponse({ok:false,code:'INVALID_REQUEST',error:'Нужен JSON-запрос допустимого размера.'});}
  return serverLocked(function(){
    // Verify configuration before any access. No legacy UID-only fallback.
    authProperties();
    var action=String(body.action||'');
    var allowed=['init','push_tx','set_config','reminders_get','reminders_save','reminders_context'];
    if(!action && body.text)return handleWebhookIngest(String(body.user_id||body.uid||''),String(body.token||''),body.text);
    if(allowed.indexOf(action)<0)authError('UNKNOWN_ACTION','Неизвестная команда.');
    var uid=authTelegram(body.init_data);
    if(body.user_id&&String(body.user_id)!==uid)authError('TELEGRAM_INVALID','Учётная запись не совпадает.');
    var db=getDb();
    if(action.indexOf('reminders_')===0)return reminderAction(db,uid,action,body);
    if(action==='init'&&!findUserRow(db.users,uid))authRotateWebhook(db,uid);
    if(action==='set_config') {
      var token=String(body.api_token||'');
      if(!/^[a-zA-Z0-9_-]{32,128}$/.test(token))authError('INVALID_TOKEN','Ключ автоматизации: от 32 до 128 букв, цифр, _ или -.');
      var u=findUserRow(db.users,uid);if(!u)authError('USER_NOT_FOUND','Учётная запись не найдена.');
      db.users.getRange(u.row,6).setValue(token);return {ok:true};
    }
    if(action==='push_tx')return serverPush(db,uid,body);
    return serverInit(db,uid);
  });
}
function serverKnown(db,uid) {
  var rows=db.txs.getDataRange().getValues(),ids=Object.create(null),hashes=Object.create(null);
  for(var i=1;i<rows.length;i++)if(String(rows[i][1])===uid){ids[String(rows[i][0])]=true;if(rows[i][10])hashes[String(rows[i][10])]=true;}
  return {ids:ids,hashes:hashes};
}
function serverAppendTx(db,uid,t) {
  db.txs.appendRow([serverText(t.id,150),uid,t.date,t.time||'',serverText(t.merchant,100),t.amount,serverText(t.category||'other',50),t.type,serverText(t.op_kind||t.type,50),serverText(t.source||'App',100),serverText(t.dedup_hash||'',150),JSON.stringify(t.items||[]).slice(0,30000),new Date().toISOString()]);
}
function serverPush(db,uid,body) {
  var incoming=body.transactions;
  if(!Array.isArray(incoming)||incoming.length>30)authError('INVALID_TRANSACTIONS','Не больше 30 операций за запрос.');
  var balance=serverMoney(body.balance);
  if(balance===null)authError('INVALID_BALANCE','Некорректный остаток.');
  // Validate the whole batch before writing either transactions or user balance.
  var valid=incoming.map(function(tx){
    if(!tx||typeof tx.id!=='string'||!tx.id||tx.id.length>150||!serverDate(tx.date)||tx.date>serverToday()||['income','expense'].indexOf(tx.type)<0||serverMoney(tx.amount)===null||serverMoney(tx.amount)<=0||(tx.currency&&['RUB','₽','РУБ'].indexOf(String(tx.currency).toUpperCase())<0))authError('INVALID_TRANSACTIONS','Некорректная операция в пакете.');
    if(!/^[\w-]+$/.test(tx.id))authError('INVALID_TRANSACTIONS','Некорректный идентификатор операции.');
    return {id:tx.id,date:tx.date,time:/^\d{2}:\d{2}$/.test(tx.time||'')?tx.time:'',merchant:tx.merchant||'Операция',amount:serverMoney(tx.amount),type:tx.type,category:tx.category,op_kind:tx.op_kind,source:tx.source,dedup_hash:String(tx.dedup_hash||''),items:Array.isArray(tx.items)?tx.items:[]};
  });
  var known=serverKnown(db,uid),ack=[],added=0;
  valid.forEach(function(t){
    if(!known.ids[t.id]&&!(t.dedup_hash&&known.hashes[t.dedup_hash])){serverAppendTx(db,uid,t);added++;}
    known.ids[t.id]=true;if(t.dedup_hash)known.hashes[t.dedup_hash]=true;ack.push(t.id);
  });
  var user=findUserRow(db.users,uid),info=body.user||{};
  // A retry containing only acknowledged records cannot overwrite a newer cloud balance.
  if(user && added>0) {
    if(info.name)db.users.getRange(user.row,2).setValue(serverText(info.name,100));
    if(info.bank)db.users.getRange(user.row,3).setValue(serverText(info.bank,60));
    db.users.getRange(user.row,4).setValue(balance);
    if(serverDate(info.payday))db.users.getRange(user.row,5).setValue(info.payday);
    db.users.getRange(user.row,7).setValue(new Date().toISOString());
  }
  return {ok:true,ack_ids:ack};
}
function serverIso(value) {return value instanceof Date?Utilities.formatDate(value,Session.getScriptTimeZone(),'yyyy-MM-dd'):String(value||'');}
function serverInit(db,uid) {
  var u=findUserRow(db.users,uid);if(!u)authError('USER_NOT_FOUND','Учётная запись не найдена.');
  var rows=db.txs.getDataRange().getValues(),txs=[];
  for(var i=rows.length-1;i>=1&&txs.length<150;i--)if(String(rows[i][1])===uid){
    var r=rows[i],items=[];try{items=JSON.parse(r[11]||'[]');}catch(e){}
    txs.push({id:String(r[0]),date:serverIso(r[2]),time:r[3] instanceof Date?Utilities.formatDate(r[3],Session.getScriptTimeZone(),'HH:mm'):String(r[3]||''),merchant:String(r[4]),amount:serverMoney(r[5])||0,category:String(r[6]||'other'),type:String(r[7]||'expense'),op_kind:String(r[8]||'expense'),source:String(r[9]||'Облако'),dedup_hash:String(r[10]||''),items:items});
  }
  var logs=db.logs.getDataRange().getValues(),list=[];
  for(var j=logs.length-1;j>=1&&list.length<40;j--)if(String(logs[j][2])===uid){var l=logs[j];list.push({log_id:String(l[0]),timestamp:String(l[1]),uid:uid,source:String(l[3]),status:String(l[4]),bank:String(l[5]),summary:String(l[6]),raw_preview:'',error_code:String(l[8])});}
  var result={ok:true,uid:uid,webhook_token:String(u.values[5]||''),user:{user_id:uid,name:String(u.values[1]||''),bank:String(u.values[2]||'Т-Банк'),balance:serverMoney(u.values[3])||0,payday:serverIso(u.values[4])},transactions:txs,logs:list};
  if(uid===ADMIN_UID)result.admin={total_users:Math.max(0,db.users.getLastRow()-1),total_tx:Math.max(0,db.txs.getLastRow()-1)};
  return result;
}
function handleWebhookIngest(uid,token,text) {
  authProperties();var db=getDb(),u=findUserRow(db.users,uid);
  if(!/^\d+$/.test(uid)||!u||!/^\w[\w-]{31,127}$/.test(token)||!authEqual(String(u.values[5]),token))authError('INVALID_TOKEN','Недействительный ключ автоматизации.');
  var parsed=parseIncomingSmsText(text,String(u.values[2]||'Т-Банк'));
  if(!parsed)authError('PARSE_NO_AMOUNT','Не удалось распознать операцию.');
  var known=serverKnown(db,uid);
  if(known.hashes[parsed.dedup_hash])return {ok:true,duplicate:true,message:'Дубль пропущен'};
  var balance=serverMoney(u.values[3])||0;
  var next=parsed.cardBalance!==null?parsed.cardBalance:serverAdd(balance,parsed.type==='income'?parsed.amount:-parsed.amount);
  serverAppendTx(db,uid,parsed);db.users.getRange(u.row,4).setValue(next);db.users.getRange(u.row,7).setValue(new Date().toISOString());
  appendLog(db.logs,uid,'iOS Shortcut','OK',parsed.bank,parsed.merchant+' · '+parsed.amount+' ₽','','');
  return {ok:true,message:'Операция сохранена',transaction:parsed};
}

/** Run manually once as the script owner to grant Sheets/Telegram permissions. */
function setupFintexBackend() {
  var config=authProperties(),db=getDb();
  getOrCreateSheet(db.ss,'Auth',AUTH_COLUMNS);
  var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+config.bot+'/getMe',{muteHttpExceptions:true});
  var result=JSON.parse(response.getContentText());
  if(response.getResponseCode()!==200||!result.ok)throw new Error('Не удалось проверить токен бота. Проверьте FINTEX_BOT_TOKEN.');
  return {ok:true,bot_username:result.result.username};
}

/** Optional owner-only helper for phone setup. Never exposed by doPost.
 * HMAC derives a separate secret from the private bot token and unique nonces.
 * No secret is printed or sent to another service; existing values are preserved.
 */
function createFintexSecret() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = PropertiesService.getScriptProperties();
    if (p.getProperty('FINTEX_AUTH_SECRET')) {
      console.log('Секрет уже есть. Он не изменён.');
      return;
    }
    var token = p.getProperty('FINTEX_BOT_TOKEN');
    if (!token || !/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
      throw new Error('Проверьте FINTEX_BOT_TOKEN в свойствах скрипта.');
    }
    var data = 'Fintex/auth-secret/v1|' + Utilities.getUuid() + '|' + Utilities.getUuid();
    var secret = Utilities.computeHmacSha256Signature(data, token)
      .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
    p.setProperty('FINTEX_AUTH_SECRET', secret);
    console.log('Готово. Секрет сохранён в свойствах скрипта.');
  } finally {
    lock.releaseLock();
  }
}

/** Owner-only, explicit fresh database creation. Never exposed by doGet/doPost.
 * Existing tables and their contents are not modified or deleted.
 */
function createFintexDatabase() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    authProperties();
    var p = PropertiesService.getScriptProperties();
    var previous = p.getProperty('FINTEX_SS_ID');
    var created = p.getProperty('FINTEX_CREATED_DB_ID');
    if (created) {
      if (created !== previous) {
        throw new Error('Новая таблица уже создавалась. Настройка подключения после этого изменена; автоматическое переключение остановлено.');
      }
      var current = getDb();
      getOrCreateSheet(current.ss, 'Auth', AUTH_COLUMNS);
      console.log('Новая таблица уже подключена. Повторно создавать её не нужно.');
      return;
    }
    var ss = SpreadsheetApp.create('FINTEX_Database');
    getOrCreateSheet(ss, 'Users', ['user_id', 'name', 'bank', 'balance', 'payday', 'api_token', 'updated_at']);
    getOrCreateSheet(ss, 'Transactions', ['id', 'user_id', 'date', 'time', 'merchant', 'amount', 'category', 'type', 'op_kind', 'source', 'dedup_hash', 'items_json', 'created_at']);
    getOrCreateSheet(ss, 'Logs', ['log_id', 'timestamp', 'uid', 'source', 'status', 'bank', 'summary', 'raw_preview', 'error_code']);
    getOrCreateSheet(ss, 'Auth', AUTH_COLUMNS);
    var settings = {FINTEX_SS_ID: ss.getId(), FINTEX_CREATED_DB_ID: ss.getId()};
    if (previous) settings.FINTEX_PREVIOUS_SS_ID = previous;
    p.setProperties(settings);
    console.log('Готово. Новая таблица создана и подключена. Старая не удалена.');
  } finally {
    lock.releaseLock();
  }
}
