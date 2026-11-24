/* Recorded patterns, not psychological traits or causal explanations.
 * Deterministic and network-free; all dates and thresholds are inspectable. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./finance-math.js'):root.FintexMath);if(typeof module==='object'&&module.exports)module.exports=api;else root.FintexBehaviorModel=api;})(typeof window!=='undefined'?window:globalThis,function(M){
  'use strict';
  const median=a=>quantile(a,.5);
  function quantile(a,q){const b=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!b.length)return null;const n=(b.length-1)*q,i=Math.floor(n);return b[i]+(b[Math.ceil(n)]-b[i])*(n-i);}
  const total=a=>M.sum(a,x=>x.amount);
  const days=a=>new Set(a.map(x=>x.date)).size;
  const within=(a,start,end)=>a.filter(x=>x.date>=start&&x.date<=end);
  const kind=t=>String(t.op_kind||'').toLowerCase();
  const excluded=t=>/transfer|refund|atm|перевод|возврат/.test(kind(t));
  function evidence(n,unit,from,to){return {level:n>=6?'Повторяется в доступной истории':'Предварительная закономерность',samples:n,unit,from,to};}
  function monthsIn(from,today){
    const out=[];let cursor=from.slice(0,7)+'-01';
    while(cursor<today){const end=M.shift(M.nextMonth(cursor),-1);if(cursor>=from&&end<today)out.push({key:cursor.slice(0,7),start:cursor,end});cursor=M.nextMonth(cursor);}
    return out;
  }
  function analyze({transactions=[],today,savingsEvents=[],observedSince='',feedback={},planned={}}={}){
    if(M.ordinal(today)===null)throw new Error('A valid local today is required');
    const from=M.shift(today,-182),seen=new Set();
    const valid=M.transactions(transactions,from,today).filter(t=>{
      if(t.id&&seen.has(t.id))return false;if(t.id)seen.add(t.id);
      return !excluded(t);
    }).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id||'').localeCompare(String(b.id||'')));
    const spending=valid.filter(t=>t.type==='expense'),variable=spending.filter(t=>!M.isBill(t)),incomes=valid.filter(t=>t.type==='income');
    const earliest=valid[0]?.date||today,span=M.ordinal(today)-M.ordinal(earliest)+1;
    const complete=monthsIn(earliest,today).map(month=>{
      const exp=within(spending,month.start,month.end),inc=within(incomes,month.start,month.end);
      return {...month,expenses:total(exp),income:total(inc),activeDays:days(exp),net:M.add(total(inc),-total(exp)),exp,inc};
    });
    const eligible=complete.filter(m=>m.activeDays>=12);
    const insights=[];
    // Compare like-for-like recorded spending days, not unobserved days with zeros.
    const weeks=[];let monday=M.shift(earliest,-((new Date(earliest+'T00:00:00Z').getUTCDay()+6)%7));
    for(;M.shift(monday,6)<today;monday=M.shift(monday,7)){
      const week=within(variable,monday,M.shift(monday,6));const wd=week.filter(t=>![0,6].includes(new Date(t.date+'T00:00:00Z').getUTCDay())),we=week.filter(t=>!wd.includes(t));
      if(days(wd)>=3&&days(we)>=1)weeks.push({start:monday,end:M.shift(monday,6),wd:total(wd)/days(wd),we:total(we)/days(we)});
    }
    if(weeks.length>=8){
      const ratios=weeks.map(w=>w.wd>0?w.we/w.wd:null).filter(Number.isFinite),ratio=median(ratios),repeats=ratios.filter(r=>r>=1.2).length;
      if(ratio>=1.2&&repeats/ratios.length>=.7)insights.push({id:'weekend',title:'В выходные записанные траты выше',text:`На день с записями — примерно на ${Math.round((ratio-1)*100)}% больше, чем в будни. Разница от 20% повторилась в ${repeats} из ${weeks.length} недель.`,suggestion:'Можно заранее выбрать комфортную сумму на выходные, не запрещая себе отдых.',evidence:evidence(weeks.length,'сопоставимых недель',weeks[0].start,weeks.at(-1).end)});
    }
    // Salary must be explicitly identified. Refunds and transfers never become salary.
    const salaryByDate=new Map();for(const t of incomes)if(t.income_kind==='salary'||/зарплат|аванс/i.test(t.merchant||''))salaryByDate.set(t.date,M.add(salaryByDate.get(t.date)||0,t.amount));
    const salaries=[...salaryByDate].map(([date,amount])=>({date,amount})),cycles=[];
    for(let i=0;i<salaries.length-1;i++){
      const start=salaries[i].date,next=salaries[i+1].date,gap=M.ordinal(next)-M.ordinal(start);
      if(gap<12||gap>45)continue;
      const first=within(variable,start,M.shift(start,4)),later=within(variable,M.shift(start,5),M.shift(start,9));
      if(days(first)>=2&&days(later)>=2&&total(later)>0)cycles.push({start,end:M.shift(next,-1),first:total(first),later:total(later),salary:salaries[i].amount,ratio:total(first)/total(later)});
    }
    const repeated=cycles.filter(c=>c.ratio>=1.25);
    if(cycles.length>=3&&repeated.length/cycles.length>=.7){
      insights.push({id:'payday',title:'После отмеченной зарплаты расходы растут',text:`Первые 5 дней дороже следующих 5 дней в ${repeated.length} из ${cycles.length} завершённых интервалов. Медианная разница — ${Math.round((median(cycles.map(c=>c.ratio))-1)*100)}%. Это связь по времени, не объяснение причин.`,suggestion:'Попробуйте выделить резерв в день зарплаты, оставив отдельную сумму на запланированные покупки.',evidence:evidence(cycles.length,'интервалов между зарплатами',cycles[0].start,cycles.at(-1).end)});
    }
    const lastSalary=salaries.at(-1);let currentScenario=null;
    if(lastSalary&&cycles.length>=3&&repeated.length/cycles.length>=.7){
      const elapsed=M.ordinal(today)-M.ordinal(lastSalary.date)+1,current=within(variable,lastSalary.date,today);
      if(elapsed>=2&&elapsed<=5&&days(current)>=2){
        const historical=cycles.map(c=>total(within(variable,c.start,M.shift(c.start,elapsed-1))));const usual=median(historical);
        if(usual>0&&total(current)>=usual*.85)currentScenario={days:elapsed,spent:total(current),typical:usual,income:lastSalary.amount,share:Math.round(total(current)/lastSalary.amount*100),dailyRate:M.money(total(current)/elapsed),evidence:evidence(cycles.length,'сравнимых зарплатных интервалов',cycles[0].start,today)};
      }
    }
    const smallThreshold=Math.min(500,Math.max(100,(median(variable.map(t=>t.amount))||200)*.5));
    const ends=[];
    for(const month of eligible){
      const startLast=M.shift(month.end,-6),first=month.exp.filter(t=>t.date<startLast&&!M.isBill(t)),last=month.exp.filter(t=>t.date>=startLast&&!M.isBill(t));
      if(days(first)<8||days(last)<3)continue;
      const a=first.filter(t=>t.amount<=smallThreshold).length/days(first),b=last.filter(t=>t.amount<=smallThreshold).length/days(last);
      if(a>0)ends.push({...month,ratio:b/a});
    }
    if(ends.length>=3&&ends.filter(m=>m.ratio>=1.25).length/ends.length>=.7)insights.push({id:'month-end',title:'В конце месяца чаще встречаются небольшие покупки',text:`Покупки до ${M.money(smallThreshold)} ₽ на день с записями учащались минимум на 25% в ${ends.filter(m=>m.ratio>=1.25).length} из ${ends.length} сопоставимых месяцев.`,suggestion:'Посмотрите, какие из этих покупок действительно хочется сохранить. Небольшая сумма сама по себе не означает лишнюю трату.',evidence:evidence(ends.length,'полных месяцев',ends[0].start,ends.at(-1).end)});
    const delivery=variable.filter(t=>/доставк|delivery|самокат|яндекс\s*еда|delivery\s*club/i.test(t.merchant||''));
    const deliveryWeeks=new Set(delivery.map(t=>M.shift(t.date,-((new Date(t.date+'T00:00:00Z').getUTCDay()+6)%7))));
    if(delivery.length>=6&&deliveryWeeks.size>=4&&span>=42)insights.push({id:'delivery',title:'Доставка регулярно встречается в записях',text:`${delivery.length} операций в ${deliveryWeeks.size} разных неделях на ${total(delivery)} ₽. По журналу нельзя узнать, планировали ли вы сокращать доставку.`,suggestion:'Если это актуально, можно выбрать посильный лимит или оставить всё как есть.',evidence:evidence(deliveryWeeks.size,'недель с доставкой',delivery[0].date,delivery.at(-1).date)});
    // An unusual amount is not evidence of impulsivity. Compare only prior history.
    const unusual=[];let comparable=0;
    for(const tx of within(variable,M.shift(today,-29),today)){
      if(!tx.id||planned[tx.id])continue;
      const previous=within(variable,M.shift(tx.date,-90),M.shift(tx.date,-1)).filter(t=>t.category===tx.category);
      if(previous.length<12||days(previous)<8)continue;
      comparable++;
      const base=median(previous.map(t=>t.amount)),mad=median(previous.map(t=>Math.abs(t.amount-base)));
      if(tx.amount>=Math.max(1000,base*3,base+3*mad))unusual.push({id:tx.id,date:tx.date,merchant:tx.merchant||'Покупка',amount:tx.amount,baseline:base,multiple:tx.amount/base,count:previous.length,from:previous[0].date,category:tx.category||'other'});
    }
    unusual.sort((a,b)=>b.multiple-a.multiple);
    const regularMonths=eligible.filter(m=>m.income>0),dailyMeans=eligible.map(m=>m.expenses/m.activeDays),relativeSpread=dailyMeans.length>=3?Math.round((Math.max(...dailyMeans)-Math.min(...dailyMeans))/median(dailyMeans)*100):null;
    // Savings history is separately observed, never reconstructed from goal.saved.
    const events=(Array.isArray(savingsEvents)?savingsEvents:[]).filter(e=>e&&M.ordinal(e.date)!==null&&e.date>=from&&e.date<=today&&Number.isFinite(e.delta)&&e.delta!==0&&Math.abs(e.delta)<=1e12);
    const savingMonths=M.ordinal(observedSince)!==null?monthsIn(observedSince>from?observedSince:from,today).map(m=>({...m,net:M.sum(events.filter(e=>e.date>=m.start&&e.date<=m.end),e=>e.delta),deposits:events.filter(e=>e.date>=m.start&&e.date<=m.end&&e.delta>0).length})):[];
    const savingReference=savingMonths.length>=3?Math.max(0,quantile(savingMonths.map(m=>m.net),.25)):null;
    const flowReference=regularMonths.length>=3?Math.max(0,quantile(regularMonths.map(m=>m.net),.25)*.5):null;
    const candidate=savingReference!==null?savingReference:flowReference;
    const monthlyReference=candidate!==null&&M.money(candidate)>=.01?M.money(candidate):null;
    const visible=insights.filter(i=>!feedback[i.id]?.dismissedUntil||feedback[i.id].dismissedUntil<today).sort((a,b)=>Number(!!feedback[b.id]?.useful)-Number(!!feedback[a.id]?.useful));
    return {from:earliest,to:today,span,records:valid.length,expenseCount:variable.length,activeDays:days(variable),completeMonths:eligible.length,insights:visible,hiddenCount:insights.length-visible.length,unusual:unusual.slice(0,3),unusualCount:unusual.length,currentScenario:feedback.payday?.dismissedUntil>=today?null:currentScenario,
      profile:{unusual:comparable&&variable.length>=30&&span>=42?{...previousLabel(unusual.length,variable.length,span),comparable,from:M.shift(today,-29),to:today}:null,spending:relativeSpread===null?null:{spread:relativeSpread,months:eligible.length,from:eligible[0].start,to:eligible.at(-1).end},saving:savingMonths.length>=3?{from:savingMonths[0].start,to:savingMonths.at(-1).end,months:savingMonths.length,positive:savingMonths.filter(m=>m.net>0).length,deposits:events.filter(e=>e.delta>0).length}:null},
      planningReason:monthlyReference===null&&(savingReference!==null||flowReference!==null)?'nonpositive':'insufficient',
      planning:monthlyReference===null?null:{monthly:monthlyReference,basis:savingReference>0?'saving':'cashflow',months:savingReference>0?savingMonths.length:regularMonths.length,from:savingReference>0?savingMonths[0].start:regularMonths[0].start,to:savingReference>0?savingMonths.at(-1).end:regularMonths.at(-1).end},
      caveat:'Анализируются только доступные здесь записи за 183 дня. Пропуски и неполная синхронизация могут менять выводы. Психологические причины по суммам не определяются.'};
  }
  function previousLabel(count,n,span){return n>=30&&span>=42?{count,records:n}:null;}
  return {analyze,median,quantile};
});
