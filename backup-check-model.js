/* Comparison only: no restore, storage, hashing, network or financial recalculation. */
(function(root){
 'use strict';
 const labels={name:'Имя профиля',bank:'Банк',balance:'Общий остаток',payday:'Дата зарплаты',goal:'Цели и их обложки',catLimits:'Лимиты категорий',transactions:'Операции',bills:'Платежи',ledgerOffset:'Локальная поправка остатка',localDeletedIds:'Отметки удалённых записей',priceHistory:'История цен',captureArchive:'Метаданные распознавания',behavior:'История накоплений',workTime:'Доход и рабочее время'};
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
 }
 const stringify=value=>JSON.stringify(canonical(value));
 function section(key,value){
  if(['transactions','bills'].includes(key))return [...value].sort((a,b)=>a.id.localeCompare(b.id));
  if(key==='localDeletedIds')return [...value].sort();
  if(key==='goal'&&Array.isArray(value?.pockets))return {...value,pockets:[...value.pockets].sort((a,b)=>a.id.localeCompare(b.id))};
  return value;
 }
 function compare(device,file){
  const sections=Object.entries(labels).map(([key,label])=>({key,label,equal:stringify(section(key,device[key]))===stringify(section(key,file[key]))}));
  const a=new Map(device.transactions.map(t=>[t.id,t])),b=new Map(file.transactions.map(t=>[t.id,t]));
  const transactions={onlyDevice:0,onlyFile:0,changed:0,equal:0};
  for(const [id,tx]of a){if(!b.has(id))transactions.onlyDevice++;else if(stringify(tx)!==stringify(b.get(id)))transactions.changed++;else transactions.equal++;}
  for(const id of b.keys())if(!a.has(id))transactions.onlyFile++;
  return {same:sections.every(s=>s.equal),sections,transactions};
 }
 const api={compare};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexBackupCheckModel=api;
})(typeof window==='undefined'?globalThis:window);
