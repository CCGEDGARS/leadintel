const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
function fixture(){
 const candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['Executive leadership','Procurement Director','Operations Director','Plant Manager','Engineering Director','Project Director','Operations Manager'],people:[]};
 const roles=['CEO','COO','Procurement Director','Operations Director','Plant Manager','Engineering Director','Project Director','Head of Procurement','Chief Financial Officer','Operations Manager'];
 candidate.people=roles.map((title,i)=>({id:'buyer-'+i,name:['Alex Berg','Bella Lind','Carl Holm','Diana Lund','Erik Dahl','Frida West','Gustav North','Hanna East','Ingrid South','Johan Lake'][i],title,organization:candidate.company,publicNameUrl:'https://example.com/team',identityStatus:'confirmed',nameVerification:'confirmed'}));
 return candidate;
}
test('main shortlist contains the four most relevant qualified contacts from the confirmed set only',()=>{
 const c=fixture(),before=JSON.stringify(c),ready=new Set(['buyer-2','buyer-3','buyer-4','buyer-5','buyer-6','buyer-7']);
 const ranked=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c,{confirmedContact:p=>ready.has(p.id)});
 const expected=D.rankedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).people.filter(p=>ready.has(p.id)).slice(0,4).map(p=>p.id);
 assert.deepEqual(ranked.priorityIds,expected);assert.equal(ranked.priorityIds.length,4);assert.equal(ranked.readyCount,ready.size);assert.ok(!ranked.priorityIds.includes('buyer-0'),'an unconfirmed executive cannot displace a confirmed relevant buyer');assert.equal(JSON.stringify(c),before);
});
test('shortfall never promotes guesses, held identities or unconfirmed people to fill four places',()=>{
 const c=fixture();c.people[2].opportunityScope={status:'review_required',reason:'Conflicting current employer'};
 const ready=new Set(['buyer-2','buyer-3']),result=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c,{confirmedContact:p=>ready.has(p.id)});
 assert.deepEqual(result.priorityIds,['buyer-3']);assert.equal(result.shortfall,3);assert.equal(result.target,4);
 c.buyerRolesChanged=true;assert.deepEqual(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c,{confirmedContact:()=>true}).priorityIds,[]);
});
test('a ready contact remains in the four while unrelated deep checks are unfinished',()=>{
 const c=fixture(),ready=new Set(['buyer-2','buyer-3','buyer-4','buyer-5']);c.people[0].emailResearch={status:'complete',searches:3,failed:0,checkedAt:new Date().toISOString()};
 const result=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c,{confirmedContact:p=>ready.has(p.id)});
 assert.equal(result.priorityIds.length,4);assert.ok(result.priorityIds.every(id=>ready.has(id)));
});
test('default confirmation requires a current named official email source, not a pattern or stale listing',()=>{
 const c=fixture(),rows=[{url:'https://example.com/team',sourceRead:true,extractedAt:new Date().toISOString(),markdown:c.people.slice(0,4).map((person,i)=>'### '+person.name+'\n'+person.title+'\n'+['alex','bella','carl','diana'][i]+'@example.com\nExample').join('\n\n')}];
 c.people=D.discoverCompanyContacts(rows,c);assert.equal(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length,4);
 c.people[0].publicEmailEvidence.checkedAt='2020-01-01';delete c.people[1].publicEmailEvidence;c.people[2].opportunityScope={status:'review_required',reason:'Employer conflict'};
 const result=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c);assert.equal(result.priorityIds.length,1);assert.equal(result.shortfall,3);
 c.publicResearch={aiReview:{conflicts:[{person_id:c.people[3].id,reason:'Conflicting current employer'}]}};
 assert.equal(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length,0,'an official email cannot override a retained employment conflict');
});
test('retained research and AI identity conflicts exclude a contact even when its channel is confirmed',()=>{
 for(const field of ['conflicts','aiReview']){
  const c=fixture(),conflicts=[{person_id:'buyer-2',reason:'Current employment conflict'}];c.publicResearch=field==='conflicts'?{conflicts}:{aiReview:{conflicts}};
  const result=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c,{confirmedContact:person=>person.id==='buyer-2'});assert.equal(result.priorityIds.length,0);
 }
});
test('four contacts may qualify with different confirmed channels, without changing email eligibility',()=>{
 const c=fixture(),stamp=new Date().toISOString(),url='https://example.com/team';
 const rows=[{url,sourceRead:true,extractedAt:stamp,markdown:c.people.slice(0,2).map((p,i)=>`### ${p.name}\n${p.title}\n${i?'bella':'alex'}@example.com`).join('\n\n')}];
 const emails=D.discoverCompanyContacts(rows,c);for(const p of c.people.slice(0,2))Object.assign(p,emails.find(row=>row.name===p.name),{id:p.id});
 Object.assign(c.people[2],{publicPhone:'+46 70 123 45 67',publicPhoneUrl:url,publicPhoneSourceCheck:{version:2,status:'attributed',url,checkedAt:stamp},publicPhoneEvidence:{version:2,url,quote:'Carl Holm — Procurement Director. Phone +46 70 123 45 67',sourceKind:'official',sourceRead:true,checkedAt:stamp}});
 Object.assign(c.people[3],{publicLinkedinUrl:'https://linkedin.com/in/diana-lund',linkedinConfirmedUrl:'https://linkedin.com/in/diana-lund',linkedinConfirmationMethod:'manual'});
 const result=D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c);assert.equal(result.priorityIds.length,4);assert.equal(D.acceptedOfficialBuyerEmail(c,c.people[2]),'');assert.equal(D.acceptedOfficialBuyerEmail(c,c.people[3]),'');
 c.people[2].publicPhoneEvidence.checkedAt='2020-01-01';c.people[3].linkedin_url='https://linkedin.com/in/another-person';assert.equal(D.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length,2);
});
test('provider phone records stay bound to the current workspace, company and person',()=>{
 const c=fixture(),p=c.people[2],contact={name:p.name,external_person_id:p.id,source:'apollo',phone_number:'+46 70 123 45 67',phone_status:'verified',company_id:'crm-company',workspace_id:'workspace'};
 const options={workspaceId:'workspace',companyId:'crm-company',contactForPerson:()=>contact};assert.equal(D.confirmedBuyerShortlist([p],{decisionMakers:c.buyerRoles},c,options).priorityIds.length,1);
 for(const patch of [{workspaceId:'other'},{companyId:'other'},{contactForPerson:()=>({...contact,external_person_id:'other'})}])assert.equal(D.confirmedBuyerShortlist([p],{decisionMakers:c.buyerRoles},c,{...options,...patch}).priorityIds.length,0);
});
test('stale automatic profile evidence does not count as a confirmed contact',()=>{
 const c=fixture(),p=c.people[2];Object.assign(p,{publicLinkedinUrl:'https://linkedin.com/in/carl-holm',linkedinIdentityEvidence:{url:'https://linkedin.com/in/carl-holm',name:p.name,organization:c.company,checkedAt:'2020-01-01'}});
 assert.equal(D.confirmedBuyerShortlist([p],{decisionMakers:c.buyerRoles},c).priorityIds.length,0);p.linkedinConfirmedUrl=p.publicLinkedinUrl;p.linkedinConfirmationMethod='automatic';p.linkedinConfirmedAt='2020-01-01';p.linkedinIdentityEvidence.checkedAt=new Date().toISOString();assert.equal(D.confirmedBuyerShortlist([p],{decisionMakers:c.buyerRoles},c).priorityIds.length,1);
});
test('reopening merged directory evidence preserves an exact manual profile review without transferring it to another identity',()=>{
 const c=fixture(),p=c.people[2],url='https://linkedin.com/in/carl-holm';c.publicResearch={evidenceVersion:2};Object.assign(p,{publicName:p.name,publicLinkedinUrl:url,linkedinConfirmedUrl:url,linkedinConfirmedAt:new Date().toISOString(),linkedinConfirmationMethod:'manual'});
 const sparse={...p,linkedinConfirmedUrl:'',linkedinConfirmedAt:'',linkedinConfirmationMethod:'manual'};
 const people=D.mergeBuyerPool([p],[sparse],{decisionMakers:c.buyerRoles}),saved=D.normalizeDiscoveryState({selectedProspects:[{...c,people}]}).selectedProspects[0];assert.equal(saved.people[0].linkedinConfirmedUrl,url);assert.equal(D.confirmedBuyerShortlist(saved.people,{decisionMakers:c.buyerRoles},saved).priorityIds.length,1);
 for(const change of [{name:'Another Person',publicName:'Another Person'},{publicLinkedinUrl:'https://linkedin.com/in/another-person'}]){const merged=D.mergeBuyerPool([p],[{...sparse,...change}],{decisionMakers:c.buyerRoles});const changed=merged.find(row=>row.name==='Another Person'||row.publicLinkedinUrl===change.publicLinkedinUrl);assert.notEqual(changed?.linkedinConfirmedUrl,url);}
});

test('malformed zero-prefixed and repeated-digit phones never qualify as confirmed contact data',()=>{
 const c=fixture(),p=c.people[2],url='https://example.com/team',checkedAt=new Date().toISOString();
 for(const phone of ['000 33.00 18','000000000','111111111','+461234567890123456']){
  Object.assign(p,{publicPhone:phone,publicPhoneUrl:url,publicPhoneEvidence:{version:2,url,quote:p.name+' '+phone,checkedAt,sourceRead:true,sourceKind:'official'},publicPhoneSourceCheck:{version:2,url,status:'attributed',checkedAt}});
  assert.equal(D.confirmedBuyerPhone(c,p),'',phone);
 }
});
