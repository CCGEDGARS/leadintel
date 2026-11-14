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
test('retained complete source reads extend a shortened candidate URL without another web request',async()=>{
 const {context,calls}=helpers.loadRunner({targetCount:1,fitResponse:goodFit}),main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));
 main.answers.exclusions='companies with less than 30 people';main.profile.exclusions=main.answers.exclusions;main.targetingConfirmation=Targeting.confirm(main);main.market.strategyApproval=StrategyIntegrity.approval(main);context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 const now=new Date().toISOString(),text='North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.',candidate={...companies(1)[0],evidence:[{url:'https://northsteel.lv/',sourceRead:true,verifiedAt:now,text}]};
 context.__discoveryState().potentialMatches=[candidate];context.__discoveryState().rawResults=[{...candidate.evidence[0],text:text+' We are proud to employ over 350 dedicated professionals.'}];
 await context.__runDiscovery({recheckOnly:true,targetDomains:[candidate.domain]});assert.equal(calls.search+calls.scrape,0);assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain);assert.match(context.__discoveryState().candidates[0].evidence[0].text,/350 dedicated professionals/);assert.equal(context.__discoveryState().candidates[0].evidence[0].verifiedAt,now);
});
test('www aliases retain the newest complete read instead of dropping it as a duplicate excerpt',()=>{
 const text='An official operating source contains detailed company manufacturing operations and serves industrial customers across the target country. '.repeat(3),old={url:'https://northsteel.lv/',sourceRead:true,verifiedAt:'2026-11-13T09:00:00Z',text},fresh={url:'https://www.northsteel.lv/',sourceRead:true,verifiedAt:'2026-11-13T09:00:04Z',text:text+' We employ 350 people.'};
 const rows=Discovery.dedupeCompanyEvidence([old,fresh]);assert.equal(rows.length,1);assert.equal(rows[0].url,fresh.url);assert.equal(rows[0].text,fresh.text);assert.equal(rows[0].verifiedAt,fresh.verifiedAt);
});
test('an explicit saved-evidence review cannot buy missing facts and keeps unresolved records',async()=>{
 const candidate=companies(1)[0],{context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});await context.__runDiscovery({recheckOnly:true,savedEvidenceOnly:true,targetDomains:[candidate.domain]});assert.equal(calls.search+calls.scrape,0);assert.equal(context.__loadMeta().lastCompanyRun.savedEvidenceOnly,true);assert.ok(context.__discoveryState().potentialMatches.some(c=>c.domain===candidate.domain));
});
test('the web-operation boundary rejects saved-only review before reserving a provider call',async()=>{
 const {context,calls}=helpers.loadRunner(),controller=new AbortController();controller.signal.leadIntelSavedEvidenceOnly=true;context.__startBudget(20);await assert.rejects(()=>context.__fetchDiscoveryResource('/api/integrations/services/firecrawl-search',{method:'POST',body:JSON.stringify({query:'missing facts'})},{signal:controller.signal}),{code:'SAVED_EVIDENCE_ONLY'});assert.equal(calls.search+calls.scrape,0);assert.equal(context.__discoveryState().researchAudit.entries.length,0);
});
test('a later empty saved-only review retains the current shortlist status and owns its zero usage',async()=>{
 const candidate={...companies(1)[0],evidence:[{url:'https://northsteel.lv/operations',sourceRead:true,verifiedAt:new Date().toISOString(),text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.'}]}, {context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});
 await context.__runDiscovery({recheckOnly:true,savedEvidenceOnly:true,targetDomains:[candidate.domain]});
 const missing={...companies(2)[1],evidence:[{url:'https://sveamachinery.lv/',text:'Svea Machinery is mentioned in Latvia.',sourceRead:false}]};context.__discoveryState().potentialMatches=[missing];context.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({...context.__loadMeta(),autonomousDiscovery:{callsUsed:4,callLimit:4}}));
 await context.__runDiscovery({recheckOnly:true,savedEvidenceOnly:true,targetDomains:[missing.domain]});assert.equal(context.__discoveryState().candidates.length,1);assert.equal(calls.search+calls.scrape,0);
 const meta=context.__loadMeta();assert.equal(meta.lastCompanyRun.callsUsed,0);assert.equal(meta.lastCompanyRun.callLimit,0);
 const nodes=Object.fromEntries(['discovery-status','discovery-company','discovery-markets','discovery-pipeline-count','run-company-discovery','company-discovery-status'].map(id=>[id,{textContent:'',innerHTML:'',classList:{toggle(){}}}]));context.document.getElementById=id=>nodes[id]||null;context.renderStatus();assert.match(nodes['discovery-status'].textContent,/1 checked/);assert.doesNotMatch(nodes['discovery-status'].textContent,/No matches/);
 for(const status of ['error','partial']){context.__discoveryState().status=status;context.renderStatus();assert.match(nodes['discovery-status'].textContent,status==='error'?/Search issue.*1 checked retained/:/Partial.*1 checked retained/);}
 context.__discoveryState().status='no_results';context.__discoveryState().candidates=[];context.renderStatus();assert.equal(nodes['discovery-status'].textContent,'Evidence incomplete');
 context.__discoveryState().potentialMatches=[];context.renderStatus();assert.equal(nodes['discovery-status'].textContent,'No matches');
});

for(const retainedLocation of ['candidate','raw'])test(`normal discovery shares explicit review's zero-web saved-evidence policy (${retainedLocation})`,async()=>{
 const candidate={...companies(1)[0],needsRecheck:true,evidence:[{url:'https://northsteel.lv/operations',sourceRead:true,verifiedAt:new Date().toISOString(),text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.'}]};
 const {context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});
 if(retainedLocation==='raw'){
  const main=JSON.parse(context.localStorage.getItem('leadintel_customer_v2_state'));main.answers.exclusions='companies with less than 30 people';main.profile.exclusions=main.answers.exclusions;main.targetingConfirmation=Targeting.confirm(main);main.market.strategyApproval=StrategyIntegrity.approval(main);context.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
  context.__discoveryState().rawResults=[{...candidate.evidence[0],text:candidate.evidence[0].text+' We are proud to employ over 350 dedicated professionals.'}];
 }
 await context.__runDiscovery();
 assert.equal(calls.search+calls.scrape,0,'normal discovery must finish the saved qualification before spending on the same known domain');
 assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain);
 assert.equal(calls.other,1,'one current fit assessment is sufficient');
 assert.equal(context.__discoveryState().candidates[0].evidence[0].verifiedAt,candidate.evidence[0].verifiedAt);
});
test('retrying a saved-only review retains its no-web authorization',async()=>{
 const candidate=companies(1)[0],{context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit}),actions=[];
 context.LeadIntelTaskCentre={start(){},registerActions(id,value){actions.push(value);},update(){},complete(){},fail(){},get(){return null;}};
 await context.__runDiscovery({recheckOnly:true,savedEvidenceOnly:true,targetDomains:[candidate.domain]});assert.equal(calls.search+calls.scrape,0);
 assert.ok(actions[0]?.retry);await actions[0].retry();assert.equal(calls.search+calls.scrape,0,'a saved-only retry cannot turn into paid web acquisition');assert.equal(context.__loadMeta().lastCompanyRun.savedEvidenceOnly,true);
});
for(const entryPoint of ['review','discovery'])test(`a fresh retained read supersedes an old company assessment clock during ${entryPoint}`,async()=>{
 const now=new Date().toISOString(),candidate={...companies(1)[0],needsRecheck:true,researchedAt:'2020-01-01T00:00:00Z',evidence:[{url:'https://northsteel.lv/',sourceRead:false,text:'North Steel is mentioned in Latvia.'}]}, {context,calls}=helpers.loadRunner({targetCount:1,pendingCompanies:[candidate],fitResponse:goodFit});
 context.__discoveryState().rawResults=[{url:'https://northsteel.lv/operations',sourceRead:true,verifiedAt:now,text:'North Steel operates industrial manufacturing facilities in Latvia. Our production teams use industrial automation systems to coordinate machinery and production operations across our business facilities.'}];
 await context.__runDiscovery(entryPoint==='review'?{recheckOnly:true,targetDomains:[candidate.domain]}:{});
 assert.equal(calls.search+calls.scrape,0,'an old assessment clock cannot force repurchase of an already fresh executed read');assert.equal(context.__discoveryState().candidates[0]?.domain,candidate.domain);assert.ok(context.__discoveryState().candidates[0].evidence.some(e=>e.verifiedAt===now));
});
