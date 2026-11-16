const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
function fixture(company='Example',domain='example.com',market='Denmark'){
 const c={company,domain,market,buyerSearchMode:'user_selected_target',buyerRoles:['Executive leadership','Operations Director'],people:[]};
 const p=(id,title)=>({id,name:'Alex '+id,publicName:'Alex '+id,title,organization:company,publicNameUrl:`https://${domain}/team`,identityStatus:'confirmed',nameVerification:'confirmed',country:''});
 c.people=[p('Regional','Managing Director, '+company+' Components Inc.'),p('Subsidiary','Managing Director, '+company+' GmbH'),p('Group','President & CEO')];return c;
}
test('a blank country cannot promote an explicitly different subsidiary into the target-market shortlist',()=>{
 for(const [company,domain,market]of [['Example','example.com','Denmark'],['North Works','northworks.example','Sweden'],['Cedar Health','cedarhealth.example','Germany']]){
  const c=fixture(company,domain,market),before=JSON.stringify(c),roles={decisionMakers:c.buyerRoles};
  for(const p of c.people.slice(0,2)){const q=D.qualifyBuyer(p,roles,c);assert.equal(q.eligible,false);assert.match(q.gaps.join(' '),/subsidiary|entity/i);assert.equal(q.total,null);}
  const r=D.confirmedBuyerShortlist(c.people,roles,c,{confirmedContact:()=>true});assert.deepEqual(r.priorityIds,['Group']);assert.equal(r.shortfall,3);assert.equal(JSON.stringify(c),before);
 }
});
test('exact selected entities and global parent leadership retain their independent eligibility',()=>{
 const c=fixture(),p=c.people[0],roles={decisionMakers:c.buyerRoles};
 assert.equal(D.qualifyBuyer(p,roles,{...c,company:'Example Components Inc.'}).eligible,true);
 assert.equal(D.qualifyBuyer(c.people[2],roles,c).eligible,true);
 assert.equal(D.qualifyBuyer({...p,title:'Managing Director, Example Group'},roles,c).eligible,true);
 assert.equal(D.qualifyBuyer({...p,title:'Managing Director, Exampleton GmbH'},roles,c).eligible,false,'an explicitly different entity requires review even when the brand prefix is unrelated');
 assert.equal(D.qualifyBuyer({...p,country:'United States'},roles,{...c,company:'Example Components Inc.'}).eligible,false,'an exact entity cannot waive an explicit country conflict');
});
test('subsidiary review survives normalization and CRM while retaining the person and confirmed channels',()=>{
 const c=fixture(),p=c.people[0],url='https://linkedin.com/in/alex-regional';Object.assign(p,{publicLinkedinUrl:url,linkedinConfirmedUrl:url,linkedinConfirmationMethod:'manual'});
 p.buyerQualification=D.qualifyBuyer(p,{decisionMakers:c.buyerRoles},c);
 const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0],retained=saved.people.find(row=>row.id===p.id);
 assert.ok(retained);assert.equal(retained.publicLinkedinUrl,url);assert.equal(D.qualifyBuyer(retained,{decisionMakers:c.buyerRoles},saved).eligible,false);
 const crm=require('../crm-engine.js').mapDiscoveryCandidateToCrm(saved),buyers=crm.intelligence.research_snapshot.buyerResearch.buyers;
 assert.ok(buyers.some(row=>row.name===p.name));assert.equal(buyers.find(row=>row.name===p.name).qualification.eligible,false);
});
test('a named official country heading applies even when the saved country field was empty',()=>{
 const c=fixture(),roles={decisionMakers:['Operations Director']},source='https://example.com/contact',person={id:'alex',name:'Alex Morgan',publicName:'Alex Morgan',title:'Operations Director',organization:'Example',publicNameUrl:source,country:''};
 for(const country of ['China','United States','Germany','Sweden']){
  const p={...person,publicPhone:'+861234567890',publicPhoneUrl:source,publicPhoneEvidence:{version:2,url:source,sourceKind:'official',sourceRead:true,checkedAt:new Date().toISOString(),quote:`### ${country} (Regional office) #### Alex Morgan Operations Director +861234567890`}};
  assert.equal(D.qualifyBuyer(p,roles,c).eligible,false,country);
  p.buyerQualification=D.qualifyBuyer(p,roles,c);const saved=D.normalizeDiscoveryState({selectedProspects:[{...c,people:[p]}]}).selectedProspects[0];
  assert.equal(saved.people[0].country,'','a source constraint does not invent a directory country');assert.equal(D.qualifyBuyer(saved.people[0],roles,saved).eligible,false);assert.equal(saved.people[0].publicPhoneEvidence.quote,p.publicPhoneEvidence.quote);
 }
});
test('country attribution stays inside the exact named card hierarchy and never comes from phone or LinkedIn prefixes',()=>{
 const c=fixture(),roles={decisionMakers:['Operations Director']},url='https://example.com/contact';
 const base={id:'alex',name:'Alex Morgan',title:'Operations Director',organization:'Example',publicNameUrl:url,publicPhone:'+861234567890',publicPhoneUrl:url,publicLinkedinUrl:'https://cn.linkedin.com/in/alex-morgan'};
 const proof=quote=>({...base,publicPhoneEvidence:{version:2,url,sourceKind:'official',sourceRead:true,checkedAt:new Date().toISOString(),quote}});
 for(const quote of ['### Denmark (Local office) #### Alex Morgan Operations Director','### China #### Another Person Operations Director ### Management #### Alex Morgan Operations Director','### China #### Another Person Operations Director','### Company contacts #### Alex Morgan Operations Director','### European Union #### Alex Morgan Operations Director'])assert.equal(D.qualifyBuyer(proof(quote),roles,c).eligible,true,quote);
 assert.equal(D.qualifyBuyer(proof('### China (Ningbo) #### Alex Morgan – Operations Director'),roles,c).eligible,false,'a punctuation separator does not erase named location evidence');
 assert.equal(D.qualifyBuyer(proof('## United States ### Georgia #### Alex Morgan Operations Director'),roles,{...c,market:'United States'}).eligible,true,'a state inside a named country is not a conflicting country');
 const stale=proof('### Denmark #### Alex Morgan Operations Director');stale.publicPhoneEvidence.checkedAt='2020-01-01';assert.equal(D.qualifyBuyer(stale,roles,c).eligible,false,'old location evidence cannot certify current target responsibility');
 const unbound=proof('### China #### Alex Morgan Operations Director');unbound.publicPhoneEvidence.url='https://unrelated.example/contact';assert.equal(D.qualifyBuyer(unbound,roles,c).eligible,true,'an unrelated source cannot assign a country to this person');
});
test('department headings, longer names and an exact company with a comma cannot create a market or entity conflict',()=>{
 const c=fixture(),roles={decisionMakers:['Operations Director','Executive leadership']},url='https://example.com/contact';
 const person={id:'alex',name:'Alex Morgan',title:'Operations Director',organization:'Example',publicNameUrl:url,publicPhone:'+4512345678',publicPhoneUrl:url};
 for(const heading of ['IT','HR','IN','NO']){
  const p={...person,publicPhoneEvidence:{version:2,url,sourceRead:true,sourceKind:'official',checkedAt:new Date().toISOString(),quote:`### ${heading} #### Alex Morgan Operations Director`}};
  assert.equal(D.qualifyBuyer(p,roles,c).eligible,true,heading);
 }
 const longer={...person,publicPhoneEvidence:{version:2,url,sourceRead:true,sourceKind:'official',checkedAt:new Date().toISOString(),quote:'### China #### Alex Morgan Smith Operations Director'}};
 assert.equal(D.qualifyBuyer(longer,roles,c).eligible,true,'a namesake with an additional surname cannot assign the selected person a country');
 for(const company of ['Example, Inc.','North Works, Ltd.'])assert.equal(D.qualifyBuyer({...person,title:'President & CEO, '+company,organization:company},roles,{...c,company}).eligible,true,company);
});
test('a multiline named country card retains its explicit scope before and after normalization',()=>{
 const c=fixture(),url='https://example.com/contact',p={id:'alex',name:'Alex Morgan',publicName:'Alex Morgan',title:'Operations Director',organization:'Example',publicNameUrl:url,publicPhone:'+861234567890',publicPhoneUrl:url,publicPhoneEvidence:{version:2,url,sourceRead:true,sourceKind:'official',checkedAt:new Date().toISOString(),quote:'### China (Ningbo)\nOffice address: 1 Export Road\n#### Alex Morgan\nOperations Director'}};
 const roles={decisionMakers:['Operations Director']};
 for(const quote of [p.publicPhoneEvidence.quote,p.publicPhoneEvidence.quote.replace(' (Ningbo)','')]){p.publicPhoneEvidence.quote=quote;assert.equal(D.qualifyBuyer(p,roles,c).eligible,false);const saved=D.normalizeDiscoveryState({selectedProspects:[{...c,people:[p]}]}).selectedProspects[0];assert.equal(D.qualifyBuyer(saved.people[0],roles,saved).eligible,false);}
});
