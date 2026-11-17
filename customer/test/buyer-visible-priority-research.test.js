const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),P=require('../additional-contact-policy.js'),receipts=require('./helpers/buyer-research-receipts.cjs');

function fixture({profiles=true}={}){
 const names=['Alex Smith','Blair Jones','Cameron West','Drew North','Evan Green','Frank White','Grace Hall','Harper South'];
 const titles=['Chief Executive Officer','Chief Operating Officer','Head of Procurement','Operations Director','Procurement Manager','Global Project Manager','Planning Supervisor','Engineering Manager'];
 const c={company:'Forge Industries',domain:'forge.example',buyerSearchMode:'user_selected_target',buyerRoles:titles.join('; '),people:names.map((name,i)=>({id:'p'+i,name,publicName:name,title:titles[i],organization:'Forge Industries',publicNameUrl:'https://forge.example/team',...(profiles&&i>=4?{publicLinkedinUrl:'https://linkedin.com/in/person-'+i,linkedinConfirmedUrl:'https://linkedin.com/in/person-'+i,linkedinConfirmationMethod:'manual'}:{})}))};
 const page={url:'https://forge.example/team',sourceRead:true,extractedAt:new Date().toISOString(),markdown:c.people.map(p=>p.name+' — '+p.title+' — '+c.company).join('\n\n')};
 return {c,page};
}

test('a partially confirmed shortlist fills four distinct research places from the committee',()=>{
 const {c}=fixture({profiles:false}),p=c.people[2];
 Object.assign(p,{publicLinkedinUrl:'https://linkedin.com/in/cameron-west',linkedinConfirmedUrl:'https://linkedin.com/in/cameron-west',linkedinConfirmationMethod:'manual'});
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(c.people,c,{forExecution:true}).map(p=>p.id),['p0','p1','p2','p3']);
});

for(const profiles of [true,false])test('the four displayed buyers finish before hidden committee candidates, including profiles found in this pass: '+!profiles,async()=>{
 const {c,page}=fixture({profiles}),calls=[];
 const report=await D.runMandatoryBuyerResearch(c,{rows:[page],readPage:async()=>page,search:async query=>{
  calls.push(query);
  if(!profiles&&query.startsWith('site:linkedin.com/in/')){
   const p=c.people.slice(4).find(p=>query.includes('"'+p.name+'"'));
   return p?[{url:'https://linkedin.com/in/person-'+p.id.slice(1),title:p.name+' – '+p.title+' – Forge Industries | LinkedIn',description:p.name+' is '+p.title+' at Forge Industries.'}]:[];
  }
  if(query==='site:forge.example "Alex Smith"')throw Object.assign(Error('Controlled hidden-source slice interruption'),{code:'TIME_BUDGET'});
  return [];
 }});
 assert.equal(report.stopReason,'time_budget');
 assert.deepEqual(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds,['p4','p5','p7','p6']);
 for(const id of ['p4','p5','p6','p7']){
  const p=c.people.find(p=>p.id===id);
  for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(c,p,key),true,id+' '+key+' must finish before the hidden source blocks');
  assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);
  assert.equal(p.contactResearch.checks.deep.status,'complete',id+' keeps its deeper work-email plan');
  assert.equal(p.emailResearch.status,'complete');
 }
 assert.equal(report.checkedPeople,4);assert.equal(report.status,'partial');assert.equal(D.buyerResearchCoveragePassed(c),false);
 const saved=D.normalizeDiscoveryState({selectedProspects:[JSON.parse(JSON.stringify(c))]}).selectedProspects[0],before=new Map(saved.people.slice(4).map(p=>[p.id,JSON.stringify(p.contactResearch.checks)]));
 assert.equal(D.buyerResearchCoveragePassed(saved,{researchPeople:saved.people.slice(4),allowPartialRoster:true}),true);
 const resumed=[];await D.runMandatoryBuyerResearch(saved,{rows:[page],readPage:async()=>page,search:async query=>{resumed.push(query);return [];}});
 for(const p of saved.people.slice(4))assert.equal(JSON.stringify(p.contactResearch.checks),before.get(p.id),'reopen reuses completed visible-buyer receipts with their original dates');
 assert.ok(resumed.every(query=>!saved.people.slice(4).some(p=>query.includes('"'+p.name+'"'))));
 assert.ok(calls.indexOf('site:forge.example "Evan Green"')<calls.indexOf('site:forge.example "Alex Smith"'));
});

test('prioritizing the displayed free-research cohort does not move the approved automatic paid group',()=>{
 const {c}=fixture(),stamp=new Date().toISOString();
 Object.assign(c,{qualification:{eligible:true,score:85,researchedAt:stamp},publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',totalPeople:8,checkedPeople:8,completedAt:stamp}}});
 for(const p of c.people)p.emailResearch={status:'complete',searches:12,failed:0,checkedAt:stamp};receipts(c);
 const displayed=c.people.slice(4);for(const p of displayed){const plan=D.buyerResearchQueryPlan(c,p);p.contactResearch.checks.deep={status:'complete',checkedAt:stamp,queryLog:plan.deep.map(query=>({query,status:'complete',checkedAt:stamp}))};}
 assert.deepEqual(P.targets(c,{provider:'apollo',automaticBuyerLimit:1}).map(p=>p.id),['p2']);
 assert.deepEqual(P.targets(c,{provider:'apollo',automaticBuyerLimit:1,confirmedEmail:p=>p.id==='p2'?'cameron@forge.example':''}).map(p=>p.id),[],'a confirmed paid primary cannot cascade spending to a displayed buyer');
 displayed[0].contactResearch.checks.gmail.status='partial';
 c.publicResearch.aiReview={status:'complete',checkedAt:stamp,inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:c.people.map(p=>p.id),findings:[],conflicts:[]};
 assert.equal(P.readiness(c,c.people[2],{provider:'treg',automatic:true}).eligible,false,'automatic paid lookup waits for all four displayed buyers');
 assert.equal(P.readiness(c,c.people[2],{provider:'treg',automatic:false}).eligible,true,'manual paid readiness remains person-scoped');
});

test('bound CRM channels choose the free cohort without changing person-scoped or pre-channel paid selection',()=>{
 const {c}=fixture({profiles:false}),stamp=new Date().toISOString(),contacts=new Map(c.people.slice(4).map(p=>[p.id,{name:p.name,external_person_id:p.id,source:'treg',phone_number:'+46 70 123 45 67',phone_status:'verified',workspace_id:'workspace',company_id:'company'}]));
 const contactOptions={workspaceId:'workspace',companyId:'company',contactForPerson:p=>contacts.get(p.id)||{}};
 Object.assign(c,{qualification:{eligible:true,score:85,researchedAt:stamp},publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',totalPeople:8,checkedPeople:8,completedAt:stamp}}});
 for(const p of c.people)p.emailResearch={status:'complete',searches:12,failed:0,checkedAt:stamp};receipts(c);
 c.publicResearch.aiReview={status:'complete',checkedAt:stamp,inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:c.people.map(p=>p.id),findings:[],conflicts:[]};
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(c.people,c,{forExecution:true,contactOptions}).map(p=>p.id),['p4','p5','p6','p7']);
 assert.deepEqual(P.targets(c,{provider:'treg',automaticBuyerLimit:1,contactOptions}).map(p=>p.id),['p2']);
 c.people[4].contactResearch.checks.gmail.status='partial';
 assert.equal(P.readiness(c,c.people[2],{provider:'treg',automatic:true,contactOptions}).eligible,false,'an unfinished displayed CRM contact blocks automatic lookup');
 assert.equal(P.readiness(c,c.people[2],{provider:'treg',automatic:false,contactOptions}).eligible,true,'manual readiness stays scoped to p2');
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(c.people,c,{forExecution:true,contactOptions:{...contactOptions,workspaceId:'other'}}).map(p=>p.id),['p0','p1','p2','p3'],'foreign-workspace evidence cannot choose the cohort');
});

test('contacts confirmed during core research leave missing final-cohort deep checks resumable',async()=>{
 const {c,page}=fixture({profiles:false}),stamp=new Date().toISOString(),url='https://forge.example/contact-staff';
 const phonePage={url,sourceRead:true,extractedAt:stamp,markdown:c.people.slice(4).map(p=>'### '+p.name+'\n'+p.title+'\nPhone: +46 70 123 45 67\nForge Industries').join('\n\n')};
 const report=await D.runMandatoryBuyerResearch(c,{rows:[page],readPage:async value=>value===url?phonePage:page,search:async query=>query==='site:forge.example "Evan Green"'?[{url,title:'Named staff contacts',description:'Evan Green Frank White Grace Hall Harper South'}]:[]});
 assert.deepEqual(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds,['p4','p5','p7','p6']);
 assert.equal(report.status,'partial','newly visible people cannot settle before their required deeper checks');
 for(const p of c.people.slice(4)){assert.equal(p.emailResearch.status,'partial');assert.equal(p.contactResearch.channels.company.status,'partial');}
 const before=new Map(c.people.map(p=>[p.id,JSON.stringify(Object.fromEntries(D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.map(key=>[key,p.contactResearch.checks[key]])))])),queries=[];
 await D.runMandatoryBuyerResearch(c,{rows:[page,phonePage],readPage:async value=>value===url?phonePage:page,search:async query=>{queries.push(query);return [];}});
 assert.equal(D.buyerResearchCoveragePassed(c),true);
 assert.equal(queries.length,8,'only two missing deep queries for each of the final four run');
 for(const p of c.people){assert.equal(JSON.stringify(Object.fromEntries(D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.map(key=>[key,p.contactResearch.checks[key]]))),before.get(p.id),'base receipts retain their original dates');}
 for(const p of c.people.slice(4))assert.equal(p.contactResearch.checks.deep.status,'complete');
});
