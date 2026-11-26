/* Opt-in, release-pinned static shell. Never intercepts cloud, POSTs or user files. */
importScripts('./offline-assets.js');
const manifest=self.FINTEX_OFFLINE;
const base=new URL('./',self.location.href),prefix='fintex-static-'+encodeURIComponent(base.pathname)+'-',coreName=prefix+manifest.revision,toolsName=coreName+'-tools';
const core=new Set(manifest.core.map(p=>new URL(p,base).href)),tools=new Set(manifest.optional.map(p=>new URL(p,base).href));
const shell=new URL('index.html',base).href;
async function verified(url){
  const res=await fetch(url,{cache:'reload'});if(!res.ok||res.type==='opaque')throw Error('Resource unavailable');
  const path=new URL(url).pathname.slice(base.pathname.length),bytes=await res.clone().arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==manifest.hashes[path])throw Error('Release changed; retry preparation');
  return res;
}
async function installCore(){
  const cache=await caches.open(coreName);
  try{await Promise.all([...core].map(async url=>{const res=await verified(url);await cache.put(url,res);}));}
  catch(error){await caches.delete(coreName);throw error;}
}
self.addEventListener('install',event=>event.waitUntil(installCore()));
// No skipWaiting on install: a new release must not replace open financial forms.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const tabs=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(base.href));
  if(tabs.length<=1)for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==coreName&&key!==toolsName)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  const path=new URL(url.pathname,base.origin).href;
  const navigation=req.mode==='navigate'&&(url.pathname===base.pathname||path===shell);
  const key=navigation?shell:path;
  if(!navigation&&!core.has(key)&&!tools.has(key))return;
  event.respondWith((async()=>{
    const cached=await (await caches.open(core.has(key)?coreName:toolsName)).match(key);
    // Pin a complete release, including query-versioned scripts, until explicit update.
    if(cached)return cached;
    return fetch(req); // Optional resources are cached only by an explicit preparation.
  })());
});
async function prepareTools(){
  const cache=await caches.open(toolsName);
  try{for(const url of tools){if(await cache.match(url))continue;const res=await verified(url);await cache.put(url,res);}}
  catch(error){await caches.delete(toolsName);throw error;}
}
self.addEventListener('message',event=>{
  const port=event.ports[0];if(!port)return;
  event.waitUntil((async()=>{
    try{
      if(event.data?.type==='STATUS'){
        const toolsCache=await caches.open(toolsName),ready=(await Promise.all([...tools].map(url=>toolsCache.match(url)))).every(Boolean);
        port.postMessage({ok:true,revision:manifest.revision,tools:ready,coreBytes:manifest.coreBytes,optionalBytes:manifest.optionalBytes});
      }else if(event.data?.type==='PREPARE_TOOLS'){await prepareTools();port.postMessage({ok:true});}
      else if(event.data?.type==='ACTIVATE'){
        const tabs=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(base.href));
        if(tabs.length>1)throw Error('Close other Fintex tabs');
        await self.skipWaiting();port.postMessage({ok:true});
      }
      else port.postMessage({ok:false});
    }catch(error){port.postMessage({ok:false,error:error.message==='Close other Fintex tabs'?'Закройте другие вкладки Fintex перед обновлением.':'Не удалось подготовить все файлы. Проверьте сеть и свободное место; финансовые данные не менялись.'});}
  })());
});
