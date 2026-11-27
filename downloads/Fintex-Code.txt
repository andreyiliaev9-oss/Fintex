/** FINTEX v8.2 — Telegram verification + ledger + captures + confirmed purchase places.
 * Replace code in the EXISTING project; keep properties and approved database.
 * Deploy a new version of the EXISTING web app. Never recreate the database.
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


/** FINTEX Cloud v8. Deploy Code.gs, Auth.gs, QuickCapture.gs and Places.gs, or the combined installer.
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
  return jsonResponse({ok:true,service:'FINTEX Cloud Backend',version:'8.2-satellite',cloud_protocol:2,ledger_protocol:3,quick_capture_protocol:1,places_protocol:2});
}
function doPost(e) {
  var body,raw=e&&e.postData&&e.postData.contents;
  try {if(!raw||raw.length>128000)throw new Error('size');body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('body');}
  catch(err){return jsonResponse({ok:false,code:'INVALID_REQUEST',error:'Нужен JSON-запрос допустимого размера.'});}
  return serverLocked(function(){
    // Verify configuration before any access. No legacy UID-only fallback.
    authProperties();
    var action=String(body.action||'');
    if(action==='sms_location_ingest')return placesIngest(body);
    if(action==='quick_capture_parse'||action==='quick_capture_submit')return qcHandle(body);
    var allowed=['init','push_tx','set_config','ledger_sync','quick_capture_status','quick_capture_pair','quick_capture_revoke'];
    if(!action && body.text)return handleWebhookIngest(String(body.user_id||body.uid||''),String(body.token||''),body.text);
    if(allowed.indexOf(action)<0)authError('UNKNOWN_ACTION','Неизвестная команда.');
    var uid=authTelegram(body.init_data);
    if(body.user_id&&String(body.user_id)!==uid)authError('TELEGRAM_INVALID','Учётная запись не совпадает.');
    var db=getDb();
    if((action==='init'||action==='ledger_sync'||action.indexOf('quick_capture_')===0)&&!findUserRow(db.users,uid))authRotateWebhook(db,uid);
    if(action.indexOf('quick_capture_')===0)return qcOwner(action,uid);
    if(action==='set_config') {
      var token=String(body.api_token||'');
      if(!/^[a-zA-Z0-9_-]{32,128}$/.test(token))authError('INVALID_TOKEN','Ключ автоматизации: от 32 до 128 букв, цифр, _ или -.');
      var u=findUserRow(db.users,uid);if(!u)authError('USER_NOT_FOUND','Учётная запись не найдена.');
      db.users.getRange(u.row,6).setValue(token);return {ok:true};
    }
    if(action==='ledger_sync')return serverLedgerSync(db,uid,body);
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
  if(serverLedgerActive(db,uid))authError('UPGRADE_REQUIRED','Обновите Fintex: журнал использует синхронизацию исправлений.');
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
  var result={ok:true,ledger_protocol:3,places_protocol:2,uid:uid,webhook_token:String(u.values[5]||''),user:{user_id:uid,name:String(u.values[1]||''),bank:String(u.values[2]||'Т-Банк'),balance:serverMoney(u.values[3])||0,payday:serverIso(u.values[4])},transactions:txs,logs:list};
  if(serverLedgerActive(db,uid)){var ledger=serverLedgerState(db,uid);result.user.balance=ledger.balance;result.transactions=Object.keys(ledger.records).map(function(id){return ledger.records[id].tx;}).filter(Boolean).slice(-150);}
  if(uid===ADMIN_UID)result.admin={total_users:Math.max(0,db.users.getLastRow()-1),total_tx:Math.max(0,db.txs.getLastRow()-1)};
  return result;
}
function handleWebhookIngest(uid,token,text) {
  authProperties();var db=getDb(),u=findUserRow(db.users,uid);
  if(!/^\d+$/.test(uid)||!u||!/^\w[\w-]{31,127}$/.test(token)||!authEqual(String(u.values[5]),token))authError('INVALID_TOKEN','Недействительный ключ автоматизации.');
  var parsed=parseIncomingSmsText(text,String(u.values[2]||'Т-Банк'));
  if(!parsed)authError('PARSE_NO_AMOUNT','Не удалось распознать операцию.');
  var known=serverKnown(db,uid);
  if(known.hashes[parsed.dedup_hash]||placesKnownSms(db,uid,parsed.dedup_hash))return {ok:true,duplicate:true,message:'Дубль пропущен'};
  var balance=serverMoney(u.values[3])||0;
  var next=parsed.cardBalance!==null?parsed.cardBalance:serverAdd(balance,parsed.type==='income'?parsed.amount:-parsed.amount);
  if(parsed.cardBalance!==null&&serverLedgerActive(db,uid))next=serverAdd(parsed.cardBalance,-serverLedgerState(db,uid).delta);
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

/** Revisioned ledger v3. Each mutation is ONE append-only commit row under the
 * script lock. A lost response is safe to retry with the same mutation ID.
 * Base Transactions/Users stay intact; tombstones and revisions never expire. */
function serverLedgerActive(db,uid){
  var sh=db.ss.getSheetByName('LedgerEvents');if(!sh)return false;
  return sh.getDataRange().getValues().slice(1).some(function(r){return String(r[1])===uid;});
}
function serverLedgerEffect(t){return !t?0:t.type==='income'?t.amount:t.type==='expense'?-t.amount:t.type==='adjustment'?t.balance_delta:0;}
function serverLedgerTx(t){
  if(!t||typeof t!=='object'||Array.isArray(t)||!/^\w[\w-]{0,149}$/.test(String(t.id||''))||!serverDate(t.date)||t.date>serverToday()||['expense','income','transfer','adjustment'].indexOf(t.type)<0)authError('INVALID_LEDGER','Некорректная операция.');
  var n=serverMoney(t.amount);
  if(typeof t.amount!=='number'||n===null||n<=0||n!==t.amount)authError('INVALID_LEDGER','Некорректная сумма.');
  if(t.currency&&['RUB','₽','РУБ'].indexOf(t.currency)<0)authError('INVALID_LEDGER','Только рублёвые операции.');
  var clean={id:t.id,date:t.date,amount:n,type:t.type,merchant:String(t.merchant||'Операция').slice(0,100),category:String(t.category||'other').slice(0,100),source:String(t.source||'App').slice(0,100),items:Array.isArray(t.items)?t.items:[]};
  ['time','op_kind','op_label','dedup_hash','scan_id','transfer_from','transfer_to','bill_id','bill_before','bill_after','goal_withdrawal'].forEach(function(k){if(t[k]!==undefined)clean[k]=t[k];});
  if(t.type==='adjustment'){
    if(typeof t.balance_delta!=='number'||serverMoney(t.balance_delta)!==t.balance_delta||Math.abs(t.balance_delta)!==n)authError('INVALID_LEDGER','Некорректная корректировка.');clean.balance_delta=t.balance_delta;
  }
  if(t.location!==undefined&&t.location!==null){var place=placesLocation(t.location);if(!place)authError('INVALID_LOCATION','Некорректная геометка.');clean.location=place;}
  var text=JSON.stringify(clean);
  if(text.length>38000||/"(?:__proto__|constructor|prototype)"\s*:/.test(text))authError('INVALID_LEDGER','Операция слишком велика или содержит недопустимые поля.');
  return clean;
}
function serverLedgerState(db,uid){
  var records=Object.create(null),ops=Object.create(null),base=db.txs.getDataRange().getValues();
  for(var i=1;i<base.length;i++)if(String(base[i][1])===uid){
    var r=base[i],items=[];try{items=JSON.parse(r[11]||'[]');}catch(_){}
    var tx={id:String(r[0]),date:serverIso(r[2]),time:r[3] instanceof Date?Utilities.formatDate(r[3],Session.getScriptTimeZone(),'HH:mm'):String(r[3]||''),merchant:String(r[4]),amount:serverMoney(r[5]),category:String(r[6]||'other'),type:String(r[7]),op_kind:String(r[8]||r[7]),source:String(r[9]||'Облако'),dedup_hash:String(r[10]||''),items:items};
    records[tx.id]={id:tx.id,revision:1,tx:tx};
  }
  var sheet=db.ss.getSheetByName('LedgerEvents'),rows=sheet?sheet.getDataRange().getValues():[],delta=0,generation=0;
  for(var j=1;j<rows.length;j++)if(String(rows[j][1])===uid){
    var row=rows[j],payload=JSON.parse(String(row[4]));
    records[String(row[2])]={id:String(row[2]),revision:Number(row[3]),tx:payload};
    ops[String(row[0])]={id:String(row[0]),txId:String(row[2]),revision:Number(row[3])};delta=serverAdd(delta,Number(row[5]));generation++;
  }
  var user=findUserRow(db.users,uid);return {records:records,ops:ops,delta:delta,generation:generation,balance:serverAdd(serverMoney(user.values[3])||0,delta)};
}
function serverLedgerSync(db,uid,body){
  // This historical spreadsheet is never a migration/write target.
  if(db.ss.getId&&db.ss.getId()==='1X-hFpWRGUomCIlmQsDvV4I2m5Ke9A9FIQ4we5aypvps')authError('PROTECTED_DATABASE','Исходная база защищена от изменений.');
  var incoming=body.mutations||[];
  if(!Array.isArray(incoming)||incoming.length>20)authError('INVALID_LEDGER','Не больше 20 изменений.');
  var mutations=incoming.map(function(m){
    if(!m||!/^\w[\w-]{0,149}$/.test(String(m.id||''))||!/^\w[\w-]{0,149}$/.test(String(m.txId||''))||!Number.isInteger(m.baseRevision)||m.baseRevision<0)authError('INVALID_LEDGER','Некорректная ревизия.');
    var tx=m.tx===null?null:serverLedgerTx(m.tx);if(tx&&tx.id!==m.txId)authError('INVALID_LEDGER','Идентификатор не совпадает.');
    return {id:m.id,txId:m.txId,baseRevision:m.baseRevision,tx:tx};
  });
  var state=serverLedgerState(db,uid),results=[];
  // A token covers base ingestion too: webhook changes cannot produce mixed pages.
  function token(s){return authHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([s.balance,s.records])));}
  if(body.pageToken&&body.pageToken!==token(state))return {ok:true,ledger_protocol:3,restart:true};
  mutations.forEach(function(m){
    if(state.ops[m.id]){
      var old=state.ops[m.id];if(old.txId!==m.txId)authError('INVALID_LEDGER','Идентификатор изменения уже занят.');
      results.push({id:m.id,status:'acked',revision:old.revision});return;
    }
    var current=state.records[m.txId]||{revision:0,tx:null};
    if(current.revision!==m.baseRevision){results.push({id:m.id,status:'conflict',current:state.records[m.txId]||{id:m.txId,revision:0,tx:null}});return;}
    var delta=serverAdd(serverLedgerEffect(m.tx),-serverLedgerEffect(current.tx)),revision=current.revision+1;
    if(serverMoney(serverAdd(state.balance,delta))===null)authError('INVALID_LEDGER','Слишком большой остаток.');
    var sh=getOrCreateSheet(db.ss,'LedgerEvents',['mutation_id','user_id','transaction_id','revision','payload_json','balance_delta','committed_at']);
    sh.appendRow([m.id,uid,m.txId,revision,JSON.stringify(m.tx),delta,new Date().toISOString()]);
    state.records[m.txId]={id:m.txId,revision:revision,tx:m.tx};state.ops[m.id]={txId:m.txId,revision:revision};state.balance=serverAdd(state.balance,delta);state.generation++;
    results.push({id:m.id,status:'acked',revision:revision});
  });
  var ids=Object.keys(state.records).sort(),offset=Number(body.offset||0);
  if(!Number.isInteger(offset)||offset<0||offset>ids.length)authError('INVALID_LEDGER','Некорректная страница.');
  var page=[],bytes=0,end=offset;
  while(end<ids.length&&page.length<100){var record=state.records[ids[end]],size=JSON.stringify(record).length;if(page.length&&bytes+size>90000)break;page.push(record);bytes+=size;end++;}
  return {ok:true,ledger_protocol:3,results:results,records:page,balance:state.balance,pageToken:token(state),nextOffset:end<ids.length?end:null,total:ids.length};
}


/** Quick Capture v1. Separate ingest-only credentials; never log OCR or keys.
 * Deploy with Auth.gs + Code.gs. No external OCR/AI service is called.
 */
function qcProperty(uid){return 'FINTEX_QC_'+uid;}
function qcDigest(text){return authHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text)));}
function qcRecord(uid){var raw=PropertiesService.getScriptProperties().getProperty(qcProperty(uid));try{return JSON.parse(raw||'null');}catch(e){return null;}}
function qcShortcutUrl(){var url=PropertiesService.getScriptProperties().getProperty('FINTEX_QC_SHORTCUT_URL')||'';return /^https:\/\/www\.icloud\.com\/shortcuts\/[a-f0-9]{32}$/i.test(url)?url:'';}
function qcOwner(action,uid){
  var props=PropertiesService.getScriptProperties(),record=qcRecord(uid);
  if(action==='quick_capture_pair'){
    var token=authRandom('quick-capture|'+uid);
    record={hash:authHmac('qc|'+uid+'|'+token),created_at:new Date().toISOString(),revoked:false};
    props.setProperty(qcProperty(uid),JSON.stringify(record));
    return {ok:true,quick_capture_protocol:1,uid:uid,token:token,scope:'capture:append',shortcut_url:qcShortcutUrl()};
  }
  if(action==='quick_capture_revoke'){props.setProperty(qcProperty(uid),JSON.stringify({revoked:true}));record=null;}
  return {ok:true,quick_capture_protocol:1,uid:uid,paired:!!(record&&!record.revoked),shortcut_url:qcShortcutUrl()};
}
function qcAuthorize(body){
  var uid=String(body.uid||''),token=String(body.token||'');
  if(!/^\d{1,20}$/.test(uid)||! /^[a-f0-9]{64}$/.test(token))authError('QC_UNAUTHORIZED','Недействительный ключ Quick Capture.');
  var record=qcRecord(uid);
  if(!record||record.revoked||!authEqual(record.hash,authHmac('qc|'+uid+'|'+token)))authError('QC_UNAUTHORIZED','Недействительный ключ Quick Capture.');
  var db=getDb();if(!findUserRow(db.users,uid))authError('QC_UNAUTHORIZED','Недействительный ключ Quick Capture.');
  if(db.ss.getId&&db.ss.getId()==='1X-hFpWRGUomCIlmQsDvV4I2m5Ke9A9FIQ4we5aypvps')authError('PROTECTED_DATABASE','Исходная база защищена от изменений.');
  return {db:db,uid:uid};
}
function qcBudget(uid){
  var record=qcRecord(uid),day=serverToday();
  if(record.day!==day){record.day=day;record.used=0;}
  if((record.used||0)>=300)authError('QC_RATE_LIMIT','Дневной лимит Quick Capture достигнут. Попробуйте завтра.');
  record.used=(record.used||0)+1;
  PropertiesService.getScriptProperties().setProperty(qcProperty(uid),JSON.stringify(record));
}
function qcHandle(body){
  var owner=qcAuthorize(body),uid=owner.uid,db=owner.db;
  if(JSON.stringify(body).length>12000)authError('QC_TOO_LARGE','Запрос Quick Capture слишком велик.');
  if(body.action==='quick_capture_parse'){
    var text=body.text;
    if(typeof text!=='string'||text.trim().length<3||text.length>4000)authError('QC_INVALID_TEXT','Передайте до 4000 символов распознанного текста, не изображение.');
    if(/\b(?:USD|EUR|GBP|PLN|KZT|CNY)\b|[$€£¥₸]/i.test(text))authError('QC_CURRENCY','Quick Capture поддерживает только рубли.');
    if(/между\s+своими|на\s+свой\s+(?:сч[её]т|карт)/i.test(text))authError('QC_OWN_TRANSFER','Перевод между своими счетами добавьте в FINTEX как перевод, не расход.');
    qcBudget(uid);
    var parsed=parseIncomingSmsText(text,'');
    return {ok:true,quick_capture_protocol:1,requires_confirmation:true,candidate:parsed?{amount:parsed.amount,date:parsed.date,merchant:parsed.merchant,category:parsed.category,type:parsed.type}:null,warnings:['Проверьте сумму, дату, получателя и направление. Распознавание может спутать сумму с комиссией или остатком.','Если дата отсутствует, предложено сегодня. Это не подтверждение даты операции.'],saved:false};
  }
  if(body.confirmed!==true)authError('QC_CONFIRM_REQUIRED','Подтвердите поля операции перед отправкой.');
  if(!/^[a-f0-9]{64}$/.test(String(body.capture_id||'')))authError('QC_INVALID_ID','Нужен SHA-256 исходного скриншота: 64 строчные hex-цифры.');
  var t=body.transaction;
  if(!t||typeof t!=='object'||Array.isArray(t)||typeof t.amount!=='number'||serverMoney(t.amount)!==t.amount||t.amount<=0||t.amount>1e10||!serverDate(t.date)||t.date>serverToday()||['income','expense'].indexOf(t.type)<0||t.currency!=='RUB'||typeof t.merchant!=='string'||!t.merchant.trim()||t.merchant.length>100||/[\r\n\x00-\x1f]/.test(t.merchant)||['food','taxi','cafe','fun','subs','shop','health','other'].indexOf(t.category)<0)authError('QC_INVALID_TRANSACTION','Проверьте сумму в рублях, дату, получателя, категорию и доход/расход.');
  var canonical={date:t.date,amount:t.amount,merchant:t.merchant.trim(),category:t.category,type:t.type},digest=qcDigest(JSON.stringify(canonical));
  var id='qc_'+qcDigest(uid+'|'+body.capture_id),mutation='qc_ingest_'+body.capture_id;
  var state=serverLedgerState(db,uid);
  if(state.ops[mutation]){
    var rows=db.ss.getSheetByName('LedgerEvents').getDataRange().getValues();
    for(var i=1;i<rows.length;i++)if(String(rows[i][0])===mutation&&String(rows[i][1])===uid){
      var original=JSON.parse(String(rows[i][4]));
      if(!original||original.scan_id!==digest)authError('QC_ID_REUSED','Этот скриншот уже отправлен с другими полями. Исправьте существующую запись в FINTEX.');
      // A deletion/edit does not permit a retry to resurrect/rewrite the record.
      return {ok:true,quick_capture_protocol:1,status:'duplicate',transaction_id:id};
    }
  }
  qcBudget(uid);
  canonical.id=id;canonical.source='Quick Capture · iPhone';canonical.currency='RUB';canonical.scan_id=digest;canonical.dedup_hash='quick_capture_'+body.capture_id;
  var result=serverLedgerSync(db,uid,{mutations:[{id:mutation,txId:id,baseRevision:0,tx:canonical}]});
  if(!result.results||result.results[0].status!=='acked')authError('QC_CONFLICT','Операция уже существует. Проверьте историю FINTEX.');
  // The one ledger-event row is the durable receipt AND the balance delta.
  // No separate balance/property/log write after this commit: retries are safe.
  return {ok:true,quick_capture_protocol:1,status:'saved',transaction_id:id};
}


/** Optional SMS phone positions. POST only; existing ingest key, no read scope. */
function placesLocation(value,forceSms){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  var lat=value.latitude,lon=value.longitude,a=value.accuracy,stamp=value.captured_at;
  var ms=typeof stamp==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(stamp)?Date.parse(stamp):NaN;
  if(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lon!=='number'||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(ms)||ms>Date.now()+300000||ms<946684800000||new Date(ms).toISOString().slice(0,10)!==stamp.slice(0,10))return null;
  if(a!==undefined&&a!==null&&(typeof a!=='number'||!Number.isFinite(a)||a<0||a>100000))return null;
  var clean={latitude:lat,longitude:lon,accuracy:a==null?null:a,captured_at:new Date(ms).toISOString(),source:'phone_sms'};
  if(!forceSms&&value.source==='user_confirmed'){
    var confirmed=Date.parse(value.confirmed_at),label=value.label;
    if(typeof label!=='string'||!label.trim()||label.length>180||/[\x00-\x1f]/.test(label)||typeof value.confirmed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value.confirmed_at)||!Number.isFinite(confirmed)||confirmed>Date.now()+300000||confirmed<946684800000||new Date(confirmed).toISOString().slice(0,10)!==value.confirmed_at.slice(0,10))return null;
    clean.source='user_confirmed';clean.label=label.trim();clean.confirmed_at=new Date(confirmed).toISOString();
  }
  return clean;
}
function placesKnownSms(db,uid,hash){
  var sheet=db.ss.getSheetByName('LedgerEvents');if(!sheet)return false;
  return sheet.getDataRange().getValues().slice(1).some(function(r){
    if(String(r[1])!==uid||!/^sms_ingest_/.test(String(r[0])))return false;
    var t=JSON.parse(String(r[4]));return t&&t.dedup_hash===hash;
  });
}
function placesIngest(body){
  var uid=String(body.uid||''),token=String(body.token||''),db=getDb(),u=findUserRow(db.users,uid);
  if(!/^\d{1,20}$/.test(uid)||!u||!/^\w[\w-]{31,127}$/.test(token)||!authEqual(String(u.values[5]),token))authError('INVALID_TOKEN','Недействительный ключ автоматизации.');
  if(!/^[a-f0-9]{64}$/.test(String(body.event_id||'')))authError('INVALID_EVENT_ID','Нужен постоянный SHA-256 идентификатор СМС-события. При повторе отправьте тот же запрос.');
  if(typeof body.text!=='string'||body.text.length>4000)authError('PARSE_NO_AMOUNT','Передайте текст СМС до 4000 символов.');
  var id='sms_'+qcDigest(uid+'|'+body.event_id),mutation='sms_ingest_'+body.event_id,state=serverLedgerState(db,uid);
  // Durable receipt survives metadata removal, edits and deletion. Do not resurrect.
  if(state.ops[mutation])return {ok:true,status:'duplicate',transaction_id:id};
  var parsed=parseIncomingSmsText(body.text,String(u.values[2]||'Т-Банк'));
  if(!parsed)authError('PARSE_NO_AMOUNT','Не удалось распознать операцию.');
  // Never turn an explicitly identified own-account transfer into an expense.
  if(/между\s+своими|на\s+свой\s+(?:сч[её]т|карт)/i.test(body.text)||/\b(?:USD|EUR|GBP|PLN|KZT|CNY)\b|[$€£¥₸]/i.test(body.text))authError('UNSUPPORTED_SMS','Свои переводы и иностранную валюту добавьте вручную в FINTEX.');
  var known=serverKnown(db,uid);
  if(known.hashes[parsed.dedup_hash])return {ok:true,status:'duplicate',message:'Уже принято прежней автоматизацией; геометка не добавлена.'};
  if(placesKnownSms(db,uid,parsed.dedup_hash))return {ok:true,status:'duplicate',message:'Похожая СМС уже принята. Проверьте историю.'};
  var place=placesLocation(body.location,true);
  // A stale fix is not a current position; finance still saves without it.
  if(place&&Math.abs(Date.parse(place.captured_at)-Date.now())>900000)place=null;
  parsed.id=id;delete parsed.cardBalance;delete parsed.bank;
  if(place)parsed.location=place;
  var result=serverLedgerSync(db,uid,{mutations:[{id:mutation,txId:id,baseRevision:0,tx:parsed}]});
  if(!result.results||result.results[0].status!=='acked')authError('SMS_CONFLICT','Проверьте историю FINTEX перед повтором.');
  return {ok:true,status:'saved',transaction_id:id,location_status:place?'attached':body.location?'invalid_or_stale':'unavailable',balance_policy:'transaction_delta'};
}
