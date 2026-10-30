const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Market=require('../market-engine.js'),Conditions=require('../market-conditions-engine.js'),Integrity=require('../strategy-integrity.js');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function fn(name,next){return app.slice(app.indexOf('function '+name+'('),app.indexOf(next,app.indexOf('function '+name+'(')));}
test('signal ID subsets do not falsely mark a researched workspace stale; actual changes do',()=>{
 const state={website:'https://seller.example',profile:{companyName:'Seller',priorityOffers:'Metal fabrication',targetMarkets:'Sweden',recommendedSignals:[{id:'a',name:'Project'},{id:'b',name:'Expansion'}]},market:{icps:[{active:true}],signals:[{id:'a',name:'Project',active:true}],researchResults:[{url:'https://source.example'}],opportunities:[{}]}};
 const ctx={state,LeadIntelStrategyIntegrity:Integrity,LeadIntelMarket:{normalizeSignals:(_,saved)=>saved,localizeGeneratedState:x=>x},LeadIntelCompanyBrain:{unrelatedSignals:()=>[]},contentLanguage:()=> 'en',saveState:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn('strategyIntegrity','function captureStrategyContext')+fn('researchContextFingerprint','function returnToProfileResearch')+fn('ensureMarketStrategySeeded','async function openModule'),ctx);
 vm.runInContext('state.market.researchContextFingerprint=researchContextFingerprint();ensureMarketStrategySeeded();',ctx);assert.notEqual(state.market.researchContextStale,true);
 state.profile.companyName='Another name';vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,true,'seller identity is material research input');
 state.profile.companyName='Seller';vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,false);
 state.profile.targetMarkets='Finland';vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,true);
});
test('research timer, phase, exact context and retry state survive normalize/reload',()=>{
 const input={researchStartedAt:12345,researchPhase:'extracting',researchContextFingerprint:'{"offers":"custom  fabrication"}',openAiRetryProgress:{startedAt:12345,attempt:2,total:4,completed:1}};
 const next=Market.normalizeMarketState(JSON.parse(JSON.stringify(Market.normalizeMarketState(input))));for(const key of Object.keys(input))assert.deepEqual(next[key],input[key]);
});
test('source classification reflects source URLs rather than a news query label',()=>{
 const x=Conditions.assessEvidence([{url:'https://maker.example/products',title:'Products',researchCategory:'news'},{url:'https://maker.example/news/new-plant',title:'Plant'},{url:'https://maker.example/careers/welder',title:'Welder'}]);assert.deepEqual(new Set(x.sourceClasses),new Set(['industry','media','jobs']));
});
test('storage budget preserves independent domains and source classes',()=>{
 const sources=Array.from({length:25},(_,i)=>({url:'https://maker.example/product/'+i,title:'Part '+i,text:'Different '+i+' '+('specification '.repeat(100))}));sources.push({url:'https://journal.example/news/project',title:'Independent news',text:'Evidence '.repeat(60)});
 const selected=Conditions.selectDiverseEvidence(sources,20);assert.ok(selected.some(x=>x.url.includes('journal.example')));assert.ok(selected.length<=20);
});
test('quick research performs bounded diversification follow-up for homogeneous sources',()=>{
 const plan=Conditions.buildAdaptivePlan({mode:'quick',market:'Sweden',offer:'Metal fabrication',results:[{url:'https://one.example/a',title:'One'},{url:'https://two.example/b',title:'Two'}]});assert.equal(plan.queries.length,2);assert.ok(plan.gaps.includes('source diversity'));assert.ok(plan.queries.every(x=>x.query.includes('Sweden Metal fabrication')));
});
test('timeout retry actually recovers and stops after two attempts',async()=>{
 const source=fs.readFileSync(require.resolve('../market-research-provider-resilience.js'),'utf8');const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));let calls=0;assert.equal(await api.withOpenAiRetry(async()=>{if(++calls===1)throw new Error('OpenAI search timed out');return 'recovered';},{sleep:async()=>{}}),'recovered');assert.equal(calls,2);
});
test('outdated research repair navigates directly to Profile research',()=>{
 let closed=0,opened=0;const ctx={closeStrategyHandoff:()=>closed++,window:{LeadIntelProfileMarket:{open:()=>opened++}}};vm.runInNewContext(fn('returnToProfileResearch','function researchProfile')+'returnToProfileResearch();',ctx);assert.equal(closed,1);assert.equal(opened,1);
});
test('source diversification derives queries from each workspace offer and market',()=>{
 for(const [offer,market] of [['Legal services','Latvia'],['Office furniture','Finland'],['Metal fabrication','Sweden']]){
 const plan=Conditions.buildAdaptivePlan({mode:'quick',offer,market,results:[{url:'https://one.example',title:'One'},{url:'https://two.example',title:'Two'}]});assert.ok(plan.queries.every(x=>x.query.includes(offer)&&x.query.includes(market)));assert.ok(plan.queries.every(x=>!x.query.includes('Ercon')));
 }
});
test('a research context that changes and then changes back clears the stale latch',()=>{
 const state={website:'https://seller.example',profile:{companyName:'Seller',priorityOffers:'Metal fabrication',targetMarkets:'Sweden',recommendedSignals:[{id:'a',name:'Project'}]},market:{icps:[{active:true}],signals:[{id:'a',name:'Project',active:true}],researchResults:[{url:'https://source.example'}],opportunities:[{}],strategyApproved:true,strategyApprovedAt:'2026-10-24T00:00:00.000Z'}};
 const ctx={state,LeadIntelStrategyIntegrity:Integrity,LeadIntelMarket:{normalizeSignals:(_,saved)=>saved,localizeGeneratedState:x=>x},LeadIntelCompanyBrain:{unrelatedSignals:()=>[]},contentLanguage:()=> 'en',saveState:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn('strategyIntegrity','function captureStrategyContext')+fn('researchContextFingerprint','function returnToProfileResearch')+fn('ensureMarketStrategySeeded','async function openModule'),ctx);
 vm.runInContext('state.market.researchContextFingerprint=researchContextFingerprint();',ctx);
 state.profile.targetMarkets='Finland';vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,true);assert.equal(state.market.strategyApproved,false);
 state.profile.targetMarkets='Sweden';vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,false);
 // A flag latched by an older build heals on the next seeding when the saved context still matches.
 state.market.researchContextStale=true;vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,false);
});
test('a forced stale marker survives seeding until a new run rewrites the fingerprint',()=>{
 const state={website:'https://seller.example',profile:{companyName:'Seller',priorityOffers:'Metal fabrication',targetMarkets:'Sweden',recommendedSignals:[{id:'a',name:'Project'}]},market:{icps:[{active:true}],signals:[{id:'a',name:'Project',active:true}],researchResults:[{url:'https://source.example'}],opportunities:[{}],researchContextStale:true,researchContextFingerprint:'stale:website-reactivated'}};
 const ctx={state,LeadIntelStrategyIntegrity:Integrity,LeadIntelMarket:{normalizeSignals:(_,saved)=>saved,localizeGeneratedState:x=>x},LeadIntelCompanyBrain:{unrelatedSignals:()=>[]},contentLanguage:()=> 'en',saveState:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn('strategyIntegrity','function captureStrategyContext')+fn('researchContextFingerprint','function returnToProfileResearch')+fn('ensureMarketStrategySeeded','async function openModule')+'ensureMarketStrategySeeded();',ctx);
 assert.equal(state.market.researchContextStale,true);
 state.market.researchResults=[];vm.runInContext('ensureMarketStrategySeeded();',ctx);assert.equal(state.market.researchContextStale,false,'no saved research means nothing can be stale');
});
test('retained previous research keeps the fingerprint of the run it came from and the handoff gate compares live',()=>{
 assert.match(app,/fingerprint:state\.market\.researchContextFingerprint/);
 assert.match(app,/state\.market\.researchContextFingerprint=previous\.fingerprint\|\|"stale:rerun-failed"/);
 assert.match(fn('strategyHandoffModel','function renderStrategyHandoff'),/^function strategyHandoffModel\(\)\{\s*syncResearchContextStale\(\);/);
});
