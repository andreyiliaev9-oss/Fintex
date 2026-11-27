/* MapTiler SDK session mode. No external request or geolocation before action. */
(() => {
 'use strict';
 let accepted=false,loading=null;
 const live=new Set();
 function config(){const u=new URL(window.FintexMapConfig?.style||'',location.href);if(u.origin!=='https://api.maptiler.com'||u.pathname!=='/maps/hybrid-v4/style.json'||!u.searchParams.get('key'))throw Error('Спутниковая карта не настроена.');return u;}
 function sdk(){
  if(window.FintexMapSDK)return Promise.resolve(window.FintexMapSDK);
  if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./assets/maps/maptiler-sdk.js?v=5.0.0';s.onload=()=>window.FintexMapSDK?resolve(window.FintexMapSDK):reject(Error('SDK недоступен'));s.onerror=()=>{s.remove();loading=null;reject(Error('SDK недоступен'));};document.head.append(s);});
  return loading;
 }
 function allow(){accepted=true;}
 function revoke(){accepted=false;for(const m of [...live])m.remove();window.dispatchEvent(new Event('fintex:satellite-revoked'));}
 async function create(host,{center=[0,20],zoom=1,onStatus=()=>{},onClick=()=>{},isCurrent=()=>true}={}){
  if(!accepted)throw Error('Сначала разрешите загрузку спутниковой карты.');
  if(!navigator.onLine)throw Error('Нет сети: спутниковой карте нужен интернет.');
  const style=config(),S=await sdk();
  if(!accepted||!host.isConnected||!isCurrent())throw Error('Открытие карты отменено.');
  S.config.apiKey=style.searchParams.get('key');S.config.telemetry=false;S.config.caching=false;S.config.session=true;
  let map;
  try{map=new S.Map({container:host,style:style.href,center,zoom,hash:false,maptilerLogo:true,geolocateControl:false,terrainControl:false,projectionControl:false,scaleControl:false,fullscreenControl:false,navigationControl:'top-right',attributionControl:{compact:false},renderWorldCopies:false,fadeDuration:0});}catch(_){throw Error('Спутник недоступен: нужен браузер с WebGL. Откройте FINTEX в Safari или Chrome.');}
  live.add(map);map.once('remove',()=>live.delete(map));
  host.dataset.basemapState='loading';onStatus('Загружаем реальные спутниковые снимки…');
  map.on('error',()=>{host.dataset.basemapState='error';onStatus('Снимки недоступны или загружены не полностью. Проверьте сеть, квоту и ограничения ключа. Подложка не заменяется имитацией.');});
  map.on('idle',()=>{if(host.dataset.basemapState!=='error'){host.dataset.basemapState='ready';onStatus('Спутник · MapTiler. Снимки не в реальном времени; детализация зависит от места.');}});
  map.on('click',e=>onClick(e,map,S));
  return {map,S};
 }
 window.FintexSatellite={create,allow,revoke,allowed:()=>accepted};
})();
