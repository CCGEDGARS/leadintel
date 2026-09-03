const test=require('node:test');
const assert=require('node:assert/strict');
const LeadIntelMarket=require('../market-engine.js');

test('old market state loads with safe deep-research defaults',()=>{
  const state=LeadIntelMarket.normalizeMarketState({researchStatus:'complete',researchResults:[]});
  assert.equal(state.researchMode,'quick');
  assert.equal(state.researchRunId,'');
  assert.deepEqual(state.researchProgress,{pass:0,maxPasses:0,stage:'idle',message:''});
});

test('primary corroborated evidence scores higher than one weak source',()=>{
  const strong=[
    {url:'https://www.gov.lv/tender/1',sourceQuality:4,corroborationCount:2,date:new Date().toISOString()},
    {url:'https://company.lv/news/expansion',sourceQuality:4,corroborationCount:2,date:new Date().toISOString()}
  ];
  const weak=[{url:'https://directory.example/a',sourceQuality:1,corroborationCount:1,date:''}];
  assert.equal(typeof LeadIntelMarket.scoreEvidenceQuality,'function');
  assert.ok(LeadIntelMarket.scoreEvidenceQuality(strong)>LeadIntelMarket.scoreEvidenceQuality(weak));
});
