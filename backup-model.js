/* Versioned, allowlisted finance backups. No credentials, arbitrary storage dump or network. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./finance-math.js'):root.FintexMath;
  const MAX_BYTES=12*1024*1024,JOURNAL='fp_restore_journal_v1';
  const fields={name:'fp_name',bank:'fp_bank',balance:'fp_balance',payday:'fp_payday',goal:'fp_goal',catLimits:'fp_cat_limits',transactions:'fp_local_tx',bills:'fp_bills',ledgerOffset:'fp_ledger_offset',localDeletedIds:'fp_local_deleted_ids',priceHistory:'fp_price_history',captureArchive:'fp_capture_archive',behavior:'fp_behavior_v1',workTime:'fp_work_time_v1'};
  const runtimeKeys=['fp_sync_queue','fp_cloud_paused_restore','fp_onboarded','fp_backup_last_restore','fp_backup_restore_notice','fp_backup_cloud_owner'];
  const allowedKeys=[...Object.values(fields),...runtimeKeys];
  const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function need(ok,message){if(!ok)throw Error(message||'Структура копии повреждена. Данные не заменены.');}
  function money(n,positive=false){return typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e12&&Math.abs(n*100-Math.round(n*100))<.02&&(!positive||n>0);}
  const id=s=>typeof s==='string'&&/^[\w-]{1,150}$/.test(s);
  function tree(value,depth=0,budget={n:0}){
    need(depth<=20&&++budget.n<300000,'В копии слишком много вложенных данных.');
    if(typeof value==='string')need(value.length<=600000,'Слишком длинное поле в копии.');
    if(typeof value==='number')need(Number.isFinite(value));
    if(value&&typeof value==='object')for(const key of Object.keys(value)){need(!['__proto__','constructor','prototype'].includes(key),'Недопустимые служебные поля в копии.');tree(value[key],depth+1,budget);}
  }
  function goal(g){
    need(obj(g)&&typeof g.title==='string'&&g.title.length<=200&&money(g.target,true)&&money(g.saved)&&g.saved>=0,'Некорректная цель в копии.');
    if(g.monthly!==undefined)need(money(g.monthly)&&g.monthly>=0);
    if(g.photo)need(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(g.photo)&&g.photo.length<=450000,'Некорректное фото цели.');
    if(g.pockets!==undefined){need(Array.isArray(g.pockets)&&g.pockets.length<=100);const ids=new Set();g.pockets.forEach(p=>{need(id(p.id)&&!ids.has(p.id)&&p.id!=='primary');ids.add(p.id);goal(p);});}
  }
  function tx(t,today){
    need(obj(t)&&id(t.id)&&M.ordinal(t.date)!==null&&t.date<=today,'Неверная дата или идентификатор операции.');
    need(['income','expense','transfer','adjustment'].includes(t.type)&&money(t.amount,true),'Некорректная сумма или вид операции.');
    need(!t.currency||['RUB','₽','РУБ'].includes(String(t.currency).toUpperCase()),'Копия должна содержать рублёвые операции.');
    need(typeof t.merchant==='string'&&t.merchant.length<=1000);
    if(t.type==='adjustment')need(money(t.balance_delta)&&Math.abs(t.balance_delta)===t.amount&&t.balance_delta!==0,'Некорректная разница остатка.');
    if(t.items!==undefined)need(Array.isArray(t.items)&&t.items.length<=10000);
    if(t.goal_withdrawal!==undefined)need(money(t.goal_withdrawal)&&t.goal_withdrawal>=0);
  }
  function validateData(data,today){
    need(obj(data));tree(data);
    need(Object.keys(data).every(k=>Object.hasOwn(fields,k)),'В копии есть неподдерживаемые разделы.');
    need(Object.keys(fields).every(k=>Object.hasOwn(data,k)),'В копии отсутствуют обязательные разделы.');
    need(typeof data.name==='string'&&data.name.trim().length>0&&data.name.length<=200&&typeof data.bank==='string'&&data.bank.length<=200,'Некорректный профиль в копии.');
    need(money(data.balance)&&money(data.ledgerOffset)&&money(M.add(data.balance,-data.ledgerOffset)),'Некорректный остаток в копии.');
    need(M.ordinal(data.payday)!==null,'Некорректная дата зарплаты.');goal(data.goal);
    need(Array.isArray(data.transactions)&&data.transactions.length<=50000,'Некорректный список операций.');
    const ids=new Set();data.transactions.forEach(t=>{tx(t,today);need(!ids.has(t.id),'В копии повторяются идентификаторы операций.');ids.add(t.id);});
    need(Array.isArray(data.bills)&&data.bills.length<=10000);const bills=new Set();
    data.bills.forEach(b=>{need(obj(b)&&id(b.id)&&!bills.has(b.id)&&typeof b.title==='string'&&money(b.amount,true)&&M.ordinal(b.due_date)!==null,'Некорректный платёж в копии.');bills.add(b.id);if(b.is_paid!==undefined)need(typeof b.is_paid==='boolean');});
    need(obj(data.catLimits)&&Object.values(data.catLimits).every(n=>money(n)&&n>=0),'Некорректные лимиты категорий.');
    need(Array.isArray(data.localDeletedIds)&&data.localDeletedIds.length<=100000&&data.localDeletedIds.every(x=>id(x)&&!ids.has(x)),'Некорректный список локальных удалений.');
    need(obj(data.priceHistory)&&Array.isArray(data.captureArchive)&&obj(data.behavior)&&(data.workTime===null||obj(data.workTime)));
    Object.values(data.priceHistory).forEach(p=>need(obj(p)&&typeof p.displayName==='string'&&Array.isArray(p.records)&&p.records.every(r=>obj(r)&&money(r.price)&&M.ordinal(r.date)!==null),'Некорректная история цен.'));
    data.captureArchive.forEach(a=>need(obj(a)&&typeof a.fileHash==='string'&&typeof a.txId==='string'));
    return data;
  }
  function parse(text,today){
    need(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_BYTES,'Выберите копию Fintex до 12 МБ.');
    let file;try{file=JSON.parse(text);}catch(_){throw Error('Это не читаемый JSON-файл копии Fintex.');}
    need(obj(file)&&file.format==='FintexBackup','Выберите файл резервной копии Fintex, а не выписку банка.');
    need(file.version===1,'Эта версия копии пока не поддерживается. Обновите Fintex.');
    need(file.currency==='RUB'&&typeof file.createdAt==='string'&&Number.isFinite(Date.parse(file.createdAt)),'Некорректные сведения о копии.');
    need(typeof file.sha256==='string'&&/^[a-f0-9]{64}$/.test(file.sha256),'В копии отсутствует контрольная сумма.');
    need(file.cloudOwner===null||typeof file.cloudOwner==='string'&&/^(?:[0-9]{1,30}|guest_[\w-]{1,100})$/.test(file.cloudOwner),'Некорректная учётная запись копии.');
    validateData(file.data,today);return file;
  }
  function payload(file){return JSON.stringify({format:file.format,version:file.version,createdAt:file.createdAt,currency:file.currency,cloudOwner:file.cloudOwner,data:file.data});}
  function snapshot(state,storage){
    const read=(key,fallback)=>{const raw=storage.getItem(key);return raw===null?fallback:JSON.parse(raw);};
    const data={name:state.name,bank:state.bank,balance:state.balance,payday:state.payday,goal:state.goal,catLimits:state.catLimits,transactions:state.transactions,bills:state.bills,ledgerOffset:state.ledgerOffset||0,localDeletedIds:state.localDeletedIds||[],priceHistory:state.priceHistory||{},captureArchive:read('fp_capture_archive',[]),behavior:read('fp_behavior_v1',{}),workTime:read('fp_work_time_v1',null)};
    return JSON.parse(JSON.stringify(data));
  }
  function storageMap(data,now,owner=null){
    const values={};for(const [field,key]of Object.entries(fields))values[key]=['name','bank','payday'].includes(field)?data[field]:JSON.stringify(data[field]);
    return {...values,fp_sync_queue:'[]',fp_cloud_paused_restore:'1',fp_onboarded:'1',fp_backup_last_restore:now,fp_backup_restore_notice:'1',fp_backup_cloud_owner:owner||''};
  }
  function recover(storage){
    const raw=storage.getItem(JOURNAL);if(raw===null)return false;
    const before=JSON.parse(raw);need(obj(before)&&Object.keys(before).length===allowedKeys.length&&allowedKeys.every(k=>Object.hasOwn(before,k)&&(before[k]===null||typeof before[k]==='string')),'Не удалось проверить незавершённое восстановление.');
    // Clear only allowlisted restore targets, then restore the saved values. The journal
    // remains until completion, so interruption during rollback is safe to retry.
    allowedKeys.forEach(k=>storage.removeItem(k));
    for(const [k,v]of Object.entries(before))if(v!==null)storage.setItem(k,v);
    storage.removeItem(JOURNAL);return true;
  }
  function replace(storage,data,now,owner=null){
    need(storage.getItem(JOURNAL)===null,'Сначала завершите предыдущее восстановление: перезагрузите приложение.');
    const before=Object.fromEntries(allowedKeys.map(k=>[k,storage.getItem(k)]));
    // Failure to reserve the rollback journal means no data is changed.
    storage.setItem(JOURNAL,JSON.stringify(before));
    try{for(const [k,v]of Object.entries(storageMap(data,now,owner)))storage.setItem(k,v);storage.removeItem(JOURNAL);}
    catch(error){try{recover(storage);}catch(_){throw Error('Восстановление прервано. Перезагрузите приложение для возврата прежних данных.');}throw Error('Недостаточно места или запись запрещена. Прежние данные сохранены.');}
  }
  const api={MAX_BYTES,JOURNAL,fields,parse,payload,snapshot,validateData,storageMap,recover,replace};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexBackupModel=api;
})(typeof window==='undefined'?globalThis:window);
