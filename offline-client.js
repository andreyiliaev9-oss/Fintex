/* Optional offline resources are not a backup and never cache financial responses. */
(() => {
  'use strict';
  let registration,box,busy=false,applying=false;
  const base=new URL('./',location.href);
  async function ownRegistration(){const reg=await navigator.serviceWorker.getRegistration(base.href);return reg?.scope===base.href?reg:undefined;}
  const supported='serviceWorker' in navigator&&isSecureContext;
  const formOpen=()=>!!document.querySelector('dialog[open],[id^="modal-"]:not(.hidden) .modal-sheet');
  function send(worker,type,timeout=120000){return new Promise((resolve,reject)=>{
    if(!worker)return reject(Error('Офлайн-версия ещё не готова.'));
    const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('Подготовка занимает дольше обычного. Проверьте статус позже.'));},timeout);
    channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data?.ok?resolve(e.data):reject(Error(e.data?.error||'Не удалось выполнить действие.'));};
    worker.postMessage({type},[channel.port2]);
  });}
  function status(text){if(box)box.querySelector('[data-offline-status]').textContent=text;}
  function network(){const note=document.getElementById('network-note');if(note)note.hidden=navigator.onLine;}
  async function inspect(){
    if(!box||!supported)return;
    registration=await ownRegistration();
    box.querySelector('[data-offline-update]').hidden=!registration?.waiting;
    if(registration?.active){
      try{const data=await send(registration.active,'STATUS',10000);status(`Приложение подготовлено для повторного открытия без сети. OCR/PDF: ${data.tools?'подготовлены':'нужна отдельная загрузка'}. Браузер может удалить кэш при нехватке места.`);}catch(e){status(e.message);}
    }else if(!busy)status('Офлайн-файлы ещё не подготовлены. Сейчас работа идёт из открытой страницы.');
  }
  const watched=new WeakSet();
  function watch(reg){
    if(watched.has(reg))return;watched.add(reg);
    const track=()=>{const worker=reg.installing;if(!worker)return;
      worker.addEventListener('statechange',()=>{
        // Registration.waiting is settled after the installed state event.
        if(worker.state==='installed'||worker.state==='activated')setTimeout(()=>inspect().catch(()=>{}),0);
      });
    };
    reg.addEventListener('updatefound',track);track();
  }
  async function prepare(){
    if(busy)return;busy=true;status('Загружаем файлы приложения. Не закрывайте эту страницу.');
    try{
      registration=await navigator.serviceWorker.register(new URL('offline-worker.js',base),{scope:base.href,updateViaCache:'none'});watch(registration);
      if(!registration.active)await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Подготовка ещё не завершена. Проверьте подключение и повторите позже.')),120000))]);
      await inspect();
    }catch(e){status('Не удалось подготовить офлайн-файлы. '+e.message);}finally{busy=false;}
  }
  async function tools(){
    if(busy)return;busy=true;status('Загружаем OCR/PDF — около 9 МБ. Это только движки, не ваши чеки.');
    try{registration=await ownRegistration();await send(registration?.active,'PREPARE_TOOLS');await inspect();}catch(e){status(e.message);}finally{busy=false;}
  }
  async function update(){
    if(busy)return;if(formOpen()){toast('Сначала закройте форму. Ввод не будет перезагружен автоматически.');return;}
    busy=true;
    try{
      registration=await ownRegistration();
      if(!registration){status('Сначала подготовьте приложение для офлайн-работы.');return;}
      watch(registration);
      if(registration.waiting){applying=true;await send(registration.waiting,'ACTIVATE');}
      else {await registration.update();await inspect();status('Проверка версии запущена. Готовое обновление появится отдельной кнопкой.');}
    }catch(e){applying=false;status(e.message);}finally{busy=false;}
  }
  function boot(){
    const note=document.createElement('p');note.id='network-note';note.className='network-note';note.setAttribute('role','status');note.textContent='Нет сети. Можно вести учёт на устройстве; облако сейчас недоступно.';document.querySelector('main').prepend(note);network();
    box=document.createElement('details');box.id='offline-settings';box.className='data-care-details';
    box.innerHTML='<summary>Без интернета и обновления</summary><p data-offline-status role="status"></p><p>Подготовьте приложение при хорошей сети (около 3 МБ), затем при необходимости OCR/PDF (около 9 МБ). Голос зависит от браузера и может требовать интернет. Облако без сети недоступно. Офлайн-файлы — не резервная копия ваших денег. После обновления подготовка OCR/PDF может понадобиться снова.</p><div class="data-care-actions"><button type="button" data-offline-prepare>Подготовить приложение</button><button type="button" data-offline-tools>Подготовить OCR/PDF</button><button type="button" data-offline-check>Проверить версию</button><button type="button" data-offline-update hidden>Применить обновление и открыть заново</button></div>';
    document.getElementById('data-care').append(box);
    if(!supported){status('Этот браузер не поддерживает подготовку офлайн. Текущие локальные записи не изменены.');box.querySelectorAll('button').forEach(b=>b.disabled=true);return;}
    box.addEventListener('toggle',()=>{if(box.open)inspect().catch(()=>{});});
    box.querySelector('[data-offline-prepare]').onclick=prepare;box.querySelector('[data-offline-tools]').onclick=tools;box.querySelector('[data-offline-check]').onclick=update;box.querySelector('[data-offline-update]').onclick=update;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying)location.reload();else inspect().catch(()=>{});});
    inspect().then(()=>{if(registration){watch(registration);registration.update().catch(()=>{});}}).catch(()=>status('Не удалось проверить офлайн-версию.'));
    window.addEventListener('fintex:tabchange',()=>inspect().catch(()=>{}));
  }
  window.addEventListener('online',network);window.addEventListener('offline',network);
  document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
