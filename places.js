/* Personal purchase atlas. Real satellite imagery; all finance/point data stays local to SDK sources. */
(() => {
 'use strict';
 const Model=FintexPlacesModel;
 let home=null,homeMarker=null,preferredMemory=null,cameraIntent='purchase';
 let focused=null,focusMarker=null,searchController=null,searchEpoch=0;
 let regionId=FintexMapRegions.defaultId,days=30,currentPosition=null,positionMarker=null,gpsBusy=false,gpsEpoch=0,gpsMessage='',mapMessage='';
 try{regionId=FintexMapRegions.get(localStorage.getItem('fp_map_region')).id;}catch(_){}
 const region=()=>FintexMapRegions.get(regionId);
 const isVisible=()=>!document.getElementById('view-map')?.classList.contains('hidden');
 let allowed=false,opened=true,category='all',mode='points',limit=25,current=null,viewer=null,host=null,opening=false,status=null,points=[],generation=0,lastFit='';
 const cats={food:'Продукты',taxi:'Транспорт',cafe:'Кафе',fun:'Развлечения',subs:'Подписки',shop:'Покупки',health:'Здоровье',other:'Прочее'};
 const money=n=>n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+' ₽';
 const purchases=n=>n+' '+(n%10===1&&n%100!==11?'покупка':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'покупки':'покупок');
 const shortDate=value=>{const [year,month,day]=String(value).split('-').map(Number);if(!year||!month||!day)return String(value);return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',...(year!==new Date().getFullYear()?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day)));};

 function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 const destinationKey=tx=>tx?JSON.stringify([tx.id,tx.location?.latitude,tx.location?.longitude,tx.location?.label,tx.location?.source,tx.merchant,tx.amount,tx.date,tx.time]):'';
 const preferenceKey='fp_map_purchase_view';
 const owner=()=>JSON.stringify([typeof USER_ID==='undefined'?'':USER_ID,window.FintexCloud?.getEndpoint?.()||'',localStorage.getItem('fp_backup_last_restore')||'']);
 function preferred(){
  let saved=preferredMemory;try{saved=JSON.parse(localStorage.getItem(preferenceKey)||'null')||saved;}catch(_){}
  if(saved?.version!==1||saved.owner!==owner()||typeof saved.txId!=='string')return null;
  if(!state.transactions.some(t=>String(t.id)===saved.txId&&t.type==='expense'&&Model.location(t.location))){preferredMemory=null;try{localStorage.removeItem(preferenceKey);}catch(_){}return null;}
  return saved.txId;
 }
 function remember(tx){if(!tx||tx.type!=='expense'||!Model.location(tx.location))return;preferredMemory={version:1,owner:owner(),txId:String(tx.id)};try{localStorage.setItem(preferenceKey,JSON.stringify(preferredMemory));}catch(_){} }
 function showPurchase(tx,{animate=false}={}){
  if(!viewer||!tx)return;const loc=Model.location(tx.location);if(!loc)return;const {map,S}=viewer;FintexMapRegions.cancel(map);homeMarker?.remove();
  const pin=node('button',undefined,'places-home-pin');pin.type='button';pin.setAttribute('aria-label',tx.merchant+' · '+money(tx.amount));if(loc.source!=='user_confirmed')pin.classList.add('is-unconfirmed');
  homeMarker=new S.Marker({element:pin}).setLngLat([loc.longitude,loc.latitude]).setPopup(new S.Popup({maxWidth:'260px'}).setDOMContent(popup(tx))).addTo(map);
  pin.addEventListener('click',()=>remember(tx));const camera={center:[loc.longitude,loc.latitude],zoom:16,pitch:20,bearing:0};
  if(animate&&FintexMapRegions.motion())map.easeTo({...camera,duration:1400});else map.jumpTo(camera);
 }
 function visitPurchase(tx){if(!tx)return;gpsEpoch++;gpsBusy=false;gpsMessage='';focused=null;currentPosition=null;positionMarker?.remove();positionMarker=null;focusMarker?.remove();focusMarker=null;cameraIntent='purchase';remember(tx);home={...home,selected:tx};showPurchase(tx,{animate:true});refresh();document.getElementById('places-map')?.scrollIntoView({behavior:FintexMapRegions.motion()?'smooth':'instant',block:'center'});}
 function stop(){generation++;if(viewer){try{viewer.map.remove();}catch(_){}viewer=null;}opening=false;host=null;homeMarker=null;cameraIntent='purchase';positionMarker=null;focusMarker=null;lastFit='';mapMessage='';}
 function savePlace(id,snapshot,loc){
  const old=state.transactions.find(t=>t.id===id);if(!old||JSON.stringify(old)!==snapshot)throw Error('Операция изменилась. Откройте выбор места заново.');
  const tx={...old,local_only:true,local_edited:true};if(loc)tx.location=loc;else delete tx.location;
  const next=state.transactions.map(t=>t.id===id?tx:t);
  // Atomic local metadata write first. Balance/offset/queue are not touched.
  localStorage.setItem('fp_local_tx',JSON.stringify(next));state.transactions=next;if(loc){remember(tx);cameraIntent='purchase';if(viewer)showPurchase(tx,{animate:true});}
  window.dispatchEvent(new Event('filely:financial-data-updated'));renderAll(false);if(window.FintexSync?.active())FintexSync.sync();
 }
 function edit(tx){const snapshot=JSON.stringify(tx);FintexPlacePicker.open({location:tx.location,title:'Где была покупка?',suggestedLabel:tx.merchant,onConfirm:loc=>savePlace(tx.id,snapshot,loc)});}
 function popup(tx){const p=node('div',undefined,'places-popup');p.append(node('strong',tx.merchant),node('p',money(tx.amount)+' · '+tx.date),node('p',tx.location.source==='user_confirmed'?tx.location.label:'Позиция телефона · место покупки не подтверждено'),button('Проверить место покупки',()=>edit(state.transactions.find(t=>t.id===tx.id)||tx)));return p;}
 function geojson(){return {type:'FeatureCollection',features:points.slice(0,2000).map(t=>({type:'Feature',geometry:{type:'Point',coordinates:[t.location.longitude,t.location.latitude]},properties:{id:t.id,minor:FintexMath.minor(t.amount),confirmed:t.location.source==='user_confirmed'?1:0}}))};}
 function fit(){if(!viewer||!points.length)return;const visible=points.slice(0,2000),key=visible.map(t=>[t.id,t.location.latitude,t.location.longitude].join(':')).join('|');if(lastFit===key)return;lastFit=key;cameraIntent='all';FintexMapRegions.cancel(viewer.map);const bounds=new viewer.S.LngLatBounds();for(const t of visible)bounds.extend([t.location.longitude,t.location.latitude]);viewer.map.fitBounds(bounds,{padding:54,maxZoom:16,duration:0});}
 function renderLayers(){
  if(!viewer||(!viewer.map.isStyleLoaded()&&!viewer.map.getSource('fintex-purchases')))return;
  const m=viewer.map,data=geojson();
  if(!m.getSource('fintex-purchases')){
   m.addSource('fintex-purchases',{type:'geojson',data,cluster:true,clusterRadius:48,clusterProperties:{total_minor:['+',['get','minor']]}});
   m.addSource('fintex-heat',{type:'geojson',data});
   m.addLayer({id:'fintex-heat',type:'heatmap',source:'fintex-heat',paint:{'heatmap-weight':1,'heatmap-intensity':1.4,'heatmap-radius':36,'heatmap-opacity':.8,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(47,177,151,0)',.25,'#46a8c9',.5,'#40bb96',.75,'#f1c65d',1,'#ed7054']}});
   m.addLayer({id:'fintex-clusters',type:'circle',source:'fintex-purchases',filter:['has','point_count'],paint:{'circle-radius':['step',['get','point_count'],24,10,30,50,36],'circle-color':'#e9c779','circle-stroke-color':'#15372e','circle-stroke-width':3}});
   m.addLayer({id:'fintex-cluster-label',type:'symbol',source:'fintex-purchases',filter:['has','point_count'],layout:{'text-field':['concat',['number-format',['/',['get','total_minor'],100],{'max-fraction-digits':0}],' ₽'],'text-size':12,'text-font':['Noto Sans Regular']},paint:{'text-color':'#112b23'}});
   m.addLayer({id:'fintex-points',type:'circle',source:'fintex-purchases',filter:['!',['has','point_count']],paint:{'circle-radius':9,'circle-color':['case',['==',['get','confirmed'],1],'#e9c779','#67d4b8'],'circle-stroke-width':3,'circle-stroke-color':'#15372e'}});
   m.addLayer({id:'fintex-point-label',type:'symbol',source:'fintex-purchases',filter:['!',['has','point_count']],layout:{'text-field':['concat',['number-format',['/',['get','minor'],100],{'max-fraction-digits':2}],' ₽'],'text-size':12,'text-font':['Noto Sans Regular'],'text-offset':[0,1.8],'text-anchor':'top'},paint:{'text-color':'#ffffff','text-halo-color':'#102b23','text-halo-width':2}});
  }else{m.getSource('fintex-purchases').setData(data);m.getSource('fintex-heat').setData(data);}
  m.setPaintProperty('fintex-heat','heatmap-weight',mode==='count'?1:['/', ['get','minor'],Math.max(1,...points.slice(0,2000).map(t=>FintexMath.minor(t.amount)))]);
  m.setLayoutProperty('fintex-heat','visibility',mode==='points'?'none':'visible');for(const id of ['fintex-clusters','fintex-cluster-label','fintex-points','fintex-point-label'])m.setLayoutProperty(id,'visibility',mode==='points'?'visible':'none');
 }
 async function draw(){
  if(!allowed||!opened||!host?.isConnected)return;
  host.hidden=false;if(viewer){viewer.map.resize();renderLayers();return;}if(opening)return;
  opening=true;const id=generation,initial=(!focused&&!currentPosition&&cameraIntent==='purchase')?home?.selected:null,initialLoc=initial?.location;
  try{const result=await FintexSatellite.create(host,{globe:true,center:initialLoc?[initialLoc.longitude,initialLoc.latitude]:FintexMapRegions.motion()?[75,58]:region().center,zoom:initialLoc?16:FintexMapRegions.motion()?0.3:region().zoom,isCurrent:()=>id===generation&&allowed&&opened,onStatus:text=>{if(id===generation){mapMessage=text;if(status){status.textContent=text;status.hidden=!text;}}},onClick:async(e,m,S)=>{
   if(mode!=='points'||!m.getLayer('fintex-points'))return;const features=m.queryRenderedFeatures(e.point,{layers:['fintex-points','fintex-clusters']});if(!features.length){selectPlace({latitude:e.lngLat.lat,longitude:e.lngLat.lng,captured_at:new Date().toISOString(),label:'Точка на карте'},false);return;}
   const f=features[0];if(f.properties.cluster){try{const z=await m.getSource('fintex-purchases').getClusterExpansionZoom(f.properties.cluster_id);FintexMapRegions.cancel(m);m.easeTo({center:f.geometry.coordinates,zoom:z,duration:350});}catch(_){}return;}
   const tx=points.find(t=>t.id===f.properties.id);if(tx){cameraIntent='purchase';remember(tx);refresh();}if(tx)new S.Popup({maxWidth:'260px'}).setLngLat(f.geometry.coordinates).setDOMContent(popup(tx)).addTo(m);
  }});
   if(id!==generation||!allowed){result.map.remove();return;}viewer=result;result.map.on('dragstart',()=>{cameraIntent='manual';});
   const loaded=()=>{if(id!==generation)return;renderLayers();if(['region','all','manual'].includes(cameraIntent))return;if(focused)showFocus(true);else if(currentPosition)showPosition(true);else if(home?.selected)showPurchase(home.selected);else FintexMapRegions.visit(result.map,region(),{intro:true});};
   let initialized=false;const initialize=()=>{if(initialized)return;initialized=true;loaded();};result.map.once('load',initialize);if(result.map.isStyleLoaded())initialize();
  }catch(error){if(id===generation){mapMessage=error.message;if(status){status.textContent=error.message;status.hidden=false;}}}finally{if(id===generation)opening=false;}
 }
 function refresh(){if(current?.container.isConnected)mount(current.container,{days});}
 function mount(container,options={days:30}){
  const previousDestination=destinationKey(home?.selected);
  container.querySelector('#places-card')?.remove();current={container,options};
  const end=FintexMath.key(new Date()),start=FintexMath.shift(end,-(options.days-1)),data=Model.project(state.transactions,{start,end,category});points=data.points;home=Model.destinations(state.transactions,{start,end,category,preferredId:preferred()});
  const card=node('section',undefined,'places-card card-surface');card.id='places-card';
  const header=node('header',undefined,'places-page-heading');header.append(node('h1','Карта'));const areaLabel=node('label',undefined,'places-region-label');areaLabel.append(node('span','Регион · Россия','sr-only'));const regions=node('select');regions.id='places-region';regions.setAttribute('aria-label','Регион России');
  const ural=node('optgroup');ural.label='Урал';const other=node('optgroup');other.label='Все регионы';FintexMapRegions.all.forEach((r,i)=>(i<6?ural:other).append(new Option(r.name,r.id)));regions.append(ural,other);regions.value=regionId;
  regions.onchange=()=>{cameraIntent='region';regionId=regions.value;try{localStorage.setItem('fp_map_region',regionId);}catch(_){}if(viewer)FintexMapRegions.visit(viewer.map,region());};areaLabel.append(regions);header.append(areaLabel);card.append(header);
  const body=node('div',undefined,'places-body');card.append(body);const hero=node('div',undefined,'places-hero');body.append(hero);
  if(!host){host=node('div',undefined,'places-map');host.id='places-map';host.dataset.noTabSwipe='';host.setAttribute('aria-label','Карта покупок и вашего местоположения');}hero.append(host);host.hidden=!allowed;
  if(!allowed){const consent=node('div',undefined,'places-map-consent');const orbit=node('div',undefined,'places-orbit');orbit.setAttribute('aria-hidden','true');consent.append(orbit,node('span','Ваши места','places-eyebrow'),node('h2','Покупки на карте'),node('p','Находите адреса. Возвращайтесь в любимые места.'));const load=button('Открыть карту',()=>{FintexSatellite.allow();allowed=true;refresh();});load.id='places-load';consent.append(load,node('small','Снимки из интернета. Сервис видит IP и область карты, но не ваши покупки.'));hero.append(consent);}
  const locate=button(gpsBusy?'Ищем вас…':'Моё местоположение',locateMe);locate.id='places-locate';locate.className='places-locate';locate.disabled=gpsBusy;hero.append(locate);
  const gps=node('p',gpsMessage,'places-gps-status');gps.id='places-gps-status';gps.setAttribute('role','status');gps.hidden=!gpsMessage;hero.append(gps);
  const search=node('form',undefined,'place-search');search.id='places-search';const input=node('input');input.id='places-search-query';input.placeholder='Адрес или место';input.maxLength=180;input.setAttribute('aria-label','Адрес или место');const submit=node('button','Найти');submit.type='submit';search.append(input,submit);search.onsubmit=findAddress;input.oninput=()=>{searchEpoch++;searchController?.abort();document.getElementById('places-search-results')?.replaceChildren();};const privacy=node('small','Поиск передаёт сервису карт только введённый запрос.','place-search-privacy');body.insertBefore(search,hero);body.insertBefore(privacy,hero);const results=node('div',undefined,'place-search-results');results.id='places-search-results';body.insertBefore(results,hero);
  if(home.selected&&cameraIntent==='purchase'&&!focused&&!currentPosition){const saved=node('div',undefined,'places-return');saved.id='places-return';const tx=home.selected;saved.append(node('span',String(tx.id)===preferred()?'Ваше место':'Последняя покупка','places-eyebrow'),node('strong',tx.merchant),node('p',tx.location.source==='user_confirmed'?tx.location.label:'Позиция телефона · место не подтверждено'),node('small',shortDate(tx.date)+(home.outsidePeriod?' · вне выбранного периода':home.outsideCategory?' · вне выбранной категории':'')+' · '+money(tx.amount)));body.append(saved);}
  const selected=node('div',undefined,'places-selected');selected.id='places-selected';const chosen=focused||currentPosition;selected.hidden=!chosen;if(chosen){selected.append(node('span',focused?'Выбрано на карте':'Вы сейчас здесь','places-eyebrow'),node('strong',focused?.label||'Моё местоположение'),button('Добавить покупку здесь',addHere));}body.append(selected);
  const tools=node('div',undefined,'places-map-tools');if(allowed){if(home.recent)tools.append(button('Последняя покупка',()=>visitPurchase(home.recent)));if(home.frequent)tools.append(button('Частое место',()=>visitPurchase(home.frequent.tx)));tools.append(button('Вся область',()=>{cameraIntent='region';if(viewer)FintexMapRegions.visit(viewer.map,region());}),button('Мои покупки',()=>{lastFit='';fit();}),button('Обновить карту',()=>{stop();refresh();}));body.append(tools);}
  status=node('p',mapMessage,'places-note');status.id='places-status';status.setAttribute('role','status');status.hidden=!mapMessage;body.append(status);
  const capture=button('Добавить из скриншота',()=>FintexCapture.open());capture.className='places-capture';body.append(capture);
  const overview=node('div',undefined,'places-overview');overview.append(node('h2','Покупки'));const periodLabel=node('label',undefined,'places-period');periodLabel.append(node('span','Период','sr-only'));const period=node('select');period.id='places-period';for(const [value,title]of [[30,'30 дней'],[90,'90 дней'],[365,'Год']])period.append(new Option(title,String(value)));period.value=String(days);period.onchange=()=>{days=Number(period.value);limit=25;refresh();};periodLabel.append(period);overview.append(periodLabel);body.append(overview);
  const summary=node('div',undefined,'places-summary'),totals=node('strong',money(data.amount),'places-total money-val');totals.id='places-total';const counts=node('div',undefined,'places-counts');counts.id='places-counts';counts.append(node('span',purchases(data.points.length)+' на карте'));if(data.missing)counts.append(node('span',data.missing+' без места','places-missing'));summary.append(totals,counts);body.append(summary);
  const filters=node('div',undefined,'places-filters'),catLabel=node('label','Категория'),cat=node('select');cat.id='places-category';cat.append(new Option('Все','all'));
  for(const id of [...new Set(state.transactions.filter(t=>t.type==='expense').map(t=>t.category||'other'))].sort())cat.append(new Option(cats[id]||id,id));
  if(![...cat.options].some(o=>o.value===category)){category='all';queueMicrotask(refresh);}cat.value=category;cat.onchange=()=>{category=cat.value;limit=25;refresh();document.getElementById('places-category')?.focus({preventScroll:true});};catLabel.append(cat);filters.append(catLabel);
  const modeLabel=node('label','Вид карты'),select=node('select');select.id='places-mode';for(const [value,title]of [['points','Точки'],['amount','По сумме'],['count','По числу']])select.append(new Option(title,value));select.value=mode;select.onchange=()=>{mode=select.value;refresh();document.getElementById('places-mode')?.focus({preventScroll:true});};modeLabel.append(select);filters.append(modeLabel);body.append(filters);
  const expenseRows=FintexMath.transactions(state.transactions,start,end).filter(t=>t.type==='expense'&&(category==='all'||t.category===category));
  const missingRows=expenseRows.filter(t=>!Model.location(t.location));
  if(missingRows.length){const add=node('details',undefined,'places-help');add.append(node('summary','Покупки без места'));const label=node('label','Выберите операцию'),choose=node('select');choose.id='places-transaction';for(const t of missingRows.slice(0,250))choose.append(new Option(t.merchant+' · '+money(t.amount)+' · '+shortDate(t.date),t.id));label.append(choose);add.append(label,button('Выбрать место',()=>{const tx=state.transactions.find(t=>t.id===choose.value);if(tx)edit(tx);}));if(missingRows.length>250)add.append(node('p','Здесь последние 250 операций. Остальные можно открыть через историю → изменить → место покупки.','places-note'));body.append(add);}
  const groups=Model.places(data.points).filter(g=>g.count>1).sort((a,b)=>b.count-a.count||b.minor-a.minor);
  if(groups.length){const ranking=node('div',undefined,'places-ranking');ranking.append(node('h3','Частые места'));for(const g of groups.slice(0,3)){const row=node('div');row.append(button(g.title,()=>visitPurchase(g.transactions[0])),node('span',money(g.amount),'money-val'),node('small',purchases(g.count)+' · '+g.label));ranking.append(row);}body.append(ranking);}
  const list=node('ul',undefined,'places-list');list.id='places-list';
  for(const tx of data.points.slice(0,limit)){
   const item=node('li'),loc=tx.location;const heading=node('div',undefined,'places-operation-heading');heading.append(button(tx.merchant,()=>visitPurchase(state.transactions.find(t=>t.id===tx.id))),node('span',money(tx.amount),'money-val'));const address=node('p',loc.source==='user_confirmed'?loc.label:'Место не подтверждено','places-operation-address'),date=node('time',shortDate(tx.date),'places-operation-date');date.dateTime=tx.date;item.append(heading,address,date);const actions=node('div',undefined,'places-operation-actions');
   actions.append(button(loc.source==='user_confirmed'?'Изменить место':'Подтвердить место',()=>edit(state.transactions.find(t=>t.id===tx.id)||tx)));
   const remove=button('Убрать геометку',()=>{if(!confirm('Убрать место из текущей версии? Деньги не изменятся. Старые серверные ревизии и копии могут содержать координаты.'))return;try{const old=state.transactions.find(t=>t.id===tx.id);savePlace(tx.id,JSON.stringify(old),null);toast('Метка убрана. Отправка — в настройках синхронизации.');}catch(error){toast(error.message);}});remove.setAttribute('aria-label','Убрать геометку: '+tx.merchant);remove.title='Убрать место';remove.className='places-remove';remove.textContent='';remove.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>';actions.append(remove);item.append(actions);list.append(item);
  }
  body.append(list);if(data.points.length>limit)body.append(button('Показать ещё ('+(data.points.length-limit)+')',()=>{limit+=25;refresh();}));
  const guide=node('details',undefined,'places-help places-guide');guide.append(node('summary','Как добавить место'),node('p','Найдите адрес или нажмите «Моё местоположение». Выберите «Добавить покупку здесь» — точку останется подтвердить одной кнопкой. Название можно не вводить.'));body.append(guide);
  const setup=node('details',undefined,'places-help');setup.append(node('summary','О карте и подключении'),node('p','Синяя точка — телефон сейчас, не адрес прошлой покупки. Регион меняет обзор, а не итоги. Поиск отправляет введённый адрес сервису карт; снимки и покупки туда не передаются. Отображаются до 2 000 точек, итог учитывает все. Для просмотра не нужен сервер. Облако и автоматизация СМС подключаются отдельно.'));const link=node('a','Подробнее →');link.href='./docs/SMS-LOCATION-SETUP.html';link.target='_blank';link.rel='noopener noreferrer';setup.append(link);if(allowed)setup.append(button('Скрыть карту и отключить загрузку снимков',()=>FintexSatellite.revoke()));setup.append(node('small','Поиск: MapTiler · © OpenStreetMap contributors','place-search-credit'));body.append(setup);
  container.append(card);if(allowed&&opened&&isVisible()){if(viewer&&previousDestination!==destinationKey(home?.selected)){homeMarker?.remove();homeMarker=null;if(cameraIntent==='purchase'&&!focused&&!currentPosition&&home?.selected)showPurchase(home.selected);}draw();}
 }
 function showPosition(intro=false){
  if(!viewer||!currentPosition)return;const {map,S}=viewer,loc=currentPosition;
  if(positionMarker)positionMarker.remove();const dot=node('div',undefined,'places-position-dot');dot.setAttribute('aria-label','Вы здесь');positionMarker=new S.Marker({element:dot}).setLngLat([loc.longitude,loc.latitude]).addTo(map);
  FintexMapRegions.visit(map,region(),{intro,target:{center:[loc.longitude,loc.latitude],zoom:16}});
 }
 function locateMe(){
  if(gpsBusy)return;const id=++gpsEpoch;gpsBusy=true;gpsMessage='Разрешите доступ к местоположению. Ищем вас…';
  // Start from this explicit gesture, not after SDK/network initialization.
  const request=FintexSatellite.locate();refresh();
  request.then(loc=>{if(id!==gpsEpoch||!isVisible())return;currentPosition=loc;cameraIntent='gps';homeMarker?.remove();homeMarker=null;focused=null;if(focusMarker){focusMarker.remove();focusMarker=null;}gpsMessage='Вы здесь'+(loc.accuracy===null?'':' · точность ≈ '+Math.round(loc.accuracy)+' м')+'.'+(!allowed?' Откройте карту, чтобы увидеть точку.':'');showPosition();},error=>{if(id===gpsEpoch&&isVisible())gpsMessage=error.message;}).finally(()=>{if(id!==gpsEpoch)return;gpsBusy=false;if(isVisible())refresh();});
 }
 function showFocus(intro=false){if(!viewer||!focused)return;const {map,S}=viewer;if(focusMarker)focusMarker.remove();focusMarker=new S.Marker({color:'#e9c779'}).setLngLat([focused.longitude,focused.latitude]).addTo(map);FintexMapRegions.visit(map,region(),{intro,target:{center:[focused.longitude,focused.latitude],zoom:16}});}
 function selectPlace(loc,fly=true){cameraIntent='draft';homeMarker?.remove();homeMarker=null;gpsEpoch++;gpsBusy=false;gpsMessage='';focused=FintexPlacesModel.location(loc)?{...FintexPlacesModel.location(loc),label:loc.label||'Точка на карте'}:null;if(fly)showFocus();else if(viewer&&focused){if(focusMarker)focusMarker.remove();focusMarker=new viewer.S.Marker({color:'#e9c779'}).setLngLat([focused.longitude,focused.latitude]).addTo(viewer.map);}refresh();}
 function addHere(){const loc=focused||currentPosition;if(!loc)return;FintexPlacePicker.open({location:loc,suggestedLabel:focused?.label||'Точка на карте',onConfirm:place=>FintexDaily.open({place})});}
 async function findAddress(event){
  event.preventDefault();searchController?.abort();searchController=new AbortController();const seq=++searchEpoch,query=document.getElementById('places-search-query').value,out=document.getElementById('places-search-results');out.replaceChildren(node('p','Ищем…','places-note'));
  try{const rows=await FintexPlaceSearch.forward(query,{center:region().center,signal:searchController.signal});if(seq!==searchEpoch||!isVisible())return;out.replaceChildren();for(const loc of rows)out.append(button(loc.label,()=>{selectPlace(loc);if(!allowed){FintexSatellite.allow();allowed=true;refresh();}}));if(!rows.length)out.append(node('p','Не нашли. Попробуйте улицу и номер дома.','places-note'));}
  catch(error){if(seq===searchEpoch&&isVisible())out.replaceChildren(node('p',error.message||'Поиск недоступен. Выберите точку на карте.','places-note'));}
 }
 function mountPage(){const container=document.getElementById('map-page');if(container&&isVisible())mount(container,{days});}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stopMotion(){if(!FintexMapRegions.motion())viewer&&FintexMapRegions.cancel(viewer.map);}
 reduced.addEventListener('change',stopMotion);window.addEventListener('fintex:motionchange',stopMotion);
 window.addEventListener('filely:financial-data-updated',mountPage);
 window.addEventListener('fintex:tabchange',e=>{if(e.detail.name==='map')mountPage();else{gpsEpoch++;gpsBusy=false;currentPosition=null;focused=null;searchEpoch++;searchController?.abort();gpsMessage='';stop();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){gpsEpoch++;gpsBusy=false;currentPosition=null;focused=null;searchEpoch++;searchController?.abort();gpsMessage='';stop();}else if(isVisible())mountPage();});
 window.addEventListener('fintex:satellite-revoked',()=>{allowed=false;viewer=null;stop();refresh();});
 window.FintexPlaces={mount,mountPage,stop,edit,position:()=>currentPosition&&Date.now()-Date.parse(currentPosition.captured_at)<=120000?{...currentPosition}:null};
})();
