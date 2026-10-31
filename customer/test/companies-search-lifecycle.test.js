const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Discovery=require('../discovery-engine.js');
const Integrity=require('../strategy-integrity.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'\n');
function fixture({deadline=false}={}){
 const main={approved:true,website:'https://seller.example',profile:{website:'https://seller.example',priorityOffers:'Training',idealCustomer:'Hotels',targetMarkets:'Sweden',decisionMakers:'Hotel manager'},targetMarkets:['Sweden'],market:{strategyApproved:true,signals:[{id:'expansion',active:true,weight:8,keywords:'new hotel'}],icps:[{id:'icp-core',type:'core',active:true,description:'Hotels',offers:'Training',buyerRoles:'Hotel manager'}]}};
 main.market.strategyApproval=Integrity.approval(main);
 const storage=new Map([['leadintel_customer_v2_state',JSON.stringify(main)]]),actions=[],events=[];
 const ctx={console:{...console,error(){}},URL,URLSearchParams,AbortController,DOMException,CustomEvent:class{},setTimeout:(fn,ms)=>setTimeout(fn,deadline&&ms>=1000?15:ms),clearTimeout,LeadIntelDiscovery:Discovery,LeadIntelStrategyIntegrity:Integrity,LeadIntelTargeting:{isConfirmed:()=>true,profileFields:()=>({})},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},navigator:{languages:[]},addEventListener(){},removeEventListener(){},dispatchEvent(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},LeadIntelServerBridge:{workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}}},LeadIntelTaskCentre:{start:row=>events.push(['start',row]),registerActions:(_id,row)=>actions.push(row),update(){},get:()=>({status:'running'}),fail:(_id,error)=>events.push(['fail',error.message]),complete:(_id,row)=>events.push(['complete',row])}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 vm.runInContext(`discovery=LeadIntelDiscovery.normalizeDiscoveryState({});renderDiscoverySafely=()=>true;renderAll=()=>{};syncStrategyFingerprint=()=>{};selectedDiscoveryTarget=()=>1;persistDiscoveryTarget=()=>1;refreshCrmState=async()=>false;`,ctx);
 return {ctx,main,storage,actions,events,run:code=>vm.runInContext(code,ctx),state:()=>vm.runInContext('discovery',ctx)};
}
async function settles(promise){return Promise.race([promise.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),90))]);}
function pending(f,name='hold'){const releases=[];f.ctx[name]=()=>new Promise(resolve=>releases.push(resolve));return ()=>releases.forEach(resolve=>resolve([]));}
function verification(f){f.run(`discovery.searchFailures=[{phase:'verifying',queryMeta:{id:'verify-target',kind:'verification',domain:'target.example',company:'Target',query:'site:target.example operations'}}];`);}
test('cancel releases a company search immediately even when the active research helper ignores abort',async()=>{
 const f=fixture();const release=pending(f);f.run(`runDiscoverySearchBatch=async()=>hold();`);
 const running=f.run('runCompanyDiscovery({savingMode:true})');await new Promise(resolve=>setImmediate(resolve));f.actions[0].cancel();
 const stopped=await settles(running);release();await running;
 assert.equal(stopped,true);assert.equal(f.state().status,'partial');assert.equal(JSON.parse(f.storage.get('leadintel_customer_v2_discovery_meta')).lastCompanyRun.canceled,true);
});
test('verification retry deadline releases an ignored-abort search and preserves saved evidence',async()=>{
 const f=fixture({deadline:true});verification(f);const release=pending(f);f.run(`discovery.rawResults=[{url:'https://saved.example/fact',text:'Saved evidence'}];runDiscoverySearchBatch=async()=>hold();`);
 const running=f.run('retryFailedDiscoveryChecks()');const stopped=await settles(running);release();await running;
 assert.equal(stopped,true);assert.equal(f.state().rawResults[0].url,'https://saved.example/fact');assert.notEqual(f.state().status,'running');
});
test('purchasing-fit retry saves each completed batch before cancellation and reports cancellation',async()=>{
 const f=fixture();const release=pending(f);f.run(`discovery.potentialMatches=[{company:'Target',domain:'target.example'}];discovery.searchFailures=[{phase:'buyer-fit',domain:'target.example'}];LeadIntelDiscovery={...LeadIntelDiscovery,researchBuyerFit:async(pool,profile,generate,options)=>{options.onProgress({completed:1,total:2,candidates:[{...pool[0],buyerFitIssueCode:'insufficient_evidence',buyerFitIssue:'Needs more evidence'}]});return hold();}};`);
 const running=f.run('retryPurchasingFitChecks()');await new Promise(resolve=>setImmediate(resolve));
 const saved=JSON.parse(f.storage.get('leadintel_customer_v2_discovery')||'{}');f.actions[0].cancel();const stopped=await settles(running);release();await running;
 assert.equal(saved.potentialMatches?.[0]?.buyerFitIssueCode,'insufficient_evidence');assert.equal(stopped,true);assert.equal(f.state().status,'partial');assert.equal(JSON.parse(f.storage.get('leadintel_customer_v2_discovery_meta')).lastCompanyRun.canceled,true);assert.equal(f.events.some(([type])=>type==='complete'),false);
});
test('stale batch workers cannot consume a replacement run budget or touch its funnel',async()=>{
 const f=fixture();f.run(`startDiscoveryBudget(1);discovery.funnel={budgetSkippedChecks:0};`);const controller=new AbortController();let current=true;controller.signal.leadIntelScopeValid=()=>current;f.ctx.signal=controller.signal;const release=pending(f);f.run(`firecrawlCompanySearch=async()=>hold();`);
 const running=f.run(`runDiscoverySearchBatch(Array.from({length:6},(_,index)=>({id:index,query:'hotel'})),'searching',signal)`);await new Promise(resolve=>setImmediate(resolve));current=false;f.run(`startDiscoveryBudget(1);reserveFirecrawlCall();discovery.funnel={budgetSkippedChecks:0};`);release();await running.catch(()=>{});
 assert.equal(f.state().funnel.budgetSkippedChecks,0);
});
test('successful search rows are saved before a later worker hangs or the run is canceled',async()=>{
 const f=fixture(),release=pending(f);let calls=0;f.ctx.row=async()=>++calls===1?[{url:'https://news.example/company',text:'Acquired company evidence',sourceRead:true}]:f.ctx.hold();f.run(`firecrawlCompanySearch=()=>row();`);
 const controller=new AbortController();f.ctx.signal=controller.signal;const running=f.run(`runDiscoverySearchBatch([{id:'one'},{id:'two'}],'searching',signal)`);await new Promise(resolve=>setImmediate(resolve));
 const saved=JSON.parse(f.storage.get('leadintel_customer_v2_discovery'));assert.equal(saved.rawResults[0].url,'https://news.example/company');controller.abort();release();await running.catch(()=>{});
});
test('an old canceled provider callback cannot change a newer run in the same workspace',async()=>{
 const f=fixture(),release=pending(f);f.run(`runDiscoverySearchBatch=async(items,phase,signal)=>{await hold();throwIfDiscoveryRunAborted(signal);discovery.rawResults=[{url:'https://old.example/late'}];};`);
 const old=f.run('runCompanyDiscovery({savingMode:true})');await new Promise(resolve=>setImmediate(resolve));f.actions[0].cancel();assert.equal(await settles(old),true);
 f.run(`runDiscoverySearchBatch=async()=>[];`);await f.run('runCompanyDiscovery({savingMode:true})');const expected=JSON.stringify(f.state()),meta=f.storage.get('leadintel_customer_v2_discovery_meta');release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(JSON.stringify(f.state()),expected);assert.equal(f.storage.get('leadintel_customer_v2_discovery_meta'),meta);
});
test('a fresh empty search retains historical raw evidence through save and reload',async()=>{
 const f=fixture();f.run(`discovery.rawResults=Array.from({length:65},(_,index)=>({url:'https://saved.example/'+index,text:'Saved source '+index,sourceRead:true,verifiedAt:'2026-10-30T00:00:00Z'}));runDiscoverySearchBatch=async()=>[];`);
 await f.run('runCompanyDiscovery({savingMode:true})');const saved=JSON.parse(f.storage.get('leadintel_customer_v2_discovery'));
 assert.equal(saved.rawResults.length,65);assert.equal(Discovery.normalizeDiscoveryState(saved).rawResults.length,65);
});
test('long search snippets stay unread while actual Firecrawl markdown carries page-read provenance',async()=>{
 const f=fixture();f.ctx.fetch=async()=>({ok:true,json:async()=>({data:[{url:'https://news.example/snippet',description:'Search snippet about operating hotels and recent expansion in Sweden. '.repeat(5)},{url:'https://news.example/read',markdown:'Extracted page about operating hotels and recent expansion in Sweden. '.repeat(5)}]})});
 f.run('startDiscoveryBudget(5)');const rows=await f.run(`firecrawlCompanySearch({id:'market',kind:'discovery',query:'Sweden hotels'},undefined)`);
 const snippet=rows.find(row=>row.url.endsWith('/snippet')),read=rows.find(row=>row.url.endsWith('/read'));
 assert.equal(snippet.sourceRead,false);assert.equal(snippet.verifiedAt,'');assert.equal(read.sourceRead,true);assert.ok(read.verifiedAt);
});
test('grounded model summaries do not become extracted page evidence',async()=>{
 const f=fixture();f.ctx.fetch=async()=>({ok:true,json:async()=>({results:[{url:'https://target.example/about',markdown:'Model returned text about hotel operations. '.repeat(5),sourceRead:true}]})});
 const rows=await f.run(`openAiCompanySearch({id:'verify',kind:'verification',domain:'target.example',query:'hotel operations'})`);
 assert.equal(rows[0].sourceRead,false);assert.equal(rows[0].evidenceKind,'model_summary');assert.equal(rows[0].verifiedAt,'');
});
test('website evidence collection has a hard deadline even if its adapter ignores abort',async()=>{
 const f=fixture({deadline:true}),release=pending(f);f.ctx.LeadIntelFirstPartyResearch={collectWebsiteEvidence:()=>f.ctx.hold(),boundedSources:()=>[]};
 const running=f.run(`scrapeCompanyWebsiteForVerification({kind:'verification',domain:'target.example'})`);const stopped=await settles(running);release();await running;
 assert.equal(stopped,true);
});
test('verification retry retains completed fit batches if the next batch ignores abort',async()=>{
 const f=fixture();verification(f);const release=pending(f);f.run(`runDiscoverySearchBatch=async()=>[];LeadIntelDiscovery={...LeadIntelDiscovery,mergeCompanyCandidates:()=>[{company:'Target',domain:'target.example'},{company:'Later',domain:'later.example'}],buildPotentialCompanyCandidates:()=>[],researchBuyerFit:async(pool,profile,generate,options)=>{options.onProgress({completed:1,total:2,candidates:[{...pool[0],buyerFitIssueCode:'insufficient_evidence',buyerFitIssue:'Need official facts'}]});return hold();}};`);
 const running=f.run('retryFailedDiscoveryChecks()');await new Promise(resolve=>setImmediate(resolve));const saved=JSON.parse(f.storage.get('leadintel_customer_v2_discovery'));assert.equal(saved.potentialMatches[0].buyerFitIssueCode,'insufficient_evidence');f.actions[0].cancel();assert.equal(await settles(running),true);release();await running;
 assert.equal(f.state().potentialMatches[0].buyerFitIssueCode,'insufficient_evidence');assert.ok(f.state().potentialMatches.some(row=>row.domain==='later.example'));assert.equal(f.state().searchFailures.find(row=>row.domain==='later.example')?.phase,'buyer-fit');assert.equal(f.state().status,'partial');assert.equal(JSON.parse(f.storage.get('leadintel_customer_v2_discovery_meta')).lastCompanyRun.canceled,true);
});
test('a failed final save cannot report a completed company search',async()=>{
 const f=fixture();f.ctx.failFinal=()=>{const original=f.ctx.localStorage.setItem;f.ctx.localStorage.setItem=(key,value)=>{if(key==='leadintel_customer_v2_discovery'&&JSON.parse(value).status!=='running')throw Error('quota');return original(key,value);};};
 f.run(`runDiscoverySearchBatch=async()=>{failFinal();return [];};`);await f.run('runCompanyDiscovery({savingMode:true})');
 assert.equal(f.state().status,'partial');assert.equal(f.events.some(([type])=>type==='complete'),false);assert.equal(JSON.parse(f.storage.get('leadintel_customer_v2_discovery_meta')).lastCompanyRun.persistence,'failed');
});
for(const [label,change] of [['account ticket',f=>f.storage.set('leadintel_account_context_v1','changed')],['Strategy',f=>{f.main.market.signals[0].weight=2;f.storage.set('leadintel_customer_v2_state',JSON.stringify(f.main));}]]){
 test(`campaign discovery stops before another CRM write after a ${label} change`,async()=>{
  const f=fixture();let writes=0;f.ctx.LeadIntelCrm={canonicalDomain:Discovery.canonicalDomain,mapDiscoveryCandidateToCrm:c=>c};f.ctx.LeadIntelServerBridge.saveCrmCompany=async()=>{writes++;change(f);return {ok:true,company:{id:'saved'}};};
  f.run(`openCampaignResearch=async()=>true;runCompanyDiscovery=async({campaignPlan})=>{campaignPlan.results=[{company:'One',domain:'one.example',qualification:{eligible:true}},{company:'Two',domain:'two.example',qualification:{eligible:true}}];return true;};`);
  await assert.rejects(f.run(`discoverCampaign({targetCount:2})`),/Workspace or Strategy changed/);assert.equal(writes,1);
 });
}
test('campaign discovery uses its bounded requested count, deduplicates domains and returns default-count results',async()=>{
 const f=fixture(),calls=[];f.ctx.LeadIntelCrm={canonicalDomain:Discovery.canonicalDomain,mapDiscoveryCandidateToCrm:c=>c};f.ctx.LeadIntelServerBridge.saveCrmCompany=async c=>{calls.push(c.domain);return {ok:true,company:{id:c.domain}};};
 f.run(`openCampaignResearch=async()=>true;runCompanyDiscovery=async({campaignPlan})=>{campaignPlan.results=[{company:'One',domain:'one.example',qualification:{eligible:true}},{company:'One duplicate',domain:'one.example',qualification:{eligible:true}},{company:'Two',domain:'two.example',qualification:{eligible:true}}];return true;};`);
 assert.equal((await f.run('discoverCampaign({targetCount:1})')).length,1);assert.deepEqual(calls,['one.example']);calls.length=0;
 assert.equal((await f.run('discoverCampaign({})')).length,2);assert.deepEqual(calls,['one.example','two.example']);
});
test('Companies to Buyers website refresh retains every historical source and its original provenance',async()=>{
 const f=fixture(),at='2026-10-30T00:00:00Z';
 const history=Array.from({length:16},(_,index)=>({url:index===15?'https://target.example/history':'https://industry.example/news/'+index,title:'Historical source '+index,text:'Source-backed target company history '+index,sourceRead:index!==1,evidenceKind:index===1?'search_snippet':'page_read',sourceType:'industry_news',verifiedAt:index===1?'':at,extractedAt:at,date:'2026-10-01',dateSource:'published'}));
 f.ctx.history=history;
 f.ctx.LeadIntelCompanyDossierUi={research:async()=>({}),evidenceRows:()=>[]};
 f.ctx.LeadIntelFirstPartyResearch={collectWebsiteEvidence:async()=>({pages:[{url:'https://target.example/team',title:'Official team',text:'Target operates hotels in Sweden and publishes its official management team. '.repeat(3),fetchedAt:at,statusCode:200}]})};
 f.ctx.LeadIntelDiscovery={...Discovery,runOfficialContactResearch:async()=>{throw Error('Controlled interruption after company evidence checkpoint');}};
 f.run(`discovery.selectedProspects=[{company:'Target',domain:'target.example',website:'https://target.example/',buyerSearchMode:'user_selected_target',buyerRoles:'Hotel manager',buyerRolesSource:'manual',people:[],evidence:history}];`);
 await f.run(`searchDecisionMakers(discovery.selectedProspects[0],{allowCrmSync:false})`);
 const saved=JSON.parse(f.storage.get('leadintel_customer_v2_discovery')).selectedProspects[0];
 assert.equal(saved.evidence.length,17,'new official evidence must supplement all sixteen retained sources');
 for(const source of history)assert.deepEqual(saved.evidence.find(row=>row.url===source.url),source,'old source provenance must stay unchanged');
 const official=saved.evidence.find(row=>row.url==='https://target.example/team');assert.equal(official.sourceRead,true);assert.equal(official.evidenceKind,'page_read');assert.equal(saved.buyerRolesSource,'manual');
});
test('retained discovery diagnostics distinguish observed source rows from duplicate URLs',async()=>{const f=fixture();f.run(`firecrawlCompanySearch=async()=>[{url:'https://source.example/a',text:'Read source A',sourceRead:true},{url:'https://source.example/a',text:'Read source A',sourceRead:true},{url:'https://source.example/b',text:'Read source B',sourceRead:true}];`);const controller=new AbortController();f.ctx.signal=controller.signal;await f.run(`runDiscoverySearchBatch([{id:'one'}],'searching',signal)`);assert.equal(f.state().funnel.evidenceRowsObserved,3);assert.equal(f.state().funnel.duplicateEvidenceRows,1);const restored=Discovery.normalizeDiscoveryState(JSON.parse(JSON.stringify(f.state())));assert.equal(restored.funnel.evidenceRowsObserved,3);assert.equal(restored.funnel.duplicateEvidenceRows,1);});
