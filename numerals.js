/* Display only: the ledger still owns rounding and arithmetic. Local font, no CDN. */
(function () {
  'use strict';
  const labels=new WeakMap();
  const formatter=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  function parts(value,prefix='') {
    const amount=window.FintexMath.money(value);
    const all=formatter.formatToParts(amount);
    return {
      major:prefix+all.filter(p=>!['decimal','fraction'].includes(p.type)).map(p=>p.value).join(''),
      minor:all.filter(p=>['decimal','fraction'].includes(p.type)).map(p=>p.value).join(''),
      label:(prefix+formatter.format(amount)+' ₽').replace(/[\u00a0\u202f]/g,' '),
      digits:all.filter(p=>p.type==='integer').map(p=>p.value).join('').length
    };
  }
  function render(el,value,prefix='') {
    if(!el)return;
    const p=parts(value,prefix),fragment=document.createDocumentFragment();
    for(const [cls,text] of [['number-major',p.major],['number-minor',p.minor],['number-currency',' ₽']]) {
      if(!text)continue;
      const span=document.createElement('span');span.className=cls;span.textContent=text;span.setAttribute('aria-hidden','true');fragment.append(span);
    }
    el.replaceChildren(fragment);el.classList.add('number-display','money-val');el.dataset.numberSize=p.digits>=11?'wide':p.digits>=8?'medium':'normal';
    el.setAttribute('role','img');labels.set(el,p.label);el.setAttribute('aria-label',document.body.classList.contains('stealth-mode')?'Сумма скрыта':p.label);
  }
  function syncPrivacy() {
    document.querySelectorAll('.number-display').forEach(el=>{if(labels.has(el))el.setAttribute('aria-label',document.body.classList.contains('stealth-mode')?'Сумма скрыта':labels.get(el));});
  }
  window.FintexNumerals={parts,render,syncPrivacy};
})();
