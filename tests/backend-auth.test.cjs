const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const SECRET='ab'.repeat(32),BOT='123456:example-server-only-bot-token',UID='8141670312';
function fixture(){
  let now=Date.UTC(2026,10,24,12),deliver=true;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const sheets=new Map(),props=new Map([['FINTEX_BOT_TOKEN',BOT],['FINTEX_AUTH_SECRET',SECRET],['FINTEX_SS_ID','test-db']]),messages=[];
  function sheet(){
    const data=[];
    return {data,appendRow(row){data.push([...row]);},setFrozenRows(){},getLastRow(){return data.length;},getDataRange(){return {getValues:()=>data.map(r=>[...r])};},getRange(row,col,rows=1,cols=1){return {setValue(value){while(data.length<row)data.push([]);data[row-1][col-1]=value;},setValues(values){for(let i=0;i<rows;i++){while(data.length<row+i)data.push([]);for(let j=0;j<cols;j++)data[row+i-1][col+j-1]=values[i][j];}}};}};
  }
  const ss={getSheetByName:name=>sheets.get(name)||null,insertSheet(name){const s=sheet();sheets.set(name,s);return s;}};
  const buffer=value=>typeof value==='string'?Buffer.from(value):Buffer.from(value.map?Array.from(value,x=>(x+256)%256):value);
  const signed=buf=>Array.from(buf,x=>x>127?x-256:x);
  let held=false;
  const ctx={Date:Clock,console,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null,setProperty:(key,value)=>props.set(key,value)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss},Session:{getScriptTimeZone:()=> 'UTC'},
    LockService:{getScriptLock:()=>({tryLock(){held=true;return true;},waitLock(){held=true;},hasLock:()=>held,releaseLock(){held=false;}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},
      newBlob:value=>({getBytes:()=>signed(buffer(value)),getDataAsString:()=>buffer(value).toString('utf8')}),
      computeHmacSha256Signature:(value,key)=>signed(crypto.createHmac('sha256',buffer(key)).update(buffer(value)).digest()),
      computeDigest:(alg,value)=>signed(crypto.createHash('sha256').update(buffer(value)).digest()),
      base64EncodeWebSafe:value=>buffer(value).toString('base64url'),base64DecodeWebSafe:value=>signed(Buffer.from(value,'base64url')),
      formatDate(date,tz,format){const iso=new Date(date).toISOString();return format==='HH:mm'?iso.slice(11,16):iso.slice(0,10);}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
    UrlFetchApp:{fetch(url,options){assert.match(url,/^https:\/\/api.telegram.org\/bot/);assert.equal(held,true);messages.push(JSON.parse(options.payload));return {getResponseCode:()=>deliver?200:403,getContentText:()=>JSON.stringify({ok:deliver})};}}
  };
  vm.createContext(ctx);for(const file of ['backend/Code.gs','backend/Auth.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  function initData(uid=UID,more={}){
    const fields={auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:Number(uid),first_name:'Тест'}),...more};
    const check=Object.keys(fields).sort().map(k=>k+'='+fields[k]).join('\n');
    const secret=crypto.createHmac('sha256','WebAppData').update(BOT).digest();
    fields.hash=crypto.createHmac('sha256',secret).update(check).digest('hex');return new URLSearchParams(fields).toString();
  }
  function post(body){const result=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(body)}}));assert.equal(held,false);return result;}
  function auth(action,fields={}){return post({action,init_data:initData(),...fields});}
  function setup(){const result=auth('init');assert.equal(result.ok,true,JSON.stringify(result));return result;}
  return {ctx,post,auth,setup,initData,sheets,props,messages,tick:ms=>{now+=ms;},failDelivery:()=>{deliver=false;}};
}

test('cloud verifies Telegram without passwords, PINs, sessions or OTP',()=>{
  const f=fixture(),s=f.setup();assert.equal(s.ok,true);assert.equal(s.uid,UID);
  assert.equal(s.session,undefined);assert.equal(s.password_set,undefined);
  assert.match(s.webhook_token,/^[a-f0-9]{64}$/);
  assert.equal(f.sheets.has('Auth'),false);
  assert.equal(f.auth('init').webhook_token,s.webhook_token);
  for(const action of ['auth_status','auth_setup','auth_login','auth_change','auth_logout','auth_reset_request','auth_reset'])assert.equal(f.auth(action).code,'UNKNOWN_ACTION');
});
test('UID-only, old password sessions, forged, stale and account-mismatched requests cannot read or write',()=>{
  const f=fixture();f.setup();
  for(const init_data of ['',f.initData().replace('hash=','hash=00'),f.initData()+'&auth_date=1',f.initData(UID,{auth_date:'1'})])assert.equal(f.post({action:'init',init_data}).ok,false);
  assert.equal(f.post({action:'init',user_id:UID,session:'old-session'}).ok,false);
  assert.equal(f.auth('init',{user_id:'999'}).code,'TELEGRAM_INVALID');
  const other=f.post({action:'init',init_data:f.initData('999')});assert.equal(other.uid,'999');assert.equal(other.transactions.length,0);
  assert.equal(f.post({action:'init',user_id:UID,token:f.setup().webhook_token}).ok,false);
});
test('existing ingestion keys survive password removal and cannot authorize reads',()=>{
  const f=fixture(),s=f.setup(),token='x'.repeat(64);
  assert.equal(f.auth('set_config',{api_token:token}).ok,true);
  assert.equal(f.auth('init').webhook_token,token);
  assert.equal(f.post({action:'init',user_id:UID,token}).ok,false);
  assert.equal(f.auth('set_config',{api_token:'short'}).code,'INVALID_TOKEN');
});
test('webhook preserves kopecks and negative balance, uses full digest and never authorizes data reads',()=>{
  const f=fixture(),s=f.setup();
  const get=text=>JSON.parse(f.ctx.doGet({parameter:{uid:UID,token:s.webhook_token,text}}));
  const first=get('Покупка 100,25 RUB Кофе 12:01');assert.equal(first.ok,true);assert.equal(first.transaction.amount,100.25);
  const second=get('Покупка 200,50 RUB Такси 12:02');assert.equal(second.ok,true);assert.notEqual(first.transaction.dedup_hash,second.transaction.dedup_hash);
  assert.equal(get('Покупка 100,25 RUB Кофе 12:01').duplicate,true);assert.equal(f.auth('init').user.balance,-300.75);
  const invalid=JSON.parse(f.ctx.doGet({parameter:{uid:UID,token:'',text:'Покупка 100 RUB'}}));assert.equal(invalid.code,'INVALID_TOKEN');
});
test('push rejects invalid batches atomically before writes, locks operations and acknowledges retries without extra rows',()=>{
  const f=fixture(),s=f.setup(),tx={id:'tx_test',date:'2026-11-24',merchant:'=IMPORTXML("bad")',amount:.25,type:'expense'};
  const push=transactions=>f.auth('push_tx',{balance:-.25,transactions});
  assert.equal(push([tx,{...tx,id:'tx_bad',amount:Infinity}]).code,'INVALID_TRANSACTIONS');assert.equal(f.sheets.get('Transactions').data.length,1);
  assert.equal(push([tx,tx]).ok,true);assert.equal(f.sheets.get('Transactions').data.length,2);assert.ok(f.sheets.get('Transactions').data[1][4].startsWith("'="));
  assert.equal(push([tx]).ok,true);assert.equal(f.sheets.get('Transactions').data.length,2);
});

test('phone setup creates a private 64-hex secret without replacing an existing one',()=>{
  const f=fixture();f.ctx.console={log:()=>{}};
  f.props.delete('FINTEX_AUTH_SECRET');
  f.props.set('FINTEX_BOT_TOKEN','123456:'+ 'x'.repeat(35));
  f.ctx.createFintexSecret();const secret=f.props.get('FINTEX_AUTH_SECRET');
  assert.match(secret,/^[a-f0-9]{64}$/);
  f.ctx.createFintexSecret();assert.equal(f.props.get('FINTEX_AUTH_SECRET'),secret);
  f.props.delete('FINTEX_AUTH_SECRET');f.props.set('FINTEX_BOT_TOKEN','wrong');
  assert.throws(()=>f.ctx.createFintexSecret());assert.equal(f.props.has('FINTEX_AUTH_SECRET'),false);
});
