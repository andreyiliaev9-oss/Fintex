/* Read-only journal projection: explicit filters, exact money search, no storage. */
(function(root){
 'use strict';
 const M=typeof module!=='undefined'&&module.exports?require('./finance-math.js'):root.FintexMath;
 const defaults=()=>({type:'all',category:'all',period:'all',from:'',to:''});
 const normalize=value=>String(value??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
 function matches(tx,query){
  const q=normalize(query);if(!q)return true;
  const number=q.replace(/[ \u00a0\u202f]/g,'').replace(/(?:₽|руб\.?|рублей)$/,'');
  if(/^\d+(?:[.,]\d{1,2})?$/.test(number))return M.minor(tx.amount)===M.minor(M.parse(number));
  const haystack=normalize([tx.merchant,...(Array.isArray(tx.items)?tx.items.flatMap(i=>[i?.name,i?.title]):[])].join(' '));
  return q.split(' ').every(word=>haystack.includes(word));
 }
 function validate(input,today){
  const v={...defaults(),...input};
  if(!['all','income','expense','transfer','adjustment'].includes(v.type)||!['all','today','7d','month','custom'].includes(v.period))return {error:'Выберите вид операции и период из списка.'};
  if(v.period==='custom'&&(M.ordinal(v.from)===null||M.ordinal(v.to)===null))return {error:'Укажите обе даты периода.'};
  if(v.period==='custom'&&v.from>v.to)return {error:'Дата начала должна быть не позже даты окончания.'};
  if(v.period==='custom'&&v.to>today)return {error:'Дата окончания должна быть не позже сегодняшней.'};
  if(v.type!=='expense')v.category='all';
  if(v.period!=='custom'){v.from='';v.to='';}
  return {value:v};
 }
 function effective(input,day){return day?{...defaults(),type:day.type||'all',period:'custom',from:day.date,to:day.date}:{...defaults(),...input};}
 function project(list,{view,day,query='',today}={}){
  const v=effective(view,day);let from='',to='';
  if(v.period==='today')from=to=today;
  if(v.period==='7d'){from=M.shift(today,-6);to=today;}
  if(v.period==='month'){from=today.slice(0,7)+'-01';to=today;}
  if(v.period==='custom'){from=v.from;to=v.to;}
  const rows=M.ledgerTransactions(list).filter(t=>(v.type==='all'||t.type===v.type)&&(v.category==='all'||t.type==='expense'&&t.category===v.category)&&(!from||t.date>=from)&&(!to||t.date<=to)&&matches(t,query)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.time||'').localeCompare(String(a.time||'')));
  return {rows,view:v,active:!!day||v.type!=='all'||v.category!=='all'||v.period!=='all',income:M.sum(rows.filter(t=>t.type==='income'),t=>t.amount),expense:M.sum(rows.filter(t=>t.type==='expense'),t=>t.amount),neutral:rows.filter(t=>['transfer','adjustment'].includes(t.type)).length};
 }
 const api={defaults,normalize,matches,validate,effective,project};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexJournalModel=api;
})(typeof window==='undefined'?globalThis:window);
