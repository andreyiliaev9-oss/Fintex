/* Display only: the ledger still owns rounding and arithmetic. Local font, no CDN. */
(function () {
  'use strict';
  const labels=new WeakMap();
  const formatter=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
  function parts(value,prefix='',currency='₽') {
    const amount=window.FintexMath.money(value);
    const all=formatter.formatToParts(amount);
    return {
      major:prefix+all.filter(p=>!['decimal','fraction'].includes(p.type)).map(p=>p.value).join(''),
      minor:all.filter(p=>['decimal','fraction'].includes(p.type)).map(p=>p.value).join(''),
      label:(prefix+formatter.format(amount)+' '+currency).replace(/[\u00a0\u202f]/g,' '),
      digits:all.filter(p=>p.type==='integer').map(p=>p.value).join('').length
    };
  }
  function journalParts(value,prefix='',currency='₽') {
    const p=parts(value,prefix,currency);
    // Ledger values are unchanged: only display fractional rubles as two kopecks.
    if(p.minor)p.minor=p.minor.padEnd(3,'0');
    p.label=(p.major+p.minor+' '+currency).replace(/[\u00a0\u202f]/g,' ');
    return p;
  }
  function render(el,value,prefix='',currency='₽',journal=false) {
    if(!el)return;
    const p=journal?journalParts(value,prefix,currency):parts(value,prefix,currency),fragment=document.createDocumentFragment();
    for(const [cls,text] of [...(journal&&prefix?[['number-sign',prefix]]:[]),['number-major',journal?p.major.slice(prefix.length):p.major],['number-minor',p.minor],['number-currency',' '+currency]]) {
      if(!text)continue;
      const span=document.createElement('span');span.className=cls;span.textContent=text;span.setAttribute('aria-hidden','true');
      if(journal&&cls==='number-major'){
        span.replaceChildren();
        text.split(/[\u00a0\u202f ]/).forEach((group,i)=>{
          if(i){const gap=document.createElement('span');gap.className='number-separator';gap.textContent='\u00a0';span.append(gap);}
          const digits=document.createElement('span');digits.className='number-group';digits.textContent=group;span.append(digits);
        });
      }
      fragment.append(span);
    }
    el.replaceChildren(fragment);el.classList.add('number-display','money-val');el.classList.toggle('journal-number',journal);el.dataset.numberSize=p.digits>=11?'wide':p.digits>=8?'medium':'normal';
    el.setAttribute('role','img');labels.set(el,p.label);el.setAttribute('aria-label',document.body.classList.contains('stealth-mode')?'Сумма скрыта':p.label);
  }
  function syncPrivacy() {
    document.querySelectorAll('.number-display').forEach(el=>{if(labels.has(el))el.setAttribute('aria-label',document.body.classList.contains('stealth-mode')?'Сумма скрыта':labels.get(el));});
  }
  window.FintexNumerals={parts,journalParts,render,renderJournal:(el,value,prefix='',currency='₽')=>render(el,value,prefix,currency,true),syncPrivacy};
})();
