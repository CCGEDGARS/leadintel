const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Discovery=require('../discovery-engine.js');
const Integrity=require('../strategy-integrity.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'\n');
function fixture(){
 const main={approved:true,website:'https://seller.example',profile:{website:'https://seller.example',priorityOffers:'Old offer',idealCustomer:'Old customer',targetMarkets:'Latvia',decisionMakers:'Old role'},targetMarkets:['Latvia'],market:{strategyApproved:true,signals:[{id:'expansion',active:true,weight:8,keywords:'new factory'}],icps:[{id:'icp-core',type:'core',active:true,description:'Hotels',targetMarkets:'Sweden',offers:'Staff training',buyerRoles:'Hotel manager',exclusions:'blocked.example'}]}};
 main.market.strategyApproval=Integrity.approval(main);
 const storage=new Map([['leadintel_customer_v2_state',JSON.stringify(main)]]);
 const ctx={console,URL,URLSearchParams,AbortController,DOMException,CustomEvent:class{},setTimeout,clearTimeout,LeadIntelDiscovery:Discovery,LeadIntelTargeting:{isConfirmed:()=>true,profileFields:()=>({})},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},navigator:{languages:[]},addEventListener(){},removeEventListener(){},dispatchEvent(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},LeadIntelServerBridge:{workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}}}};
 ctx.LeadIntelStrategyIntegrity=Integrity;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 vm.runInContext(`discovery=LeadIntelDiscovery.normalizeDiscoveryState({});renderDiscoverySafely=()=>true;renderAll=()=>{};syncStrategyFingerprint=()=>{};selectedDiscoveryTarget=()=>1;persistDiscoveryTarget=()=>1;`,ctx);
 return {ctx,main,write:()=>storage.set('leadintel_customer_v2_state',JSON.stringify(main)),state:()=>vm.runInContext('discovery',ctx)};
}
for(const [label,change] of [['signal',m=>m.market.signals[0].weight=2],['role',m=>m.market.icps[0].buyerRoles='HR Director'],['reference',m=>m.referenceCustomerPortfolio={lists:[{id:'r',active:true,reference:{publishedModel:{active:true,fingerprint:'new',updatedAt:'now'}}}]}]]){
 test(`normal company search invalidates a late ${label} change before adopting results`,async()=>{
  const f=fixture();let valid;
  f.ctx.mutate=()=>{change(f.main);f.write();};
  vm.runInContext(`runDiscoverySearchBatch=async(items,phase,signal)=>{mutate();globalThis.validAfterChange=signal.leadIntelScopeValid();throwIfDiscoveryRunAborted(signal);return [];};`,f.ctx);
  assert.equal(await vm.runInContext('runCompanyDiscovery()',f.ctx),false);
  valid=f.ctx.validAfterChange;assert.equal(valid,false);assert.equal(f.state().needsRefresh,true);
 });
}
test('verification retry uses active ICP offers, markets and exclusions',async()=>{
 const f=fixture();f.ctx.captured=[];
 vm.runInContext(`discovery.searchFailures=[{phase:'verifying',queryMeta:{kind:'verification',domain:'target.example',company:'Target',query:'site:target.example operations'}}];runDiscoverySearchBatch=async()=>[];LeadIntelDiscovery={...LeadIntelDiscovery,mergeCompanyCandidates:(rows,profile)=>{captured.push(profile);return [];},buildPotentialCompanyCandidates:()=>[],researchBuyerFit:async()=>[]};`,f.ctx);
 await vm.runInContext('retryFailedDiscoveryChecks()',f.ctx);
 assert.equal(f.ctx.captured[0].priorityOffers,'Staff training');assert.equal(f.ctx.captured[0].targetMarkets,'Sweden');assert.match(f.ctx.captured[0].exclusions,/blocked.example/);
});
test('verification retry cannot overwrite a replacement account state',async()=>{
 const f=fixture();f.ctx.replace=()=>{f.ctx.LeadIntelServerBridge.session.user.id='u2';vm.runInContext(`discovery=LeadIntelDiscovery.normalizeDiscoveryState({status:'idle',lastRunAt:'replacement'});`,f.ctx);};
 vm.runInContext(`discovery.searchFailures=[{phase:'verifying',queryMeta:{kind:'verification',domain:'target.example',company:'Target',query:'site:target.example operations'}}];runDiscoverySearchBatch=async()=>{replace();return [];};`,f.ctx);
 assert.equal(await vm.runInContext('retryFailedDiscoveryChecks()',f.ctx),false);assert.equal(f.state().lastRunAt,'replacement');assert.equal(f.state().status,'idle');
});
test('manual company roles remain authoritative after successful research and Strategy changes on reload',()=>{
 const main={profile:{priorityOffers:'Industrial training',decisionMakers:'CEO'},market:{icps:[{id:'icp-core',active:true,buyerRoles:'Engineering Director'}]}};
 const candidate={company:'Target',domain:'target.example',buyerSearchMode:'user_selected_target',buyerRoles:'HR Director',buyerRolesSource:'manual',buyerRolesChanged:false,buyerDiscovery:{opportunityRoles:['HR Director'],checkedAt:'2026-10-30T00:00:00Z',researchVersion:'current',roleSelectionContext:'older-context',providerStatus:{grounded:{status:'complete'}}}};
 const saved=Discovery.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];
 assert.equal(saved.buyerRolesSource,'manual');assert.equal(Discovery.buyerRolesForTarget(main,saved),'HR Director');
});
for(const [label,change] of [['account',f=>f.ctx.LeadIntelServerBridge.session.user.id='u2'],['Strategy',f=>{f.main.market.signals[0].weight=2;f.write();}]]){
 test(`buyer dossier request uses active ICP context and rejects a late ${label} result without touching saved manual work`,async()=>{
  const f=fixture();let captured;
  f.ctx.LeadIntelCompanyDossierUi={research:async(candidate,request)=>{captured=request;change(f);return {};},evidenceRows:()=>[]};
  vm.runInContext(`discovery.selectedProspects=[{company:'Target',domain:'target.example',buyerRoles:'HR Director',buyerRolesChanged:true,people:[{id:'saved',name:'Anna Buyer',title:'HR Director'}]}];`,f.ctx);
  assert.equal(await vm.runInContext('searchDecisionMakers(discovery.selectedProspects[0])',f.ctx),false);
  assert.equal(captured.seller.offers,'Staff training');assert.equal(captured.seller.markets,'Sweden');assert.match(captured.seller.exclusions,/blocked.example/);
  const c=f.state().selectedProspects[0];assert.equal(c.people[0].name,'Anna Buyer');assert.equal(c.buyerRoles,'HR Director');assert.equal(c.buyerRolesChanged,true);assert.equal(c.buyerDiscovery,undefined);
 });
}
test('pipeline save and reload retains manual buying committee and its research hold',()=>{
 const candidate={company:'Target',domain:'target.example',buyerRoles:'HR Director; Finance Director',buyerRolesChanged:true,buyerRolesSource:'manual'};
 const saved=Discovery.normalizeDiscoveryState({pipeline:Discovery.upsertPipelineItem([],candidate)}).pipeline[0];
 assert.equal(saved.buyerRoles,candidate.buyerRoles);assert.equal(saved.buyerRolesChanged,true);assert.equal(saved.buyerRolesSource,'manual');
});
for(const [label,change] of [['legacy boolean',f=>delete f.main.market.strategyApproval],['stale offers',f=>f.main.profile.priorityOffers='New offer'],['inactive ICPs',f=>f.main.market.icps[0].active=false],['inactive signals',f=>f.main.market.signals[0].active=false],['unapproved Profile',f=>f.main.approved=false],['missing validator',f=>delete f.ctx.LeadIntelStrategyIntegrity]]){
 test(`new company research blocks ${label} before provider work and preserves saved manual research`,async()=>{
  const f=fixture();let calls=0;f.ctx.fetch=async()=>{calls++;throw Error('must not call');};
  vm.runInContext(`discovery.pipeline=[{company:'Saved',domain:'saved.example',buyerRoles:'HR Director',buyerRolesChanged:true}];`,f.ctx);
  change(f);f.write();const before=JSON.stringify(f.state());
  assert.equal(await vm.runInContext('runCompanyDiscovery()',f.ctx),false);assert.equal(calls,0);assert.equal(JSON.stringify(f.state()),before);
 });
}
test('a provider response arriving after a Strategy edit cannot enter company research or start another provider',async()=>{
 const f=fixture();f.ctx.LeadIntelServerBridge.session.authenticated=false;
 let release,started;const pending=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});let calls=0;
 f.ctx.fetch=async()=>{calls++;started();await pending;return {ok:true,json:async()=>({data:[]})};};
 const run=vm.runInContext('runCompanyDiscovery({savingMode:true})',f.ctx);await entered;
 f.main.market.signals[0].keywords='new strategy';f.write();const calledBeforeResponse=calls;release();
 assert.equal(await run,false);assert.equal(calls,calledBeforeResponse);assert.equal(f.state().rawResults.length,0);assert.equal(f.state().needsRefresh,true);
});
test('an old account response arriving after a newer company run cannot change its results or metadata',async()=>{
 const f=fixture();f.ctx.LeadIntelServerBridge.session.authenticated=false;
 let release,started;const pending=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});let old=true;
 f.ctx.fetch=async()=>{if(old){started();await pending;}return {ok:true,json:async()=>({data:[]})};};
 const first=vm.runInContext('runCompanyDiscovery({savingMode:true})',f.ctx);await entered;
 f.ctx.LeadIntelServerBridge.session.user.id='u2';vm.runInContext(`discovery=LeadIntelDiscovery.normalizeDiscoveryState({});`,f.ctx);old=false;
 await vm.runInContext('runCompanyDiscovery({savingMode:true})',f.ctx);const expected=JSON.stringify(f.state()),meta=f.ctx.localStorage.getItem('leadintel_customer_v2_discovery_meta');release();
 assert.equal(await first,false);assert.equal(JSON.stringify(f.state()),expected);assert.equal(f.ctx.localStorage.getItem('leadintel_customer_v2_discovery_meta'),meta);
});
test('retained buyer public research uses active ICP context and stops after a late Strategy dossier response',async()=>{
 const f=fixture();let seller,officialCalls=0;
 f.ctx.LeadIntelCompanyDossierUi={research:async(candidate,request)=>{seller=request.seller;f.main.market.signals[0].keywords='changed';f.write();return {};},evidenceRows:()=>[]};
 f.ctx.LeadIntelDiscovery={...Discovery,runOfficialContactResearch:async()=>{officialCalls++;}};
 vm.runInContext(`renderPipeline=()=>{};renderCandidates=()=>{};discovery.selectedProspects=[{company:'Target',domain:'target.example',buyerSearchMode:'user_selected_target',buyerRoles:'HR Director',people:[{id:'saved',name:'Anna Buyer',title:'HR Director'}]}];`,f.ctx);
 assert.equal(await vm.runInContext(`runPublicProspectContacts('target.example',{personIds:['saved']})`,f.ctx),false);
 assert.equal(seller.offers,'Staff training');assert.equal(seller.markets,'Sweden');assert.equal(officialCalls,0);assert.equal(f.state().selectedProspects[0].people[0].name,'Anna Buyer');
});
test('purchasing-fit retry stops before a recovery provider after the account ticket changes',async()=>{
 const f=fixture();let calls=0;f.ctx.fetch=async()=>{calls++;throw Error('must not call');};
 f.ctx.changeTicket=()=>f.ctx.localStorage.setItem('leadintel_account_context_v1','replacement-ticket');
 vm.runInContext(`discovery.potentialMatches=[{company:'Target',domain:'target.example'}];discovery.searchFailures=[{phase:'buyer-fit',domain:'target.example'}];LeadIntelDiscovery={...LeadIntelDiscovery,researchBuyerFit:async(pool,profile,generate)=>{changeTicket();await generate('saved evidence');return [];}};`,f.ctx);
 assert.equal(await vm.runInContext('retryPurchasingFitChecks()',f.ctx),false);assert.equal(calls,0);assert.equal(f.state().lastRunAt,'');
});
test('pipeline checkpointing retains every role in an expanded sixteen-role research plan',()=>{
 const roles=['Procurement Director','Engineering Director','Project Director','Project Manager','CAPEX Manager','Investment Project Manager','Procurement Manager','Strategic Sourcing Manager','Purchasing Manager','Engineering Manager','Technical Manager','Design Engineer','Operations Director','Plant Manager','Production Manager','Executive leadership'];
 const saved=Discovery.upsertPipelineItem([],{company:'Target',domain:'target.example',buyerRoles:roles,buyerDiscovery:{opportunityRoles:roles}})[0];
 assert.deepEqual(saved.buyerRoles.split('; '),roles);assert.deepEqual(saved.buyerDiscovery.opportunityRoles,roles);
});
test('explicit Strategy handoff starts one bounded company run and retains saved evidence',async()=>{
 const f=fixture();let cancel;f.ctx.LeadIntelTaskCentre={start(){},registerActions:(_id,actions)=>cancel=actions.cancel,fail(){},get:()=>({status:'running'}),update(){},complete(){}};f.ctx.hold=()=>new Promise(()=>{});
 vm.runInContext(`discovery.rawResults=[{url:'https://saved.example/history',text:'Historical evidence'}];runDiscoverySearchBatch=async()=>hold();const originalRun=runCompanyDiscovery;runCompanyDiscovery=(...args)=>(globalThis.companyRun=originalRun(...args));`,f.ctx);
 const result=vm.runInContext('startCompanyResearchFromStrategy()',f.ctx);
 assert.equal(result.status,'running');assert.equal(f.state().status,'running');assert.equal(f.state().rawResults[0].url,'https://saved.example/history');
 const runId=JSON.parse(f.ctx.localStorage.getItem('leadintel_customer_v2_discovery_meta')).lastCompanyRun.runId;
 assert.equal(vm.runInContext('startCompanyResearchFromStrategy()',f.ctx).status,'running');
 assert.equal(JSON.parse(f.ctx.localStorage.getItem('leadintel_customer_v2_discovery_meta')).lastCompanyRun.runId,runId);
 cancel();await f.ctx.companyRun;
});
test('current checked shortlist is reused without any provider call on Strategy Continue',()=>{
 const f=fixture();let calls=0;f.ctx.fetch=async()=>{calls++;throw Error('unexpected research');};
 vm.runInContext(`discovery.status='complete';discovery.needsRefresh=false;rankedCheckedCompanies=()=>[{company:'Checked',domain:'checked.example'}];`,f.ctx);
 assert.equal(vm.runInContext('startCompanyResearchFromStrategy()',f.ctx).status,'ready');assert.equal(calls,0);
});
test('stale shortlist cannot be reused by Strategy Continue',async()=>{
 const f=fixture();let cancel;f.ctx.LeadIntelTaskCentre={start(){},registerActions:(_id,actions)=>cancel=actions.cancel,fail(){},get:()=>({status:'running'}),update(){},complete(){}};
 vm.runInContext(`discovery.needsRefresh=true;rankedCheckedCompanies=()=>[{domain:'old.example'}];runDiscoverySearchBatch=()=>new Promise(()=>{});const originalRun=runCompanyDiscovery;runCompanyDiscovery=(...args)=>(globalThis.companyRun=originalRun(...args));`,f.ctx);
 assert.equal(vm.runInContext('startCompanyResearchFromStrategy()',f.ctx).status,'running');cancel();await f.ctx.companyRun;
});
test('unapproved Strategy handoff fails before providers and preserves historical evidence',()=>{
 const f=fixture();delete f.main.market.strategyApproval;f.write();let calls=0;f.ctx.fetch=async()=>{calls++;};
 vm.runInContext(`discovery.rawResults=[{url:'https://history.example/source',text:'Saved source'}];`,f.ctx);
 assert.equal(vm.runInContext('startCompanyResearchFromStrategy()',f.ctx).status,'blocked');assert.equal(calls,0);assert.equal(f.state().rawResults.length,1);
});
for(const change of ['account ticket','bridge','sign out'])test(`a late research startup exception cannot change Companies after ${change}`,async()=>{
 const f=fixture();vm.runInContext(`runCompanyDiscovery=()=>{discovery.status='running';return Promise.reject(new Error('Delayed startup failure'));};`,f.ctx);
 assert.equal(vm.runInContext('startCompanyResearchFromStrategy()',f.ctx).status,'running');
 if(change==='account ticket')f.ctx.localStorage.setItem('leadintel_account_context_v1','replacement');
 if(change==='bridge')f.ctx.LeadIntelServerBridge={...f.ctx.LeadIntelServerBridge};
 if(change==='sign out')f.ctx.LeadIntelServerBridge.session.authenticated=false;
 f.state().status='complete';await Promise.resolve();await Promise.resolve();assert.equal(f.state().status,'complete');
});
