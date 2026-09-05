const test=require('node:test');
const assert=require('node:assert/strict');
const language=require('../content-language.js');
test('translation validates all fields and rejects missing or extra output',()=>{
  const source={f0:'Laboratory testing',f1:'24 months'};
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes'}));
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'24 mēneši',x:'extra'}));
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'12 mēneši'}));
  assert.deepEqual(language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'24 mēneši'}),{f0:'Laboratorijas pārbaudes',f1:'24 mēneši'});
});
test('workspace and language isolate translation cache entries',()=>{
  assert.notEqual(language.cacheKey('one','lv',{f0:'Testing'}),language.cacheKey('two','lv',{f0:'Testing'}));
  assert.notEqual(language.cacheKey('one','en',{f0:'Testing'}),language.cacheKey('one','lv',{f0:'Testing'}));
});
test('translation prompt preserves facts and treats embedded instructions as data',()=>{
  const p=language.promptFor({f0:'Our approach is laboratory testing only'},'lv');
  assert.match(p.system,/Latvian/);
  assert.match(p.system,/Do not add/);
  assert.match(p.system,/untrusted data/);
  assert.match(p.prompt,/laboratory testing only/);
});
test('Latvian translation rejects obvious English prose left inside fields',()=>{
  assert.throws(()=>language.validate({f0:'We help companies improve sales'},{f0:'We help companies improve sales'},'lv'));
});
test('failed translations are retryable rather than cached as success',async()=>{
  let calls=0;
  const root={fetch:async()=>{calls++;return {ok: calls>1,status:calls>1?200:503,json:async()=>({text:JSON.stringify({f0:'Pārdošanas apmācības'})})};}};
  await assert.rejects(language.request(root,'retry-workspace','lv',{f0:'Sales training'}));
  const result=await language.request(root,'retry-workspace','lv',{f0:'Sales training'});
  assert.equal(result.f0,'Pārdošanas apmācības');assert.equal(calls,2);
});
