/* Per-tab, new-operation input only. Not a transaction, backup, or cloud payload. */
(() => {
  'use strict';
  const key='fintex_entry_draft_v1';let formBinding=null;
  function begin(){try{formBinding=binding();}catch(_){formBinding=null;}}
  const fields=['amount','merchant','date','category','from','to'];
  function binding(){return JSON.stringify([localStorage.getItem('fp_auth_uid')||String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'guest'),localStorage.getItem('fp_name'),localStorage.getItem('fp_backup_last_restore')]);}
  function clear(){try{sessionStorage.removeItem(key);}catch(_){}}
  function read(){
    try{const draft=JSON.parse(sessionStorage.getItem(key)||'null');if(!draft)return null;
      if(draft.version!==1||draft.binding!==binding()||!['expense','income','transfer'].includes(draft.kind)||fields.some(f=>typeof draft[f]!=='string'||draft[f].length>100)||draft.date!==''&&FintexMath.ordinal(draft.date)===null){clear();return null;}
      return draft;
    }catch(_){clear();return null;}
  }
  function save(data){
    try{if(!formBinding||formBinding!==binding())return false;
      if(!data.amount&&!data.merchant&&!data.from&&!data.to){clear();return true;}
      const safe=Object.fromEntries(fields.map(f=>[f,String(data[f]||'').slice(0,f==='amount'?20:100)]));
      sessionStorage.setItem(key,JSON.stringify({...safe,version:1,kind:data.kind,binding:formBinding}));return true;
    }catch(_){return false;}
  }
  window.FintexEntryDraft={begin,read,save,clear};
})();
