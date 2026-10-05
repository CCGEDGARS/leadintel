const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const company={company:'Example',domain:'example.com',buyerRoles:['Project Manager']};
const person={id:'buyer',name:'Anna Smith',publicName:'Anna Smith',organization:'Example',title:'Project Manager',publicNameUrl:'https://example.com/team/anna'};
const row={url:'https://se.linkedin.com/in/anna-smith-123',title:'Anna Smith – Project Manager – Example | LinkedIn',description:'Anna Smith. Project Manager at Example.'};
// Regression: preserving an official identity source must not discard the
// independently acquired evidence linking that person to a direct profile.
test('official identity followed by a unique public profile becomes automatically confirmed and survives save/reload',()=>{
 const matched=D.matchPublicLinkedInProfiles([person],[row],company.company)[0];
 assert.equal(matched.publicNameUrl,'https://example.com/team/anna');
 assert.equal(D.linkedInVerification(matched,company).status,'automatic');
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:"user_selected_target",people:[matched]}]}).selectedProspects[0].people[0];
 assert.equal(D.linkedInVerification(saved,company).status,'automatic');
 for(const update of [{publicLinkedinUrl:'https://linkedin.com/in/other'},{name:'Jane Jones',publicName:'Jane Jones'},{organization:'Other'},{opportunityScope:{status:'review_required',reason:'Different subsidiary'}}])assert.equal(D.linkedInVerification({...saved,...update},company).status,'review_required');
});
test('a bare URL or ambiguous same-name profiles cannot confer automatic confirmation',()=>{
 assert.equal(D.linkedInVerification({...person,publicLinkedinUrl:row.url},company).status,'review_required');
 const ambiguous=D.matchPublicLinkedInProfiles([person],[row,{...row,url:'https://linkedin.com/in/anna-smith-456'}],company.company)[0];
 assert.equal(D.linkedInVerification(ambiguous,company).status,'missing');
});
test('independent profile evidence survives refresh and CRM reconstruction across customers',()=>{
 const C=require('../crm-engine.js');
 for(const companyName of ['Factory','Clinic','Retailer']){
  const target={...company,company:companyName,buyerSearchMode:'user_selected_target'};
  const p={...person,organization:companyName};
  const matched=D.matchPublicLinkedInProfiles([p],[{...row,title:`Anna Smith – Project Manager – ${companyName} | LinkedIn`,description:`Anna Smith at ${companyName}`}],companyName)[0];
  const merged=D.mergeBuyerPool([matched],[{...p,publicLinkedinUrl:row.url,linkedinIdentityEvidence:null}],{decisionMakers:['Project Manager']})[0];
  assert.equal(D.linkedInVerification(merged,target).status,'automatic');
  const buyers=C.mapDiscoveryCandidateToCrm({...target,people:[merged]}).intelligence.research_snapshot.buyerResearch.buyers;
  const saved=D.normalizeDiscoveryState({selectedProspects:[{...target,people:buyers}]}).selectedProspects[0];
  assert.equal(D.linkedInVerification(saved.people[0],saved).status,'automatic');
 }
});
test('concurrent profile identity and verification provenance edits cannot form synthetic confirmation',()=>{
 const S=require('../workspace-sync.js'),base={discovery:{people:[{...person,publicLinkedinUrl:row.url}]}};
 const local=structuredClone(base),server=structuredClone(base);
 local.discovery.people[0].publicLinkedinUrl='https://linkedin.com/in/other';
 server.discovery.people[0].linkedinIdentityEvidence={url:row.url,name:person.name,organization:'Example',checkedAt:'2026-10-05T12:00:00Z'};
 assert.equal(S.merge(base,local,server).safe,false);
});
