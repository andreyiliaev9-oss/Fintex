/** FINTEX Cloud v7. Deploy Code.gs and Auth.gs, or the combined installer.
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
  return jsonResponse({ok:true,service:'FINTEX Cloud Backend',version:'7.0-ledger',cloud_protocol:2,ledger_protocol:3});
}
function doPost(e) {
  var body,raw=e&&e.postData&&e.postData.contents;
  try {if(!raw||raw.length>128000)throw new Error('size');body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('body');}
  catch(err){return jsonResponse({ok:false,code:'INVALID_REQUEST',error:'Нужен JSON-запрос допустимого размера.'});}
  return serverLocked(function(){
    // Verify configuration before any access. No legacy UID-only fallback.
    authProperties();
    var action=String(body.action||'');
    var allowed=['init','push_tx','set_config','ledger_sync'];
    if(!action && body.text)return handleWebhookIngest(String(body.user_id||body.uid||''),String(body.token||''),body.text);
    if(allowed.indexOf(action)<0)authError('UNKNOWN_ACTION','Неизвестная команда.');
    var uid=authTelegram(body.init_data);
    if(body.user_id&&String(body.user_id)!==uid)authError('TELEGRAM_INVALID','Учётная запись не совпадает.');
    var db=getDb();
    if((action==='init'||action==='ledger_sync')&&!findUserRow(db.users,uid))authRotateWebhook(db,uid);
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
  var result={ok:true,ledger_protocol:3,uid:uid,webhook_token:String(u.values[5]||''),user:{user_id:uid,name:String(u.values[1]||''),bank:String(u.values[2]||'Т-Банк'),balance:serverMoney(u.values[3])||0,payday:serverIso(u.values[4])},transactions:txs,logs:list};
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
  if(known.hashes[parsed.dedup_hash])return {ok:true,duplicate:true,message:'Дубль пропущен'};
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
