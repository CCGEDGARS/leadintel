const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const company='Acme Labs',domain='acme.example',name='Alex Morgan',url='https://se.linkedin.com/in/alex-morgan';
const person=()=>({id:'alex',name,publicName:name,title:'Chief Operating Officer',organization:company,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:`https://${domain}/team`,linkedin_url:url,publicLinkedinUrl:url});
const row=()=>({url,title:`${name} – Chief Operating Officer – ${company} | LinkedIn`,description:`${name} is currently at ${company}.`});
test('a saved unverified public profile still receives exact identity verification',()=>{
 const p=person(),candidate={company,domain,people:[p]};assert.equal(D.linkedInVerification(p,candidate).status,'review_required');
 const matched=D.matchPublicLinkedInProfiles([p],[row()],company)[0];
 assert.equal(matched.linkedinIdentityEvidence?.url,url);assert.equal(D.linkedInVerification(matched,candidate).status,'automatic');
});
for(const kind of ['wrong-name','former-employer','model-summary','ambiguous'])test(`a saved URL cannot bypass ${kind} identity checks`,()=>{
 const r=row(),p=person();let rows=[r];
 if(kind==='wrong-name')r.title=`Alex Jones – Chief Operating Officer – ${company} | LinkedIn`,r.description=`Alex Jones at ${company}`;
 if(kind==='former-employer')r.description=`${name} formerly at ${company}. Current employer: Other Company`;
 if(kind==='model-summary')r.evidenceKind='model_summary';
 if(kind==='ambiguous')rows.push({...r,url:'https://linkedin.com/in/alex-morgan-2'});
 const matched=D.matchPublicLinkedInProfiles([p],rows,company)[0];
 assert.notEqual(D.linkedInVerification(matched,{company,domain}).status,'automatic');assert.ok(!matched.linkedinIdentityEvidence);
});
test('mandatory refresh verifies a saved public URL from its completed search receipt',async()=>{
 const p=person(),candidate={company,domain,buyerSearchMode:'user_selected_target',people:[p]},queries=[];
 await D.runMandatoryBuyerResearch(candidate,{rows:[{url:p.publicNameUrl,markdown:`${name} — Chief Operating Officer — ${company}`,sourceRead:true}],search:async q=>{queries.push(q);return q.startsWith('site:linkedin.com/in/')?[row()]:[];}});
 assert.ok(queries.some(q=>q.startsWith('site:linkedin.com/in/')));assert.equal(D.linkedInVerification(p,candidate).status,'automatic');
 const saved=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];
 assert.equal(D.linkedInVerification(saved.people[0],saved).status,'automatic');
 saved.people[0].linkedinIdentityEvidence=null;saved.people[0].contactResearch.checks.linkedin.profileMatchVersion=1;
 const replay=[];await D.runMandatoryBuyerResearch(saved,{rows:[{url:p.publicNameUrl,markdown:`${name} — Chief Operating Officer — ${company}`,sourceRead:true}],search:async q=>{replay.push(q);return q.startsWith('site:linkedin.com/in/')?[row()]:[];}});
 assert.deepEqual(replay,[`site:linkedin.com/in/ "${name}" "${company}"`]);assert.equal(saved.people[0].contactResearch.checks.linkedin.profileMatchVersion,2);assert.equal(D.confirmedBuyerContactData(saved,saved.people[0]).linkedin,url);
});
test('a uniquely verified replacement updates both saved URL aliases for contact handoff',()=>{
 const p=person(),current='https://se.linkedin.com/in/alex-morgan-current';
 const matched=D.matchPublicLinkedInProfiles([p],[{...row(),url:current}],company)[0];
 assert.equal(matched.publicLinkedinUrl,current);assert.equal(matched.linkedin_url,current);
 assert.equal(D.confirmedBuyerContactData({company,domain},matched).linkedin,current);
});
