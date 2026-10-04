const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
const ui=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
function runtime({identity,firecrawlError=true,groundedError=true,websiteError=false}){
 const start=ui.indexOf('async function searchDecisionMakers('),end=ui.indexOf('function saveLocalPipeline',start);
 const helpers=ui.slice(ui.indexOf('function buyerResearchIncomplete('),ui.indexOf('function buyerProviderStatusHtml('));
 const candidate={company:'LKAB',domain:'lkab.com',website:'https://lkab.com',market:'Sweden',buyerFit:{purchase:'plant equipment installation project procurement'},people:[]};
 const state={profile:{decisionMakers:'CEO'}};
 const context={AbortController,setTimeout,clearTimeout,Date,console,window:{LeadIntelFirstPartyResearch:{collectWebsiteEvidence:async()=>{if(websiteError)throw Object.assign(new Error("website extraction unavailable"),{status:503});return {pages:[]}}}},LeadIntelDiscovery:D,mainState:()=>state,canonicalDomain:D.canonicalDomain,showToast:()=>{},saveDiscovery:()=>{},renderAll:()=>{},discovery:{pipeline:[],selectedProspects:[candidate]},DISCOVERY_REQUEST_TIMEOUT_MS:1,LEADINTEL_API:'https://example.test',crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,bridge:()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>identity}),fetchBuyerResearch:async()=>{if(groundedError)throw Object.assign(new Error('grounded timed out'),{name:'AbortError'});return {ok:true,json:async()=>({results:[]})}},searchBuyerPublicPages:async()=>{if(firecrawlError)throw Object.assign(new Error('upstream unavailable'),{status:502});return []},BUYER_RESEARCH_VERSION:'20261004-research-state-v1',PUBLIC_NAME_CHECK_VERSION:'test',findPublicProspectContacts:async()=>{},refreshCrmState:async()=>{}};
 vm.createContext(context);vm.runInContext(helpers+'\n'+ui.slice(start,end)+'\nthis.run=searchDecisionMakers;',context);
 return {context,candidate};
}
test('failed providers still trace all ten identity rows and report incomplete without losing pending buyers',async()=>{
 const identity={ok:true,people:Array.from({length:10},(_,i)=>({id:'apollo-'+i,name:'Anna',title:'Inköpschef',organization_name:'LKAB'}))};
 const {context,candidate}=runtime({identity});assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(candidate.buyerDiscovery.providerStatus.firecrawl.failures.length,18);
 assert.equal(candidate.buyerDiscovery.providerStatus.firecrawl.failures[0].status,502);
 assert.equal(candidate.buyerDiscovery.providerStatus.grounded.status,'timeout');
 assert.equal(candidate.buyerDiscovery.resultDiagnostics.filter(d=>d.source==='identity').length,10);
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(candidate.buyerResearchProgress.label,'Research incomplete');
 assert.equal(candidate.people.length,0);
 assert.equal(candidate.buyerDiscovery.pool.length,10);
});
test('opportunity roles remain consistent through parsing and ranking, even when seller profile lists CEO',async()=>{
 const {context,candidate}=runtime({identity:{ok:true,people:[{id:'one',name:'Anna Andersson',title:'Inköpschef',organization_name:'LKAB'}]}});
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(candidate.people.length,1);assert.equal(candidate.people[0].title,'Inköpschef');
});
test('only fully completed providers permit a completed empty-result state',()=>{
 const context={};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchIncomplete('),ui.indexOf('function buyerProviderFailure('))+'\nthis.check=buyerResearchIncomplete;',context);
 assert.equal(context.check({firecrawl:{status:'complete'},grounded:{status:'complete'},identity:{status:'complete'}}),false);
 for(const status of ['failed','timeout','partial','not_configured','pending'])assert.equal(context.check({firecrawl:{status}}),true);
});

test('company website outage does not prevent buyer identity fallback',async()=>{
 const {context,candidate}=runtime({websiteError:true,identity:{ok:true,people:[{id:'one',name:'Anna Andersson',title:'Inköpschef',organization_name:'LKAB'}]}});
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(candidate.people.length,1);
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.ok(candidate.buyerDiscovery.issues.some(issue=>issue.includes('website extraction unavailable')));
});
test('CRM receives the final verified buyer state and CRM outage preserves research',async()=>{
 const {context,candidate}=runtime({firecrawlError:false,groundedError:false,identity:{ok:true,people:[{id:'one',name:'Anna Andersson',title:'Inköpschef',organization_name:'LKAB'}]}});
 const snapshots=[];
 context.crmCompanyByDomain=()=>({id:'company'});
 context.window.LeadIntelCrm={mapDiscoveryCandidateToCrm:value=>JSON.parse(JSON.stringify(value))};
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'one',name:'Anna Andersson',title:'Inköpschef',organization_name:'LKAB'}]}),saveCrmCompany:async value=>{snapshots.push(value);throw new Error('CRM unavailable');}});
 context.findPublicProspectContacts=async()=>{candidate.people[0].publicName='Anna Verified';candidate.publicContactStatus='complete';};
 assert.equal(await context.run(candidate),true);
 assert.equal(snapshots.length,1);
 assert.equal(snapshots[0].people[0].publicName,'Anna Verified');
 assert.equal(snapshots[0].buyerResearchProgress.phase,'complete');
 assert.equal(candidate.peopleStatus,'complete');
});

test('four public names no longer skip directory discovery',async()=>{
 const {context,candidate}=runtime({firecrawlError:false,groundedError:false,identity:{ok:true,people:[]}});let calls=0;
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>{calls++;return {ok:true,people:[]};}});
 context.searchBuyerPublicPages=async()=>['Anna Andersson','Bertil Berg','Carl Carlson','Dora Dahl'].map(name=>({title:`${name} | Inköpschef | LKAB`,url:'https://linkedin.com/in/'+name.replace(/ /g,'-')}));
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);assert.equal(calls,1);assert.equal(candidate.people.length,4);assert.equal(candidate.buyerDiscovery.providerStatus.identity.status,'complete');
});
test('previous pending identities are researched even with a populated public shortlist and survive reload resolved',async()=>{
 const {context,candidate}=runtime({firecrawlError:false,groundedError:false,identity:{ok:true,people:[]}});
 candidate.buyerDiscovery={pool:[{id:'old-markus',name:'Markus',firstName:'Markus',title:'Projektchef',organization:'LKAB',identityStatus:'pending'}]};const queries=[];
 context.searchBuyerPublicPages=async query=>{queries.push(query);return query.includes('"Markus"')?[{title:'Markus Andersson | Projektchef | LKAB',url:'https://linkedin.com/in/markus-andersson'}]:[];};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(queries.filter(q=>q.includes('"Markus"')).length,2);assert.equal(candidate.people[0].name,'Markus Andersson');assert.equal(candidate.people[0].id,'old-markus');
 assert.equal(candidate.buyerDiscovery.pool.some(p=>p.identityStatus==='pending'),false);
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target'}]});assert.equal(restored.selectedProspects[0].buyerDiscovery.pool[0].name,'Markus Andersson');
 assert.equal(restored.selectedProspects[0].buyerDiscovery.resultDiagnostics.find(d=>d.source==='identity_resolution').accepted,true);
});
