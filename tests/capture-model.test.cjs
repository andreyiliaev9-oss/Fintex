const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../capture-model.js');
const today='2026-11-24';
const qr={found:true,raw:'t=20261124T1201&s=120.50&fn=1234567890123456&i=123&fp=456&n=1',date:today,sum:120.5};
const receipt=(more={})=>({kind:'receipt',qr,amount:120.5,ocrTotal:120.5,date:today,time:'12:01',merchant:'Магнит',type:'expense',op_kind:'expense',confidence:97,raw:'ИТОГ 120.50',...more});
const assess=(c,more={})=>M.assess(c,{today,...more});
test('autosave requires corroborated, explicit sale QR and high quality text',()=>{
  assert.equal(assess(receipt()).autoSave,true);
  for(const changed of [{itemsSum:121},{qr:{...qr,raw:qr.raw+'&n=2'}},{confidence:0},{confidence:null},{confidence:91},{ocrTotal:121},{dateInferred:true},{uncertain:true},{merchant:'Кассовый чек'},{qr:{...qr,raw:qr.raw.replace('&n=1','')}},{qr:{...qr,raw:qr.raw.replace('&n=1','&n=2')}},{kind:'bank'},{op_kind:'refund',type:'income'}])assert.equal(assess(receipt(changed)).autoSave,false,JSON.stringify(changed));
});
test('invalid amounts, dates and foreign currencies never enter ledger',()=>{
  for(const amount of [0,-1,Infinity,NaN,null,'120.50'])assert.equal(assess(receipt({amount})).canSave,false);
  for(const date of ['2026-02-30','2026-11-25','2026-00-01',''])assert.equal(assess(receipt({date})).canSave,false);
  assert.equal(assess(receipt({raw:'120 USD'})).canSave,false);
  assert.equal(assess(receipt({raw:'120 PLN'})).canSave,false);
});
test('duplicate is blocked by full file hash, fiscal identity and matching operation fields',()=>{
  const tx={id:'tx1',date:today,time:'12:01',amount:120.5,merchant:'Магнит',type:'expense'};
  assert.equal(assess(receipt(),{transactions:[tx]}).duplicateId,'tx1');
  assert.equal(assess(receipt({merchant:'Другой',fileHash:'hash'}),{transactions:[tx],archive:[{fileHash:'hash',txId:'tx1'}]}).canSave,false);
  assert.equal(assess(receipt({merchant:'Другой'}),{transactions:[tx],archive:[{fiscalKey:M.fiscalKey(qr),txId:'tx1'}]}).canSave,false);
  assert.equal(assess(receipt(),{transactions:[],archive:[{fileHash:'hash',txId:'deleted'}]}).canSave,true);
});
test('unknown bank stays unknown and all transfer directions require confirmation',()=>{
  assert.equal(M.bankFromText('Покупка 120,50 RUB'), '');assert.equal(M.bankFromText('Т-Банк Покупка'),'Т-Банк');
  for(const [op_kind,type] of [['transfer_in','income'],['transfer_out','expense'],['income','income']]){
    const p=assess(receipt({op_kind,type}));assert.equal(p.autoSave,false);assert.equal(p.canSave,true);
  }
});
