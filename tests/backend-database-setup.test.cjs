const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({fail=false}={}){
 const props=new Map([['FINTEX_BOT_TOKEN','123456:'+'x'.repeat(35)],['FINTEX_AUTH_SECRET','ab'.repeat(32)],['FINTEX_SS_ID','old-db']]);
 const databases=new Map(),logs=[];let count=0,held=false;
 function database(id){
  const sheets=new Map();
  return {sheets,getId:()=>id,getSheetByName:name=>sheets.get(name)||null,insertSheet(name){
   if(fail&&name==='Transactions')throw Error('Sheets unavailable');
   const data=[];const sh={data,appendRow(row){data.push([...row]);},setFrozenRows(){},getDataRange(){return {getValues:()=>data.map(r=>[...r])};}};sheets.set(name,sh);return sh;
  }};
 }
 const old=database('old-db');old.sheets.set('Users',{data:[['untouched-old-header'],['private existing record']]});databases.set('old-db',old);
 const ctx={console:{log:message=>logs.push(message)},PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null,setProperties:values=>Object.entries(values).forEach(([key,value])=>props.set(key,value))})},
 SpreadsheetApp:{create(){count++;const id='new-'+count,db=database(id);databases.set(id,db);return db;},openById:id=>databases.get(id),getActiveSpreadsheet:()=>old},
 LockService:{getScriptLock:()=>({waitLock(){assert.equal(held,false);held=true;},releaseLock(){held=false;}})}};
 vm.createContext(ctx);for(const file of ['backend/Auth.gs','backend/Code.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 return {ctx,props,databases,logs,count:()=>count,held:()=>held};
}
test('explicit owner setup creates schema, switches the pointer and preserves the old database and secrets',()=>{
 const f=fixture(),old=JSON.stringify(f.databases.get('old-db').sheets.get('Users').data),secret=f.props.get('FINTEX_AUTH_SECRET');
 f.ctx.createFintexDatabase();assert.equal(f.props.get('FINTEX_SS_ID'),'new-1');assert.equal(f.props.get('FINTEX_PREVIOUS_SS_ID'),'old-db');assert.equal(f.props.get('FINTEX_AUTH_SECRET'),secret);
 const db=f.databases.get('new-1');assert.deepEqual([...db.sheets.keys()],['Users','Transactions','Logs','Auth']);assert.equal(db.sheets.get('Users').data[0].join(','),'user_id,name,bank,balance,payday,api_token,updated_at');
 assert.equal(JSON.stringify(f.databases.get('old-db').sheets.get('Users').data),old);assert.equal(f.held(),false);assert.equal(f.logs.some(s=>s.includes(secret)),false);
});
test('repeating setup is idempotent and never replaces a populated new database',()=>{
 const f=fixture();f.ctx.createFintexDatabase();f.databases.get('new-1').sheets.get('Users').appendRow(['123','Name']);
 f.ctx.createFintexDatabase();assert.equal(f.count(),1);assert.equal(f.databases.get('new-1').sheets.get('Users').data.length,2);assert.equal(f.held(),false);
});
test('a schema initialization failure leaves the original database connected',()=>{
 const f=fixture({fail:true});assert.throws(()=>f.ctx.createFintexDatabase(),/Sheets unavailable/);assert.equal(f.props.get('FINTEX_SS_ID'),'old-db');assert.equal(f.props.has('FINTEX_CREATED_DB_ID'),false);assert.equal(f.held(),false);
});
test('missing auth configuration or a manually changed database pointer prevents an automatic switch',()=>{
 const f=fixture();f.props.delete('FINTEX_AUTH_SECRET');assert.throws(()=>f.ctx.createFintexDatabase());assert.equal(f.count(),0);assert.equal(f.held(),false);
 const g=fixture();g.ctx.createFintexDatabase();g.props.set('FINTEX_SS_ID','old-db');assert.throws(()=>g.ctx.createFintexDatabase());assert.equal(g.count(),1);assert.equal(g.props.get('FINTEX_SS_ID'),'old-db');assert.equal(g.held(),false);
});
