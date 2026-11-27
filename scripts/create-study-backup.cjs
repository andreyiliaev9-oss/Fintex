/* Synthetic, credential-free research data. No application storage or network access. */
const B=require('../backup-model.js'),M=require('../finance-math.js'),crypto=require('node:crypto');
function createStudyBackup(date){
 if(typeof date!=='string'||M.ordinal(date)===null)throw Error('Укажите реальную дату YYYY-MM-DD.');
 const tx=(id,days,type,amount,merchant,category)=>({id,date:M.shift(date,-days),type,amount,merchant,category,source:'Учебные данные',items:[]});
 const file={format:'FintexBackup',version:1,createdAt:date+'T09:00:00.000Z',currency:'RUB',cloudOwner:null,data:{
  name:'Учебный профиль — не реальные деньги',bank:'Тестовый банк',balance:8750.25,payday:M.shift(date,10),
  goal:{title:'Учебный резерв',target:50000,saved:1000,pockets:[{id:'study-trip',title:'Учебная поездка',target:10000,saved:250}]},
  catLimits:{},transactions:[tx('study-coffee',1,'expense',249.75,'Учебная кофейня','cafe'),tx('study-groceries',2,'expense',1500,'Учебные продукты','food'),tx('study-taxi',3,'expense',500,'Учебное такси','taxi'),tx('study-income',4,'income',10000,'Учебный доход','other')],
  bills:[{id:'study-bill',title:'Учебный интернет',amount:750,due_date:M.shift(date,4),is_paid:false}],ledgerOffset:0,localDeletedIds:[],priceHistory:{},captureArchive:[],behavior:{},workTime:null
 }};
 B.validateData(file.data,date);file.sha256=crypto.createHash('sha256').update(B.payload(file)).digest('hex');return file;
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),date=args[args.indexOf('--date')+1],output=args[args.indexOf('--output')+1];
  if(!args.includes('--date')||!args.includes('--output')||!output)throw Error('Использование: node scripts/create-study-backup.cjs --date YYYY-MM-DD --output .cache/study-backup.json');
  const fs=require('node:fs'),path=require('node:path'),file=createStudyBackup(date);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(file,null,2)+'\n');console.log('Создана синтетическая копия: '+output+' (не импортируется автоматически)');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={createStudyBackup};
