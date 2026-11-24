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
