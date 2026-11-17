const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
for(const mode of ['user_selected_target','user_selected_without_signal'])test('a saved '+mode+' keeps its authoritative CRM identity through normalization',()=>{
 const candidate={company:'Buyer',domain:'buyer.example',crmId:'saved-company',buyerSearchMode:mode,marketVerified:true,fitVerified:true,qualificationGaps:['No active buying signal was confirmed'],evidence:[{url:'https://buyer.example/about',text:'Buyer operates an industrial manufacturing facility.'}],people:[]};
 let state={selectedProspects:[candidate],potentialMatches:[candidate]};
 for(let i=0;i<2;i++){state=D.normalizeDiscoveryState(JSON.parse(JSON.stringify(state)));assert.equal(state.selectedProspects.length,1);assert.equal(state.selectedProspects[0].crmId,'saved-company');assert.equal(state.potentialMatches[0].crmId,'saved-company');}
});
function fixture(){
 let release,entered;const pending=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve),candidate={company:'Buyer',domain:'buyer.example',crmId:'company',people:[],peopleStatus:'idle'},calls={reads:0,restore:0,jobReads:0,starts:0};
 const bridge={workspace:{id:'w'},session:{authenticated:true,user:{id:'u'}},getCrmCompany:async()=>{calls.reads++;entered();return pending;}},c={window:null,discovery:{selectedProspects:[candidate]},bridge:()=>bridge,crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,canonicalDomain:D.canonicalDomain,scope:'original',captureCompanyAction:()=>({scope:c.scope}),companyActionCurrent:o=>o.scope===c.scope,restoreNewerBuyerResearch:(owner,detail)=>{calls.restore++;const buyers=detail.intelligence?.research_snapshot?.buyerResearch?.buyers||[];if(!buyers.length)return false;owner.people=buyers;owner.buyerDiscovery={checkedAt:'2026-11-14T10:00:00Z'};return true;},ensureCrmCompany:async()=>({id:'company'}),runDurableBuyerResearch:async()=>{calls.jobReads++;return false;},findPotentialDecisionMakers:async()=>{assert.equal(candidate.__leadIntelBuyerStart,undefined);calls.starts++;return true;},setJourneyFocus(){},saveDiscovery(){},renderAll(){},showToast(){}};c.window=c;vm.createContext(c);
 vm.runInContext(section('function validateCompanySave(','function captureCompanyAction(')+section('function buyerHydrationScope(','function buyerHydrationProfiles(')+section('async function restoreCompanyBeforeBuyerStart(','async function selectTargetForBuyers('),c);
 const detail=people=>({ok:true,company:{id:'company',workspace_id:'w',normalized_domain:'buyer.example',lifecycle_status:'prospect'},intelligence:{research_snapshot:{buyerResearch:{buyers:people}}}});
 return {c,candidate,calls,release,started,detail};
}
test('automatic selection awaits scoped CRM research before considering a new Buyer start',async()=>{
 const f=fixture(),run=f.c.startSelectedBuyerResearch(f.candidate);await f.started;assert.equal(f.calls.starts,0);assert.equal(f.calls.jobReads,0);assert.ok(f.candidate.__leadIntelBuyerStart);
 assert.equal(await f.c.startSelectedBuyerResearch(f.candidate),false,'A second click cannot start a parallel restore');f.release(f.detail([{id:'one',name:'Saved Buyer'}]));assert.equal(await run,true);assert.equal(f.calls.starts,0);assert.equal(f.calls.jobReads,0);assert.equal(f.candidate.people.length,1);assert.equal(f.candidate.__leadIntelBuyerStart,undefined);
});
test('a genuinely unresearched CRM company continues through the original durable restore/start path',async()=>{
 const f=fixture(),run=f.c.startSelectedBuyerResearch(f.candidate);await f.started;f.release(f.detail([]));assert.equal(await run,true);assert.equal(f.calls.jobReads,1);assert.equal(f.calls.starts,1);
});
test('CRM read failure retains selection and offers retry without creating Buyer work',async()=>{
 const f=fixture(),run=f.c.startSelectedBuyerResearch(f.candidate);await f.started;f.release({ok:false,error:'Controlled CRM unavailable'});assert.equal(await run,false);assert.equal(f.calls.starts,0);assert.equal(f.calls.jobReads,0);assert.equal(f.c.discovery.selectedProspects[0],f.candidate);assert.equal(f.candidate.peopleStatus,'error');assert.match(f.candidate.buyerDiscovery.lastError.message,/CRM unavailable/);assert.equal(f.candidate.__leadIntelBuyerStart,undefined);
});
test('a Strategy or workspace change during the detail read prevents hydration and new work',async()=>{
 const f=fixture(),run=f.c.startSelectedBuyerResearch(f.candidate);await f.started;f.c.scope='replacement';f.release(f.detail([{id:'old',name:'Old Buyer'}]));assert.equal(await run,false);assert.equal(f.calls.restore,0);assert.equal(f.calls.starts,0);assert.deepEqual(f.candidate.people,[]);
});
for(const field of ['id','workspace_id','normalized_domain'])test('a mismatched CRM '+field+' is held before hydration or Buyer dispatch',async()=>{
 const f=fixture(),run=f.c.startSelectedBuyerResearch(f.candidate);await f.started;const detail=f.detail([{id:'other',name:'Other Buyer'}]);detail.company[field]='different';f.release(detail);assert.equal(await run,false);assert.equal(f.calls.restore,0);assert.equal(f.calls.starts,0);assert.equal(f.candidate.peopleStatus,'error');
});
