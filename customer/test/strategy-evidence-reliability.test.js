const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../market-engine.js');
const Verification=require('../market-research-verification.js');
const Conditions=require('../market-conditions-engine.js');
const profile={targetMarkets:'Sweden; Kazakhstan',priorityOffers:'industrial automation',idealCustomer:'manufacturers',buyingTriggers:'old tender signal',completeness:100,opportunityValue:'€100,000'};
const signals=[{id:'s',name:'Expansion',keywords:'новый завод; жаңа зауыт; facility expansion',weight:10,active:true}];
const options={mode:'intelligence',sourceTypes:['news','company'],sourceTypesCustomized:true,instructions:'robotic welding',language:'en'};
test('actual strategy plan honors explicit empty sources and disabled signals without reviving profile triggers',()=>{
 assert.deepEqual(Market.buildResearchPlan(profile,signals,{...options,sourceTypes:[]}),[]);
 const plan=Market.buildResearchPlan(profile,signals.map(s=>({...s,active:false})),options);
 assert.ok(plan.every(q=>!q.query.includes('old tender signal')));
 assert.equal(plan.filter(q=>q.researchCategory==='commercial').length,0);
 const saved=Market.normalizeMarketState({researchSourceTypes:[],researchSourceTypesCustomized:true});
 assert.deepEqual(saved.researchSourceTypes,[]);
});
test('strategic and commercial families span selected markets and retain original custom keywords and instructions',()=>{
 const plan=Market.buildResearchPlan(profile,signals,options);
 for(const category of ['direction','competition','funding','pricing','commercial'])assert.deepEqual(new Set(plan.filter(q=>q.researchCategory===category).map(q=>q.market)),new Set(['Sweden','Kazakhstan']));
 assert.ok(plan.filter(q=>q.researchCategory==='commercial').some(q=>/новый завод|жаңа зауыт/.test(q.query)));
 assert.ok(plan.every(q=>q.query.includes('robotic welding')));
 assert.ok(plan.every(q=>! /tender|procurement/i.test(q.query)));
});
test('merge preserves contradiction verdict and publication provenance through richer extraction and reload',()=>{
 const url='https://example.com/story';
 const merged=Market.mergeResearchResults([{url,market:'Sweden',text:'old',date:'',verification:{relevance:'reject',commercialFit:'weak',contradiction:true,rationale:'Different company'}}],[{url,market:'Sweden',text:'A much richer extracted body',date:'2020-01-01',dateSource:'metadata.datePublished',extractedAt:'2026-10-30T10:00:00Z'}]);
 assert.equal(merged[0].verification.contradiction,true);
 assert.equal(merged[0].dateSource,'metadata.datePublished');
 const restored=Market.normalizeMarketState({researchResults:merged}).researchResults;
 assert.equal(restored[0].verification.contradiction,true);
 assert.equal(Market.buildMarketOpportunities(profile,[],signals,restored)[0].profileOnly,true);
});
test('tracked and syndicated repeated sources cannot manufacture independent high confidence',()=>{
 const story={market:'Sweden',title:'Factory announces facility expansion',text:'Factory announces facility expansion and a robotic welding investment for its manufacturing plant.',date:new Date().toISOString(),extractedAt:new Date().toISOString()};
 const evidence=[{...story,url:'https://news.example/story?utm_source=feed'},{...story,url:'https://news.example/story?utm_source=mail'},{...story,url:'https://syndicated.example/reprint'}];
 assert.equal(Market.mergeResearchResults(evidence).length,2);
 assert.notEqual(Market.buildMarketOpportunities(profile,[{active:true}],signals,evidence)[0].confidence,'High');
});
test('future and unknown publication dates never earn current-event timing',()=>{
 const timing=date=>Market.buildMarketOpportunities(profile,[],signals,[{market:'Sweden',url:'https://news.example/story',title:'Expansion',date,extractedAt:new Date().toISOString()}])[0].score.timing;
 assert.ok(timing('2099-01-01')<timing(new Date().toISOString()));
 assert.ok(timing('')<timing(new Date().toISOString()));
});
test('weak or unknown fit cannot produce High confidence despite extraction and profile completeness',()=>{
 const evidence=[1,2,3].map(i=>({market:'Sweden',url:`https://news${i}.example/story`,title:`Factory ${i} facility expansion`,text:`Company ${i} expanded its plant.`,date:new Date().toISOString(),extractedAt:new Date().toISOString(),verification:{relevance:'strong',commercialFit:'unknown'}}));
 assert.notEqual(Market.buildMarketOpportunities(profile,[{active:true}],signals,evidence)[0].confidence,'High');
});
test('unavailable verification response cannot attach verdicts to retained evidence',()=>{
 const results=[{url:'https://example.com/a'}];
 const response=Verification.applyVerification(results,{status:'unavailable',verdicts:[{evidence_id:'evidence-1',relevance:'strong',commercial_fit:'strong'}]});
 assert.equal(response.results[0].verification,undefined);
});
test('adaptive follow-up honors source selection and does not invent tender intent',()=>{
 const input={mode:'deep',market:'Sweden',offer:'automation',signals,sourceTypes:['company'],sourceTypesCustomized:true,results:[]};
 const plan=Conditions.buildAdaptivePlan(input);
 assert.ok(plan.queries.length>0);
 assert.ok(plan.queries.every(q=>q.sourceType==='company'));
 assert.ok(plan.queries.every(q=>!/tender|procurement/i.test(q.query)));
 assert.deepEqual(Conditions.buildAdaptivePlan({...input,sourceTypes:[]}).queries,[]);
});
test('profile completeness and contact readiness do not substitute for evidence of commercial fit',()=>{
 const result={market:'Sweden',url:'https://example.com/a',title:'Expansion',contactReady:true};
 const opportunity=Market.buildMarketOpportunities(profile,[{active:true}],signals,[result])[0];
 assert.equal(opportunity.score.fit,0);
 const verified=Market.buildMarketOpportunities(profile,[{active:true}],signals,[{...result,verification:{relevance:'strong',commercialFit:'strong'}}])[0];
 assert.ok(verified.score.fit>opportunity.score.fit);
});
test('excluded tender evidence stays retained but cannot score without active tender permission',()=>{
 const tender={market:'Sweden',url:'https://example.com/tender/123',title:'Tender procurement automation contract',text:'Published tender'};
 const opportunity=Market.buildMarketOpportunities(profile,[],signals,[tender])[0];
 assert.equal(opportunity.profileOnly,true);
 assert.equal(tender.title,'Tender procurement automation contract');
});
test('adaptive research uses remaining budget and only intelligence asks for cross-checking already covered categories',()=>{
 const results=['direction','competition','funding','pricing','commercial'].flatMap(category=>[1,2].map(i=>({researchCategory:category,url:`https://${category}${i}.example/a`,title:`${category} ${i}`})));
 const input={market:'Sweden',offer:'automation',signals,sourceTypes:['news','company'],results};
 assert.deepEqual(Conditions.buildAdaptivePlan({...input,mode:'deep',remainingQueries:0}).queries,[]);
 const intelligence=Conditions.buildAdaptivePlan({...input,mode:'intelligence',remainingQueries:2});
 assert.equal(intelligence.queries.length,2);
 assert.ok(intelligence.queries.some(q=>/corroborat|cross.check|independent/i.test(q.query)));
});
test('edited or disabled ICP markets cannot revive old expanded markets',()=>{
 const original={...profile,researchMarkets:['Sweden','Norway'],targetMarkets:'Nordics',currentMarkets:['Latvia']};
 const projected=Market.effectiveTargetingProfile(original,{icps:[{active:true,targetMarkets:'Kazakhstan'}]});
 assert.deepEqual(Market.effectiveResearchMarkets(projected),['Kazakhstan']);
 const disabled=Market.effectiveTargetingProfile(original,{icps:[{active:false,targetMarkets:'Kazakhstan'}]});
 assert.deepEqual(Market.effectiveResearchMarkets(disabled),[]);
 assert.deepEqual(original.researchMarkets,['Sweden','Norway']);
});
test('syndicated copies with changed titles do not multiply evidence strength',()=>{
 const body='Factory Omega announces a new robotic welding plant. Local engineering teams will install automation equipment.';
 const evidence=[1,2,3].map(i=>({market:'Sweden',url:`https://source${i}.example/article`,title:`Headline ${i}`,text:body,date:new Date().toISOString(),extractedAt:new Date().toISOString(),verification:{relevance:'strong',commercialFit:'strong'}}));
 const one=Market.buildMarketOpportunities(profile,[],signals,evidence.slice(0,1))[0];
 const repeated=Market.buildMarketOpportunities(profile,[],signals,evidence)[0];
 assert.equal(repeated.score.evidence,one.score.evidence);
 assert.notEqual(repeated.confidence,'High');
});
test('disabled signals cannot receive positive intent from retained evidence',()=>{
 const evidence=[{market:'Sweden',url:'https://example.com/a',title:'новый завод'}];
 assert.equal(Market.buildMarketOpportunities(profile,[],signals.map(s=>({...s,active:false})),evidence)[0].score.intent,0);
});
test('detection dates cannot be promoted to publication recency',()=>{
 const evidence={market:'Sweden',url:'https://example.com/a',title:'Expansion',date:new Date().toISOString(),dateSource:'detectedAt'};
 const detected=Market.buildMarketOpportunities(profile,[],signals,[evidence])[0];
 const published=Market.buildMarketOpportunities(profile,[],signals,[{...evidence,dateSource:'metadata.datePublished'}])[0];
 assert.ok(detected.score.timing<published.score.timing);
});
test('contradictory verification dominates an earlier positive verdict when merging sources',()=>{
 const url='https://example.com/a';
 const merged=Market.mergeResearchResults([{url,verification:{relevance:'strong',commercialFit:'strong'}}],[{url,verification:{relevance:'reject',commercialFit:'weak',contradiction:true}}]);
 assert.equal(merged[0].verification.contradiction,true);
});
test('market conditions dedup multilingual syndication and do not reward future dates',()=>{
 const content='Компания объявляет новый завод и расширение производства в Казахстане. Новая площадка будет выпускать роботизированное оборудование.';
 const evidence=[{url:'https://a.example/news',title:'Новый завод',text:content},{url:'https://b.example/news',title:'Новый завод',text:content}];
 assert.equal(Conditions.assessEvidence(evidence).results.length,1);
 const item={url:'https://ec.europa.eu/news',title:'Official',text:content};
 assert.ok(Conditions.scoreEvidence({...item,date:'2099-01-01'})<Conditions.scoreEvidence({...item,date:new Date().toISOString()}));
});
test('adaptive follow-up follows an observed event and stops repeating executed searches',()=>{
 const input={mode:'deep',market:'Sweden',offer:'automation',sourceTypes:['company','news'],remainingQueries:2,results:[{url:'https://news.example/event',title:'Omega announces new robotic welding plant',researchCategory:'commercial'}]};
 const plan=Conditions.buildAdaptivePlan(input);
 assert.ok(plan.queries.some(q=>q.query.includes('Omega announces new robotic welding plant')));
 assert.ok(plan.queries.some(q=>q.sourceType==='company'));
 const repeated=Conditions.buildAdaptivePlan({...input,previousQueries:plan.queries});
 assert.ok(repeated.queries.every(q=>!plan.queries.some(old=>old.query===q.query)));
});
test('provider search fields cannot counterfeit an executed verification',()=>{
 const raw={url:'https://example.com/a',title:'Expansion',description:'Factory announcement',verification:{relevance:'strong',commercialFit:'strong'}};
 const results=Market.normalizeSearchResults({results:[raw]},{market:'Sweden'},'openai');
 assert.equal(results[0].verification,undefined);
});
test('initial plan reserves adaptive budget only when explicitly requested',()=>{
 for(const [mode,total,reserved] of [['quick',4,0],['deep',12,2],['intelligence',24,4]]){
  const full=Market.buildResearchPlan(profile,signals,{...options,mode});
  const initial=Market.buildResearchPlan(profile,signals,{...options,mode,reserveFollowUps:true});
  assert.equal(full.length,total);
  assert.equal(initial.length,total-reserved);
  assert.ok(initial.some(q=>q.researchCategory==='commercial'));
 }
});
test('strategy approval signature survives normalization without creating fresh approval',()=>{
 const strategyApproval={version:1,signature:'strategy-v1-test',approvedAt:'2026-10-30T10:00:00Z'};
 assert.deepEqual(Market.normalizeMarketState({strategyApproval}).strategyApproval,strategyApproval);
 assert.equal(Market.normalizeMarketState({strategyApproval}).strategyApproved,false);
});
test('explicit inactive reference portfolio cannot revive a legacy lookalike anchor',()=>{
 const legacy={...profile,lookalikeCustomers:'Legacy reference'};
 for(const reference of [null,{active:false,dna:{referenceProfiles:[{companyName:'Inactive reference'}]}}]){
  const lookalike=Market.buildIcpCandidates(legacy,'en',reference).find(icp=>icp.type==='lookalike');
  assert.equal(lookalike.active,false);
  assert.doesNotMatch(lookalike.description,/Legacy reference|Inactive reference/);
 }
});
test('research execution receipts survive JSON save reload and localization without changing execution outcomes',()=>{
 const execution={version:1,runId:'market-1',mode:'intelligence',startedAt:1793354400000,deadlineAt:1793355000000,completedAt:1793354500000,status:'partial',receipts:['planned','not_run','running','zero_results','complete','failed','unavailable','cancelled'].map((status,index)=>({provider:['openai','firecrawl','gemini'][index%3],stage:['discovery','custom_source','extraction','extraction_batch','verification'][index%5],query:`Search ${index}`,status,attempt:index,startedAt:1793354400000,completedAt:status==='planned'?0:1793354500000,resultCount:index}))};
 const state=Market.normalizeMarketState({researchExecution:execution,researchExecutionHistory:[{...execution,runId:'earlier',status:'complete'}],researchResults:[{url:'https://company.example/news',title:'Saved evidence',extractedAt:'2026-10-30T10:00:00Z'}]});
 const restored=Market.localizeGeneratedState(JSON.parse(JSON.stringify(state)),profile,'en');
 assert.deepEqual(restored.researchExecution,execution);
 assert.deepEqual(restored.researchExecutionHistory,[{...execution,runId:'earlier',status:'complete'}]);
 assert.equal(restored.researchResults[0].extractedAt,'2026-10-30T10:00:00Z');
});
test('execution normalization bounds receipt payload and rejects unsupported enums without manufacturing completed checks',()=>{
 const rows=Array.from({length:130},()=>({provider:'unknown',stage:'invented',query:'x'.repeat(900),status:'success',attempt:-2,startedAt:Infinity,completedAt:-1,resultCount:-5}));
 const execution={version:1,runId:'market-1',mode:'intelligence',startedAt:100,deadlineAt:200,status:'running',receipts:rows};
 const state=Market.normalizeMarketState({researchExecution:execution,researchExecutionHistory:Array.from({length:15},(_,i)=>({...execution,runId:`run-${i}`}))});
 assert.equal(state.researchExecution.receipts.length,100);
 assert.equal(state.researchExecutionHistory.length,10);
 assert.equal(state.researchExecutionHistory[0].runId,'run-5');
 assert.equal(state.researchExecution.receipts[0].query.length,500);
 assert.equal(state.researchExecution.receipts[0].status,'not_run');
 assert.equal(state.researchExecution.receipts[0].provider,'unknown');
 assert.equal(state.researchExecution.receipts[0].stage,'unknown');
 assert.equal(state.researchExecution.receipts[0].attempt,0);
 assert.equal(state.researchExecution.receipts[0].startedAt,0);
 assert.equal(state.researchExecution.receipts[0].completedAt,0);
 assert.equal(state.researchExecution.receipts[0].resultCount,0);
});
test('monitoring revision survives save reload for server compare-and-swap without changing schedule timestamps',()=>{
 const monitoring={revision:17,lastRunAt:'2026-10-29T10:00:00Z',nextRunAt:'2026-11-05T10:00:00Z'};
 const state=Market.normalizeMarketState({monitoring});
 const restored=Market.normalizeMarketState(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.monitoring.revision,17);
 assert.equal(restored.monitoring.lastRunAt,monitoring.lastRunAt);
 assert.equal(restored.monitoring.nextRunAt,monitoring.nextRunAt);
 assert.equal(Market.normalizeMonitoring({revision:-1}).revision,0);
 assert.equal(Market.normalizeMonitoring({revision:2.8}).revision,2);
});
test('approval invalidation reason survives JSON reload without reapproving the historical marker',()=>{
 const invalidated={code:'strategy-context-changed',reason:'Selected market changed. Review Strategy again.',at:'2026-10-30T22:00:00Z'};
 const state=Market.normalizeMarketState({strategyApproval:{version:1,signature:'historical-signature',approvedAt:'2026-10-29'},strategyApproved:false,strategyApprovalInvalidated:invalidated});
 const restored=Market.normalizeMarketState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.strategyApprovalInvalidated,invalidated);
 assert.equal(restored.strategyApproved,false);
 assert.equal(restored.strategyApproval.signature,'historical-signature');
});
test('changing deep research to quick preserves accepted citations through localization and JSON reload',()=>{
 const accepted=Array.from({length:65},(_,index)=>({url:`https://company${index}.example/accepted`,market:'Sweden',title:`Accepted citation ${index}`,text:`Original retained evidence ${index}`,extractedAt:'2026-10-30T10:00:00Z',verification:{relevance:index===49?'reject':'strong',commercialFit:'moderate',contradiction:index===49}}));
 const deep=Market.normalizeMarketState({researchMode:'deep',researchResults:accepted});
 assert.equal(deep.researchResults.length,65);
 const changed=Market.localizeGeneratedState({...deep,researchMode:'quick'},profile,'en');
 const restored=Market.normalizeMarketState(JSON.parse(JSON.stringify(changed)));
 assert.deepEqual(restored.researchResults.map(item=>item.url),accepted.map(item=>item.url));
 assert.equal(restored.researchResults[49].verification.contradiction,true);
 assert.equal(restored.researchResults[49].text,'Original retained evidence 49');
 assert.equal(Market.RESEARCH_MODES.quick.maxStoredResults,20);
});
test('partial quick rerun merge preserves prior and new source identities beyond the quick selection cap',()=>{
 const retained=Array.from({length:65},(_,index)=>({url:`https://old${index}.example/accepted`,title:`Retained ${index}`}));
 const incoming=Array.from({length:20},(_,index)=>({url:`https://new${index}.example/finding`,title:`New ${index}`}));
 const merged=Market.mergeResearchResults(retained,incoming);
 const saved=Market.normalizeMarketState({researchMode:'quick',researchStatus:'partial',researchResults:merged});
 const restored=Market.localizeGeneratedState(JSON.parse(JSON.stringify(saved)),profile,'en');
 assert.equal(restored.researchResults.length,85);
 assert.deepEqual(new Set(restored.researchResults.map(item=>item.url)),new Set(merged.map(item=>item.url)));
});
test('durable research collection retains all 205 prior plus 20 newly selected sources across render and reload',()=>{
 const prior=Array.from({length:205},(_,index)=>({url:`https://accepted${index}.example/source`,market:'Sweden',title:`Accepted ${index}`,text:`Saved company evidence ${index}`,date:'2026-10-01',extractedAt:'2026-10-30T10:00:00Z'}));
 const selected=Array.from({length:Market.RESEARCH_MODES.quick.maxStoredResults},(_,index)=>({url:`https://newfinding${index}.example/source`,market:'Sweden',title:`New finding ${index}`,text:`New source evidence ${index}`}));
 const merged=Market.mergeResearchResults(prior,selected);
 const normalized=Market.normalizeMarketState({researchMode:'quick',researchStatus:'complete',researchResults:merged});
 const rendered=Market.localizeGeneratedState(normalized,profile,'en');
 const restored=Market.normalizeMarketState(JSON.parse(JSON.stringify(rendered)));
 assert.equal(restored.researchResults.length,225);
 assert.deepEqual(restored.researchResults.map(item=>item.url),merged.map(item=>item.url));
 assert.equal(restored.researchResults[204].text,'Saved company evidence 204');
 assert.equal(restored.researchResults[224].text,'New source evidence 19');
 assert.equal(restored.researchResults[204].extractedAt,'2026-10-30T10:00:00Z');
 assert.equal(Market.RESEARCH_MODES.quick.maxStoredResults,20);
 assert.equal(Market.RESEARCH_MODES.deep.maxStoredResults,80);
 assert.equal(Market.RESEARCH_MODES.intelligence.maxStoredResults,200);
});

test('unverified second publisher cannot promote same-publisher verified stories to High confidence',()=>{
 const p={targetMarkets:'Sweden',priorityOffers:'industrial automation',opportunityValue:'€100,000'};
 const s=[{id:'expansion',keywords:'facility expansion',weight:10,active:true},{id:'investment',keywords:'investment',weight:10,active:true}];
 const rows=[1,2].map(i=>({market:'Sweden',url:`https://company.example/news/${i}`,title:'Facility expansion investment '+i,text:'Company story '+i+' describes distinct facility expansion investment',date:new Date().toISOString(),extractedAt:new Date().toISOString(),verification:{relevance:'strong',commercialFit:'strong'}}));
 rows.push({market:'Sweden',url:'https://unverified.example/comment',title:'Generic unrelated discussion',text:'Unverified generic commentary'});
 assert.equal(Market.buildMarketOpportunities(p,[],s,rows)[0].confidence,'Medium');
 rows[1].url='https://independent.example/news/2';assert.equal(Market.buildMarketOpportunities(p,[],s,rows)[0].confidence,'High');
});
