const test=require('node:test');
const assert=require('node:assert/strict');
const language=require('../content-language.js');
test('auto language resolves from browser preference and explicit choice wins',()=>{
  assert.equal(language.resolveLanguage('auto',['lv-LV','en-US']),'lv');
  assert.equal(language.resolveLanguage('auto',['de-DE','en-US']),'en');
  assert.equal(language.resolveLanguage('en',['lv-LV']),'en');
  assert.equal(language.resolveLanguage('lv',['en-US']),'lv');
});
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

test('market content translation updates generated fields and evidence display text without changing source identity',async()=>{
  const market={
    icps:[{id:'icp-core',name:'Core ICP',description:'Factories and warehouses',targetMarkets:'Latvia',buyerRoles:'Procurement managers',offers:'Office furniture',value:'',exclusions:'',rationale:'Generated rationale'}],
    signals:[{id:'growth',name:'Factory expansion',keywords:'new factory',reason:'Buying trigger',priority:'High'}],
    opportunities:[{id:'opp-latvia',market:'Latvia',title:'Latvia: Office furniture',hypothesis:'Prioritize factories',rationale:'Fit is based on evidence',evidence:[{url:'https://example.com/a',title:'Factory expansion',description:'A new warehouse is planned',text:'Original source text'}]}]
  };
  const translated={};for(const key of Object.keys(language.marketContentSource(market)))translated[key]=`lv:${key}`;
  const next=language.applyMarketContent(market,translated,'lv');
  assert.equal(next.icps[0].name,'lv:icp.0.name');
  assert.equal(next.signals[0].reason,'lv:signal.0.reason');
  assert.equal(next.opportunities[0].market,'Latvia');
  assert.equal(next.opportunities[0].marketLabel,'lv:opportunity.0.marketLabel');
  assert.equal(next.opportunities[0].evidence[0].displayTitle,'lv:opportunity.0.evidence.0.displayTitle');
  assert.equal(next.opportunities[0].evidence[0].text,'Original source text');
  assert.equal(next.contentLanguage,'lv');
});
