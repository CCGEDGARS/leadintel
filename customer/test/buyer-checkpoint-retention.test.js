const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),{createClient}=require('../buyer-research-jobs.js');
const stamp=()=>new Date().toISOString();
const fixture=require('./fixtures/buyer-retained-research.cjs');

async function restore(c,next,status='needs_review'){
 const bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}};const client=createClient({getBridge:()=>bridge,fetchImpl:async()=>Response.json({job:{id:'job',domain:c.domain,status,phase:'official',revision:1,candidate:next}})});await client.restore(c,{profile:{decisionMakers:c.buyerRoles}});
}
test('an input-only queued checkpoint preserves the complete dossier without inventing a failed attempt',async()=>{
 const {c}=fixture(),dossier=structuredClone(c.buyerDiscovery.companyDossier);await restore(c,{company:c.company,domain:c.domain,people:c.people,buyerDiscovery:{opportunityRoles:c.buyerRoles,companyContacts:[]}},'canceled');assert.deepEqual(c.buyerDiscovery.companyDossier,dossier);assert.equal(c.buyerDiscovery.companyContacts.length,4);
});
test('a partial inventory checkpoint retains sourced contacts, phone routes and public company channels',async()=>{
 const {c,rows}=fixture(),partial=D.officialCompanyContactInventory(rows.slice(0,1),c);partial.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'partial',readPages:1,reads:[{url:rows[0].url,status:'complete'}],completedUrls:[rows[0].url],checkedAt:stamp(),queries:[],failures:['Another source is unavailable']};
 await restore(c,{company:c.company,domain:c.domain,people:c.people,publicContacts:[{kind:'phone',value:'+46 70 888 88 88',url:'https://example.com/contact'}],buyerDiscovery:{officialContactInventory:partial,companyContacts:partial.contacts},publicResearch:{accountability:D.createBuyerResearchAccountability()}});
 assert.equal(c.buyerDiscovery.officialContactInventory.channels.length,4);assert.equal(c.buyerDiscovery.officialContactInventory.routes.length,2);assert.equal(c.buyerDiscovery.companyContacts.length,4);assert.equal(c.publicContacts.length,3);assert.equal(c.publicResearch.accountability.officialPages,0,'old reads do not impersonate execution by the new attempt');
});
test('a same-person directory checkpoint cannot erase the accepted email source proof',async()=>{
 const {c}=fixture(),{normalizeBuyerInput}=await import('../../backend/src/buyer-research-store.js');const {requestInput}=require('../buyer-research-jobs.js');const input=normalizeBuyerInput(requestInput(c,{}));
 input.candidate.people=D.matchPublicBuyerDetails(input.candidate.people,[{url:'https://example.com/management',sourceRead:true,markdown:c.people.map(p=>`### ${p.name}\n${p.title}\nExample`).join('\n\n')}],c.domain,c.company);assert.equal(input.candidate.people[0].publicEmailEvidence,null);
 await restore(c,input.candidate);assert.equal(c.people.filter(p=>D.acceptedOfficialBuyerEmail(c,p)).length,4);assert.equal(c.people.filter(p=>D.confirmedBuyerPhone(c,p)).length,2);
});
test('a changed address or explicit rejected binding cannot inherit the old confirmation',async()=>{
 for(const change of [{publicEmail:'different@example.com',publicEmailEvidence:null},{publicEmailUrl:'https://example.com/changed',publicEmailEvidence:null},{publicEmailSourceCheck:{status:'failed',email:'anna.berg@example.com',url:'https://example.com/team/0',checkedAt:stamp()}}]){const {c}=fixture(),next=structuredClone(c);Object.assign(next.people[0],change);await restore(c,next);assert.equal(D.acceptedOfficialBuyerEmail(c,c.people[0]),'');}
});
test('actual recorded Viscaria sources retain all four confirmed channels through a sparse same-person checkpoint',()=>{
 const {c}=require('./fixtures/viscaria-contact-replay.cjs')(),next=JSON.parse(JSON.stringify(c));assert.equal(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length,4);
 for(const person of next.people){person.publicEmailEvidence=null;person.linkedinIdentityEvidence=null;person.publicLinkedinUrl='';person.linkedin_url='';person.publicNameUrl='https://www.viscaria.com/en/investors/governance/executive-management-team/';}
 const restored=D.mergeRetainedBuyerResearch(c,next);assert.equal(D.confirmedBuyerShortlist(restored.people,{decisionMakers:c.buyerRoles},restored).priorityIds.length,4);
});
for(const [field,hold] of [['opportunityScope',{status:'review_required',reason:'Employment conflict',url:'https://example.com/team'}],['roleReview',{version:1,status:'conflict',reason:'Current role conflict',sources:[]}]])test('a sparse normalized checkpoint cannot clear the saved '+field+' hold',()=>{
 const {c}=fixture();c.people[0][field]={...hold,checkedAt:stamp()};const next=JSON.parse(JSON.stringify(c));next.people[0][field]=null;const merged=D.mergeRetainedBuyerResearch(c,next);assert.equal(merged.people[0][field]?.status,hold.status);assert.equal(D.qualifyBuyer(merged.people[0],{decisionMakers:c.buyerRoles},merged).eligible,false);
});
test('retaining older complete facts cannot hide a newer dossier employment conflict',()=>{
 const {c}=fixture(),next=structuredClone(c);next.buyerDiscovery.companyDossier={status:'partial',people:[{name:c.people[0].name,status:'departed'}],conflicts:[{name:c.people[0].name,reason:'Employment changed'}]};const merged=D.mergeRetainedBuyerResearch(c,next);assert.equal(D.qualifyBuyer(merged.people[0],{decisionMakers:c.buyerRoles},merged).eligible,false);
});
test('a signed review with no person coverage cannot clear saved employment conflicts',()=>{
 const {c}=fixture();c.publicResearch.conflicts=[{person_id:c.people[0].id,reason:'Conflicting current employer'}];const next=structuredClone(c);next.publicResearch.conflicts=[];next.publicResearch.aiReview={status:'complete',reviewedPersonIds:[],inputSignature:D.buyerReviewSignature(next)};const merged=D.mergeRetainedBuyerResearch(c,next);assert.equal(merged.publicResearch.conflicts.length,1);
});
test('same-revision domain recovery applies recovered source facts to an already saved job reference',async()=>{
 const {c}=fixture(),next=structuredClone(c);for(const p of c.people)p.publicEmailEvidence=null;c.buyerResearchJob={id:'job',revision:1,status:'needs_review'};
 const bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}},client=createClient({getBridge:()=>bridge,fetchImpl:async()=>Response.json({job:{id:'job',domain:c.domain,status:'needs_review',revision:1,retainedEvidenceRecovered:true,candidate:next}})});await client.restore(c,{profile:{decisionMakers:c.buyerRoles}});assert.equal(c.people.filter(p=>D.acceptedOfficialBuyerEmail(c,p)).length,4);
});
test('official executive cards remain role evidence when image captions precede names and titles use separate paragraphs',()=>{
 const {c,pages}=require('./fixtures/viscaria-contact-replay.cjs')();for(const name of ['Charlotte Odenberger','Jörgen Olsson']){const p=c.people.find(p=>p.name===name),checked=D.matchBuyerRoleEvidence(p,pages,c,{complete:true});assert.equal(checked.roleReview?.status,'supported',name);assert.ok(checked.roleReview.sources.some(r=>r.url.includes('executive-management-team')));}
});
for(const body of ['### Chief Financial Officer\nAnna Buyer\n\n### Head of Procurement\nBob Smith','### Anna Buyer\n\n![Bob Smith](bob.jpg)\n\n### Head of Procurement\nBob Smith','### Anna Buyer\n\n![Bob Smith](bob.jpg)\n\nHead of Procurement\nBob Smith'])test('role evidence cannot cross a following staff-card boundary: '+body.slice(0,40),()=>{
 const p={id:'anna',name:'Anna Buyer',publicName:'Anna Buyer',title:'Head of Procurement',organization:'Example'};const result=D.matchBuyerRoleEvidence(p,[{url:'https://example.com/team',markdown:body,sourceRead:true}],{company:'Example',domain:'example.com'},{complete:true});assert.notEqual(result.roleReview?.status,'supported');
});
