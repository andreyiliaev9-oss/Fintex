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
  return {latitude,longitude,accuracy:accuracy??null,captured_at:new Date(ms).toISOString(),source:'phone_sms'};
 }
 function project(transactions,{start='0000-01-01',end='9999-12-31',category='all',now=Date.now()}={}){
  const expenses=M.transactions(transactions,start,end).filter(t=>t.type==='expense'&&(category==='all'||t.category===category));
  const points=expenses.flatMap(t=>{const place=location(t.location,now);return place?[{...t,location:place}]:[];}).sort((a,b)=>b.date.localeCompare(a.date)||String(b.time||'').localeCompare(String(a.time||''))||String(a.id).localeCompare(String(b.id)));
  return {points,total:expenses.length,missing:expenses.length-points.length,amount:M.sum(points,t=>t.amount)};
 }
 const api={location,project};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexPlacesModel=api;
})(typeof window==='undefined'?globalThis:window);
