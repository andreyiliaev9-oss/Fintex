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
