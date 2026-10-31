const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function flow({enabled=false,cached=false,automatic=false,approved=true}={}){
 const calls=[],person={id:'apollo-anna',name:'Anna Buyer',publicNameUrl:'https://example.com/team',publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/team'},candidate={domain:'example.com',people:[person]},results=new Map();
 if(cached)results.set('p',{contact:{id:'crm-anna',name:'Anna Buyer',external_person_id:'apollo-anna',company_id:'c',workspace_id:'w',work_email:'anna@example.com',email_status:'verified'}});
 const ctx={LEADINTEL_API:'https://api.example',console,Date,Promise,CONTACT_CONFIRM_VERSION:'v11',enrichmentPending:new Set(),enrichmentResults:results,LeadIntelDiscovery:{qualifyBuyer:()=>({eligible:true}),buyerQualityAssessment:()=>({researchPassed:true}),buyerResearchCoveragePassed:()=>true},crmCompanyByDomain:()=>null,crmAuthenticated:()=>true,personKey:()=> 'p',renderAll(){},buyerAutomaticMode:()=>false,verifiedBuyerEmail:(c,p,x)=>x.email_status==='verified'?x.work_email:'',resolveApolloBuyer:async(c,p)=>p,ensureCrmCompany:async()=>({id:'c'}),canonicalDomain:x=>x,saveDiscovery(){},refreshCrmState:async()=>{},showToast(){},CustomEvent:class{},window:{dispatchEvent(){},LeadIntelDialogs:{confirm:async()=>{calls.push('credit-approval');return approved;}},LeadIntelCrm:{mapContacts:()=>[{}]}},bridge:()=>({workspace:{id:'w'},enrichCrmContact:async()=>{calls.push('apollo');return {ok:true,contact:{id:'crm-anna',name:'Anna Buyer',external_person_id:'apollo-anna',company_id:'c',workspace_id:'w',work_email:'anna@example.com',email_status:'verified'}};},saveCrmContacts:async()=>({ok:true})}),fetch:async url=>{calls.push(String(url));return {ok:true,json:async()=>String(url).includes('approved-workflow')?{status:approved?'automatic':'manual',config:{buyers:{confirmContacts:true}}}:String(url).includes('verify-email')?{status:'valid',deliverability:'deliverable',checked_at:new Date().toISOString()}:{providers:[{provider:'hunter',source:'customer',metadata:{additional_verification_enabled:enabled}}]}};}};
 const stableBridge=ctx.bridge();ctx.bridge=()=>stableBridge;require('./helpers/buyer-action-context.cjs').prepare(ctx,candidate);
 vm.runInNewContext(require('./helpers/buyer-action-context.cjs').source+source.slice(source.indexOf('async function confirmBuyerContact('),source.indexOf('const contactFlowPromises=')),ctx);
 ctx.discovery={selectedProspects:[candidate]};
 return {ctx,calls,candidate,run:()=>ctx.confirmBuyerContact(candidate,0,{automatic}),person};
}
test('connected Hunter stays unused by default and Apollo runs first',async()=>{const f=flow();assert.equal(await f.run(),true);assert.deepEqual(f.calls.slice(0,2),['credit-approval','apollo']);assert.equal(f.calls.some(c=>c.includes('/hunter/')),false);assert.equal(f.person.contactVerification.status,'verified');});
test('verified cached contacts avoid another Apollo lookup',async()=>{const f=flow({cached:true});await f.run();assert.equal(f.calls.includes('apollo'),false);assert.equal(f.calls.some(c=>c.includes('/hunter/')),false);});
test('enabled Hunter does not spend credits after Apollo already verified the address',async()=>{const f=flow({enabled:true});await f.run();assert.equal(f.calls.filter(c=>c.includes('/hunter/verify-email')).length,0);assert.equal(f.calls.some(c=>c.includes('/hunter/find-email')),false);assert.deepEqual(f.calls.slice(0,2),['credit-approval','apollo']);});
test('automatic buyer workflows cannot spend Apollo or Hunter credits without separate manual approval',async()=>{for(const approved of [true,false]){const f=flow({automatic:true,approved,enabled:true});assert.equal(await f.run(),false);assert.equal(f.calls.includes('apollo'),false);assert.equal(f.calls.some(c=>c.includes('/hunter/')),false);assert.equal(f.calls.includes('credit-approval'),false);}});

test('official source check precedes Apollo and an accepted public confirmation avoids paid enrichment',async()=>{
 const f=flow();f.ctx.publicBuyerSource=()=>({email:'anna@example.com'});
 f.ctx.confirmPublicBuyerSource=async()=>{f.calls.push('public-source');f.ctx.enrichmentResults.set('p',{contact:{work_email:'anna@example.com',email_status:'public_confirmed'}});return true;};
 f.ctx.verifiedBuyerEmail=(c,p,x)=>['verified','public_confirmed'].includes(x.email_status)?x.work_email:'';
 await f.run();assert.equal(f.calls[0],'public-source');assert.equal(f.calls.includes('apollo'),false);
});
test('strict delivery requirements still use Apollo after public identity confirmation',async()=>{
 const f=flow();f.ctx.publicBuyerSource=()=>({email:'anna@example.com'});
 f.ctx.confirmPublicBuyerSource=async()=>{f.calls.push('public-source');f.ctx.enrichmentResults.set('p',{contact:{work_email:'anna@example.com',email_status:'public_confirmed'}});return true;};
 await f.run();assert.deepEqual(f.calls.slice(0,3),['public-source','credit-approval','apollo']);
});
test('saved verified CRM contact is loaded before any paid enrichment',async()=>{
 const f=flow();f.ctx.crmCompanyByDomain=()=>({id:'c'});
 const old=f.ctx.bridge();const savedBridge={...old,getCrmCompany:async()=>{f.calls.push('crm');return {ok:true,contacts:[{external_person_id:'apollo-anna',work_email:'anna@example.com',email_status:'verified'}]};}};f.ctx.bridge=()=>savedBridge;
 await f.run();assert.equal(f.calls[0],'crm');assert.equal(f.calls.includes('apollo'),false);
});
test('qualification holds block both paid providers',async()=>{
 const f=flow({enabled:true});f.ctx.LeadIntelDiscovery.qualifyBuyer=()=>({eligible:false,gaps:['Employer mismatch']});
 assert.equal(await f.run(),false);assert.equal(f.calls.length,0);
});
test('additional email services do not intercept an explicitly approved phone lookup',async()=>{
 const f=flow();f.ctx.window.LeadIntelAdditionalContacts={};
 await f.ctx.confirmBuyerContact(f.candidate,0,{kind:'phone'});
 assert.equal(f.calls.includes('apollo'),true);assert.equal(f.calls.includes('credit-approval'),true);
});

test('Find email starts public research before credits when mandatory evidence is missing',async()=>{
 const f=flow();f.ctx.LeadIntelDiscovery.buyerResearchCoveragePassed=()=>false;
 f.ctx.findPublicProspectContacts=async()=>{f.calls.push('public-research');f.ctx.enrichmentResults.set('p',{contact:{id:'crm-anna',name:'Anna Buyer',external_person_id:'apollo-anna',company_id:'c',workspace_id:'w',work_email:'anna@example.com',email_status:'verified'}});return true;};
 assert.equal(await f.run(),true);assert.equal(f.calls[0],'public-research');assert.equal(f.calls.includes('apollo'),false);
});

test('manual Email keeps the selected stable buyer after reorder and scopes public research to that buyer',async()=>{
 const f=flow(),selected=f.person,other={id:'other',name:'Other Buyer'};let options,request;
 f.candidate.people.push(other);f.ctx.window.LeadIntelAdditionalContacts={confirm:async(_c,p,o)=>{assert.equal(p.id,selected.id);options=o;f.candidate.people.reverse();await o.freeConfirm();return false;},policy:()=>({provider:'treg'})};
 f.ctx.LeadIntelDiscovery.buyerResearchCoveragePassed=()=>false;
 f.ctx.findPublicProspectContacts=async(_domain,o)=>{request=o;return false;};
 await f.run();assert.deepEqual(Array.from(request.personIds),[selected.id]);assert.equal(request.manualContact,true);
 assert.equal(f.candidate.people[0].id,'other');
});
