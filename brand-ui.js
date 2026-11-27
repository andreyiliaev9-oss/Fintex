/* Local brand decoration and a read-only directory. Never changes merchant text,
   category, card network, financial records or stored bank selection. */
(() => {
 'use strict';
 const B=window.FintexBrands;if(!B)return;
 const kinds={merchant:'Магазины и кафе',bank:'Банки',payment:'Карты и оплата',service:'Сервисы'};
 // A missing SVG must not leave a broken-image symbol or trigger a remote lookup.
 document.addEventListener('error',event=>{if(event.target.matches?.('img[data-brand-logo]'))event.target.closest('.brand-mark')?.setAttribute('data-logo-failed','true');},true);
 function boot(){
  const launch=document.createElement('section');launch.id='brand-directory-settings';launch.className='brand-directory-card card-surface';
  launch.innerHTML=`<h3>Логотипы компаний</h3><p>${B.count} брендов: магазины, банки, карты и сервисы. Каталог локальный, не все компании мира.</p><button type="button" id="brand-directory-open">Посмотреть каталог →</button>`;
  (document.getElementById('settings-personal')||document.getElementById('view-settings'))?.append(launch);
  let dialog=null,previous=null,shown=36;
  function render(){
   const query=B.normalize(dialog.querySelector('#brand-search').value),kind=dialog.querySelector('#brand-kind').value;
   const rows=B.entries.filter(entry=>(!kind||entry.kind===kind)&&[entry.name,...entry.aliases].some(alias=>B.normalize(alias).includes(query)));
   const grid=dialog.querySelector('#brand-directory-grid');grid.replaceChildren();
   for(const entry of rows.slice(0,shown)){
    const item=document.createElement('article');item.className='brand-directory-item';
    const badge=document.createElement('span');badge.innerHTML=B.badge(entry.name,entry.kind);item.append(badge);
    const name=document.createElement('strong');name.textContent=entry.name;item.append(name);
    const label=document.createElement('small');label.textContent=kinds[entry.kind];item.append(label);
    const source=document.createElement('a');source.href=entry.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Источник SVG ↗';source.setAttribute('aria-label','Источник логотипа '+entry.name);item.append(source);grid.append(item);
   }
   dialog.querySelector('#brand-directory-count').textContent=rows.length?`Показано ${Math.min(shown,rows.length)} из ${rows.length}`:'Совпадений нет. Для неизвестной компании остаётся обычная иконка категории.';
   dialog.querySelector('#brand-directory-more').hidden=shown>=rows.length;
  }
  launch.querySelector('button').onclick=()=>{
   if(!dialog){
    dialog=document.createElement('dialog');dialog.id='brand-directory';dialog.className='daily-dialog';dialog.setAttribute('aria-labelledby','brand-directory-title');
    dialog.innerHTML='<header class="flow-header"><h2 id="brand-directory-title">Логотипы компаний</h2><button type="button" id="brand-directory-close" aria-label="Закрыть каталог">×</button></header><p class="brand-directory-note">Логотип определяется по названию, не подтверждает продавца или принадлежность карты. Все изображения находятся в приложении; названия операций не отправляются сервису логотипов.</p><label class="flow-field" for="brand-search">Найти компанию<input id="brand-search" type="search" maxlength="100" placeholder="Например, Пятёрочка или Visa" autocomplete="off" /></label><label class="flow-field" for="brand-kind">Раздел<select id="brand-kind"><option value="">Все бренды</option>'+Object.entries(kinds).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')+'</select></label><p id="brand-directory-count" role="status" aria-live="polite"></p><div id="brand-directory-grid"></div><button id="brand-directory-more" type="button" class="flow-secondary">Показать ещё</button><details class="quiet-details"><summary>Источники и права</summary><p class="brand-directory-note">SVG из Russian Brand Logos, Simple Icons 16.38.1 и SVG Credit Card & Payment Icons (Apache-2.0). Товарные знаки принадлежат правообладателям; приложение не связано с ними. Это справочная идентификация, не гарантия актуальности фирменного стиля. Источник указан у каждого логотипа. Лицензия MIT исходного русского каталога не распространяется на товарные знаки.</p></details>';
    document.body.append(dialog);dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}});dialog.querySelector('#brand-directory-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>previous?.focus({preventScroll:true}));
    for(const id of ['brand-search','brand-kind'])dialog.querySelector('#'+id).addEventListener(id==='brand-search'?'input':'change',()=>{shown=36;render();});
    dialog.querySelector('#brand-directory-more').onclick=()=>{shown+=36;render();};
   }
   previous=document.activeElement;shown=36;dialog.querySelector('#brand-search').value='';dialog.querySelector('#brand-kind').value='';render();dialog.showModal();dialog.querySelector('#brand-directory-close').focus({preventScroll:true});
  };
  const input=document.getElementById('flow-name');
  if(input){
   const preview=document.createElement('div');preview.id='flow-brand-preview';preview.className='brand-preview';preview.hidden=true;input.closest('label').after(preview);let last='';
   function update(){
    const brand=B.match(input.value),id=brand?.id||'';if(id===last)return;last=id;preview.replaceChildren();preview.hidden=!brand;if(!brand)return;
    const logo=document.createElement('span');logo.innerHTML=B.badge(brand.name,brand.kind);preview.append(logo);const caption=document.createElement('span');caption.textContent='По названию · '+brand.name;preview.append(caption);
   }
   input.form.addEventListener('input',update);input.form.addEventListener('change',update);
   // Templates/kind switches update values programmatically; wait for their real handlers.
   document.getElementById('daily-flow').addEventListener('click',()=>queueMicrotask(update));
   new MutationObserver(()=>{if(document.getElementById('daily-flow').open)update();}).observe(document.getElementById('daily-flow'),{attributes:true,attributeFilter:['open']});
  }
 }
 if(document.readyState==='complete')boot();else window.addEventListener('load',boot,{once:true});
})();
