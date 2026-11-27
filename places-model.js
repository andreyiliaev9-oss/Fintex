/* Optional phone-location metadata, not proof of a purchase address. */
(function(root){
 'use strict';
 const M=typeof module!=='undefined'&&module.exports?require('./finance-math.js'):root.FintexMath;
 function location(value,now=Date.now()){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const {latitude,longitude,accuracy,captured_at}=value;
  if(typeof latitude!=='number'||!Number.isFinite(latitude)||Math.abs(latitude)>90||typeof longitude!=='number'||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
  const ms=typeof captured_at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(captured_at)?Date.parse(captured_at):NaN;
  if(!Number.isFinite(ms)||ms>Date.parse(new Date(now).toISOString())+300000||ms<946684800000||new Date(ms).toISOString().slice(0,10)!==captured_at.slice(0,10))return null;
  if(accuracy!==undefined&&accuracy!==null&&(typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>100000))return null;
  const clean={latitude,longitude,accuracy:accuracy??null,captured_at:new Date(ms).toISOString(),source:'phone_sms'};
  if(value.source==='user_confirmed'){
   const confirmed=Date.parse(value.confirmed_at),label=value.label;
   if(typeof label!=='string'||!label.trim()||label.length>180||/[\x00-\x1f]/.test(label)||typeof value.confirmed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value.confirmed_at)||!Number.isFinite(confirmed)||confirmed>now+300000||confirmed<946684800000||new Date(confirmed).toISOString().slice(0,10)!==value.confirmed_at.slice(0,10))return null;
   Object.assign(clean,{source:'user_confirmed',label:label.trim(),confirmed_at:new Date(confirmed).toISOString()});
  }
  return clean;
 }
 function project(transactions,{start='0000-01-01',end='9999-12-31',category='all',now=Date.now()}={}){
  const expenses=M.transactions(transactions,start,end).filter(t=>t.type==='expense'&&(category==='all'||t.category===category));
  const points=expenses.flatMap(t=>{const place=location(t.location,now);return place?[{...t,location:place}]:[];}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.time||'').localeCompare(String(a.time||''))||String(a.id).localeCompare(String(b.id)));
  return {points,total:expenses.length,missing:expenses.length-points.length,amount:M.sum(points,t=>t.amount)};
 }
 function places(points){
  const groups=new Map();
  for(const tx of points){const l=tx.location,key=[tx.merchant.toLocaleLowerCase('ru-RU').trim(),l.source==='user_confirmed'?l.label.toLocaleLowerCase('ru-RU'):'',l.latitude.toFixed(4),l.longitude.toFixed(4)].join('|');let g=groups.get(key);if(!g){g={title:tx.merchant,label:l.label||'Место телефона · не подтверждено',latitude:l.latitude,longitude:l.longitude,count:0,minor:0,transactions:[]};groups.set(key,g);}g.count++;g.minor+=M.minor(tx.amount);g.transactions.push(tx);}
  return [...groups.values()].map(g=>({...g,amount:g.minor/100})).sort((a,b)=>b.minor-a.minor||a.title.localeCompare(b.title));
 }
 const api={location,project,places};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexPlacesModel=api;
})(typeof window==='undefined'?globalThis:window);
