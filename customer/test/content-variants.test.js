const test=require('node:test');
const assert=require('node:assert/strict');
const Variants=require('../content-variants.js');

test('content variants keep English and Latvian generated values separately',()=>{
  let variants=Variants.set({},'en',{title:'English title',body:'English body'});
  variants=Variants.set(variants,'lv',{title:'Latviešu virsraksts',body:'Latviešu teksts'});
  assert.equal(Variants.get(variants,'en').title,'English title');
  assert.equal(Variants.get(variants,'lv').title,'Latviešu virsraksts');
  assert.equal(Variants.has(variants,'lv','body'),true);
});

test('content variant updates do not mutate the previous record',()=>{
  const original={en:{body:'Original'},lv:{body:'Oriģināls'}};
  const next=Variants.set(original,'lv',{body:'Atjaunināts'});
  assert.equal(original.lv.body,'Oriģināls');
  assert.equal(next.lv.body,'Atjaunināts');
});

test('content variant language keys are limited to the supported content languages',()=>{
  assert.deepEqual(Variants.LANGUAGES,['en','lv']);
  assert.equal(Variants.language('LV'),'lv');
  assert.equal(Variants.language('de'),'en');
});
