/* Pick a place, then explicitly confirm it once. No background GPS or silent saves. */
(() => {
 'use strict';
 const M=FintexPlacesModel,$=id=>document.getElementById(id);
 let dialog,map=null,SDK=null,marker=null,draft=null,commit=null,prior=null,epoch=0,expectedBinding='',suggestion='',lookup=null,lookupEpoch=0,opening=false,pointEpoch=0;
 const binding=()=>[window.Telegram?.WebApp?.initDataUnsafe?.user?.id||(typeof USER_ID==='undefined'?'':USER_ID),window.FintexCloud?.getEndpoint?.()||'',localStorage.getItem('fp_backup_last_restore')||''].join('|');
 const region=()=>FintexMapRegions.get(localStorage.getItem('fp_map_region'));
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function say(text){$('place-picker-status').textContent=text;}
 function abortLookup(){lookupEpoch++;lookup?.abort();lookup=null;}
 function coordinates(){const lat=$('place-lat').value.trim(),lon=$('place-lon').value.trim();if(!lat||!lon)return null;return M.location({latitude:Number(lat.replace(',','.')),longitude:Number(lon.replace(',','.')),accuracy:draft?.accuracy??null,captured_at:draft?.captured_at||new Date().toISOString()});}
 function update(){
  const loc=coordinates();$('place-picker-save').disabled=!loc;$('place-reverse').hidden=!loc;
  $('place-selected-title').textContent=loc?($('place-label').value.trim()||suggestion||'Точка на карте'):'Выберите место';
  $('place-selected-note').textContent=loc?'Проверьте точку и нажмите «Здесь была покупка».':'Найдите адрес, выберите знакомое место или нажмите «Я здесь».';
  if(!loc&&marker){marker.remove();marker=null;}
  if(map&&SDK&&loc){if(!marker){marker=new SDK.Marker({color:'#e9c779',draggable:true}).setLngLat([loc.longitude,loc.latitude]).addTo(map);marker.on('dragend',()=>choose({...coordinates(),latitude:marker.getLngLat().lat,longitude:marker.getLngLat().lng,accuracy:null,captured_at:new Date().toISOString()}));}else marker.setLngLat([loc.longitude,loc.latitude]);}
 }
 function choose(loc,label){pointEpoch++;abortLookup();draft=M.location(loc);$('place-lat').value=draft?.latitude??'';$('place-lon').value=draft?.longitude??'';$('place-label').value=label||suggestion||'Точка на карте';update();}
 function fly(){const loc=coordinates();if(map&&loc)FintexMapRegions.visit(map,region(),{target:{center:[loc.longitude,loc.latitude],zoom:16}});}
 function close(){epoch++;abortLookup();if(map){map.remove();map=null;}opening=false;marker=null;SDK=null;draft=null;commit=null;expectedBinding='';if(dialog?.open)dialog.close();prior?.focus?.({preventScroll:true});}
 async function showMap(){
  if(map||opening)return;opening=true;const id=epoch,host=$('place-picker-map');host.hidden=false;
  try{const loc=coordinates(),r=region(),result=await FintexSatellite.create(host,{center:loc?[loc.longitude,loc.latitude]:r.center,zoom:loc?16:r.zoom,isCurrent:()=>id===epoch&&dialog.open,onStatus:text=>{if(epoch===id&&host.dataset.basemapState==='error')say(text);},onClick:e=>{choose({latitude:e.lngLat.lat,longitude:e.lngLat.lng,captured_at:new Date().toISOString()});say('Точка выбрана. Можно сохранить или уточнить адрес.');}});
   if(id!==epoch||!dialog.open){result.map.remove();return;}map=result.map;SDK=result.S;map.on('load',update);update();
  }catch(error){if(epoch===id){say(error.message);$('place-picker-consent').hidden=false;}}finally{if(epoch===id)opening=false;}
 }
 async function reverse(){
  const loc=coordinates();if(!loc)return;abortLookup();lookup=new AbortController();const id=epoch,seq=lookupEpoch,account=expectedBinding;say('Ищем адрес рядом с точкой…');
  try{const rows=await FintexPlaceSearch.reverse(loc,{signal:lookup.signal});if(id!==epoch||seq!==lookupEpoch||account!==binding()||!dialog.open)return;
   if(rows[0]){$('place-label').value=rows[0].label;update();say('Адрес рядом с точкой найден. Проверьте, что покупка была здесь.');}else say('Адрес не найден. Точку всё равно можно сохранить — название необязательно.');
  }catch(error){if(id===epoch&&seq===lookupEpoch&&dialog.open)say(error.message||'Адрес недоступен. Выбранную точку можно сохранить.');}
 }
 function locate(){
  const id=epoch,account=expectedBinding,point=pointEpoch;$('place-locate').disabled=true;say('Определяем, где вы сейчас…');
  FintexSatellite.locate().then(loc=>{if(id!==epoch||point!==pointEpoch||!dialog.open||account!==binding())return;choose(loc);fly();say('Вы здесь'+(loc.accuracy===null?'':' · точность примерно '+Math.round(loc.accuracy)+' м')+'. Проверьте место покупки.');if(FintexSatellite.allowed())reverse();},error=>{if(id===epoch&&dialog.open)say(error.message);}).finally(()=>{if(id===epoch)$('place-locate').disabled=false;});
 }
 async function search(event){
  event.preventDefault();abortLookup();const id=epoch,seq=lookupEpoch,account=expectedBinding;lookup=new AbortController();$('place-search-results').replaceChildren();say('Ищем адрес…');
  try{const rows=await FintexPlaceSearch.forward($('place-search-query').value,{signal:lookup.signal,center:region().center});if(id!==epoch||seq!==lookupEpoch||account!==binding()||!dialog.open)return;
   for(const loc of rows)$('place-search-results').append(button(loc.label,()=>{choose(loc,loc.label);$('place-search-results').replaceChildren();if(FintexSatellite.allowed()){showMap();fly();}say('Адрес выбран. Подтвердите место покупки.');}));say(rows.length?'Выберите подходящий адрес.':'Ничего не найдено. Попробуйте улицу и номер дома или точку на карте.');
  }catch(error){if(id===epoch&&seq===lookupEpoch&&dialog.open)say(error.message||'Поиск недоступен. Можно выбрать точку на карте.');}
 }
 function mount(){
  dialog=node('dialog');dialog.id='place-picker';dialog.className='place-picker';dialog.setAttribute('aria-labelledby','place-picker-title');
  dialog.innerHTML=`<header><div><span class="places-eyebrow">Место покупки</span><h2 id="place-picker-title">Где это было?</h2></div><button type="button" id="place-picker-close" aria-label="Закрыть выбор места">×</button></header>
   <div class="place-picker-body"><form id="place-search-form" class="place-search"><label class="sr-only" for="place-search-query">Адрес или место</label><input id="place-search-query" maxlength="180" placeholder="Улица, дом или место" autocomplete="off"><button type="submit" aria-label="Найти адрес">Найти</button></form><div id="place-search-results" class="place-search-results"></div>
   <p class="place-search-privacy">Поиск отправляет запрос или точку сервису карт — без покупок и сумм.</p><button type="button" id="place-locate">Я здесь</button><div id="place-recent" class="place-recent"></div>
   <div id="place-picker-consent"><button type="button" id="place-picker-load">Выбрать на карте</button><p class="places-note">Снимки загрузятся из интернета. Сервис увидит IP и область просмотра.</p></div><div id="place-picker-map" class="places-map" aria-label="Выберите место покупки на карте" hidden></div>
   <div class="place-selected"><strong id="place-selected-title"></strong><p id="place-selected-note"></p><button type="button" id="place-reverse" hidden>Уточнить адрес точки</button></div><p id="place-picker-status" class="places-note" role="status" aria-live="polite"></p>
   <label class="place-name-label">Название · можно не менять<input id="place-label" maxlength="180" autocomplete="off" placeholder="Точка на карте"></label>
   <details id="place-coordinate-fields"><summary>Координаты и подробности</summary><div class="places-filters"><label>Широта<input id="place-lat" inputmode="decimal" autocomplete="off"></label><label>Долгота<input id="place-lon" inputmode="decimal" autocomplete="off"></label></div><p class="places-note">Место сохраняется только по кнопке ниже. Оно войдёт в историю и резервные копии; при настроенной синхронизации — в облако. Старые ревизии могут содержать удалённые метки.</p></details><small class="place-search-credit">Поиск: MapTiler · © OpenStreetMap contributors</small></div>
   <footer><button type="button" id="place-picker-save" disabled>Здесь была покупка</button><button type="button" id="place-picker-cancel">Отмена</button></footer>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>{if(!dialog.open&&(map||commit))close();});
  $('place-picker-close').onclick=close;$('place-picker-cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('place-locate').onclick=locate;$('place-reverse').onclick=reverse;$('place-search-form').onsubmit=search;$('place-search-query').oninput=()=>{abortLookup();$('place-search-results').replaceChildren();};
  $('place-picker-load').onclick=()=>{FintexSatellite.allow();$('place-picker-consent').hidden=true;showMap();};
  for(const id of ['place-lat','place-lon'])$(id).addEventListener('input',()=>{pointEpoch++;abortLookup();draft=null;$('place-label').value=suggestion||'Точка на карте';update();});
  $('place-label').addEventListener('input',()=>{pointEpoch++;abortLookup();update();});
  $('place-picker-save').onclick=()=>{
   if(expectedBinding!==binding()){say('Учётная запись изменилась. Откройте выбор места заново.');return;}
   const loc=coordinates();if(!loc)return;
   const confirmed=M.location({...loc,source:'user_confirmed',label:$('place-label').value.trim()||suggestion||'Точка на карте',confirmed_at:new Date().toISOString()});if(!confirmed){say('Проверьте название и точку.');return;}
   const callback=commit;try{callback?.(confirmed);close();}catch(error){say(error.message||'Не удалось сохранить место. Попробуйте ещё раз.');}
  };
  window.addEventListener('fintex:satellite-revoked',()=>{abortLookup();if(map){map=null;marker=null;SDK=null;}$('place-picker-map').hidden=true;if(dialog.open)$('place-picker-consent').hidden=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)close();});window.addEventListener('pagehide',close);
 }
 function open({location:initial=null,title='Где это было?',suggestedLabel='',onConfirm}={}){
  if(!dialog)mount();if(dialog.open)close();epoch++;prior=document.activeElement;commit=onConfirm;expectedBinding=binding();suggestion=String(suggestedLabel||'').slice(0,180);
  const recent=window.FintexPlaces?.position?.(),loc=M.location(initial)||recent;draft=loc;dialog.querySelector('h2').textContent=title;
  $('place-label').value=loc?.source==='user_confirmed'?loc.label:suggestion||'Точка на карте';$('place-lat').value=loc?.latitude??'';$('place-lon').value=loc?.longitude??'';$('place-locate').disabled=false;$('place-picker-map').hidden=true;$('place-coordinate-fields').open=false;$('place-picker-consent').hidden=FintexSatellite.allowed();$('place-search-query').value='';$('place-search-results').replaceChildren();say(recent&&!initial?'Ваша недавняя позиция уже выбрана. Подтвердите, если покупка была здесь.':'');
  const saved=$('place-recent');saved.replaceChildren();const seen=new Set();for(const tx of (typeof state==='undefined'?[]:state.transactions)){const p=M.location(tx.location);if(p?.source!=='user_confirmed')continue;const key=p.label+'|'+p.latitude.toFixed(4)+'|'+p.longitude.toFixed(4);if(seen.has(key))continue;seen.add(key);if(seen.size>5)break;saved.append(button(p.label,()=>{choose(p,p.label);fly();say('Знакомое место выбрано. Осталось подтвердить покупку.');}));}saved.hidden=!saved.childElementCount;
  update();dialog.showModal();$('place-locate').focus();if(FintexSatellite.allowed())showMap();
 }
 function field(host,{location:loc=null,title='Место покупки',suggestedLabel='',onChange}){
  host.replaceChildren();host.classList.add('place-field');host.append(node('strong',title),node('p',loc?.source==='user_confirmed'?loc.label:loc?'Точка есть · осталось подтвердить':'Без места'));
  host.append(button(loc?'Изменить место':'Добавить место на карте',()=>open({location:loc,title:'Где была покупка?',suggestedLabel:typeof suggestedLabel==='function'?suggestedLabel():suggestedLabel,onConfirm:onChange})));
  if(loc)host.append(button('Убрать из этой операции',()=>onChange(null)));
 }
 window.FintexPlacePicker={open,close,field};
})();
