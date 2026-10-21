const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../crm-engine.js'),D=require('../discovery-engine.js');

test('complete removal clears only the exact company across working records and keeps seller settings and other companies',()=>{
 const row={domain:'example.com',people:[{name:'Buyer'}]},other={domain:'sub.example.com',company:'Separate company'};
 const state={main:{website:'seller.com',targetCompanies:[row,other],profile:{companyName:'Seller'}},discovery:{selectedProspects:[row,other],candidates:[row,other],pipeline:[row,other],potentialMatches:[row],rawResults:[{url:'https://example.com/team'},other],checkedCompanyDomains:['example.com','sub.example.com'],searchFeedback:[row,other]},meta:{activeBuyerCompanyDomain:'example.com',scriptBuyer:{domain:'example.com'},selectedEmailBuyer:{domain:'example.com'},selectedLinkedInBuyer:{domain:'sub.example.com'},buyerCrmSaves:{'example.com':'old','sub.example.com':'keep'}},outreach:{selectedDomain:'example.com',items:[row,other],buyerDrafts:{one:row,two:other},messageStudio:{mode:'friendly'}},delivery:{selectedDomain:'example.com',opportunities:[row,other],activity:[row,other]}};
 const before=JSON.stringify(state),next=C.removeBuyerCompanyRecords(state,'https://www.example.com/team');
 assert.equal(JSON.stringify(state),before,'cleanup is pure and cannot mutate the rollback snapshot');
 for(const key of ['selectedProspects','candidates','pipeline','rawResults','searchFeedback'])assert.deepEqual(next.discovery[key],[other],key);
 assert.deepEqual(next.discovery.checkedCompanyDomains,['sub.example.com']);
 assert.deepEqual(next.main.targetCompanies,[other]);assert.equal(next.main.website,'seller.com');assert.equal(next.main.profile.companyName,'Seller');
 assert.equal(next.meta.scriptBuyer,undefined);assert.equal(next.meta.selectedEmailBuyer,undefined);assert.equal(next.meta.selectedLinkedInBuyer.domain,'sub.example.com');assert.equal(next.meta.buyerCrmSaves['example.com'],undefined);
 assert.equal(next.outreach.items.length,1);assert.deepEqual(Object.keys(next.outreach.buyerDrafts),['two']);assert.equal(next.outreach.messageStudio.mode,'friendly');
 assert.equal(next.delivery.opportunities.length,1);assert.equal(next.delivery.activity.length,1);
 assert.equal(D.normalizeDiscoveryState(next.discovery).selectedProspects.some(x=>x.domain==='example.com'),false);
});

test('saved-state signatures detect new buyers, contact evidence and research changes',()=>{
 const candidate={domain:'example.com',company:'Example',people:[{id:'a',name:'Anna Andersson'}]};
 const signature=C.buyerCrmSignature(candidate);assert.equal(C.buyerCrmSignature(structuredClone(candidate)),signature);
 for(const patch of [{people:[{id:'a',name:'Anna Andersson',publicEmail:'anna@example.com'}]},{publicResearch:{checkedAt:'2026-10-21'}},{people:[...candidate.people,{id:'b',name:'Bert Buyer'}]}])assert.notEqual(C.buyerCrmSignature({...candidate,...patch}),signature);
 assert.ok(signature.length<80,'UI status never stores a second research snapshot');
});
