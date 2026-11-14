const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function part(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function clearFixture(){
 const modal={hidden:true},b={workspace:{id:'a'},session:{authenticated:true,user:{id:'u'}}};
 const c={discovery:{status:'complete',candidates:[{domain:'a.example'}],selectedProspects:[]},LeadIntelDiscovery:D,bridge:()=>b,discoveryOperationContext:()=>b.workspace.id,captureCompanyAction:()=>({state:c.discovery,bridge:b,context:b.workspace.id}),companyActionCurrent:o=>c.discovery===o.state&&o.bridge===b&&o.context===b.workspace.id,document:{activeElement:null,body:{classList:{add(){},remove(){}}}},$:id=>id==='clear-company-results-modal'?modal:null,showToast(){},loadMeta:()=>({}),saveMeta(){},saveDiscovery(){},renderAll(){},clearCompanySearchProgressClock(){},enrichmentResults:new Map(),enrichmentPending:new Set(),selectedBuyerEnrichment:new Set(),automaticPublicChecks:new Set(),window:{LeadIntelBuyerResearchJobs:{isObserving:row=>row.buyerResearchJob?.status==='running'}}};
 vm.createContext(c);vm.runInContext(part('let clearCompanyResultsReturnFocus=','function moduleReady()'),c);return {c,b};
}
test('Clear confirmation cannot clear a replacement workspace',()=>{
 const {c,b}=clearFixture();assert.equal(c.openClearCompanyResultsModal(),true);b.workspace.id='b';const replacement={status:'complete',candidates:[{domain:'b.example'}],selectedProspects:[]};c.discovery=replacement;
 assert.equal(c.clearCompanySearchResults(),false);assert.equal(c.discovery,replacement);assert.equal(c.discovery.candidates.length,1);
});
test('Clear cannot detach an active durable Buyer research owner',()=>{
 const {c}=clearFixture();const selected={domain:'a.example',peopleStatus:'loading',buyerResearchJob:{id:'job-a',status:'running'}};c.discovery.selectedProspects=[selected];const before=c.discovery;
 assert.equal(c.openClearCompanyResultsModal(),false);assert.equal(c.clearCompanySearchResults(),false);assert.equal(c.discovery,before);assert.equal(c.discovery.selectedProspects[0],selected);
});
function reviewFixture(){
 const row={company:'Target',domain:'a.example',people:[],peopleStatus:'idle'},b={workspace:{id:'a'},session:{authenticated:true,user:{id:'u'}}},calls=[];
 const c={discovery:{status:'complete',candidates:[],potentialMatches:[row],selectedProspects:[]},researchReviewRows:()=>[row],researchReviewKey:x=>x.domain,canonicalDomain:x=>x,mergeWorkflowCompanies:(_a,rows)=>rows,saveDiscovery(){},renderAll(){},showToast(){},startSelectedBuyerResearch:owner=>calls.push(owner),crmAuthenticated:()=>true,bridge:()=>b,captureCompanyAction:()=>({state:c.discovery,bridge:b}),companyActionCurrent:o=>o.state===c.discovery&&o.bridge===b,claimCompanySelection:()=>({state:c.discovery,bridge:b}),finishCompanySelection(){},focusBuyerCompany(){},ensureCrmCompany:async()=>({id:'crm-a'}),validateCompanySave:()=>({id:'crm-a'})};
 vm.createContext(c);vm.runInContext(part('async function selectResearchReviewForBuyers(','function unselectResearchReviewForBuyers(').replace(/^function selectResearchReviewForBuyers/,'async function selectResearchReviewForBuyers'),c);return {c,row,calls};
}
test('Research review waits for CRM acknowledgement before persisting and starting Buyers',async()=>{
 const {c,calls}=reviewFixture();let release;c.ensureCrmCompany=()=>new Promise(resolve=>{release=resolve});const pending=c.selectResearchReviewForBuyers('a.example');await Promise.resolve();assert.equal(c.discovery.selectedProspects.length,0);assert.equal(calls.length,0);assert.equal(typeof release,'function');release({id:'crm-a'});assert.equal(await pending,true);assert.equal(c.discovery.selectedProspects[0].crmId,'crm-a');assert.equal(calls.length,1);
});
test('Research review cannot start Buyers after CRM rejects an archived company',async()=>{
 const {c,calls}=reviewFixture();c.ensureCrmCompany=async()=>{throw Error('Restore archived company in CRM')};assert.equal(await c.selectResearchReviewForBuyers('a.example'),false);assert.equal(c.discovery.selectedProspects.length,0);assert.equal(calls.length,0);
});
