/* Pure reminder policy. No network, storage, implicit permission or financial mutations. */
var FintexReminderModel = (function () {
  'use strict';
  var DAY=86400000;
  function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;var n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;}
  function shift(s,n){return new Date(date(s)+n*DAY).toISOString().slice(0,10);}
  function defaults(){return {enabled:false,receipts:true,expenses:true,bills:true,reports:true,goals:false,time:'20:30',reportTime:'19:00',reportFrequency:'weekly',timezone:'Europe/Warsaw',includeAmounts:false};}
  function settings(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Укажите настройки напоминаний.');
    var out=defaults();
    ['enabled','receipts','expenses','bills','reports','goals','includeAmounts'].forEach(function(k){if(typeof raw[k]!=='boolean')throw new Error('Некорректный переключатель: '+k);out[k]=raw[k];});
    ['time','reportTime'].forEach(function(k){if(!/^(09|1\d|20|21):[0-5]\d$/.test(raw[k]||''))throw new Error('Выберите время с 09:00 до 21:59.');out[k]=raw[k];});
    if(['weekly','daily'].indexOf(raw.reportFrequency)<0)throw new Error('Выберите ежедневный или еженедельный итог.');out.reportFrequency=raw.reportFrequency;
    if(['UTC','Europe/Warsaw','Europe/Moscow','Europe/Kaliningrad','Europe/Berlin','Europe/London','Europe/Istanbul','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Almaty','Asia/Tbilisi','Asia/Dubai','Asia/Vladivostok','Asia/Bangkok','Asia/Tokyo','America/New_York','America/Los_Angeles'].indexOf(raw.timezone)<0)throw new Error('Выберите поддерживаемый часовой пояс.');
    if(typeof raw.timezone!=='string'||raw.timezone.length>64||!/^([A-Za-z_+-]+\/)*[A-Za-z_+-]+$/.test(raw.timezone))throw new Error('Укажите часовой пояс IANA, например Europe/Warsaw.');out.timezone=raw.timezone;
    if(out.enabled&&!['receipts','expenses','bills','reports','goals'].some(function(k){return out[k];}))throw new Error('Выберите хотя бы один тип напоминаний.');
    return out;
  }
  function context(raw,today,old){
    raw=raw||{};old=old||{};var out={lastSeen:today,goalActive:raw.goalActive===true,bills:[]};
    ['lastReceipt','lastExpense'].forEach(function(k){var v=raw[k];out[k]=date(v)!==null&&v<=today?v:'';if(date(old[k])!==null&&old[k]<=today&&old[k]>out[k])out[k]=old[k];});
    if(Array.isArray(raw.bills))out.bills=raw.bills.slice(0,50).filter(function(b){return b&&typeof b.id==='string'&&/^[\w-]{1,100}$/.test(b.id)&&date(b.due)!==null&&b.due>=today&&b.due<=shift(today,366);}).map(function(b){return {id:b.id,due:b.due};});
    return out;
  }
  function due(p,c,s,local,now){
    if(!p.enabled||date(local.date)===null||!/^\d{2}:\d{2}$/.test(local.time))return null;
    var hour=Number(local.time.slice(0,2)),minute=hour*60+Number(local.time.slice(3));
    if(hour<9||hour>=22||s.lastDay===local.date||now-Number(s.lastAt||0)<20*3600000||Number(s.retryAfter||0)>now)return null;
    var sent=s.sent||{},dow=new Date(date(local.date)).getUTCDay(),week=shift(local.date,-((dow+6)%7));
    function at(time){var parts=time.split(':'),delta=minute-(Number(parts[0])*60+Number(parts[1]));return delta>=0&&delta<90;}
    function item(kind,key,text){return sent[key]?null:{kind:kind,key:key,text:text};}
    if(p.reports&&(p.reportFrequency==='daily'||dow===0)&&at(p.reportTime)){
      var report=item('reports','report_'+(p.reportFrequency==='weekly'?week:local.date),'📊 FINTEX · '+(p.reportFrequency==='weekly'?'Ваш финансовый итог за неделю':'Ваш финансовый итог за день')+'\nПосмотрите записанные доходы и расходы. Полнота учёта зависит от добавленных вами операций.');
      if(report){report.from=p.reportFrequency==='weekly'?week:local.date;report.to=local.date;return report;}
    }
    if(!at(p.time)||!c.lastSeen||date(c.lastSeen)===null||date(local.date)-date(c.lastSeen)>7*DAY)return null;
    if(p.bills){var bill=(c.bills||[]).find(function(b){return date(b.due)!==null&&b.due>=local.date&&b.due<=shift(local.date,2)&&!sent['bill_'+b.id+'_'+b.due];});if(bill)return item('bills','bill_'+bill.id+'_'+bill.due,'📅 FINTEX · Предстоящий платёж\nВ последнем синхронизированном списке есть неоплаченный платёж на '+bill.due.split('-').reverse().join('.')+'. Проверьте актуальность и оплату в приложении.');}
    var choices=[];
    var receiptBase=c.lastReceipt||c.registered;
    if(p.receipts&&date(receiptBase)!==null&&date(local.date)-date(receiptBase)>=3*DAY)choices.push({kind:'receipts',text:'🧾 FINTEX · Не забудьте загрузить чеки\nВ доступных данных давно не было новых чеков. Если были покупки, добавьте их, чтобы они попали в аналитику. Если покупок не было — ничего делать не нужно.'});
    if(p.expenses&&c.lastExpense!==local.date)choices.push({kind:'expenses',text:'💳 FINTEX · Время проверить учёт\nПроверьте, все ли сегодняшние операции добавлены. Мы не знаем, были ли неучтённые покупки; если операций не было, пропустите напоминание.'});
    if(p.goals&&c.goalActive&&dow===3)choices.push({kind:'goals',text:'🎯 FINTEX · Ваш план накоплений\nЕсли это сейчас комфортно, вернитесь к своей цели. Можно пополнить подушку, изменить темп или пропустить — решение за вами.'});
    choices=choices.filter(function(x){return !s.byKind||!s.byKind[x.kind]||now-s.byKind[x.kind]>=3*DAY;}).sort(function(a,b){return Number((s.byKind||{})[a.kind]||0)-Number((s.byKind||{})[b.kind]||0);});
    return choices.length?item(choices[0].kind,choices[0].kind+'_'+local.date,choices[0].text):null;
  }
  return {defaults:defaults,settings:settings,context:context,due:due,date:date,shift:shift};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FintexReminderModel;
