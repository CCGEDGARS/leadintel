const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../market-engine.js');
const querySafety=require('../market-query-safety.js');

querySafety.install(market);

test('market research queries stay within Firecrawl search length while preserving core commercial intent',()=>{
  const longFocus='MI integrācija pārdošanā un mārketingā personalizēti GPT asistenti un MI darbinātas pārdošanas rokasgrāmatas '.repeat(8);
  const longCustomer='B2B uzņēmumi biznesa īpašnieki un korporatīvās pārdošanas komandas kas vēlas uzlabot pārdošanas rādītājus '.repeat(8);
  const longSignal='jauna MI tehnoloģiju ieviešanas iniciatīva pārdošanas komandas transformācija vadības prioritāte '.repeat(8);
  const profile={
    targetMarkets:'Latvija',
    priorityOffers:'Korporatīvās pārdošanas apmācības, biznesa koučings un mentorings, pielāgota MI integrācija',
    marketFocus:longFocus,
    idealCustomer:longCustomer,
    buyingTriggers:longSignal
  };
  const signals=[{id:'signal-ai',name:'AI adoption',active:true,weight:10,keywords:longSignal}];
  const queries=market.buildResearchQueries(profile,signals,{mode:'quick',sourceTypes:['news'],language:'lv',instructions:longFocus});
  assert.ok(queries.length>0);
  for(const item of queries){
    assert.ok(item.query.length<=querySafety.FIRECRAWL_QUERY_MAX_CHARS,`Firecrawl query must be <= ${querySafety.FIRECRAWL_QUERY_MAX_CHARS} chars, got ${item.query.length}`);
    assert.match(item.query,/Latvija/);
    assert.match(item.query,/Korporatīvās pārdošanas apmācības/);
    assert.match(item.query,/ziņas|paziņojums|paplašināšana/);
  }
});

test('query safety compacts verbose strategy context before search instead of blindly slicing the final query',()=>{
  const compact=querySafety.compactInputs({marketFocus:'A '.repeat(100),idealCustomer:'B '.repeat(100),priorityOffers:'C '.repeat(100)},[{keywords:'D '.repeat(100)}],{instructions:'E '.repeat(100)},market);
  assert.ok(compact.profile.marketFocus.length<=querySafety.FIELD_LIMITS.marketFocus);
  assert.ok(compact.profile.idealCustomer.length<=querySafety.FIELD_LIMITS.idealCustomer);
  assert.ok(compact.profile.priorityOffers.length<=querySafety.FIELD_LIMITS.offer);
  assert.ok(compact.signals[0].keywords.length<=querySafety.FIELD_LIMITS.signalKeywords);
  assert.ok(compact.input.instructions.length<=querySafety.FIELD_LIMITS.instructions);
});
