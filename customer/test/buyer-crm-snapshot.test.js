const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js'),C=require('../crm-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function setup(ok=true){
 const person={id:'anna',name:'Anna Andersson',title:'Project Manager',organization:'Example',publicNameUrl:'https://example.com/team',identityEvidenceDate:'2026-10-01',contactVerification:{status:'verified',checkedAt:'2026-10-04'}};
 const candidate={domain:'example.com',company:'Example',people:[person],peopleStatus:'complete',buyerDiscovery:{opportunityRoles:['Project Manager'],pool:[person],researchIncomplete:true,checkedAt:'2026-10-04'}};
 const writes=[],events=[],bridge={workspace:{id:'w1'},saveCrmCompany:async value=>{writes.push(value);return {ok,error:'save failed',company:{id:'company',normalized_domain:'example.com',workspace_id:'w1'}};}};
 const ctx={discovery:{selectedProspects:[candidate]},canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>true,crmCompanyByDomain:()=>({id:'company'}),bridge:()=>bridge,discoveryOperationContext:()=>JSON.stringify([bridge.workspace?.id,bridge.session?.user?.id]),mainState:()=>({}),LeadIntelDiscovery:D,window:{LeadIntelCrm:C},saveDiscovery:()=>events.push('workspace'),refreshCrmState:async()=>events.push('refresh'),showToast:value=>events.push(value)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function validateCompanySave('),source.indexOf('function captureCompanyAction(')),ctx);vm.runInContext(source.slice(source.indexOf('async function saveBuyerResearch('),source.indexOf('function buyerAutomaticMode(')),ctx);
 return {ctx,candidate,writes,events};
}
test('saving buyer research updates durable qualification without replacing verified contacts or advancing messages',async()=>{
 const {ctx,writes,events}=setup();assert.equal(await ctx.saveBuyerResearch('example.com'),true);
 assert.equal(writes.length,1);assert.equal(writes[0].contacts.length,0);const research=writes[0].intelligence.research_snapshot.buyerResearch;
 assert.equal(research.buyers[0].qualification.eligible,true);assert.equal(research.buyers[0].contactVerification.status,'verified');assert.equal(research.researchIncomplete,true);assert.ok(events.includes('refresh'));
});
test('failed durable save is reported without claiming success or advancing the workflow',async()=>{
 const {ctx,events}=setup(false);assert.equal(await ctx.saveBuyerResearch('example.com'),false);assert.deepEqual(events,['save failed']);
});
test('CRM round trip retains all opportunity inputs in the buyer review signature',()=>{
 for(const buyerRoles of ['Procurement Director; Project Manager',['Procurement Director','Project Manager']])for(const buyerRolesChanged of [false,true]){
  const {candidate}=setup();Object.assign(candidate,{fitDescription:'New production line needs structural components.',buyerRoles,buyerRolesChanged,evidence:[{url:'https://example.com/project',text:'New production line under construction.',date:'2026-10-01'}]});
  const before=D.buyerReviewSignature(candidate),mapped=JSON.parse(JSON.stringify(C.mapDiscoveryCandidateToCrm(candidate))),s=mapped.intelligence.research_snapshot;
  assert.equal(s.fitDescription,candidate.fitDescription);assert.deepEqual(s.buyerRoles,buyerRoles);assert.equal(s.buyerRolesChanged,buyerRolesChanged);
  const reopened={company:mapped.company.company_name,domain:mapped.company.domain,fitDescription:s.fitDescription,buyerRoles:s.buyerRoles,buyerRolesChanged:s.buyerRolesChanged,buyerFit:s.buyerFit,evidence:mapped.intelligence.evidence,people:s.buyerResearch.buyers,buyerDiscovery:s.buyerResearch.discovery,publicResearch:s.buyerResearch.publicResearch};
  assert.equal(D.buyerReviewSignature(reopened),before);
  assert.notEqual(D.buyerReviewSignature({...reopened,fitDescription:'A different opportunity'}),before);
  assert.notEqual(D.buyerReviewSignature({...reopened,buyerRolesChanged:!buyerRolesChanged}),before);
 }
});
