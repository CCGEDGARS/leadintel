const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const profile={website:'https://seller.example/',priorityOffers:'leadership training; warehouse automation',idealCustomer:'companies operating warehouses',targetMarkets:'Denmark',exclusions:'none'};
const now=new Date().toISOString(),quote='We operate a distribution warehouse in Denmark where our teams pick, sort and move inventory through storage and dispatch operations.';
const candidate={company:'Nordic',domain:'nordic.example',market:'Denmark',evidence:[{url:'https://nordic.example/operations',sourceRead:true,verifiedAt:now,text:'We provide leadership training services to business customers. '+quote}]};
test('a sourced buyer application for one offer is not vetoed by selling a different offer',()=>{
 const checked=D.parseBuyerFit(JSON.stringify({companies:[{domain:candidate.domain,fit:85,relationship:'buyer',offerId:'offer-1',reason:'The operating warehouse is a specific inferred application for automation; demand remains unconfirmed.',buyerRole:'warehouse operator',evidence:[{sourceId:'source-0',quote}]}]}),[candidate],profile)[0];
 const result=D.assessCompanyQualification(checked,profile,{}, {researchedAt:now});assert.equal(result.eligible,true,result.gaps.join('; '));assert.equal(checked.buyerFit.purchase,'warehouse automation');
});
test('overlap with one offer cannot prevent saved-evidence assessment of the other confirmed offer',()=>{
 const plan=D.companyEvidencePlan(candidate,profile,{}, {researchedAt:now});assert.equal(plan.hardFailure,false);assert.equal(plan.reassessSaved,true);
});

test('independent applications inside a combined offer preserve the parent offer identity',()=>{
 const combined={...profile,priorityOffers:'leadership training and warehouse automation'};
 const plan=D.companyEvidencePlan(candidate,combined,{}, {researchedAt:now});assert.equal(plan.hardFailure,false);assert.equal(plan.reassessSaved,true);
 const checked=D.parseBuyerFit(JSON.stringify({companies:[{domain:candidate.domain,fit:85,relationship:'buyer',offerId:'offer-0',reason:'Warehouse automation is an inferred application for the stated distribution operations; demand is unconfirmed.',buyerRole:'warehouse operator',evidence:[{sourceId:'source-0',quote}]}]}),[candidate],combined)[0];
 const result=D.assessCompanyQualification(checked,combined,{}, {researchedAt:now});assert.equal(result.eligible,true,result.gaps.join('; '));assert.equal(checked.buyerFit.purchase,combined.priorityOffers);
});
