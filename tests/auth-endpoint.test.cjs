const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const base='https://script.google.com/macros/s/';
const current=base+'AKfycbyzfhzExalPbmThOsQ24Sq3-qOq_7aLSPQ69dShDbRawnawVIyR5L3hLlN1PSkCHFIM/exec';
const retired=[
 'AKfycbxXANSbGhKg-owDC4NFctMJ0mUW5H9XuXwXTohc0n0',
 'AKfycby5QwCkVgVNt8tzrm7_BTw24Ogl05pZHcSNOE6u6LpXxf6iw5oedtJSnGgsvmV0c9-3',
 'AKfycbw2Q0L7sKq0QrOQtffRS3oRpq22nrWZ8b9ErM8aWSuF4I9qMLz4f_N7mVu_F6m8-6j6',
 'AKfycbz_gCZDuLK2Ghkoapf_arMFYu63_9VK7wC8GZUoYn-J3WPqmg7TFRvfKgjJ9KqNXq3F'
];
function fixture(value){
 const stored=new Map([['fp_balance','123.45'],['fp_local_tx','[{"id":"unchanged"}]']]);
 if(value!==undefined)stored.set('fp_api_url',value);
 const ctx={window:{},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},document:{documentElement:{dataset:{}},readyState:'loading',addEventListener(){}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('cloud.js','utf8'),ctx);
 return {api:ctx.window.FintexCloud,stored};
}
test('the app defaults to the owners new /exec deployment, never the library URL',()=>{
 const f=fixture();assert.equal(f.api.defaultEndpoint,current);assert.equal(f.api.getEndpoint(),current);assert.equal(f.stored.has('fp_api_url'),false);
});
test('known retired saved URLs migrate without modifying financial data and remain stable',()=>{
 for(const id of retired)for(const suffix of ['/exec','/dev']){
  const f=fixture(' '+base+id+suffix+' ');assert.equal(f.api.getEndpoint(),current);assert.equal(f.stored.get('fp_api_url'),current);assert.equal(f.api.getEndpoint(),current);
  assert.equal(f.stored.get('fp_balance'),'123.45');assert.equal(f.stored.get('fp_local_tx'),'[{"id":"unchanged"}]');
 }
});
test('a custom server is preserved and uses the same endpoint resolver as sync',()=>{
 const custom=base+'custom-user-owned-deployment/exec',f=fixture(custom);assert.equal(f.api.getEndpoint(),custom);assert.equal(f.stored.get('fp_api_url'),custom);
 const app=fs.readFileSync('app.js','utf8');assert.match(app,/gasUrl: window\.FintexCloud\.getEndpoint\(\)/);
});
