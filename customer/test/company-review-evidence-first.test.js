const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Discovery=require('../discovery-engine.js'),Targeting=require('../targeting-policy.js'),StrategyIntegrity=require('../strategy-integrity.js'),{weakBuyerFitResponse}=require('./helpers/buyer-fit-fixtures.cjs');
const uiSource=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),existing=fs.readFileSync(require.resolve('./discovery-research-budget.test.js'),'utf8');
const helpers={require,__dirname,fs,path,vm,assert,Discovery,Targeting,StrategyIntegrity,weakBuyerFitResponse,uiSource,AbortController,DOMException,URL,URLSearchParams,TextEncoder,TextDecoder,setTimeout,clearTimeout,console};
vm.createContext(helpers);vm.runInContext(existing.slice(existing.indexOf('const companyNames ='),existing.indexOf("test('saved unfinished companies")),helpers);
const goodFit=prompt=>JSON.stringify({companies:JSON.parse(prompt.split('. Companies: ')[1]).map(c=>({domain:c.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Production operations are a specific application for the confirmed automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:c.evidence[0].sourceId,quoteId:c.evidence[0].quoteOptions.find(q=>q.quote.includes('Latvia')).quoteId}]}))});
const companies=n=>Array.from({length:n},(_,i)=>({company:['North Steel','Svea Machinery','Nordic Foundry','Polar Engineering','Baltic Mining'][i],domain:['northsteel','sveamachinery','nordicfoundry','polarengineering','balticmining'][i]+'.lv',market:'Latvia',evidence:[]}));
test('Review next companies reuses fresh saved operating evidence before buying web requests',async()=>{
 const candidate={...companies(1)[0],evidence:[{url:'https://northsteel.lv/operations',text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.',sourceRead:true,verifiedAt:new Date().toISOString()}],needsRecheck:true,buyerFit:{version:2,context:'old-targeting-context',fit:85}};
 const {context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});
 await context.__runDiscovery({recheckOnly:true,targetDomains:[candidate.domain],reviewBatchId:'saved-review'});
 assert.equal(calls.search+calls.scrape,0,'explicit company review must share the saved-evidence-first policy');
 assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain);assert.equal(calls.other,1);
 assert.equal(context.__discoveryState().candidates[0].evidence[0].verifiedAt,candidate.evidence[0].verifiedAt,'AI reassessment must preserve the actual source-read time');
});
test('a bounded five-company review completes the first company before acquiring all five names again',async()=>{
 const pending=companies(5),{context,calls}=helpers.loadRunner({engine:{...Discovery,discoveryCallBudget:()=>3},targetCount:5,pendingCompanies:pending,fitResponse:goodFit});
 await context.__runDiscovery({recheckOnly:true,targetDomains:pending.map(c=>c.domain),reviewBatchId:'bounded-review'});
 const state=context.__discoveryState();assert.ok(state.candidates.length>=1,'a three-request review must finish a readable first company rather than spend all requests rediscovering names');
 assert.ok(calls.search+calls.scrape<=3);assert.match(calls.queries[0],/^site:northsteel\.lv/);assert.doesNotMatch(calls.queries[0],/after:|\bnews\b/i,'missing operating facts require an operating query');
 assert.equal(state.status,'partial');assert.equal(new Set([...state.candidates,...state.potentialMatches].map(c=>c.domain)).size,5);
 const saved=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'));assert.equal(saved.candidates[0].domain,state.candidates[0].domain);
});
test('explicit review reuses retained official raw pages without fabricating a new read time',async()=>{
 const candidate=companies(1)[0],{context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});
 const source={url:'https://northsteel.lv/operations',domain:candidate.domain,market:'Latvia',title:'North Steel operations',text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.',sourceRead:true,verifiedAt:new Date().toISOString()};
 context.__discoveryState().rawResults=[source];await context.__runDiscovery({recheckOnly:true,targetDomains:[candidate.domain]});
 assert.equal(calls.search+calls.scrape,0,'a retained official page is evidence, not a reason to repurchase the same research');assert.equal(context.__discoveryState().candidates[0]?.evidence[0].verifiedAt,source.verifiedAt);
});
test('finishing a later fit batch cannot erase earlier completed companies from this review',async()=>{
 const pending=companies(5),{context}=helpers.loadRunner({engine:{...Discovery,discoveryCallBudget:()=>20},targetCount:5,pendingCompanies:pending,fitResponse:goodFit});
 await context.__runDiscovery({recheckOnly:true,targetDomains:pending.map(c=>c.domain)});
 const state=context.__discoveryState();assert.equal(state.candidates.length,5);assert.equal(state.potentialMatches.length,0);assert.equal(state.status,'complete');
 const saved=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_discovery'));assert.equal(saved.candidates.length,5);
});
test('rechecking a company retained only in Buyers still reuses its saved operating evidence',async()=>{
 const candidate={...companies(1)[0],people:[{id:'retained-buyer',name:'Saved Person'}],evidence:[{url:'https://northsteel.lv/operations',sourceRead:true,verifiedAt:new Date().toISOString(),text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.'}]};
 const {context,calls}=helpers.loadRunner({targetCount:1,fitResponse:goodFit});context.__discoveryState().selectedProspects=[candidate];await context.__runDiscovery({recheckOnly:true,targetDomains:[candidate.domain]});
 assert.equal(calls.search+calls.scrape,0);assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain);assert.equal(context.__discoveryState().selectedProspects[0].people[0].id,'retained-buyer');
});
test('a legacy competitor assessment is reassessed under the current offer-application policy',async()=>{
 const {context,calls}=helpers.loadRunner({targetCount:1,fitResponse:goodFit}),main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
 const profile=Discovery.effectiveTargetingProfile({...main.profile,...Targeting.profileFields(main)},main.market),legacy=JSON.parse(Discovery.buyerFitContext(profile));delete legacy.assessmentPolicy;
 const candidate={...companies(1)[0],evidence:[{url:'https://northsteel.lv/operations',text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.',sourceRead:true,verifiedAt:new Date().toISOString()}],buyerFit:{version:2,context:JSON.stringify(legacy),fit:15,relationship:'competitor',purchase:profile.priorityOffers,reason:'Earlier policy treated the overlapping service as the whole relationship.',buyerRole:'competitor',evidence:[{url:'https://northsteel.lv/operations',quote:'North Steel operates industrial manufacturing facilities in Latvia.'}]}};
 context.__discoveryState().potentialMatches=[candidate];await context.__runDiscovery({recheckOnly:true,targetDomains:[candidate.domain]});
 assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain,'old policy must not veto a fresh sourced application assessment');assert.equal(calls.search+calls.scrape,0);assert.equal(calls.other,1);
});
