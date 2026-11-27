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
