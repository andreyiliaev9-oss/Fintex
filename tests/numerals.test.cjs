const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const math=require('../finance-math.js');
const ctx={window:{FintexMath:math},Intl};vm.createContext(ctx);vm.runInContext(fs.readFileSync('numerals.js','utf8'),ctx);
const parts=ctx.window.FintexNumerals.parts;
test('figure typography preserves signed amounts, groups and kopecks without changing values',()=>{
  for(const [n,major,minor,label] of [[0,'0','','0 ₽'],[12345.67,'12 345',',67','12 345,67 ₽'],[-.01,'-0',',01','-0,01 ₽'],[12.5,'12',',5','12,5 ₽'],[999999999999.99,'999 999 999 999',',99','999 999 999 999,99 ₽']]){
    const p=parts(n);assert.equal(p.major.replace(/\u00a0/g,' '),major);assert.equal(p.minor,minor);assert.equal(p.label,label);
  }
  assert.equal(parts(10,'+').label,'+10 ₽');
});
