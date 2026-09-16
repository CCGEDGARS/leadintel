const test=require('node:test');
const assert=require('node:assert/strict');
const verifier=require('../market-research-verification.js');
const market=require('../market-engine.js');
const fs=require('node:fs');
const path=require('node:path');

const results=[
  {url:'https://example.com/a',title:'Expansion',market:'Latvia',sourceProviders:['openai','firecrawl']},
  {url:'https://example.org/b',title:'Hiring',market:'Latvia',sourceProviders:['openai']}
];

test('verification request uses stable evidence ids and does not claim Gemini found sources',()=>{
  const request=verifier.buildVerificationPayload({mode:'deep',profile:{targetMarkets:'Latvia'},signals:[],results});
  assert.deepEqual(request.evidence.map(item=>item.id),['evidence-1','evidence-2']);
  assert.equal(request.role,'verification');
  assert.equal(request.web_search,false);
  assert.equal('sourceProviders' in request.evidence[0],false);
});

test('browser verification payload is bounded before transmission',()=>{
  const many=Array.from({length:200},(_,index)=>({url:`https://example.com/${index}`,title:'Title',description:'x'.repeat(1000),text:'y'.repeat(5000)}));
  const request=verifier.buildVerificationPayload({mode:'intelligence',profile:{},signals:[],results:many});
  assert.ok(request.evidence.length<=60);
  assert.ok(JSON.stringify(request).length<=75000);
});

test('verification merges known verdicts without adding Gemini to source provenance',()=>{
  const merged=verifier.applyVerification(results,{status:'complete',provider:'gemini',role:'verification',web_search:false,verdicts:[
    {evidence_id:'evidence-1',relevance:'strong',commercial_fit:'strong',contradiction:false,rationale:'Direct evidence.',missing_evidence:[]},
    {evidence_id:'unknown',relevance:'reject',commercial_fit:'weak',contradiction:true,rationale:'Invented.',missing_evidence:[]}
  ]});
  assert.deepEqual(merged.results[0].sourceProviders,['openai','firecrawl']);
  assert.equal(merged.results[0].verification.relevance,'strong');
  assert.equal(merged.results[1].verification,undefined);
  assert.equal(merged.verification.webSearch,false);
});

test('rejected or contradicted evidence is excluded from opportunity scoring',()=>{
  const applied=verifier.applyVerification(results,{status:'complete',provider:'gemini',role:'verification',web_search:false,verdicts:[
    {evidence_id:'evidence-1',relevance:'reject',commercial_fit:'weak',contradiction:true,rationale:'Not relevant.',missing_evidence:[]}
  ]});
  const opportunities=market.buildMarketOpportunities({targetMarkets:'Latvia',priorityOffers:'Equipment'},[],[],applied.results,'en');
  assert.equal(opportunities[0].evidence.some(item=>item.url==='https://example.com/a'),false);
  assert.equal(opportunities[0].evidence.some(item=>item.url==='https://example.org/b'),true);
});

test('market state preserves verifier status and metadata and recovers interrupted verification',()=>{
  const normalized=market.normalizeMarketState({researchMode:'deep',researchSourceStatus:{openai:'complete',firecrawl:'complete',gemini:'complete'},researchVerification:{status:'complete',provider:'gemini',role:'verification',webSearch:false,summary:'Checked',disagreements:['One gap'],missingEvidence:['Budget'],verifiedAt:'2026-09-16T10:00:00Z'}});
  assert.equal(normalized.researchSourceStatus.gemini,'complete');
  assert.equal(normalized.researchVerification.webSearch,false);
  assert.deepEqual(normalized.researchVerification.missingEvidence,['Budget']);
  const recovered=market.recoverInterruptedResearch({...normalized,researchStatus:'running',researchSourceStatus:{...normalized.researchSourceStatus,gemini:'running'}});
  assert.equal(recovered.researchSourceStatus.gemini,'error');
});

test('unavailable Gemini remains an explicit non-fatal verification state',()=>{
  const applied=verifier.applyVerification(results,{status:'unavailable',provider:'gemini',role:'verification',web_search:false,reason:'Gemini is not configured'});
  assert.equal(applied.results.length,2);
  assert.equal(applied.verification.status,'unavailable');
  assert.equal(applied.verification.reason,'Gemini is not configured');
});

test('deep research wires Gemini as verifier, never as web discovery',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(app,/\/api\/ai\/research-verification/);
  assert.match(app,/Discovery: OpenAI/);
  assert.match(app,/Extraction: Firecrawl/);
  assert.match(app,/Verification: \$\{[^}]*Gemini/);
  assert.doesNotMatch(app,/Gemini (web )?search/i);
  assert.match(html,/market-research-verification\.js\?v=20260916-gemini-verification-v1/);
});
