const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../market-engine.js');

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
    assert.ok(item.query.length<=480,`Firecrawl query must be <= 480 chars, got ${item.query.length}`);
    assert.match(item.query,/Latvija/);
    assert.match(item.query,/Korporatīvās pārdošanas apmācības/);
    assert.match(item.query,/ziņas|paziņojums|paplašināšana/);
  }
});
