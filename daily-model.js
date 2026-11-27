/* Daily ledger rules. No DOM, storage, network, or automatic money movement. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./finance-math.js'):root.FintexMath;
  const effect=tx=>tx?.type==='income'?M.money(tx.amount):tx?.type==='expense'?-M.money(tx.amount):tx?.type==='adjustment'?M.money(tx.balance_delta):0;
  const locked=tx=>!!(tx?.bill_id||tx?.goal_withdrawal||tx?.type==='adjustment');
  function validate(draft,today,original){
    const type=String(draft.type||''),amount=M.parse(draft.amount),date=String(draft.date||''),merchant=String(draft.merchant||'').trim().slice(0,100);
    if(!['expense','income','transfer'].includes(type))return {error:'Выберите вид операции.',field:'type'};
    if(amount===null||amount<=0)return {error:'Укажите сумму больше нуля, до двух знаков после запятой.',field:'amount'};
    if(M.ordinal(date)===null||date>today)return {error:'Выберите дату не позднее сегодня.',field:'date'};
    if(!merchant)return {error:'Укажите название операции.',field:'merchant'};
    if(locked(original)&&(type!==original.type||M.minor(amount)!==M.minor(original.amount)||date!==original.date))return {error:'Эта запись связана с платежом или целью. Здесь можно менять только название и категорию.'};
    const from=String(draft.from||'').trim().slice(0,60),to=String(draft.to||'').trim().slice(0,60);
    if(type==='transfer'&&(!from||!to||from.toLocaleLowerCase('ru')===to.toLocaleLowerCase('ru')||!draft.covered))return {error:'Укажите разные свои счета и подтвердите, что оба уже входят в общий остаток.',field:!from?'from':!to||from.toLocaleLowerCase('ru')===to.toLocaleLowerCase('ru')?'to':'covered'};
    return {value:{type,amount,date,merchant,category:String(draft.category||'other'),...(type==='transfer'?{transfer_from:from,transfer_to:to}:{})}};
  }
  function change(balance,transactions,draft,today,id,newId){
    const old=id?transactions.find(t=>t.id===id):null;
    if(id&&!old)return {error:'Операция уже удалена. Закройте форму и откройте историю заново.'};
    const checked=validate(draft,today,old);if(checked.error)return checked;
    const tx={...(old||{}),...checked.value,id:old?.id||newId,source:old?.source||'Вручную',items:old?.items||[],...(id?{local_edited:true,local_only:true}:checked.value.type==='transfer'?{local_only:true}:{} )};
    if(tx.type!=='transfer'){delete tx.transfer_from;delete tx.transfer_to;}
    const next=transactions.slice();if(old)next[next.indexOf(old)]=tx;else next.unshift(tx);
    return {transactions:next,balance:M.add(balance,-effect(old),effect(tx)),tx};
  }
  function reconciliation(balance,transactions){
    const income=M.sum(transactions.filter(t=>t.type==='income'),t=>t.amount),expense=M.sum(transactions.filter(t=>t.type==='expense'),t=>t.amount),adjustments=M.sum(transactions.filter(t=>t.type==='adjustment'),effect);
    return {opening:M.add(balance,-income,expense,-adjustments),income,expense,adjustments,balance:M.money(balance)};
  }
  function adjust(balance,transactions,raw,today,id,reason){
    const actual=M.parse(raw);if(actual===null)return {error:'Укажите корректный остаток, до двух знаков после запятой.'};
    const delta=M.add(actual,-balance);if(!delta)return {unchanged:true};
    const tx={id,type:'adjustment',amount:Math.abs(delta),balance_delta:delta,date:today,merchant:String(reason||'Сверка остатка').trim().slice(0,100)||'Сверка остатка',category:'other',source:'Сверка',items:[],local_only:true};
    return {balance:actual,transactions:[tx,...transactions],tx};
  }
  function monthComparison(transactions,today){
    const [y,m,d]=today.split('-').map(Number),currentFrom=`${today.slice(0,7)}-01`,prevEnd=new Date(Date.UTC(y,m-1,0)),prevDay=Math.min(d,prevEnd.getUTCDate());
    const previousFrom=`${prevEnd.getUTCFullYear()}-${String(prevEnd.getUTCMonth()+1).padStart(2,'0')}-01`,previousTo=previousFrom.slice(0,8)+String(prevDay).padStart(2,'0');
    const rows=M.transactions(transactions,null,today).filter(t=>t.type==='expense'),current=rows.filter(t=>t.date>=currentFrom),previous=rows.filter(t=>t.date>=previousFrom&&t.date<=previousTo);
    const spent=M.sum(current,t=>t.amount),prior=M.sum(previous,t=>t.amount);
    return {currentFrom,currentTo:today,previousFrom,previousTo,spent,prior,delta:M.add(spent,-prior),comparable:!!current.length&&!!previous.length,shorterPrevious:prevDay!==d};
  }
  const api={effect,locked,validate,change,reconciliation,adjust,monthComparison};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexDailyModel=api;
})(typeof window==='undefined'?globalThis:window);
