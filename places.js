/* Real map, optional SMS positions. Never requests device position or tiles on boot. */
(() => {
 'use strict';
 const Model=window.FintexPlacesModel;
 let map=null,allowed=false,opened=false,category='all',mode='amount',limit=25,current=null;
 const cats={food:'Продукты',taxi:'Транспорт',cafe:'Кафе',fun:'Развлечения',subs:'Подписки',shop:'Покупки',health:'Здоровье',other:'Прочее'};
 const money=n=>n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+' ₽';
 function expenses(n){const d=n%10,h=n%100;return n+' '+(d===1&&h!==11?'расход':d>=2&&d<=4&&(h<12||h>14)?'расхода':'расходов');}
 function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
 function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function stop(){if(map){map.remove();map=null;}}
 function popup(tx){const p=node('div',undefined,'places-popup');p.append(node('strong',tx.merchant),node('p',money(tx.amount)+' · '+tx.date),node('p','Место телефона при получении СМС, не подтверждённый адрес магазина.'));return p;}
 function draw(host,points,status){
  stop();if(!allowed||!points.length)return;
  if(!navigator.onLine){status.textContent='Нет сети: список доступен, подложке карты нужен интернет.';return;}
  if(!window.L?.heatLayer){status.textContent='Библиотека карты не загрузилась. Список операций доступен ниже.';return;}
  host.hidden=false;
  try{
   map=L.map(host,{scrollWheelZoom:false,zoomControl:true,attributionControl:true,preferCanvas:true});
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:2,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'});
   tiles.on('tileerror',()=>{status.textContent='Подложка карты недоступна. Точки и список сохранены; попробуйте позже.';});tiles.addTo(map);
   const visible=points.slice(0,2000),positions=visible.map(t=>[t.location.latitude,t.location.longitude]);
   const max=mode==='count'?1:Math.max(...visible.map(t=>t.amount));
   if(mode!=='points')L.heatLayer(visible.map(t=>[t.location.latitude,t.location.longitude,mode==='count'?1:t.amount/max]),{radius:28,blur:22,maxZoom:17,max:1,minOpacity:.25,gradient:{.2:'#46a8c9',.45:'#40bb96',.7:'#f1c65d',1:'#e86d53'}}).addTo(map);
   if(mode==='points')for(const tx of visible)L.circleMarker([tx.location.latitude,tx.location.longitude],{radius:8,color:'#064e43',weight:2,fillColor:'#f1c65d',fillOpacity:.9}).bindPopup(popup(tx)).addTo(map);
   if(positions.length===1)map.setView(positions[0],15);else map.fitBounds(positions,{padding:[24,24],maxZoom:16});
   requestAnimationFrame(()=>map?.invalidateSize());
   status.textContent=(mode==='points'?'Нажмите на точку для деталей. ':'Тепло показывает относительную плотность '+(mode==='count'?'количества покупок. ':'сумм расходов. '))+'При изменении масштаба цвет меняется; точные суммы — в списке.'+(points.length>2000?' На карте только 2 000 последних операций; итог и список учитывают все.':'');
  }catch(_){stop();status.textContent='Не удалось открыть карту. Все операции доступны списком.';host.hidden=true;}
 }
 function refresh(){if(current?.container.isConnected)mount(current.container,current.options);}
 function mount(container,options={days:30}){
  stop();container.querySelector('#places-card')?.remove();current={container,options};
  const end=FintexMath.key(new Date()),start=FintexMath.shift(end,-(options.days-1));
  const data=Model.project(state.transactions,{start,end,category});
  const card=node('details',undefined,'places-card card-surface');card.id='places-card';card.open=opened;
  const summary=node('summary');summary.append(node('strong','Карта расходов'),node('small',data.points.length+' с местом · '+data.missing+' без места'));card.append(summary);
  const body=node('div',undefined,'places-body');card.append(body);
  body.append(node('p','Места телефона при получении СМС — не проверенные адреса покупок. Онлайн-покупки и задержанные СМС могут указывать не туда.','places-note'),node('p',start+' — '+end+' · период выбран в аналитике','places-note'));
  const filters=node('div',undefined,'places-filters');
  const catLabel=node('label','Категория'),cat=node('select');cat.id='places-category';cat.append(new Option('Все категории','all'));
  for(const id of [...new Set(state.transactions.filter(t=>t.type==='expense').map(t=>t.category||'other'))].sort())cat.append(new Option(cats[id]||id,id));
  if(![...cat.options].some(o=>o.value===category)){category='all';queueMicrotask(refresh);}
  cat.value=category;cat.addEventListener('change',()=>{category=cat.value;limit=25;refresh();document.getElementById('places-category')?.focus({preventScroll:true});});catLabel.append(cat);filters.append(catLabel);
  const modeLabel=node('label','Отображение'),select=node('select');select.id='places-mode';for(const [value,title]of [['amount','Тепло по сумме'],['count','Тепло по количеству'],['points','Точки покупок']])select.append(new Option(title,value));select.value=mode;select.addEventListener('change',()=>{mode=select.value;refresh();document.getElementById('places-mode')?.focus({preventScroll:true});});modeLabel.append(select);filters.append(modeLabel);body.append(filters);
  const totals=node('p',expenses(data.points.length)+' с местом · '+money(data.amount),'places-total money-val');totals.id='places-total';body.append(totals);
  const note=node('p',undefined,'places-note');note.id='places-status';note.setAttribute('role','status');body.append(note);
  const host=node('div',undefined,'places-map');host.id='places-map';host.hidden=true;host.setAttribute('aria-label','Карта мест телефона при получении СМС');body.append(host);
  if(!data.points.length){note.textContent='За этот период нет расходов с геометкой. Старым покупкам координаты не придумываем.';}
  else if(!allowed){
   note.textContent='Для карты загрузятся тайлы OpenStreetMap. Сервис увидит IP и просматриваемую область, но FINTEX не отправляет ему суммы, названия магазинов и журнал. Список ниже работает без карты.';
   const load=button('Показать карту · OpenStreetMap',()=>{allowed=true;refresh();});load.id='places-load';body.append(load);
  }else{
   body.append(button('Скрыть карту и отключить загрузку тайлов',()=>{allowed=false;refresh();}));
   // Collapsed map must not send requests. Opening explicitly starts the map.
   note.textContent='Откройте раздел, чтобы показать карту.';
  }
  const list=node('ul',undefined,'places-list');list.id='places-list';
  for(const tx of data.points.slice(0,limit)){
   const item=node('li');item.append(node('strong',tx.merchant),node('span',tx.date+' · '+money(tx.amount),'money-val'));
   const loc=tx.location;item.append(node('small',loc.latitude.toFixed(5)+', '+loc.longitude.toFixed(5)+' · '+new Date(loc.captured_at).toLocaleString('ru-RU')+' · '+(loc.accuracy===null?'точность неизвестна':'точность ≈ '+Math.round(loc.accuracy)+' м')));
   const remove=button('Убрать геометку',()=>{
    if(!confirm('Убрать место из текущей версии операции? Сумма и остаток не изменятся. Старые серверные ревизии и ранее сохранённые копии могут содержать координаты.'))return;
    const original=state.transactions.find(t=>t.id===tx.id);if(!original)return;
    const previous=original.location;delete original.location;
    try{persistAll();}catch(_){original.location=previous;toast('Не удалось сохранить изменение. Геометка не удалена.');return;}
    renderAll(false);document.querySelector('#places-card>summary')?.focus({preventScroll:true});toast('Метка убрана с карты. Состояние отправки — в настройках синхронизации.');
   });remove.setAttribute('aria-label','Убрать геометку: '+tx.merchant);item.append(remove);list.append(item);
  }
  body.append(list);if(data.points.length>limit)body.append(button('Показать ещё ('+(data.points.length-limit)+')',()=>{limit+=25;refresh();}));
  const setup=node('details',undefined,'places-help');setup.append(node('summary','Как подключить СМС и геолокацию'),node('p','Нужны обновлённый Apps Script и одно изменение вашей автоматизации iPhone. Сам сайт не меняет «Команды» и не включает слежение. Запрашивайте геопозицию только при СМС; если она недоступна, отправляйте операцию без неё. Ошибка самого действия iOS может остановить команду — проверьте это на своём телефоне.'));
  const link=node('a','Настройка автоматизации и ограничения →');link.href='./docs/SMS-LOCATION-SETUP.html';link.target='_blank';link.rel='noopener noreferrer';setup.append(link);body.append(setup);
  card.addEventListener('toggle',()=>{if(!card.isConnected)return;opened=card.open;if(!opened){stop();host.hidden=true;}else if(allowed&&data.points.length&&!map)draw(host,data.points,note);});
  const anchor=container.querySelector('.ap-observations');if(anchor)anchor.before(card);else container.append(card);
  if(opened&&allowed&&data.points.length)draw(host,data.points,note);
 }
 // No location permission prompts, polling or background tracking.
 window.FintexPlaces={mount,stop};
})();
