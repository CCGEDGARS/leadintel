const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
function fixture(domain='supplier.example',company='Independent Supplier'){
 const person={id:'p',name:'Alex Jensen',publicName:'Alex Jensen',title:'Procurement Director',organization:company,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:`https://${domain}/team`};
 const candidate={company,domain,buyerSearchMode:'user_selected_target'};
 const row={url:`https://career-global.${domain}/people/alex-jensen`,sourceRead:true,extractedAt:new Date().toISOString(),markdown:`# Alex Jensen\nProcurement Director\n${company}\nEmail [alex.jensen@${domain}](mailto:alex.jensen@${domain})`};
 return {person,candidate,row};
}
for(const [domain,company] of [['supplier.example','Independent Supplier'],['clinic.example','Independent Clinic']])test(`read named company-subdomain email survives ${company} save and CRM reopen with incomplete research`,()=>{
 const {person,candidate,row}=fixture(domain,company),matched=D.matchPublicBuyerDetails([person],[row],domain,company)[0];
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,matched),`alex.jensen@${domain}`);
 assert.equal(matched.publicEmailUrl,row.url);assert.equal(matched.publicEmailEvidence.sourceKind,'official');
 matched.emailResearch={status:'partial',searches:3,failed:1,checkedAt:new Date().toISOString()};
 const restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[{...candidate,people:[matched]}]}))).selectedProspects[0];
 assert.equal(D.acceptedOfficialBuyerEmail(restored,restored.people[0]),`alex.jensen@${domain}`);
 const saved=CRM.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.buyers[0];
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,saved),`alex.jensen@${domain}`);assert.equal(saved.emailResearch.status,'partial');
});
for(const change of ['unread','foreign','suffix-spoof','wrong-person','model-summary'])test(`company subdomain proof rejects ${change}`,()=>{
 const {person,candidate,row}=fixture();
 if(change==='unread')row.sourceRead=false;
 if(change==='foreign')row.url='https://careers.other.example/people/alex-jensen';
 if(change==='suffix-spoof')row.url='https://supplier.example.attacker.example/people/alex-jensen';
 if(change==='wrong-person')row.markdown=row.markdown.replaceAll('Alex Jensen','Other Person');
 if(change==='model-summary'){row.sourceRead=false;row.evidenceKind='model_summary';row.description=row.markdown;delete row.markdown;}
 const matched=D.matchPublicBuyerDetails([person],[row],candidate.domain,candidate.company)[0];
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,matched),'');
});
