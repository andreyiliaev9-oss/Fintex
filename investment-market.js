/* Offline share reference + explicitly manual-price practice. No market-data feed.
 * Integer minor units, separate currencies, replayable virtual ledger.
 */
(function (root) {
  'use strict';
  const stocks = Object.freeze([
    {id:'XNAS:AAPL',symbol:'AAPL',name:'Apple',market:'США',exchange:'Nasdaq',currency:'USD',source:'https://investor.apple.com/faq/default.aspx'},
    {id:'XNAS:MSFT',symbol:'MSFT',name:'Microsoft',market:'США',exchange:'Nasdaq',currency:'USD',source:'https://www.microsoft.com/en-us/investor/faq'},
    {id:'XNAS:NVDA',symbol:'NVDA',name:'NVIDIA',market:'США',exchange:'Nasdaq',currency:'USD',source:'https://investor.nvidia.com/investor-resources/faqs/default.aspx'},
    {id:'MOEX:SBER',symbol:'SBER',name:'Сбербанк',market:'Россия',exchange:'Московская биржа',currency:'RUB',source:'https://www.moex.com/files/47h5f424r3va853q1z60pkpmwk'},
    {id:'MOEX:GAZP',symbol:'GAZP',name:'Газпром',market:'Россия',exchange:'Московская биржа',currency:'RUB',source:'https://www.moex.com/files/47h5f424r3va853q1z60pkpmwk'},
    {id:'MOEX:LKOH',symbol:'LKOH',name:'Лукойл',market:'Россия',exchange:'Московская биржа',currency:'RUB',source:'https://www.moex.com/files/47h5f424r3va853q1z60pkpmwk'},
    {id:'XETR:SAP',symbol:'SAP',name:'SAP',market:'Европа',exchange:'Xetra',currency:'EUR',source:'https://www.sap.com/investors/en/resources/faq.html'},
    {id:'XAMS:ASML',symbol:'ASML',name:'ASML',market:'Европа',exchange:'Euronext Amsterdam',currency:'EUR',source:'https://www.asml.com/en/investors/shares'}
  ].map(Object.freeze));
  const INITIAL = Object.freeze({RUB:10000000,USD:1000000,EUR:1000000});
  const MAX_TRADES = 500;
  const stock = id => stocks.find(s=>s.id===id);
  function newPractice() { return {generation:root.crypto?.randomUUID?.() || `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`,trades:[]}; }
  function minor(value) {
    const text=String(value).trim().replace(',','.');
    if(!/^\d{1,8}(\.\d{1,2})?$/.test(text))throw new Error('Введите цену больше нуля: не более двух знаков после запятой.');
    const [whole,decimal='']=text.split('.');
    const n=Number(whole)*100+Number(decimal.padEnd(2,'0'));
    if(!Number.isSafeInteger(n)||n<=0||n>1000000000)throw new Error('Цена должна быть от 0,01 до 10 000 000.');
    return n;
  }
  function quantity(value) {
    if(!/^\d{1,7}$/.test(String(value)))throw new Error('Количество — целое число от 1 до 1 000 000.');
    const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>1000000)throw new Error('Количество — целое число от 1 до 1 000 000.');return n;
  }
  function costs(priceMinor,qty) {
    if(!Number.isSafeInteger(priceMinor)||priceMinor<=0||priceMinor>1000000000)throw new Error('Некорректная цена.');
    if(!Number.isSafeInteger(qty))throw new Error('Количество должно быть целым числом.');
    quantity(qty);
    const value=BigInt(priceMinor)*BigInt(qty);
    if(value>100000000000n)throw new Error('Слишком большая сумма для учебной сделки.');
    return {gross:Number(value),fee:Number((value*3n+500n)/1000n)};
  }
  function emptySummary() { return {cash:{...INITIAL},positions:{},realized:{RUB:0,USD:0,EUR:0},trades:[]}; }
  function apply(summary,t) {
    const instrument=stock(t.instrumentId);if(!instrument)throw new Error('Акция не найдена в учебном каталоге.');
    if(!['buy','sell'].includes(t.side))throw new Error('Выберите покупку или продажу.');
    const {gross,fee}=costs(t.priceMinor,t.quantity);
    const p=summary.positions[instrument.id] || {quantity:0,cost:0};
    let allocated=0,realized=0;
    if(t.side==='buy') {
      if(gross+fee>summary.cash[instrument.currency])throw new Error('Не хватает виртуальных денег в этой валюте. Уменьшите количество.');
      p.quantity+=t.quantity;p.cost+=gross+fee;summary.cash[instrument.currency]-=gross+fee;
    } else {
      if(t.quantity>p.quantity)throw new Error('Нельзя продать больше акций, чем есть в учебном портфеле.');
      allocated=t.quantity===p.quantity?p.cost:Number(BigInt(p.cost)*BigInt(t.quantity)/BigInt(p.quantity));
      realized=gross-fee-allocated;p.quantity-=t.quantity;p.cost-=allocated;
      summary.cash[instrument.currency]+=gross-fee;summary.realized[instrument.currency]+=realized;
    }
    summary.positions[instrument.id]=p;
    summary.trades.push({...t,currency:instrument.currency,gross,fee,realized});
    return summary;
  }
  function summary(practice) {
    if(!practice||typeof practice.generation!=='string'||practice.generation.length>100||!practice.generation||!Array.isArray(practice.trades)||practice.trades.length>MAX_TRADES)throw new Error('Повреждены данные тренировок.');
    const ids=new Set();const result=emptySummary();
    for(const t of practice.trades) {
      if(!t||typeof t.id!=='string'||!t.id||t.id.length>100||ids.has(t.id)||t.source!=='manual'||typeof t.createdAt!=='string'||!Number.isFinite(Date.parse(t.createdAt)))throw new Error('Повреждена учебная сделка.');
      ids.add(t.id);apply(result,t);
    }
    return result;
  }
  function execute(practice,order,now=new Date().toISOString()) {
    const current=summary(practice);
    if(order.generation!==practice.generation)throw new Error('Учебный счёт был сброшен. Откройте форму заново.');
    if(order.acknowledged!==true)throw new Error('Подтвердите, что это ваша условная цена, а не котировка.');
    if(typeof order.id!=='string'||!order.id||order.id.length>100)throw new Error('Откройте подтверждение заново.');
    const old=practice.trades.find(t=>t.id===order.id);
    if(old) {
      if(old.instrumentId===order.instrumentId&&old.side===order.side&&old.quantity===order.quantity&&old.priceMinor===order.priceMinor)return practice;
      throw new Error('Повторное подтверждение отличается от исходного.');
    }
    if(order.revision!==practice.trades.length)throw new Error('Учебный портфель изменился. Проверьте расчёт заново.');
    if(practice.trades.length>=MAX_TRADES)throw new Error('Достигнут предел: 500 учебных сделок.');
    const trade={id:order.id,instrumentId:order.instrumentId,side:order.side,quantity:order.quantity,priceMinor:order.priceMinor,source:'manual',createdAt:now};
    apply(current,trade);
    const next={generation:practice.generation,trades:[...practice.trades,trade]};summary(next);return next;
  }
  const api={stocks,INITIAL,MAX_TRADES,stock,newPractice,minor,quantity,costs,summary,execute};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FintexPracticeMarket=api;
})(typeof window!=='undefined'?window:globalThis);
