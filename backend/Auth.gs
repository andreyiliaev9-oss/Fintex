/** FINTEX authentication. Deploy together with Code.gs and PasswordKdf.gs.
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
function authRecord(db,uid,create) {
  var sh=getOrCreateSheet(db.ss,'Auth',AUTH_COLUMNS), rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) if(String(rows[i][0])===uid) return {sheet:sh,row:i+1,v:rows[i]};
  if(!create) return null;
  var values=[uid,'','',1,0,0,'',0,0,0,0,0]; sh.appendRow(values);
  return {sheet:sh,row:sh.getLastRow(),v:values};
}
function authSave(rec) { rec.sheet.getRange(rec.row,1,1,AUTH_COLUMNS.length).setValues([rec.v]); }
function authPassword(password) {
  if(typeof password!=='string' || !/^[0-9]{6}$/.test(password)) authError('PASSWORD_POLICY','PIN-код должен содержать ровно 6 цифр.');
  return password; // Never trim or silently truncate passwords.
}
function authVerifier(password,salt,uid) {
  var bytes=authHex(Utilities.newBlob(password).getBytes());
  return authHmac('password|'+uid+'|'+FintexKdf.derive(bytes,salt));
}
function authBlocked(rec) {
  if(Number(rec.v[5])>Date.now()) authError('RATE_LIMIT','Слишком много попыток. Подождите 15 минут.');
}
function authWrong(rec) {
  rec.v[4]=Number(rec.v[4]||0)+1;
  if(rec.v[4]>=5) {rec.v[5]=Date.now()+15*60*1000;rec.v[4]=0;}
  authSave(rec);
  authError('WRONG_PASSWORD','Неверный PIN-код.');
}
function authCheckPassword(rec,password,uid) {
  authBlocked(rec);
  if(typeof password!=='string' || password.length>128 || !authEqual(authVerifier(password,rec.v[1],uid),rec.v[2])) authWrong(rec);
  rec.v[4]=0;rec.v[5]=0; authSave(rec);
}
function authClearReset(rec) { for(var i=6;i<=8;i++) rec.v[i]=i===6?'':0; }
function authSetPassword(rec,password,uid) {
  authPassword(password);
  rec.v[1]=authRandom('salt').slice(0,32);
  rec.v[2]=authVerifier(password,rec.v[1],uid);
  rec.v[3]=Number(rec.v[3]||0)+1;rec.v[4]=0;rec.v[5]=0;
  authClearReset(rec);authSave(rec);
}
function authSession(rec,uid,webhookToken) {
  var payload=Utilities.base64EncodeWebSafe(JSON.stringify({uid:uid,v:Number(rec.v[3]),exp:Date.now()+30*60*1000})).replace(/=+$/,'');
  var result={ok:true,session:payload+'.'+authHmac('session|'+payload),expires_in:1800};
  if(webhookToken) result.webhook_token=webhookToken;
  return result;
}
function authRequire(db,body) {
  var token=String(body.session||'');
  if(token.length>2048) authError('AUTH_REQUIRED','Войдите в приложение.');
  var parts=token.split('.'), payload;
  if(parts.length!==2 || !authEqual(authHmac('session|'+parts[0]),parts[1])) authError('AUTH_REQUIRED','Войдите в приложение.');
  try { payload=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch(e) {}
  if(!payload || !/^\d+$/.test(payload.uid) || !Number.isFinite(payload.exp) || payload.exp<=Date.now() || payload.exp>Date.now()+1800000+60000) authError('AUTH_REQUIRED','Сеанс истёк. Введите PIN снова.');
  if(body.user_id && String(body.user_id)!==payload.uid) authError('AUTH_REQUIRED','Учётная запись не совпадает.');
  var rec=authRecord(db,payload.uid,false);
  if(!rec || !rec.v[2] || Number(rec.v[3])!==payload.v) authError('AUTH_REQUIRED','Войдите в приложение снова.');
  return {uid:payload.uid,rec:rec};
}
function authRotateWebhook(db,uid) {
  var token=authRandom('webhook'), user=findUserRow(db.users,uid);
  if(user) db.users.getRange(user.row,6).setValue(token);
  else db.users.appendRow([uid,'','Т-Банк',0,'',token,new Date().toISOString()]);
  return token;
}
function authSendReset(db,uid,rec) {
  var now=Date.now();
  if(Number(rec.v[9])>now) authError('RATE_LIMIT','Новый код можно запросить через минуту.');
  if(now-Number(rec.v[10]||0)>=3600000) {rec.v[10]=now;rec.v[11]=0;}
  if(Number(rec.v[11])>=3) authError('RATE_LIMIT','Лимит отправки кодов: 3 за час. Попробуйте позже.');
  // Derive the six-digit code from a keyed, unpredictable value. Never persist it in plaintext.
  var code=String(parseInt(authRandom('reset').slice(0,8),16)%1000000).padStart(6,'0');
  rec.v[6]=authHmac('reset|'+uid+'|'+code);rec.v[7]=now+600000;rec.v[8]=0;
  rec.v[9]=now+60000;rec.v[11]=Number(rec.v[11]||0)+1;authSave(rec);
  try {
    var response=UrlFetchApp.fetch('https://api.telegram.org/bot'+authProperties().bot+'/sendMessage',{
      method:'post',contentType:'application/json',muteHttpExceptions:true,
      payload:JSON.stringify({chat_id:uid,text:'Fintex: код сброса PIN — '+code+'\nДействует 10 минут. Никому не сообщайте код. Если это не вы, не используйте его.'})
    });
    var data=JSON.parse(response.getContentText());
    if(response.getResponseCode()!==200 || !data.ok) throw new Error('delivery');
  } catch(e) {authClearReset(rec);authSave(rec);authError('DELIVERY_FAILED','Не удалось отправить код. Откройте личный чат с ботом, нажмите «Начать» и попробуйте через минуту.');}
  return {ok:true,retry_after:60,expires_in:600};
}
function authDispatch(db,body) {
  var action=body.action, uid,rec,session;
  if(['auth_change','auth_logout','auth_rotate_webhook'].indexOf(action)>=0) {
    session=authRequire(db,body);uid=session.uid;rec=session.rec;
    if(action==='auth_logout') {rec.v[3]=Number(rec.v[3])+1;authSave(rec);return {ok:true};}
    if(action==='auth_rotate_webhook') return {ok:true,webhook_token:authRotateWebhook(db,uid)};
    authPassword(body.new_password);authCheckPassword(rec,body.password,uid);
    authSetPassword(rec,body.new_password,uid);return authSession(rec,uid);
  }
  uid=authTelegram(body.init_data);
  if(body.user_id && String(body.user_id)!==uid) authError('TELEGRAM_INVALID','Учётная запись не совпадает.');
  rec=authRecord(db,uid,false);
  if(action==='auth_status') return {ok:true,password_set:!!(rec&&rec.v[2]),pin_protocol:1,uid:uid};
  if(action==='auth_setup') {
    if(rec&&rec.v[2]) authError('PASSWORD_EXISTS','PIN или пароль уже задан. Войдите или запросите сброс.');
    authPassword(body.password);rec=rec||authRecord(db,uid,true);
    authSetPassword(rec,body.password,uid);return authSession(rec,uid,authRotateWebhook(db,uid));
  }
  if(!rec || !rec.v[2]) authError('PASSWORD_NOT_SET','Сначала создайте PIN-код.');
  if(action==='auth_login') {authCheckPassword(rec,body.password,uid);return authSession(rec,uid);}
  if(action==='auth_reset_request') return authSendReset(db,uid,rec);
  if(action==='auth_reset') {
    authPassword(body.new_password);
    if(!rec.v[6] || Number(rec.v[7])<=Date.now() || Number(rec.v[8])>=5) authError('CODE_EXPIRED','Код истёк или исчерпаны попытки. Запросите новый.');
    rec.v[8]=Number(rec.v[8]||0)+1;authSave(rec);
    if(!/^\d{6}$/.test(String(body.code||'')) || !authEqual(rec.v[6],authHmac('reset|'+uid+'|'+body.code))) authError('WRONG_CODE','Неверный код.');
    authSetPassword(rec,body.new_password,uid);
    return authSession(rec,uid,authRotateWebhook(db,uid));
  }
  authError('UNKNOWN_ACTION','Неизвестная команда.');
}
