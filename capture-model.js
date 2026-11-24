/* Capture safety policy. OCR confidence describes text quality, not financial certainty. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FintexCaptureModel=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function validDate(date,today){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const d=new Date(date+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===date&&date<=today;}
  const banks=[[/т-банк|тинькофф|t-bank|tinkoff/i,'Т-Банк'],[/сбербанк|сбер|sber/i,'Сбер'],[/альфа|alfa/i,'Альфа-Банк'],[/ozon\s*банк|озон\s*банк/i,'Ozon Банк'],[/втб|vtb/i,'ВТБ'],[/газпромбанк|gpb/i,'Газпромбанк'],[/райффайзен|raiffeisen/i,'Райффайзен'],[/яндекс\s*(банк|пэй)|yandex\s*pay/i,'Яндекс Пэй'],[/совкомбанк|sovcombank/i,'Совкомбанк'],[/мтс\s*банк|mts\s*bank/i,'МТС Банк']];
  function bankFromText(text){return banks.find(([re])=>re.test(text||''))?.[1]||'';}
  function fiscalKey(qr){
    if(!qr?.found)return '';
    const p=new URLSearchParams(qr.raw||'');
    if(['t','s','fn','i','fp','n'].some(k=>p.getAll(k).length!==1)||!/^\d{8}T\d{4}(?:\d{2})?$/.test(p.get('t')||''))return '';
    return /^\d{16}$/.test(p.get('fn')||'')&&/^\d{1,10}$/.test(p.get('i')||'')&&/^\d{1,20}$/.test(p.get('fp')||'')?[p.get('fn'),p.get('i'),p.get('fp')].join('_'):'';
  }
  function duplicate(c,transactions,archive){
    const ids=new Set(transactions.map(t=>t.id));
    const record=archive.find(r=>ids.has(r.txId)&&((c.fileHash&&r.fileHash===c.fileHash)||(c.fiscalKey&&r.fiscalKey===c.fiscalKey)));
    if(record)return record.txId;
    return transactions.find(t=>(c.dedup_hash&&t.dedup_hash===c.dedup_hash)||(c.fiscalKey&&t.dedup_hash==='capture_fiscal_'+c.fiscalKey)||(t.date===c.date&&Math.round(t.amount*100)===Math.round(c.amount*100)&&t.type===c.type&&String(t.merchant).trim().toLowerCase()===String(c.merchant).trim().toLowerCase()&&(!c.time||!t.time||t.time===c.time)))?.id||'';
  }
  function assess(c,{today,transactions=[],archive=[]}={}){
    const reasons=[];
    const amount=typeof c.amount==='number'&&Number.isFinite(c.amount)&&c.amount>0&&c.amount<=1e10;
    const date=validDate(c.date,today);
    const foreign=/\b(?:USD|EUR|GBP|CNY|PLN|KZT|BYN)\b|[$€£¥₸₴]/i.test(c.raw||'');
    if(!amount)reasons.push('Укажите положительную сумму в рублях.');
    if(!date)reasons.push('Проверьте дату: она должна быть не позднее сегодня.');
    if(!String(c.merchant||'').trim())reasons.push('Укажите магазин или назначение.');
    if(!c.bank)reasons.push('Банк не найден в документе. Не подставляем банк из настроек.');
    if(c.dateInferred)reasons.push('Дата отсутствует в документе — подтвердите её.');
    if(c.kind==='bank')reasons.push('Банковское изображение требует подтверждения суммы и направления.');
    if(c.op_kind!=='expense')reasons.push('Доход, возврат или перевод нужно подтвердить.');
    const qr=c.qr||{},key=fiscalKey(qr),params=new URLSearchParams(qr.raw||'');
    const qrMatches=!!key&&params.get('n')==='1'&&validDate(qr.date,today)&&qr.date===c.date&&Number.isFinite(qr.sum)&&Math.round(qr.sum*100)===Math.round(c.amount*100)&&Number.isFinite(c.ocrTotal)&&Math.round(c.ocrTotal*100)===Math.round(c.amount*100);
    if(c.kind==='receipt'&&!qrMatches)reasons.push('Нет полного QR или итог из текста не совпал с QR.');
    if(!Number.isFinite(c.confidence)||c.confidence<92)reasons.push('Качество текста недостаточно для автосохранения.');
    const itemsMismatch=Number.isFinite(c.itemsSum)&&c.itemsSum>0&&Math.round(c.itemsSum*100)!==Math.round(c.amount*100);
    if(itemsMismatch)reasons.push('Сумма позиций не совпала с итогом — проверьте чек.');
    if(c.uncertain)reasons.push('Есть неоднозначные поля или несколько операций.');
    if(foreign)reasons.push('В документе найдена другая валюта. Capture поддерживает только рубли.');
    const duplicateId=duplicate({...c,fiscalKey:key},transactions,archive);
    if(duplicateId)reasons.push('Похожая операция уже учтена. Повторная запись заблокирована.');
    const canSave=!!(amount&&date&&String(c.merchant||'').trim()&&!foreign&&!duplicateId&&['income','expense'].includes(c.type)&&['expense','income','refund','transfer_in','transfer_out','atm'].includes(c.op_kind));
    const autoSave=!!(canSave&&c.kind==='receipt'&&qrMatches&&c.op_kind==='expense'&&!c.dateInferred&&!c.uncertain&&!itemsMismatch&&c.confidence>=92&&c.merchant!=='Кассовый чек');
    return {canSave,autoSave,duplicateId,reasons,fiscalKey:key,level:duplicateId?'duplicate':autoSave?'matched':'review'};
  }
  return {validDate,bankFromText,fiscalKey,duplicate,assess};
});
