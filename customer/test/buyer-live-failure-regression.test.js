const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
const ui=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
function runtime({identity,firecrawlError=true,groundedError=true}){
 const start=ui.indexOf('async function searchDecisionMakers('),end=ui.indexOf('function saveLocalPipeline',start);
 const helpers=ui.slice(ui.indexOf('function buyerResearchIncomplete('),ui.indexOf('function buyerProviderStatusHtml('));
 const candidate={company:'LKAB',domain:'lkab.com',website:'https://lkab.com',market:'Sweden',buyerFit:{purchase:'plant equipment installation project procurement'},people:[]};
 const state={profile:{decisionMakers:'CEO'}};
 const context={AbortController,setTimeout,clearTimeout,Date,console,window:{LeadIntelFirstPartyResearch:{collectWebsiteEvidence:async()=>({pages:[]})}},LeadIntelDiscovery:D,mainState:()=>state,canonicalDomain:D.canonicalDomain,showToast:()=>{},saveDiscovery:()=>{},renderAll:()=>{},discovery:{pipeline:[],selectedProspects:[candidate]},DISCOVERY_REQUEST_TIMEOUT_MS:1,LEADINTEL_API:'https://example.test',crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,bridge:()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>identity}),fetchBuyerResearch:async()=>{if(groundedError)throw Object.assign(new Error('grounded timed out'),{name:'AbortError'});return {ok:true,json:async()=>({results:[]})}},searchBuyerPublicPages:async()=>{if(firecrawlError)throw Object.assign(new Error('upstream unavailable'),{status:502});return []},PUBLIC_NAME_CHECK_VERSION:'test',findPublicProspectContacts:async()=>{},refreshCrmState:async()=>{}};
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
