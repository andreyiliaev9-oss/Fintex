/* One latest financial operation, reversed as a delta, never a whole-ledger rewind. */
(() => {
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).filter(k=>!['local_only','local_edited'].includes(k)).sort().map(k=>[k,normalized(x[k])])):x;
 const equal=(a,b)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
 let baseline=null,last=null,suppressed=false;
 const snapshot=()=>({transactions:clone(state.transactions),goal:clone(state.goal),bills:clone(state.bills)});
 function render(){const box=document.getElementById('operation-undo');if(!box)return;box.hidden=!last;document.getElementById('operation-undo-copy').textContent=last?'Последнее действие сохранено':'';}
 function observe(){
  if(typeof state==='undefined')return;const now=snapshot();if(suppressed){baseline=now;return;}
  if(baseline){const a=new Map(baseline.transactions.map(t=>[t.id,t])),b=new Map(now.transactions.map(t=>[t.id,t]));const ids=[...new Set([...a.keys(),...b.keys()])].filter(id=>!equal(a.get(id),b.get(id)));
   if(ids.length)last={changes:ids.map(id=>({id,before:a.get(id)||null,after:b.get(id)||null})),goal:equal(baseline.goal,now.goal)?null:{before:baseline.goal,after:now.goal},bills:equal(baseline.bills,now.bills)?null:{before:baseline.bills,after:now.bills}};
   else if(!equal(baseline.goal,now.goal)||!equal(baseline.bills,now.bills))last=null;
  }
  baseline=now;render();
 }
 function ignore(fn){suppressed=true;try{return fn();}finally{suppressed=false;baseline=snapshot();}}
 function undo(){
  if(!last)return;const action=last;
  const changed=action.changes.some(c=>!equal(state.transactions.find(t=>t.id===c.id)||null,c.after))||action.goal&&!equal(state.goal,action.goal.after)||action.bills&&!equal(state.bills,action.bills.after);
  if(changed){last=null;render();toast('Записи уже изменились. Отмена не затронула новые данные.');return;}
  const before={tx:state.transactions,balance:state.balance,offset:state.ledgerOffset,deleted:state.localDeletedIds,goal:state.goal,bills:state.bills};
  const txs=state.transactions.filter(t=>!action.changes.some(c=>c.id===t.id));let delta=0;
  for(const c of action.changes){delta=FintexMath.add(delta,FintexMath.ledgerEffect(c.before),-FintexMath.ledgerEffect(c.after));if(c.before)txs.push(clone(c.before));}
  try{
   suppressed=true;state.transactions=txs;state.balance=FintexMath.add(state.balance,delta);state.ledgerOffset=FintexMath.add(state.ledgerOffset,delta);
   for(const c of action.changes){state.localDeletedIds=state.localDeletedIds.filter(id=>id!==c.id);if(!c.before)state.localDeletedIds.push(c.id);}
   if(action.goal)state.goal=clone(action.goal.before);if(action.bills)state.bills=clone(action.bills.before);
   persistAll();if(action.goal)window.FintexBehavior?.recordSaving(FintexMath.add(FintexMath.goalSavings(state.goal),-FintexMath.goalSavings(before.goal)));last=null;baseline=snapshot();renderAll(false);window.dismissUndoBanner?.();toast('Последнее действие отменено');
  }catch(_){state.transactions=before.tx;state.balance=before.balance;state.ledgerOffset=before.offset;state.localDeletedIds=before.deleted;state.goal=before.goal;state.bills=before.bills;try{persistAll();}catch(_){}toast('Не удалось сохранить отмену. Освободите место и повторите.');}
  finally{suppressed=false;render();}
 }
 window.addEventListener('filely:financial-data-updated',observe);
 window.FintexUndo={undo,ignore};
 document.addEventListener('DOMContentLoaded',()=>{baseline=snapshot();const box=document.createElement('aside');box.id='operation-undo';box.hidden=true;box.setAttribute('aria-label','Отмена последнего действия');box.innerHTML='<span id="operation-undo-copy" role="status"></span><button type="button" id="operation-undo-apply">Отменить</button><button type="button" id="operation-undo-close" aria-label="Скрыть отмену">×</button>';document.body.append(box);document.getElementById('operation-undo-apply').addEventListener('click',undo);document.getElementById('operation-undo-close').addEventListener('click',()=>{last=null;render();});window.undoLastTxDelete=undo;}, {once:true});
})();
