const test=require('node:test'),assert=require('node:assert/strict'),J=require('../journal-model.js');
const today='2026-11-24',rows=[
 {id:'a',type:'expense',amount:50.25,merchant:'Зелёный магазин',items:[{name:'Молоко'}],category:'food',date:today},
 {id:'b',type:'expense',amount:150.25,merchant:'Аптека',category:'health',date:'2026-11-18'},
 {id:'c',type:'income',amount:500,merchant:'Доход',date:'2026-11-17'},
 {id:'d',type:'transfer',amount:800,merchant:'Карта',date:today},
 {id:'e',type:'adjustment',amount:.25,balance_delta:-.25,merchant:'Сверка',date:today},
 {id:'future',type:'income',amount:100,merchant:'Будущее',date:'2026-11-25'},
 {id:'usd',type:'expense',amount:1,currency:'USD',date:today}
];
const project=(view={},query='',day)=>J.project(rows,{view,query,day,today});
test('search normalizes Russian text and combines words across merchant and receipt without mutation',()=>{const copy=JSON.stringify(rows);assert.equal(J.matches(rows[0],'МАГАЗИН зеленый МОЛОКО'),true);assert.equal(J.matches(rows[0],'аптека'),false);assert.equal(JSON.stringify(rows),copy);});
test('numeric searches are exact kopeck amounts, never a substring of a larger debit',()=>{for(const q of ['50,25','50.25 ₽','50,25 руб.']){assert.equal(J.matches(rows[0],q),true);assert.equal(J.matches(rows[1],q),false);}assert.equal(J.matches(rows[0],'50'),false);});
test('seven-day and month scopes include both boundaries and exclude future records',()=>{assert.deepEqual(project({period:'7d'}).rows.map(t=>t.id).sort(),['a','b','d','e']);assert.equal(project({period:'month'}).rows.length,5);assert.deepEqual(project({period:'custom',from:'2026-11-17',to:'2026-11-18'}).rows.map(t=>t.id),['b','c']);});
test('calendar context replaces rather than intersects a stale journal view',()=>{const r=project({type:'income',period:'today'},'',{date:'2026-11-18',type:'expense'});assert.deepEqual(r.rows.map(t=>t.id),['b']);assert.equal(r.view.from,'2026-11-18');});
test('income and expense totals cover all matches, never include neutral movements or foreign currency',()=>{const before=JSON.stringify(rows),r=project({period:'month'});assert.equal(r.income,500);assert.equal(r.expense,200.5);assert.equal(r.neutral,2);assert.deepEqual(project({type:'expense',category:'health'}).rows.map(t=>t.id),['b']);assert.equal(JSON.stringify(rows),before);});
test('custom dates are explicit and validated before changing any applied filter',()=>{for(const v of [{from:'',to:''},{from:'2026-02-30',to:today},{from:today,to:'2026-11-18'},{from:today,to:'2026-11-25'}])assert.ok(J.validate({period:'custom',...v},today).error);assert.ok(J.validate({period:'custom',from:today,to:today},today).value);assert.equal(J.validate({type:'income',category:'food'},today).value.category,'all');});
