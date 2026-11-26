const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/gas-fixture.cjs');
const SECRET='ab'.repeat(32),BOT='123456:example-server-only-bot-token',UID='8141670312';

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
