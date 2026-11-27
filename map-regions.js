/* Local view presets, not geocoding or administrative boundary data.
 * Choice changes the camera only. GPS is never replaced with a regional centre. */
(() => {
 'use strict';
 const regions=[
 ['sverdlovsk','Свердловская область',61.2,58.6,6],
 ['kurgan','Курганская область',65.3,55.5,6.6],['tyumen','Тюменская область',68,58,6],['chelyabinsk','Челябинская область',60.5,54.8,6.5],['khanty','Ханты-Мансийский АО — Югра',72,62,5.5],['yamal','Ямало-Ненецкий АО',74,67,5.2],
 ['adygea','Республика Адыгея',40,44.6,7.5],['altai-republic','Республика Алтай',86.7,50.8,6.2],['bashkortostan','Республика Башкортостан',56.5,54.2,6.4],['buryatia','Республика Бурятия',109,53,5.7],['dagestan','Республика Дагестан',47.1,43,6.7],['ingushetia','Республика Ингушетия',44.9,43.2,8.5],['kabardino','Кабардино-Балкарская Республика',43.4,43.4,7.4],['kalmykia','Республика Калмыкия',45.5,46.3,6.6],['karachay','Карачаево-Черкесская Республика',41.7,43.7,7.5],['karelia','Республика Карелия',33.5,64,5.7],['komi','Республика Коми',54,64,5.3],['mari','Республика Марий Эл',48,56.7,7],['mordovia','Республика Мордовия',44.3,54.4,7],['sakha','Республика Саха (Якутия)',130,65,3.9],['ossetia','Республика Северная Осетия — Алания',44.2,43.1,7.8],['tatarstan','Республика Татарстан',51,55.4,6.8],['tuva','Республика Тыва',94.5,51.5,6],['udmurtia','Удмуртская Республика',52.5,57.1,6.8],['khakassia','Республика Хакасия',90,53.5,6.7],['chechnya','Чеченская Республика',45.8,43.2,7.6],['chuvashia','Чувашская Республика',47.2,55.5,7.2],
 ['altai','Алтайский край',82.6,52.5,6],['zabaykal','Забайкальский край',116,53.5,5.2],['kamchatka','Камчатский край',159,57,4.8],['krasnodar','Краснодарский край',39.3,45.3,6.3],['krasnoyarsk','Красноярский край',95,64,4],['perm','Пермский край',56,59,6],['primorye','Приморский край',135,45.5,5.8],['stavropol','Ставропольский край',43.4,45,6.7],['khabarovsk','Хабаровский край',137,52,4.8],
 ['amur','Амурская область',128,53.5,5.6],['arkhangelsk','Архангельская область',43,64,5],['astrakhan','Астраханская область',47.5,47,6.6],['belgorod','Белгородская область',37.5,50.8,7],['bryansk','Брянская область',33.5,53,6.9],['vladimir','Владимирская область',40.6,56,7],['volgograd','Волгоградская область',44,49.5,6],['vologda','Вологодская область',41,60,5.8],['voronezh','Воронежская область',40.6,51,6.6],['ivanovo','Ивановская область',41.5,57,7],['irkutsk','Иркутская область',105,57,4.9],['kaliningrad','Калининградская область',21.3,54.8,7.3],['kaluga','Калужская область',35.5,54.4,7],['kemerovo','Кемеровская область — Кузбасс',87,54.5,6.3],['kirov','Кировская область',49.5,58.5,6],['kostroma','Костромская область',43.5,58.5,6.3],['kursk','Курская область',36,51.7,6.8],['leningrad','Ленинградская область',31,60,6],['lipetsk','Липецкая область',39.5,52.7,7],['magadan','Магаданская область',154,63,4.7],['moscow-oblast','Московская область',38,55.7,6.6],['murmansk','Мурманская область',34,68,5.7],['nizhny','Нижегородская область',44.5,56.5,6.3],['novgorod','Новгородская область',33,58.5,6.4],['novosibirsk','Новосибирская область',80,55,6],['omsk','Омская область',73.5,56,6],['orenburg','Оренбургская область',55,52,5.8],['oryol','Орловская область',36.5,52.9,7],['penza','Пензенская область',44.5,53.2,6.7],['pskov','Псковская область',29,57.5,6.5],['rostov','Ростовская область',41,47.8,6],['ryazan','Рязанская область',40.8,54.4,6.7],['samara','Самарская область',50.5,53.2,6.5],['saratov','Саратовская область',46,51.7,6],['sakhalin','Сахалинская область',143,50,4.8],['smolensk','Смоленская область',33,55,6.5],['tambov','Тамбовская область',41.5,52.7,6.7],['tver','Тверская область',34.5,57,6],['tomsk','Томская область',82,58.5,5.5],['tula','Тульская область',37.6,53.8,6.9],['ulyanovsk','Ульяновская область',48,54,6.6],['yaroslavl','Ярославская область',39.5,58,6.7],['moscow','Москва',37.62,55.75,10],['petersburg','Санкт-Петербург',30.32,59.94,10],['jewish','Еврейская автономная область',132.5,48.6,6.5],['nenets','Ненецкий автономный округ',54,68,5.2],['chukotka','Чукотский автономный округ',174,67,4.5]
 ].map(([id,name,longitude,latitude,zoom])=>Object.freeze({id,name,center:[longitude,latitude],zoom}));
 const get=id=>regions.find(r=>r.id===id)||regions[0];
 const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches&&localStorage.getItem('fp_motion')!=='0';
 const flights=new WeakMap();
 function cancel(map){const cleanup=flights.get(map);if(cleanup)cleanup();map.stop();}
 function visit(map,region,{intro=false,target=null}={}){
  cancel(map);
  const area={center:region.center,zoom:region.zoom,pitch:25,bearing:0};
  const end=target?{center:target.center,zoom:target.zoom||16,pitch:35,bearing:0}:area;
  if(!motion()){map.jumpTo({...end,pitch:0});return;}
  const stages=target&&(intro||map.getZoom()<4)?[{...area,duration:7800},{...end,duration:6200}]:[{...end,duration:intro?7800:target?6200:4200}];
  const canvas=map.getContainer?.();let active=true;
  const cleanup=()=>{active=false;map.off?.('moveend',next);map.off?.('remove',cleanup);for(const event of ['pointerdown','touchstart','wheel'])canvas?.removeEventListener(event,interrupt);flights.delete(map);};
  const interrupt=()=>{cleanup();map.stop();};
  function next(){if(!active)return;const camera=stages.shift();if(!camera){cleanup();return;}map.once('moveend',next);map.flyTo({...camera,essential:false,curve:1.25,easing:t=>t*t*(3-2*t)});}
  flights.set(map,cleanup);map.once('remove',cleanup);for(const event of ['pointerdown','touchstart','wheel'])canvas?.addEventListener(event,interrupt,{passive:true});next();
 }
 window.FintexMapRegions=Object.freeze({all:regions,get,motion,visit,cancel,defaultId:'sverdlovsk'});
})();
