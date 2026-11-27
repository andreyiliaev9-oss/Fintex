/* Revisioned operation sync. Capability-gated; never sends patches to an old server. */
(() => {
 'use strict';
 const KEY='fp_ledger_sync_v1',M=FintexMath,clone=x=>JSON.parse(JSON.stringify(x));
 const clean=t=>{if(!t)return null;const c=clone(t);delete c.local_only;delete c.local_edited;return c;};
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const semantic=t=>t?JSON.stringify([t.date,t.type,t.amount,t.balance_delta||0,t.merchant,t.category||'other',t.location||null]):'null';
 let cache=null,baseline=null,suppress=false,running=null,error='',timer;
 const owner=()=>String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||USER_ID);
 const binding=()=>[owner(),FintexCloud.getEndpoint(),localStorage.getItem('fp_backup_last_restore')||''].join('|');
 function ensure(){
  if(cache?.binding===binding())return;
  try{cache=JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){cache=null;}
  if(!cache||cache.binding!==binding())cache={binding:binding(),active:false,records:{},outbox:[],conflicts:{},last:null};
  cache.records=Object.assign(Object.create(null),cache.records);cache.conflicts=Object.assign(Object.create(null),cache.conflicts);
  baseline=clone(state.transactions);
 }
 function store(){localStorage.setItem(KEY,JSON.stringify(cache));}
 function label(tx){ensure();if(cache.conflicts[tx.id])return 'Нужно сравнить версии';if(cache.outbox.some(m=>m.txId===tx.id))return 'Ожидает отправки';if(cache.active&&cache.records[tx.id]?.tx&&semantic(tx)===semantic(cache.records[tx.id].tx))return 'В облаке';if(!tx.local_only&&cache.legacyRecords?.[tx.id]&&semantic(tx)===semantic(cache.legacyRecords[tx.id]))return 'В облаке';return state.syncQueue.some(t=>t.id===tx.id)?'Ожидает отправки':'На устройстве';}
 function status(){ensure();if(!FintexCloud.canSync())return localStorage.getItem('fp_cloud_paused_restore')==='1'?'На устройстве · облако на паузе':'На устройстве · облако через Telegram';if(error)return error;if(cache.balanceConflict)return 'Нужно сравнить остатки';if(Object.keys(cache.conflicts).length)return 'Нужно сравнить версии';if(cache.outbox.length||state.syncQueue.length)return 'Ожидает отправки';if(cache.active&&cache.last)return 'Операции проверены с облаком';return cache.legacy?'Сервер не поддерживает исправления':'На устройстве · сервер исправлений не подключён';}
 function render(){
  if(!document.getElementById('ledger-sync-status'))return;
  window.dispatchEvent(new Event('fintex:storage-status'));
  const text=status();document.getElementById('ledger-sync-status').textContent=text;
  document.getElementById('ledger-sync-summary').textContent=text+(cache.last?' · Последняя проверка: '+new Date(cache.last).toLocaleString('ru-RU'):'');
  for(const id of ['ap-queue-badge','autopilot-stage-pill','st-sync-label']){const el=document.getElementById(id);if(el)el.textContent=text;}
  document.querySelectorAll('[data-operation-row]').forEach(row=>{let el=row.querySelector('.tx-sync-state');if(!el){el=document.createElement('small');el.className='tx-sync-state';row.querySelector('.tx-merchant-copy')?.append(el);}const tx=state.transactions.find(t=>t.id===row.dataset.operationRow);if(tx)el.textContent=label(tx);});
  const box=document.getElementById('ledger-conflicts');box.replaceChildren();
  if(cache.balanceConflict){const info=document.createElement('p');info.className='backup-copy money-val';info.textContent=`Первое подключение: на устройстве ${cache.balanceConflict.current} ₽; по облаку с локальными записями ${cache.balanceConflict.candidate} ₽. Ничего не заменено.`;box.append(info);for(const [choice,title]of [['cloud','Использовать расчёт по облаку'],['local','Сохранить мой остаток корректировкой']]){const button=document.createElement('button');button.type='button';button.className='section-action';button.textContent=title;button.addEventListener('click',()=>{if(state.balance!==cache.balanceConflict.current){error='Остаток изменился. Проверьте синхронизацию заново.';render();return;}cache.balanceDecision={choice,token:cache.balanceConflict.token};sync(true);});box.append(button);}}
  for(const [id,conflict]of Object.entries(cache.conflicts)){
   const item=document.createElement('div');item.className='ledger-conflict';
   const local=state.transactions.find(t=>t.id===id)||null,remote=conflict.tx;
   const heading=document.createElement('strong');heading.textContent=local?.merchant||remote?.merchant||'Удалённая операция';item.append(heading);
   const describe=t=>t?`${t.merchant} · ${t.date} · ${M.money(t.amount).toLocaleString('ru-RU')} ₽ · ${t.location?'Место: '+Number(t.location.latitude).toFixed(5)+', '+Number(t.location.longitude).toFixed(5):'Без геометки'} · ${t.type==='income'?'Доход':t.type==='expense'?'Расход':t.type==='transfer'?'Перевод':'Корректировка'}`:'Удалено';
   for(const [title,tx]of [['На устройстве',local],['В облаке',remote]]){const p=document.createElement('p');p.textContent=title+': '+describe(tx);p.className='money-val';item.append(p);}
   for(const [choice,title]of [['remote','Принять облачную'],['local','Отправить мою версию']]){const button=document.createElement('button');button.type='button';button.textContent=title;button.addEventListener('click',()=>resolve(id,choice));item.append(button);}box.append(item);
  }
 }
 function record(){
  if(suppress||typeof state==='undefined')return;ensure();const now=state.transactions;
  if(!baseline){baseline=clone(now);return;}
  if(cache.active){
   const before=new Map(baseline.map(t=>[t.id,t])),after=new Map(now.map(t=>[t.id,t]));
   for(const id of new Set([...before.keys(),...after.keys()]))if(!equal(clean(before.get(id)),clean(after.get(id)))){
    if(cache.conflicts[id])continue;
    const pending=cache.outbox.filter(m=>m.txId===id),base=(cache.records[id]?.revision||0)+pending.length;
    cache.outbox.push({id:'mut_'+crypto.randomUUID(),txId:id,baseRevision:base,tx:clean(after.get(id))});
   }
   try{store();error='';}catch(_){error='На устройстве · очередь не сохранена, освободите место';}
  }
  baseline=clone(now);render();if(cache.active&&!error){clearTimeout(timer);timer=setTimeout(()=>sync(),350);}
 }
 function adopt(data,records){
  const local=new Map(state.transactions.map(t=>[t.id,t])),old=cache.records,protectedIds=new Set([...cache.outbox.map(m=>m.txId),...Object.keys(cache.conflicts)]);
  for(const [id,r]of Object.entries(records)){
   if(protectedIds.has(id))continue;
   const t=local.get(id),prior=old[id];
   if(!r.tx&&!t)continue;
   if(!prior){
    if(state.localDeletedIds.includes(id)||t&&(t.local_only||semantic(t)!==semantic(r.tx))){cache.conflicts[id]=r;continue;}
   }else if(t&&semantic(t)!==semantic(prior.tx)){cache.conflicts[id]=r;continue;}
   if(r.tx){const merged={...(t||{}),...r.tx};if(!r.tx.location)delete merged.location;delete merged.local_only;delete merged.local_edited;local.set(id,merged);}else local.delete(id);
  }
  if(!cache.active)for(const [id,t]of local)if(!records[id])cache.conflicts[id]={id,revision:0,tx:null};
  const txs=[...local.values()];let delta=0;
  for(const id of new Set([...local.keys(),...Object.keys(records)]))delta=M.add(delta,M.ledgerEffect(local.get(id)),-M.ledgerEffect(records[id]?.tx));
  let balance=M.add(data.balance,delta);
  if(!cache.active&&M.minor(balance)!==M.minor(state.balance)){
   const decision=cache.balanceDecision;delete cache.balanceDecision;
   if(!decision||decision.token!==data.pageToken){cache.balanceConflict={current:state.balance,candidate:balance,token:data.pageToken};store();render();return;}
   if(decision.choice==='local'){const difference=M.add(state.balance,-balance),id='opening_'+crypto.randomUUID();const tx={id,date:TODAY,type:'adjustment',amount:Math.abs(difference),balance_delta:difference,merchant:'Согласование остатков при подключении',category:'other',source:'Сверка облака',items:[]};txs.push(tx);cache.outbox.push({id:'mut_'+crypto.randomUUID(),txId:id,baseRevision:0,tx});delta=M.add(delta,difference);balance=M.add(balance,difference);}
  }
  delete cache.balanceConflict;
  // Persist metadata before changing in-memory finances; failure leaves both versions visible locally.
  const next={...cache,records,active:true,last:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(next));cache=next;
  suppress=true;
  try{state.transactions=txs;state.balance=balance;state.ledgerOffset=delta;state.syncQueue=[];localStorage.setItem('fp_sync_queue','[]');
   state.localDeletedIds=[...new Set([...state.localDeletedIds,...Object.values(records).filter(r=>!r.tx).map(r=>r.id)])];
   if(window.FintexUndo)window.FintexUndo.ignore(()=>persistAll());else persistAll();baseline=clone(txs);renderAll(false);
  }finally{suppress=false;}
 }
 function persistWithoutUndo(){persistAll();return true;}
 async function perform(notify){
  ensure();error='';render();if(!FintexCloud.canSync()){if(notify)toast(status());return;}
  const bound=binding();
  try{
   const init=await FintexCloud.request('init',{user_id:USER_ID});if(bound!==binding())return;
   if(init.places_protocol!==2&&(state.transactions.some(t=>t.location?.source==='user_confirmed')||cache.outbox.some(m=>m.tx?.location?.source==='user_confirmed')))throw Error('Подтверждённые места сохранены на устройстве. Обновите Apps Script до places_protocol: 2.');
   if(init.ledger_protocol!==3){cache.active=false;cache.legacy=true;store();await legacySyncWithBackend(notify);render();return;}
   // Flush the legacy add-only queue BEFORE activating revisioned writes.
   if(!cache.active&&state.syncQueue.length)await flushSyncQueue();
   let mutations=[],size=0;for(const m of cache.outbox){const n=JSON.stringify(m).length;if(mutations.length>=20||size+n>90000)break;mutations.push(clone(m));size+=n;}
   const result=await FintexCloud.request('ledger_sync',{user_id:USER_ID,mutations});if(bound!==binding())return;
   if(result.ledger_protocol!==3||!Array.isArray(result.records))throw Error('Сервер исправлений не подтвердил протокол.');
   if(typeof result.balance!=='number'||!Number.isFinite(result.balance)||Math.abs(result.balance)>1e12)throw Error('Сервер вернул некорректный остаток. Деньги не заменены.');
   const valid=r=>r&&/^[\w-]{1,150}$/.test(r.id)&&Number.isInteger(r.revision)&&r.revision>=1&&(r.tx===null||r.tx.id===r.id&&M.ledgerTransactions([r.tx]).length===1&&Number.isFinite(r.tx.amount)&&r.tx.amount>0&&(r.tx.type!=='adjustment'||Math.abs(r.tx.balance_delta)===r.tx.amount));
   if(!result.records.every(valid))throw Error('Журнал облака не прошёл проверку. Деньги не заменены.');
   const records=Object.assign(Object.create(null),Object.fromEntries(result.records.map(r=>[r.id,r])));let offset=result.nextOffset;
   while(offset!==null&&offset!==undefined){const page=await FintexCloud.request('ledger_sync',{user_id:USER_ID,offset,pageToken:result.pageToken});if(bound!==binding())return;if(page.restart)throw Error('Журнал изменился во время загрузки. Нажмите «Проверить» ещё раз.');if(page.pageToken!==result.pageToken||!Array.isArray(page.records)||!page.records.every(valid))throw Error('Страницы облака не прошли проверку.');for(const r of page.records)records[r.id]=r;offset=page.nextOffset;}
   const results=new Map((result.results||[]).map(r=>[r.id,r]));const blocked=new Set();
   for(const m of cache.outbox){const r=results.get(m.id);if(r?.status==='conflict'){cache.conflicts[m.txId]=r.current;blocked.add(m.txId);}}
   cache.outbox=cache.outbox.filter(m=>!blocked.has(m.txId)&&results.get(m.id)?.status!=='acked');
   // Acknowledged local content is the base for adopting a server echo, not a conflict.
   for(const m of mutations)if(results.get(m.id)?.status==='acked')cache.records[m.txId]={id:m.txId,revision:results.get(m.id).revision,tx:m.tx};
   adopt(result,records);render();if(notify)toast(status());
  }catch(e){error='На устройстве · '+(e.message||'облако недоступно');render();if(notify)toast(error);}
 }
 function sync(notify=false){if(running)return running;running=perform(notify).finally(()=>{running=null;if(cache?.active&&cache.outbox.length&&!error){clearTimeout(timer);timer=setTimeout(()=>sync(),500);}});return running;}
 function resolve(id,choice){
  ensure();const remote=cache.conflicts[id];if(!remote)return;
  if(choice==='local'){cache.outbox.push({id:'mut_'+crypto.randomUUID(),txId:id,baseRevision:remote.revision,tx:clean(state.transactions.find(t=>t.id===id))});delete cache.conflicts[id];store();render();sync(true);}
  else{
   const old=state.transactions.find(t=>t.id===id);state.balance=M.add(state.balance,-M.ledgerEffect(old),M.ledgerEffect(remote.tx));state.ledgerOffset=M.add(state.ledgerOffset,-M.ledgerEffect(old),M.ledgerEffect(remote.tx));
   state.transactions=state.transactions.filter(t=>t.id!==id);if(remote.tx)state.transactions.push(remote.tx);state.localDeletedIds=state.localDeletedIds.filter(x=>x!==id);delete cache.conflicts[id];cache.records[id]=remote;store();suppress=true;try{if(window.FintexUndo)window.FintexUndo.ignore(()=>persistAll());else persistAll();baseline=clone(state.transactions);renderAll(false);}finally{suppress=false;}render();
  }
 }
 function boot(){
  ensure();baseline=clone(state.transactions);
  const group=document.createElement('details');group.id='settings-sync';group.className='section-group card-surface';
  group.innerHTML='<summary><span><strong>Сохранение операций</strong><small>Устройство, очередь и облако</small></span></summary><div class="section-body"><p id="ledger-sync-summary" class="backup-copy"></p><p class="backup-copy">Синхронизируются операции и остаток. Цели, обложки и настройки платежей переносите резервной копией. Старому серверу исправления не отправляются.</p><button type="button" id="ledger-sync-retry" class="section-action">Проверить синхронизацию</button><div id="ledger-conflicts"></div></div>';
  document.getElementById('settings-backup').before(group);const button=document.createElement('button');button.type='button';button.id='ledger-sync-status';button.className='ledger-sync-status';button.addEventListener('click',()=>{goTab('settings');group.open=true;group.scrollIntoView({block:'start'});});document.getElementById('hero-balance-card').append(button);
  document.getElementById('ledger-sync-retry').addEventListener('click',()=>sync(true));render();
  window.addEventListener('online',()=>sync());
 }
 window.addEventListener('filely:financial-data-updated',record);
 window.addEventListener('storage',event=>{if(event.newValue===event.oldValue)return;if(event.key==='fp_backup_last_restore'){location.reload();return;}if(event.key===KEY){try{const material=raw=>{const c=JSON.parse(raw||'null');return JSON.stringify(c?[c.binding,c.records,c.outbox,c.conflicts]:null);};if(material(event.newValue)!==material(event.oldValue))location.reload();}catch(_){location.reload();}}});
 window.FintexSync={sync,label,render,observeLegacy(rows){ensure();cache.legacyRecords=cache.legacyRecords||{};for(const t of rows||[])if(t?.id&&['income','expense'].includes(t.type))cache.legacyRecords[t.id]=clean(t);try{store();}catch(_){}render();},active:()=>{ensure();return cache.active;},ignore(fn){suppress=true;try{return fn();}finally{suppress=false;baseline=clone(state.transactions);}},status};
 document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
