const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const SECRET='ab'.repeat(32),BOT='123456:example-server-only-bot-token',UID='8141670312';
const PASSWORD='Лесной пароль 2026';
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
  const ctx={Date:Clock,console,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss},Session:{getScriptTimeZone:()=> 'UTC'},
    LockService:{getScriptLock:()=>({tryLock(){held=true;return true;},hasLock:()=>held,releaseLock(){held=false;}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},
      newBlob:value=>({getBytes:()=>signed(buffer(value)),getDataAsString:()=>buffer(value).toString('utf8')}),
      computeHmacSha256Signature:(value,key)=>signed(crypto.createHmac('sha256',buffer(key)).update(buffer(value)).digest()),
      computeDigest:(alg,value)=>signed(crypto.createHash('sha256').update(buffer(value)).digest()),
      base64EncodeWebSafe:value=>buffer(value).toString('base64url'),base64DecodeWebSafe:value=>signed(Buffer.from(value,'base64url')),
      formatDate(date,tz,format){const iso=new Date(date).toISOString();return format==='HH:mm'?iso.slice(11,16):iso.slice(0,10);}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
    UrlFetchApp:{fetch(url,options){assert.match(url,/^https:\/\/api.telegram.org\/bot/);assert.equal(held,true);messages.push(JSON.parse(options.payload));return {getResponseCode:()=>deliver?200:403,getContentText:()=>JSON.stringify({ok:deliver})};}}
  };
  vm.createContext(ctx);for(const file of ['backend/PasswordKdf.gs','backend/Code.gs','backend/Auth.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  // Most behavioural tests use Node's implementation at the SAME production cost.
  // A separate test runs the generated GAS KDF against this reference.
  const gasKdf=ctx.FintexKdf;
  ctx.FintexKdf={derive:(p,s)=>crypto.pbkdf2Sync(Buffer.from(p,'hex'),Buffer.from(s,'hex'),600000,32,'sha256').toString('hex')};
  function initData(uid=UID,more={}){
    const fields={auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:Number(uid),first_name:'Тест'}),...more};
    const check=Object.keys(fields).sort().map(k=>k+'='+fields[k]).join('\n');
    const secret=crypto.createHmac('sha256','WebAppData').update(BOT).digest();
    fields.hash=crypto.createHmac('sha256',secret).update(check).digest('hex');return new URLSearchParams(fields).toString();
  }
  function post(body){const result=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(body)}}));assert.equal(held,false);return result;}
  function auth(action,fields={}){return post({action,init_data:initData(),...fields});}
  function setup(){const result=auth('auth_setup',{password:PASSWORD});assert.equal(result.ok,true,JSON.stringify(result));return result;}
  return {ctx,gasKdf,post,auth,setup,initData,sheets,props,messages,tick:ms=>{now+=ms;},failDelivery:()=>{deliver=false;}};
}

test('generated GAS PBKDF2 matches independent Node crypto at 600,000 rounds with Unicode password',()=>{
  const f=fixture(),salt='ef'.repeat(16),p=Buffer.from(PASSWORD).toString('hex');
  const actual=f.gasKdf.derive(p,salt),expected=crypto.pbkdf2Sync(Buffer.from(PASSWORD),Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex');assert.equal(actual,expected);
});
test('Telegram HMAC, freshness, duplicate fields and UID binding are mandatory; configuration fails closed',()=>{
  const f=fixture();assert.equal(f.auth('auth_status').password_set,false);
  for(const data of ['',f.initData().replace('hash=','hash=00'),f.initData()+'&auth_date=1',f.initData(UID,{auth_date:'1'})])assert.equal(f.post({action:'auth_status',init_data:data}).ok,false);
  assert.equal(f.auth('auth_setup',{user_id:'999',password:PASSWORD}).ok,false);
  assert.equal(f.post({action:'init',user_id:UID,token:'legacy'}).code,'AUTH_REQUIRED');
  f.props.delete('FINTEX_AUTH_SECRET');assert.equal(f.auth('auth_status').code,'AUTH_NOT_CONFIGURED');
});
test('setup is single-use; passwords are not stored; API requires expiring, untampered password sessions',()=>{
  const f=fixture(),s=f.setup();assert.equal(f.auth('auth_setup',{password:'another-password'}).code,'PASSWORD_EXISTS');
  const persisted=JSON.stringify([...f.sheets.values()].map(s=>s.data));assert.ok(!persisted.includes(PASSWORD));assert.ok(!persisted.includes(s.session));
  assert.equal(f.post({action:'init',session:s.session,user_id:UID}).ok,true);
  assert.equal(f.post({action:'init',session:s.session,user_id:'999'}).code,'AUTH_REQUIRED');
  assert.equal(f.post({action:'init',session:s.session+'bad'}).code,'AUTH_REQUIRED');
  assert.equal(f.post({action:'init',user_id:UID,token:s.webhook_token}).code,'AUTH_REQUIRED');
  f.tick(1800001);assert.equal(f.post({action:'init',session:s.session}).code,'AUTH_REQUIRED');
});
test('password retries are limited, the block expires, and a correct password creates a session',()=>{
  const f=fixture();f.setup();for(let i=0;i<5;i++)assert.equal(f.auth('auth_login',{password:'not the password'}).code,'WRONG_PASSWORD');
  assert.equal(f.auth('auth_login',{password:PASSWORD}).code,'RATE_LIMIT');f.tick(900001);assert.equal(f.auth('auth_login',{password:PASSWORD}).ok,true);
});
test('reset is bound to verified Telegram, delivered only to its chat, hashed, rate limited and single-use',()=>{
  const f=fixture(),old=f.setup();assert.equal(f.auth('auth_reset_request').ok,true);
  const message=f.messages[0];assert.equal(message.chat_id,UID);const code=message.text.match(/\b\d{6}\b/)[0];
  assert.ok(!JSON.stringify(f.sheets.get('Auth').data).includes(code));assert.equal(f.auth('auth_reset_request').code,'RATE_LIMIT');
  assert.equal(f.auth('auth_reset',{code:'bad',new_password:'a new secure password'}).code,'WRONG_CODE');
  const next=f.auth('auth_reset',{code,new_password:'a new secure password'});assert.equal(next.ok,true);
  assert.equal(f.auth('auth_reset',{code,new_password:'reuse code password'}).code,'CODE_EXPIRED');
  assert.equal(f.post({action:'init',session:old.session}).code,'AUTH_REQUIRED');assert.notEqual(next.webhook_token,old.webhook_token);
  assert.equal(f.auth('auth_login',{password:PASSWORD}).code,'WRONG_PASSWORD');assert.equal(f.auth('auth_login',{password:'a new secure password'}).ok,true);
});
test('reset codes expire and exhaust five attempts; failed delivery cannot leave an active code',()=>{
  const f=fixture();f.setup();f.auth('auth_reset_request');const code=f.messages[0].text.match(/\b\d{6}\b/)[0];
  for(let i=0;i<5;i++)assert.equal(f.auth('auth_reset',{code:'abcdef',new_password:'new secure password'}).code,'WRONG_CODE');
  assert.equal(f.auth('auth_reset',{code,new_password:'new secure password'}).code,'CODE_EXPIRED');
  f.tick(60001);f.auth('auth_reset_request');f.tick(600001);assert.equal(f.auth('auth_reset',{code,new_password:'new secure password'}).code,'CODE_EXPIRED');
  f.failDelivery();assert.equal(f.auth('auth_reset_request').code,'DELIVERY_FAILED');assert.equal(f.sheets.get('Auth').data[1][6],'');
  f.tick(60001);assert.equal(f.auth('auth_reset_request').code,'RATE_LIMIT');
});
test('password change verifies the old password and revokes existing sessions; logout revokes all devices',()=>{
  const f=fixture(),s=f.setup();assert.equal(f.post({action:'auth_change',session:s.session,password:'wrong',new_password:'a changed password'}).code,'WRONG_PASSWORD');
  const changed=f.post({action:'auth_change',session:s.session,password:PASSWORD,new_password:'a changed password'});assert.equal(changed.ok,true);
  assert.equal(f.post({action:'init',session:s.session}).code,'AUTH_REQUIRED');assert.equal(f.post({action:'init',session:changed.session}).ok,true);
  assert.equal(f.post({action:'auth_logout',session:changed.session}).ok,true);assert.equal(f.post({action:'init',session:changed.session}).code,'AUTH_REQUIRED');
});
test('webhook preserves kopecks and negative balance, uses full digest and never authorizes data reads',()=>{
  const f=fixture(),s=f.setup();
  const get=text=>JSON.parse(f.ctx.doGet({parameter:{uid:UID,token:s.webhook_token,text}}));
  const first=get('Покупка 100,25 RUB Кофе 12:01');assert.equal(first.ok,true);assert.equal(first.transaction.amount,100.25);
  const second=get('Покупка 200,50 RUB Такси 12:02');assert.equal(second.ok,true);assert.notEqual(first.transaction.dedup_hash,second.transaction.dedup_hash);
  assert.equal(get('Покупка 100,25 RUB Кофе 12:01').duplicate,true);assert.equal(f.post({action:'init',session:s.session}).user.balance,-300.75);
  const invalid=JSON.parse(f.ctx.doGet({parameter:{uid:UID,token:'',text:'Покупка 100 RUB'}}));assert.equal(invalid.code,'INVALID_TOKEN');
});
test('push rejects invalid batches atomically before writes, locks operations and acknowledges retries without extra rows',()=>{
  const f=fixture(),s=f.setup(),tx={id:'tx_test',date:'2026-11-24',merchant:'=IMPORTXML("bad")',amount:.25,type:'expense'};
  const push=transactions=>f.post({action:'push_tx',session:s.session,balance:-.25,transactions});
  assert.equal(push([tx,{...tx,id:'tx_bad',amount:Infinity}]).code,'INVALID_TRANSACTIONS');assert.equal(f.sheets.get('Transactions').data.length,1);
  assert.equal(push([tx,tx]).ok,true);assert.equal(f.sheets.get('Transactions').data.length,2);assert.ok(f.sheets.get('Transactions').data[1][4].startsWith("'="));
  assert.equal(push([tx]).ok,true);assert.equal(f.sheets.get('Transactions').data.length,2);
});
