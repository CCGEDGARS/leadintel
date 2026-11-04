const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../additional-contact-policy.js'),fixture=require('./fixtures/manual-paid-company.cjs');
const {runtime}=require('./helpers/buyer-controls-runtime.cjs');
test('manual paid lookup accepts only pending purchasing reasoning; automation remains blocked',()=>{
 const {candidate:c}=fixture(),before=JSON.stringify(c.qualification);assert.deepEqual(c.qualification.gaps,['Verify a specific purchasing application for a confirmed offer']);
 assert.equal(P.readiness(c,c.people[0],{provider:'treg'}).eligible,true);assert.equal(P.readiness(c,c.people[0],{provider:'treg'}).manualFitPending,true);
 assert.equal(P.readiness(c,c.people[0],{provider:'treg',automatic:true}).eligible,false);assert.equal(JSON.stringify(c.qualification),before);
 for(const mutate of [c=>c.qualification.gaps.push('Verify company identity with readable official evidence'),c=>c.qualification.gaps.push('Resolve exclusion checks'),c=>c.qualification.gaps.push('No relevant buyer relationship established from the operating evidence'),c=>c.qualification.gaps=[],c=>delete c.qualification,c=>c.needsRecheck=true,c=>c.lifecycle_status='suppressed',c=>c.qualification.researchedAt='2001-01-01',c=>c.people[0].organization='Other',c=>c.people[0].emailResearch.status='partial']){const {candidate:x}=fixture();mutate(x);assert.equal(P.readiness(x,x.people[0],{provider:'treg'}).eligible,false);}
});
function setup({enabled=true,approve=true,failed=false}={}){
 const r=runtime(),{candidate}=fixture();Object.assign(r.candidate,candidate);r.person=r.candidate.people[0];r.c.LeadIntelAdditionalContactPolicy=P;r.c.qualificationAssessment=()=>r.candidate.qualification;
 r.b.getCrmCompany=async()=>({ok:true,company:{id:'company',workspace_id:'w',normalized_domain:candidate.domain},contacts:[]});r.b.saveCrmCompany=async()=>({ok:true,company:{id:'company',workspace_id:'w',normalized_domain:candidate.domain}});
 r.eval('crmCompanies=[{id:"company",workspace_id:"w",normalized_domain:"nordic.se"}];');
 const calls=[],dialogs=[];let saves=0;r.c.LeadIntelDialogs={confirm:async text=>{dialogs.push(text);return approve;}};
 r.c.fetch=async(url,options={})=>{calls.push({url,options});return {ok:!failed||!url.includes('/email?'),json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled,phoneEnabled:false,dailyLimit:3,monthlyLimit:30,maxPerCompany:2},role:'owner'}:url.includes('/services/status')?{providers:[{provider:'treg',configured:true,source:'customer'}]}:failed?{error:'Controlled provider unavailable'}:{contact:{id:'result',company_id:'company',workspace_id:'w',external_person_id:r.person.id,name:r.person.name,title:r.person.title,work_email:'anna@nordic.se',email_status:'verified',verification_provider:'Treg',source:'treg'}}};};
 const prepare=r.c.paidHooks.prepare;
 require('node:vm').runInContext(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'),r.c);
 r.c.LeadIntelAdditionalContacts.register({...r.c.paidHooks,rows:()=>[r.candidate],assessment:()=>r.candidate.qualification,prepare,accept:async(c,p,result)=>{saves++;r.c.seedContact=result.contact;r.eval('enrichmentResults.set("nordic.se|buyer-anna",{contact:seedContact})');}});
 return {...r,calls,dialogs,saves:()=>saves};
}
for(const scenario of [{},{approve:false},{enabled:false},{failed:true}])test('real manual button routing and CRM preparation '+JSON.stringify(scenario),async()=>{
 const r=setup(scenario);try{await r.c.LeadIntelAdditionalContacts.load();const existing=r.person.publicLinkedinUrl;let settings=0;const button=r.dom.window.document.createElement('button');button.id='open-settings';button.onclick=()=>settings++;r.dom.window.document.body.append(button);
 const ok=await r.c.confirmBuyerContact(r.candidate,0,{paidOnly:true,kind:'email',personId:r.person.id});
 const expected=scenario.enabled!==false&&scenario.approve!==false&&!scenario.failed;assert.equal(ok,expected,JSON.stringify(r.calls));assert.equal(r.person.publicLinkedinUrl,existing);assert.equal(r.candidate.qualification.eligible,false);
 const requests=r.calls.filter(c=>c.url.includes('/email?'));assert.equal(requests.length,scenario.enabled===false||scenario.approve===false?0:1);
 if(requests.length){const body=JSON.parse(requests[0].options.body);assert.equal(body.person_id,r.person.id);assert.equal(body.email_lookup,true);assert.equal(body.phone_approved,false);assert.match(r.dialogs[0],/Purchasing-fit review is still pending/);}
 if(scenario.enabled===false)assert.equal(settings,1);assert.equal(r.saves(),expected?1:0);
 const node=r.dom.window.document.createElement('div');node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);assert.equal(node.querySelector('[data-prospect-enrich-email]').getAttribute('aria-pressed'),String(expected));assert.equal(node.querySelector('[data-keep-buyer]').disabled,!expected);
 }finally{r.close();}
});
test('manual company verification uses its own saved date, never a newer unrelated company run',()=>{
 const r=runtime();try{r.c.LeadIntelDiscovery.assessCompanyQualification=(c,p,m,s)=>({researchedAt:s.researchedAt});r.eval('discovery.lastRunAt="2099-01-01"');
 assert.equal(r.c.qualificationAssessment({domain:'example.com',qualification:{researchedAt:'2026-10-01'}}).researchedAt,'2026-10-01');
 assert.equal(r.c.qualificationAssessment({domain:'example.com',researchedAt:'2026-10-02',qualification:{researchedAt:'2026-10-01'}}).researchedAt,'2026-10-02');
 }finally{r.close();}
});
