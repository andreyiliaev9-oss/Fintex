/* Optional cloud sync. Opening Fintex never depends on this server. */
(function () {
  'use strict';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyzfhzExalPbmThOsQ24Sq3-qOq_7aLSPQ69dShDbRawnawVIyR5L3hLlN1PSkCHFIM/exec';
  // Only known retired Fintex deployments migrate; custom server URLs remain intact.
  const RETIRED_ENDPOINTS = [
    'https://script.google.com/macros/s/AKfycbxXANSbGhKg-owDC4NFctMJ0mUW5H9XuXwXTohc0n0/exec',
    'https://script.google.com/macros/s/AKfycby5QwCkVgVNt8tzrm7_BTw24Ogl05pZHcSNOE6u6LpXxf6iw5oedtJSnGgsvmV0c9-3/exec',
    'https://script.google.com/macros/s/AKfycbw2Q0L7sKq0QrOQtffRS3oRpq22nrWZ8b9ErM8aWSuF4I9qMLz4f_N7mVu_F6m8-6j6/exec',
    'https://script.google.com/macros/s/AKfycbz_gCZDuLK2Ghkoapf_arMFYu63_9VK7wC8GZUoYn-J3WPqmg7TFRvfKgjJ9KqNXq3F/exec'
  ];
  const read=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
  const write=(key,value)=>{try{localStorage.setItem(key,value);}catch(_){}};
  function endpoint() {
    const saved=read('fp_api_url');
    const value=String(saved||'').trim().replace(/\/dev$/, '/exec');
    if(!value || RETIRED_ENDPOINTS.includes(value)) {
      if(saved)write('fp_api_url',DEFAULT_ENDPOINT);
      return DEFAULT_ENDPOINT;
    }
    return value;
  }
  const initData=()=>window.Telegram?.WebApp?.initData||'';
  function canSync() {
    if(window.FintexBackupRecoveryError||read('fp_cloud_paused_restore')==='1'||!initData())return false;
    // Do not upload records saved for a different Telegram account.
    const prior=read('fp_auth_uid'),uid=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'');
    return !prior||prior===uid;
  }
  async function request(action,fields={}) {
    if(!canSync())throw new Error('Облако доступно через вашу учётную запись Telegram. Локальные записи доступны без входа.');
    const restoreEpoch=read('fp_backup_last_restore');
    const url=endpoint();
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('Проверьте адрес сервера в настройках.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try {
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},signal:controller.signal,body:JSON.stringify({...fields,action,init_data:initData()})});
      if(!response.ok)throw new Error('Облако временно недоступно. Локальные данные сохранены.');
      const data=await response.json();
      if(!data||data.ok!==true)throw new Error(data?.error||'Не удалось синхронизировать данные.');
      if(restoreEpoch!==read('fp_backup_last_restore')||read('fp_cloud_paused_restore')==='1')throw new Error('Синхронизация остановлена после восстановления копии.');
      if(data.uid)write('fp_auth_uid',String(data.uid));
      return data;
    } finally {clearTimeout(timer);}
  }
  window.FintexCloud={request,canSync,defaultEndpoint:DEFAULT_ENDPOINT,getEndpoint:endpoint};
})();
