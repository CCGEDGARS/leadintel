const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../market-engine.js');
const Attention=require('../attention-centre-model.js');

test('Claude research receipts and source provenance survive serialization without inventing OpenAI work',()=>{
 const rows=market.normalizeSearchResults({results:[{url:'https://factory.example/news',description:'AI summary',evidenceKind:'model_summary'}]},{market:'Sweden'},'anthropic');
 const saved=market.normalizeMarketState(JSON.parse(JSON.stringify({researchResults:rows,researchSourceStatus:{discovery:'complete',anthropic:'complete',openai:'idle'},researchExecution:{version:1,runId:'run-claude',status:'complete',receipts:[{provider:'anthropic',stage:'discovery',status:'complete',attempt:1,resultCount:1}]}})));
 assert.deepEqual(saved.researchResults[0].sourceProviders,['anthropic']);assert.equal(saved.researchResults[0].evidenceKind,'model_summary');
 assert.equal(saved.researchSourceStatus.anthropic,'complete');assert.equal(saved.researchSourceStatus.discovery,'complete');assert.equal(saved.researchSourceStatus.openai,'idle');
 assert.equal(saved.researchExecution.receipts[0].provider,'anthropic');
 const opportunities=market.buildMarketOpportunities({targetMarkets:'Sweden'},[],[],saved.researchResults);assert.ok(opportunities.every(o=>!o.evidence.length));
 const extracted={...rows[0],text:'Actual short source text',extractedBy:'firecrawl',extractedAt:new Date().toISOString()};
 const merged=market.mergeResearchResults(rows,[extracted],rows);assert.equal(merged[0].text,extracted.text);assert.equal(merged[0].evidenceKind,'source_excerpt');
});

test('Claude and Gemini connection status does not produce an OpenAI connection warning',()=>{
 const status={ai:{providers:[{provider:'anthropic',configured:true},{provider:'gemini',configured:true}]},services:{providers:[{provider:'firecrawl',configured:true}]}};
 assert.equal(Attention.researchProviderNotice(status),'');status.ai.providers.pop();
 assert.match(Attention.researchProviderNotice(status),/verification is off/);assert.doesNotMatch(Attention.researchProviderNotice(status),/OpenAI|search only/);
});
