const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const target={company:'Finance Group',domain:'finance.example'},person={id:'p',name:'Ārija Bērziņa',publicName:'Ārija Bērziņa',organization:target.company,title:'Chief Financial Officer',publicNameUrl:'https://finance.example/team',identityStatus:'confirmed'};
const url='https://lv.linkedin.com/in/arija-berzina',row={url,title:'Arija Berzina - Group CFO at Finance Group',description:'Group CFO at Finance Group · Experience: Finance Group'};
test('accented company identity matches its unique unaccented profile without renaming the person',()=>{
 const p=D.matchPublicLinkedInProfiles([person],[row],target.company)[0];
 assert.equal(p.publicLinkedinUrl,url);assert.equal(p.publicName,person.publicName);assert.equal(p.name,person.name);assert.equal(p.publicNameUrl,person.publicNameUrl);assert.equal(p.linkedinIdentityEvidence.name,person.publicName);
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...target,buyerSearchMode:'user_selected_target',people:[p]}]}).selectedProspects[0].people[0];assert.equal(saved.publicName,person.publicName);assert.equal(saved.linkedinIdentityEvidence.name,person.publicName);
});
test('accent folding still holds distinct profile paths and never accepts another surname or employer',()=>{
 const p=D.matchPublicLinkedInProfiles([person],[row,{...row,url:'https://www.linkedin.com/in/arija-berzina-other'}],target.company)[0];assert.equal(p.linkedinProfileReview.status,'review_required');assert.ok(!p.linkedinIdentityEvidence);
 for(const other of [{...row,title:'Arija Kalnina - CFO at Finance Group'},{...row,title:'Arija Berzina - CFO at Other Company',description:'Currently at Other Company'},{...row,title:'Arija Berzina - CFO at Other Company',description:'Experience includes Finance Group.'}])assert.ok(!D.matchPublicLinkedInProfiles([person],[other],target.company)[0].linkedinIdentityEvidence);
});
test('an unrelated same-name former-employer profile cannot invalidate the uniquely matched company profile',()=>{
 const p={...person,name:'Arija Berzina',publicName:'Arija Berzina',publicLinkedinUrl:url};
 const other={url:'https://www.linkedin.com/in/arija-berzina-namesake',title:'Arija Berzina - Other Company',description:'Currently at Other Company. Previously at Finance Group.'};
 const found=D.matchPublicLinkedInProfiles([p],[row,other],target.company)[0];assert.equal(found.publicLinkedinUrl,url);assert.ok(found.linkedinIdentityEvidence);assert.equal(found.linkedinProfileReview,null);
 const changed=D.matchPublicLinkedInProfiles([p],[{...other,url:'https://www.linkedin.com/in/arija-berzina'}],target.company)[0];assert.equal(changed.linkedinProfileReview.status,'review_required','a current-employer contradiction on the same actual profile remains a hold');
});
test('historical sections cannot borrow current employer text across line boundaries',()=>{
 const p={...person,name:'Arija Berzina',publicName:'Arija Berzina'};
 const found=D.matchPublicLinkedInProfiles([p],[{...row,description:'Employment history\nPreviously CFO at Other Company\nCurrent employer: Finance Group'}],target.company)[0];assert.ok(found.linkedinIdentityEvidence);assert.equal(found.linkedinProfileReview,null);
});
test('profile subpages and transliteration guesses do not confer identity confirmation',()=>{
 for(const bad of [{...row,url:url+'/posts'},{...row,title:'Ария Берзина - Finance Group'}])assert.ok(!D.matchPublicLinkedInProfiles([person],[bad],target.company)[0].linkedinIdentityEvidence);
});
test('free website directory identities still need public profile matching evidence',()=>{
 const p={...person,identitySource:'apollo',identityOrigin:'apollo',linkedin_url:url};
 assert.ok(D.matchPublicLinkedInProfiles([p],[row],target.company)[0].linkedinIdentityEvidence);
 assert.ok(!D.matchPublicLinkedInProfiles([p],[{...row,title:'Arija Kalnina - Finance Group'}],target.company)[0].linkedinIdentityEvidence);
});
