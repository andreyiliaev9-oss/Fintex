/* Explicit address lookup only. Never send merchant/ledger/screenshot data.
 * Search results may be exported under MapTiler Cloud terms §6.4; no bulk lookup. */
(() => {
 'use strict';
 function feature(value){
  const c=value?.center||value?.geometry?.coordinates;
  const city=Array.isArray(value?.context)?value.context.find(c=>String(c.id||'').startsWith('place.')&&['city','town','village','hamlet'].includes(c.place_designation)):null;
  const line=value?.text_ru||value?.text;
  const short=typeof line==='string'&&value?.address?line+' '+String(value.address):null;
  const label=short?(city?(city.text_ru||city.text)+', ':'')+short:value?.place_name_ru||value?.place_name||line;
  if(!Array.isArray(c)||typeof label!=='string')return null;
  const location=FintexPlacesModel.location({longitude:c[0],latitude:c[1],captured_at:new Date().toISOString()});
  const name=label.replace(/[\x00-\x1f]/g,' ').trim().slice(0,180);
  return location&&name?{...location,label:name}:null;
 }
 async function request(query,{signal,reverse=false,center}={}){
  const style=new URL(window.FintexMapConfig?.style||'',location.href);
  if(style.origin!=='https://api.maptiler.com'||!style.searchParams.get('key'))throw Error('Поиск пока недоступен. Выберите точку на карте.');
  if(!navigator.onLine)throw Error('Для поиска нужен интернет. Можно выбрать сохранённое место.');
  const url=new URL('/geocoding/'+encodeURIComponent(query)+'.json',style.origin);
  url.searchParams.set('key',style.searchParams.get('key'));url.searchParams.set('language','ru');url.searchParams.set('limit',reverse?'1':'5');
  if(reverse)url.searchParams.set('types','address');else{url.searchParams.set('country','ru');url.searchParams.set('autocomplete','false');if(center)url.searchParams.set('proximity',center.join(','));}
  const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,8000);
  try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});if(!response.ok)throw Error('Поиск не ответил. Выберите точку на карте или попробуйте ещё раз.');const body=await response.json();if(!Array.isArray(body.features))throw Error('Не удалось прочитать адрес. Выберите точку на карте.');return body.features.slice(0,5).map(feature).filter(Boolean);}
  catch(error){if(signal?.aborted)throw error;if(error.name==='AbortError')throw Error('Поиск занял слишком много времени. Точку можно выбрать на карте.');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 window.FintexPlaceSearch={forward(query,options){const text=String(query||'').trim();if(text.length<3||text.length>180)return Promise.reject(Error('Введите хотя бы три символа адреса.'));return request(text,options);},reverse(loc,options){if(!FintexPlacesModel.location(loc))return Promise.reject(Error('Сначала выберите точку.'));return request(loc.longitude+','+loc.latitude,{...options,reverse:true});}};
})();
