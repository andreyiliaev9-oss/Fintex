/* Explicit place confirmation. One-shot browser location, never background tracking. */
(() => {
 'use strict';
 const M=FintexPlacesModel,$=id=>document.getElementById(id);
 let dialog,map=null,SDK=null,marker=null,draft=null,commit=null,prior=null,epoch=0,expectedBinding='';
 const binding=()=>[window.Telegram?.WebApp?.initDataUnsafe?.user?.id||(typeof USER_ID==='undefined'?'':USER_ID),window.FintexCloud?.getEndpoint?.()||'',localStorage.getItem('fp_backup_last_restore')||''].join('|');
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function say(text){$('place-picker-status').textContent=text;}
 function coordinates(){
  const lat=$('place-lat').value.trim(),lon=$('place-lon').value.trim();
  if(!lat||!lon)return null;
  const latitude=Number(lat.replace(',','.')),longitude=Number(lon.replace(',','.'));
  return M.location({latitude,longitude,accuracy:draft?.accuracy??null,captured_at:draft?.captured_at||new Date().toISOString()});
 }
 function update(){
  const loc=coordinates(),label=$('place-label').value.trim();
  $('place-picker-save').disabled=!loc||!label||!$('place-confirm').checked;
  if(map&&SDK&&loc){if(!marker){marker=new SDK.Marker({color:'#e9c779',draggable:true}).setLngLat([loc.longitude,loc.latitude]).addTo(map);marker.on('dragend',()=>choose(marker.getLngLat().lat,marker.getLngLat().lng));}else marker.setLngLat([loc.longitude,loc.latitude]);}
 }
 function choose(latitude,longitude,accuracy=null,captured_at=new Date().toISOString()){
  draft={latitude,longitude,accuracy,captured_at};$('place-lat').value=String(latitude);$('place-lon').value=String(longitude);$('place-confirm').checked=false;update();
 }
 function close(){epoch++;if(map){map.remove();map=null;}marker=null;SDK=null;draft=null;commit=null;expectedBinding='';if(dialog?.open)dialog.close();prior?.focus?.({preventScroll:true});}
 async function showMap(){
  if(map)return;
  const id=epoch,host=$('place-picker-map');host.hidden=false;
  try{const loc=coordinates(),result=await FintexSatellite.create(host,{center:loc?[loc.longitude,loc.latitude]:[0,20],zoom:loc?16:1,isCurrent:()=>id===epoch&&dialog.open,onStatus:text=>{if(epoch===id)say(text);},onClick:e=>{choose(e.lngLat.lat,e.lngLat.lng);say('Точка выбрана. Уточните подпись и подтвердите место покупки.');}});
   if(id!==epoch||!dialog.open){result.map.remove();return;}map=result.map;SDK=result.S;map.on('load',update);update();
  }catch(error){if(epoch===id)say(error.message);}
 }
 function locate(){
  if(!window.isSecureContext||!navigator.geolocation){say('Геолокация недоступна. Откройте через HTTPS в Safari/Chrome или выберите точку вручную.');return;}
  const id=epoch;$('place-locate').disabled=true;say('Телефон определяет местоположение. Это может занять до 15 секунд…');
  navigator.geolocation.getCurrentPosition(position=>{
   if(id!==epoch||!dialog.open||expectedBinding!==binding())return;
   $('place-locate').disabled=false;
   const stamp=position.timestamp;
   if(!Number.isFinite(stamp)||Math.abs(Date.now()-stamp)>120000){say('Телефон вернул устаревшую позицию. Запросите ещё раз или выберите точку вручную.');return;}
   const loc=M.location({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,captured_at:new Date(stamp).toISOString()});
   if(!loc){say('Телефон не вернул корректные координаты. Выберите точку вручную.');return;}
   choose(loc.latitude,loc.longitude,loc.accuracy,loc.captured_at);map?.jumpTo({center:[loc.longitude,loc.latitude],zoom:16});
   say('Позиция найдена'+(loc.accuracy===null?'':': точность примерно '+Math.round(loc.accuracy)+' м')+'. Это место телефона сейчас — подтвердите, что покупка была здесь.');
  },error=>{if(id!==epoch||!dialog.open)return;$('place-locate').disabled=false;say(error.code===1?'Доступ к местоположению запрещён. Разрешите его в настройках браузера или выберите точку вручную.':error.code===3?'Не удалось определить место за 15 секунд. Попробуйте снова или выберите точку вручную.':'Местоположение не определено. Выберите точку вручную.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 function mount(){
  dialog=node('dialog');dialog.id='place-picker';dialog.className='place-picker';dialog.setAttribute('aria-labelledby','place-picker-title');
  dialog.innerHTML='<header><div><span class="places-eyebrow">Личная карта покупок</span><h2 id="place-picker-title">Где была покупка?</h2></div><button type="button" id="place-picker-close" aria-label="Закрыть выбор места">×</button></header><div class="place-picker-body"><p class="places-note">Разрешение GPS не подтверждает магазин. Если покупка была раньше или онлайн, выберите её место вручную либо оставьте без метки.</p><button type="button" id="place-locate">Определить моё местоположение</button><div id="place-picker-consent"><p class="places-note">Спутниковые снимки и подписи загрузит MapTiler. Сервис увидит IP и область просмотра. Сумма, магазин, ваш журнал и банковский скриншот ему не передаются.</p><button type="button" id="place-picker-load">Открыть настоящий спутник</button></div><div id="place-picker-map" class="places-map" aria-label="Выберите место покупки на спутниковой карте" hidden></div><p id="place-picker-status" class="places-note" role="status" aria-live="polite"></p><label>Магазин и адрес · ваша подпись<input id="place-label" maxlength="180" autocomplete="off" placeholder="Например, кафе у дома, ул. Лесная, 5"></label><details id="place-coordinate-fields"><summary>Координаты точки</summary><div class="places-filters"><label>Широта<input id="place-lat" inputmode="decimal" autocomplete="off"></label><label>Долгота<input id="place-lon" inputmode="decimal" autocomplete="off"></label></div><p class="places-note">Можно ввести вручную, если точный адрес и координаты вам известны. FINTEX не угадывает адрес по названию магазина.</p></details><label class="place-check"><input id="place-confirm" type="checkbox"><span>Подтверждаю: покупка была в этой точке, подпись верна.</span></label><p class="places-note">Пока вы не подтвердите, геометка не сохраняется. Координаты и подпись войдут в историю, облачную синхронизацию и резервные копии. Старые серверные ревизии могут сохранять их после удаления метки.</p></div><footer><button type="button" id="place-picker-save" disabled>Подтвердить место</button><button type="button" id="place-picker-cancel">Отмена</button></footer>';
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{if(!dialog.open&&(map||commit))close();});
  $('place-picker-close').onclick=close;$('place-picker-cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('place-locate').onclick=locate;$('place-picker-load').onclick=()=>{FintexSatellite.allow();$('place-picker-consent').hidden=true;showMap();};
  for(const id of ['place-lat','place-lon'])$(id).addEventListener('input',()=>{draft=null;$('place-confirm').checked=false;update();});
  $('place-label').addEventListener('input',()=>{$('place-confirm').checked=false;update();});$('place-confirm').onchange=update;
  $('place-picker-save').onclick=()=>{
   if(expectedBinding!==binding()){say('Учётная запись изменилась. Закройте выбор места и откройте снова.');return;}
   const loc=coordinates();if(!loc||!$('place-confirm').checked)return;
   const confirmed=M.location({...loc,source:'user_confirmed',label:$('place-label').value.trim(),confirmed_at:new Date().toISOString()});if(!confirmed){say('Проверьте подпись и координаты.');return;}
   const callback=commit;try{callback?.(confirmed);close();}catch(error){say(error.message||'Не удалось сохранить место. Ничего не подтверждено.');}
  };
  window.addEventListener('fintex:satellite-revoked',()=>{if(map){map=null;marker=null;SDK=null;}$('place-picker-map').hidden=true;if(dialog.open)$('place-picker-consent').hidden=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)close();});window.addEventListener('pagehide',close);
 }
 function open({location:initial=null,title='Где была покупка?',onConfirm}={}){
  if(!dialog)mount();if(dialog.open)close();epoch++;prior=document.activeElement;commit=onConfirm;expectedBinding=binding();
  const loc=M.location(initial);draft=loc;dialog.querySelector('h2').textContent=title;
  $('place-label').value=loc?.source==='user_confirmed'?loc.label:'';$('place-lat').value=loc?.latitude??'';$('place-lon').value=loc?.longitude??'';$('place-confirm').checked=false;$('place-locate').disabled=false;$('place-picker-map').hidden=true;$('place-coordinate-fields').open=false;$('place-picker-consent').hidden=FintexSatellite.allowed();say('Определите место сейчас или укажите точку покупки на карте.');update();dialog.showModal();$('place-locate').focus();if(FintexSatellite.allowed())showMap();
 }
 function field(host,{location:loc=null,title='Место покупки',onChange}){
  host.replaceChildren();host.classList.add('place-field');host.append(node('strong',title),node('p',loc?.source==='user_confirmed'?loc.label:loc?'Есть позиция телефона · место ещё не подтверждено':'Без места · необязательно'));
  host.append(button(loc?'Проверить / изменить место':'Добавить место на карте',()=>open({location:loc,title,onConfirm:onChange})));
  if(loc)host.append(button('Убрать из этой операции',()=>onChange(null)));
 }
 window.FintexPlacePicker={open,close,field};
})();
