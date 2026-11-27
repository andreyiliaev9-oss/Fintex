/* Personal purchase atlas. Real satellite imagery; all finance/point data stays local to SDK sources. */
(() => {
 'use strict';
 const Model=FintexPlacesModel;
 let allowed=false,opened=true,category='all',mode='points',limit=25,current=null,viewer=null,host=null,opening=false,status=null,points=[],generation=0,lastFit='';
 const cats={food:'Продукты',taxi:'Транспорт',cafe:'Кафе',fun:'Развлечения',subs:'Подписки',shop:'Покупки',health:'Здоровье',other:'Прочее'};
 const money=n=>n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+' ₽';
 const expenses=n=>n+' '+(n%10===1&&n%100!==11?'расход':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'расхода':'расходов');
 function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function stop(){generation++;if(viewer){try{viewer.map.remove();}catch(_){}viewer=null;}opening=false;host=null;lastFit='';}
 function savePlace(id,snapshot,loc){
  const old=state.transactions.find(t=>t.id===id);if(!old||JSON.stringify(old)!==snapshot)throw Error('Операция изменилась. Откройте выбор места заново.');
  const tx={...old,local_only:true,local_edited:true};if(loc)tx.location=loc;else delete tx.location;
  const next=state.transactions.map(t=>t.id===id?tx:t);
  // Atomic local metadata write first. Balance/offset/queue are not touched.
  localStorage.setItem('fp_local_tx',JSON.stringify(next));state.transactions=next;
  window.dispatchEvent(new Event('filely:financial-data-updated'));renderAll(false);if(window.FintexSync?.active())FintexSync.sync();
 }
 function edit(tx){const snapshot=JSON.stringify(tx);FintexPlacePicker.open({location:tx.location,title:'Место покупки · '+tx.merchant,onConfirm:loc=>savePlace(tx.id,snapshot,loc)});}
 function popup(tx){const p=node('div',undefined,'places-popup');p.append(node('strong',tx.merchant),node('p',money(tx.amount)+' · '+tx.date),node('p',tx.location.source==='user_confirmed'?tx.location.label:'Позиция телефона · место покупки не подтверждено'),button('Проверить место покупки',()=>edit(state.transactions.find(t=>t.id===tx.id)||tx)));return p;}
 function geojson(){return {type:'FeatureCollection',features:points.slice(0,2000).map(t=>({type:'Feature',geometry:{type:'Point',coordinates:[t.location.longitude,t.location.latitude]},properties:{id:t.id,minor:FintexMath.minor(t.amount),confirmed:t.location.source==='user_confirmed'?1:0}}))};}
 function fit(){if(!viewer||!points.length)return;const visible=points.slice(0,2000),key=visible.map(t=>[t.id,t.location.latitude,t.location.longitude].join(':')).join('|');if(lastFit===key)return;lastFit=key;const bounds=new viewer.S.LngLatBounds();for(const t of visible)bounds.extend([t.location.longitude,t.location.latitude]);viewer.map.fitBounds(bounds,{padding:54,maxZoom:16,duration:0});}
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
  m.setLayoutProperty('fintex-heat','visibility',mode==='points'?'none':'visible');for(const id of ['fintex-clusters','fintex-cluster-label','fintex-points','fintex-point-label'])m.setLayoutProperty(id,'visibility',mode==='points'?'visible':'none');fit();
 }
 async function draw(){
  if(!allowed||!opened||!host?.isConnected)return;
  host.hidden=false;if(viewer){viewer.map.resize();renderLayers();return;}if(opening)return;
  opening=true;const id=generation;
  try{const result=await FintexSatellite.create(host,{isCurrent:()=>id===generation&&allowed&&opened,onStatus:text=>{if(status&&id===generation)status.textContent=text;},onClick:async(e,m,S)=>{
   if(mode!=='points'||!m.getLayer('fintex-points'))return;const features=m.queryRenderedFeatures(e.point,{layers:['fintex-points','fintex-clusters']});if(!features.length)return;
   const f=features[0];if(f.properties.cluster){try{const z=await m.getSource('fintex-purchases').getClusterExpansionZoom(f.properties.cluster_id);m.easeTo({center:f.geometry.coordinates,zoom:z,duration:350});}catch(_){}return;}
   const tx=points.find(t=>t.id===f.properties.id);if(tx)new S.Popup({maxWidth:'260px'}).setLngLat(f.geometry.coordinates).setDOMContent(popup(tx)).addTo(m);
  }});
   if(id!==generation||!allowed){result.map.remove();return;}viewer=result;result.map.on('load',renderLayers);if(result.map.isStyleLoaded())renderLayers();
  }catch(error){if(status&&id===generation)status.textContent=error.message;}finally{if(id===generation)opening=false;}
 }
 function refresh(){if(current?.container.isConnected)mount(current.container,current.options);}
 function mount(container,options={days:30}){
  container.querySelector('#places-card')?.remove();current={container,options};
  const end=FintexMath.key(new Date()),start=FintexMath.shift(end,-(options.days-1)),data=Model.project(state.transactions,{start,end,category});points=data.points;
  const card=node('details',undefined,'places-card card-surface');card.id='places-card';card.open=opened;
  const summary=node('summary');summary.append(node('span','Личный атлас','places-eyebrow'),node('strong','Мои места и покупки'),node('small',data.points.length+' с местом · '+data.missing+' без места'));card.append(summary);
  const body=node('div',undefined,'places-body');card.append(body);
  const hero=node('div',undefined,'places-hero');body.append(hero);
  if(!host){host=node('div',undefined,'places-map');host.id='places-map';host.setAttribute('aria-label','Настоящая спутниковая карта покупок');}hero.append(host);host.hidden=!allowed;
  if(!allowed){const consent=node('div',undefined,'places-map-consent');consent.append(node('span','Спутник · MapTiler','places-eyebrow'),node('h3','Там, где остаются ваши истории'),node('p','Настоящие снимки, покупки и любимые места. MapTiler увидит IP и область карты, но не суммы, магазины и ваш журнал.'));const load=button('Открыть спутниковую карту',()=>{FintexSatellite.allow();allowed=true;refresh();});load.id='places-load';consent.append(load);hero.append(consent);}
  const totals=node('p',expenses(data.points.length)+' с местом · '+money(data.amount),'places-total money-val');totals.id='places-total';body.append(totals,node('p',start+' — '+end+' · период выбран в аналитике','places-note'));
  const filters=node('div',undefined,'places-filters'),catLabel=node('label','Категория'),cat=node('select');cat.id='places-category';cat.append(new Option('Все категории','all'));
  for(const id of [...new Set(state.transactions.filter(t=>t.type==='expense').map(t=>t.category||'other'))].sort())cat.append(new Option(cats[id]||id,id));
  if(![...cat.options].some(o=>o.value===category)){category='all';queueMicrotask(refresh);}cat.value=category;cat.onchange=()=>{category=cat.value;limit=25;refresh();document.getElementById('places-category')?.focus({preventScroll:true});};catLabel.append(cat);filters.append(catLabel);
  const modeLabel=node('label','На карте'),select=node('select');select.id='places-mode';for(const [value,title]of [['points','Покупки и суммы'],['amount','Тепло по сумме'],['count','Тепло по количеству']])select.append(new Option(title,value));select.value=mode;select.onchange=()=>{mode=select.value;refresh();document.getElementById('places-mode')?.focus({preventScroll:true});};modeLabel.append(select);filters.append(modeLabel);body.append(filters);
  status=node('p',undefined,'places-note');status.id='places-status';status.setAttribute('role','status');body.append(status);
  status.textContent=!data.points.length?'За этот период нет расходов с геометкой. Выберите покупку ниже — место можно добавить сейчас.':'Золотые точки — подтверждены вами, мятные — только позиция телефона. При отдалении точки объединяются, суммы складываются.';
  body.append(node('p','Тепло — относительная плотность, не фиксированная рублёвая шкала. Карта показывает до 2 000 последних точек; итог и список учитывают все.','places-note'));
  if(allowed)body.append(button('Скрыть карту и отключить загрузку снимков',()=>FintexSatellite.revoke()));
  const expenseRows=FintexMath.transactions(state.transactions,start,end).filter(t=>t.type==='expense'&&(category==='all'||t.category===category));
  if(expenseRows.length){const add=node('details',undefined,'places-help');add.append(node('summary','Добавить / подтвердить место покупки'));const label=node('label','Выберите операцию'),choose=node('select');choose.id='places-transaction';for(const t of expenseRows.slice(0,250))choose.append(new Option(t.merchant+' · '+money(t.amount)+' · '+t.date,t.id));label.append(choose);add.append(label,button('Выбрать место на карте',()=>{const tx=state.transactions.find(t=>t.id===choose.value);if(tx)edit(tx);}));if(expenseRows.length>250)add.append(node('p','Здесь последние 250 операций. Остальные можно открыть через историю → изменить → место покупки.','places-note'));body.append(add);}
  const groups=Model.places(data.points),ranking=node('div',undefined,'places-ranking');ranking.append(node('h3','Где остаётся больше всего'));for(const g of groups.slice(0,3)){const row=node('div');row.append(node('strong',g.title),node('span',money(g.amount),'money-val'),node('small',g.count+' покупок · '+g.label));ranking.append(row);}if(!groups.length)ranking.append(node('p','Места появятся после первой подтверждённой покупки.','places-note'));body.append(ranking);
  const list=node('ul',undefined,'places-list');list.id='places-list';
  for(const tx of data.points.slice(0,limit)){
   const item=node('li'),loc=tx.location;item.append(node('strong',tx.merchant),node('span',tx.date+' · '+money(tx.amount),'money-val'),node('small',loc.source==='user_confirmed'?'Подтверждено вами · '+loc.label:'Место телефона при СМС · адрес не подтверждён'),node('small',loc.latitude.toFixed(5)+', '+loc.longitude.toFixed(5)+(loc.accuracy===null?' · точность неизвестна':' · точность ≈ '+Math.round(loc.accuracy)+' м')));
   item.append(button(loc.source==='user_confirmed'?'Изменить место':'Подтвердить место покупки',()=>edit(state.transactions.find(t=>t.id===tx.id)||tx)));
   const remove=button('Убрать геометку',()=>{if(!confirm('Убрать место из текущей версии? Деньги не изменятся. Старые серверные ревизии и копии могут содержать координаты.'))return;try{const old=state.transactions.find(t=>t.id===tx.id);savePlace(tx.id,JSON.stringify(old),null);toast('Метка убрана. Отправка — в настройках синхронизации.');}catch(error){toast(error.message);}});remove.setAttribute('aria-label','Убрать геометку: '+tx.merchant);item.append(remove);list.append(item);
  }
  body.append(list);if(data.points.length>limit)body.append(button('Показать ещё ('+(data.points.length-limit)+')',()=>{limit+=25;refresh();}));
  const setup=node('details',undefined,'places-help');setup.append(node('summary','Как покупки попадают на карту'),node('p','Добавьте место при ручном вводе, проверке скриншота или позже через историю. Геолокация запрашивается по нажатию, не в фоне. Для автоматической передачи координат вместе с СМС нужно отдельно настроить iPhone и обновить сервер.'));const link=node('a','Подключение СМС и ограничения →');link.href='./docs/SMS-LOCATION-SETUP.html';link.target='_blank';link.rel='noopener noreferrer';setup.append(link);body.append(setup);
  card.addEventListener('toggle',()=>{if(!card.isConnected)return;opened=card.open;if(opened)draw();});const anchor=container.querySelector('.ap-observations');if(anchor)anchor.before(card);else container.append(card);if(allowed&&opened)draw();
 }
 window.addEventListener('fintex:satellite-revoked',()=>{allowed=false;viewer=null;stop();refresh();});
 window.FintexPlaces={mount,stop,edit};
})();
