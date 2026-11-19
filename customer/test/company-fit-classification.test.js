const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
// Step 4 company fit: the AI assessment is untrusted formatting as well as untrusted content.
// A capitalised or decorated non-buyer label must never default to a buyer and pass the 80+ gate.
const profile={website:'https://seller.example/',priorityOffers:'leadership training; warehouse automation',idealCustomer:'companies operating warehouses',targetMarkets:'Denmark',exclusions:'none'};
const now=new Date().toISOString(),quote='We operate a distribution warehouse in Denmark where our teams pick, sort and move inventory through storage and dispatch operations.';
const candidate={company:'Nordic',domain:'nordic.example',market:'Denmark',evidence:[{url:'https://nordic.example/operations',sourceRead:true,verifiedAt:now,text:'We provide leadership training services to business customers. '+quote}]};
const base={domain:candidate.domain,fit:85,relationship:'buyer',offerId:'offer-1',reason:'The stated warehouse operations are a specific inferred application for automation.',buyerRole:'warehouse operator',evidence:[{sourceId:'source-0',quote}]};
const parse=(over={})=>D.parseBuyerFit(JSON.stringify({companies:[{...base,...over}]}),[candidate],profile)[0];

test('capitalised or decorated non-buyer classifications are never scored as buyers',()=>{
 for(const [label,expected] of [['Competitor','competitor'],['competitor ','competitor'],['COMPETITOR','competitor'],['Direct competitor','competitor'],['Reseller','reseller'],['Distributor','reseller'],['Material supplier','supplier'],['Unrelated','unrelated'],['Not a buyer','unrelated'],['Competitor, not a buyer','competitor']]){
  const result=parse({relationship:label});
  assert.equal(result.buyerFit?.relationship,expected,label);
  const q=D.assessCompanyQualification({...result,researchedAt:now},profile,{},{},Date.now());
  assert.equal(q.automaticEligible,false,label+' must not reach automatic flow');
  assert.equal(q.checked,false,label+' must not be a checked buyer');
  assert.ok(q.gaps.includes('No relevant buyer relationship established from the operating evidence'),label);
 }
});

test('buyer classifications remain buyers regardless of case',()=>{
 for(const label of ['buyer','Buyer',' BUYER ','Potential buyer','Customer']){
  assert.equal(parse({relationship:label}).buyerFit?.relationship,'buyer',label);
 }
});

test('an honest insufficient-evidence answer is not reported as a provider failure',()=>{
 for(const over of [{evidenceStatus:'Insufficient',fit:null,offerId:null,evidence:[]},{evidenceStatus:' INSUFFICIENT ',fit:null,offerId:null,evidence:[]},{relationship:'Unverified',fit:null,offerId:null,evidence:[]},{relationship:'Unknown - insufficient operating evidence',fit:null,offerId:null,evidence:[]}]){
  const result=parse(over);
  assert.equal(result.buyerFit,undefined);
  assert.equal(result.buyerFitIssueCode,'insufficient_evidence',JSON.stringify(over));
 }
});

test('an unrecognised stated classification is rejected for retry instead of defaulting to buyer',()=>{
 const result=parse({relationship:'partner'});
 assert.equal(result.buyerFit,undefined);
 assert.equal(result.buyerFitIssueCode,'invalid_assessment');
 assert.match(result.buyerFitIssue,/did not classify/);
});

test('a missing classification keeps the existing buyer-category inference',()=>{
 assert.equal(parse({relationship:undefined}).buyerFit?.relationship,'buyer');
 assert.equal(parse({relationship:undefined,buyerRole:'competitor in warehouse automation'}).buyerFit?.relationship,'unrelated');
 assert.equal(parse({relationship:undefined,buyerRole:'unverified'}).buyerFitIssueCode,'insufficient_evidence');
});

test('equivalent identifier formats resolve only to the exact supplied choices',()=>{
 for(const over of [{offerId:1},{offerId:'1'},{offerId:'Offer-1'},{offerId:'Warehouse automation'},{offerId:undefined,purchase:'warehouse automation'},{evidence:[{sourceId:0,quote}]},{evidence:[{sourceId:'Source-0',quote}]},{evidence:[{sourceId:'source-0',quoteId:1}]},{fit:'85'},{fit:' 85 '}]){
  const result=parse(over);
  assert.equal(result.buyerFit?.fit,85,JSON.stringify(over));
  assert.equal(result.buyerFit?.purchase,'warehouse automation',JSON.stringify(over));
 }
 for(const over of [{offerId:2},{offerId:'offer-9'},{offerId:'robotics'},{offerId:-1},{offerId:1.5},{offerId:'offer-9',purchase:'warehouse automation'}])assert.equal(parse(over).buyerFitIssue,'The assessment did not select a confirmed offer.',JSON.stringify(over));
 for(const over of [{evidence:[{sourceId:1,quote}]},{evidence:[{sourceId:'source-0',quoteId:99}]},{evidence:[{sourceId:'source-0',quote:'We invented this sentence about a robotic warehouse purchase.'}]}])assert.match(parse(over).buyerFitIssue,/did not cite an exact official first-party quote/,JSON.stringify(over));
 for(const fit of ['85 points','85%','high',101,-1])assert.equal(parse({fit}).buyerFitIssue,'The assessment did not contain a valid fit score.',String(fit));
});

test('need status is read case-insensitively and stays inferred unless evidenced',()=>{
 assert.equal(parse({needStatus:'Evidenced'}).buyerFit.needStatus,'evidenced');
 assert.equal(parse({needStatus:'evidenced'}).buyerFit.needStatus,'evidenced');
 assert.equal(parse({needStatus:'likely'}).buyerFit.needStatus,'inferred');
 assert.equal(parse({}).buyerFit.needStatus,'inferred');
});

test('a saved normalised assessment still re-verifies after reload',()=>{
 const saved=parse({relationship:'Competitor',offerId:1});
 const reloaded=JSON.parse(JSON.stringify(saved));
 const verified=D.verifiedBuyerFit(reloaded,profile);
 assert.equal(verified?.relationship,'competitor');
 assert.equal(verified?.purchase,'warehouse automation');
 assert.equal(verified?.fit,85);
});

// Owner request 19 Nov 2026: companies are listed by relevance score in both display groups.
test('unranked companies follow the relevance score instead of alphabetical order',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const body=source.match(/function companyDisplayGroups\(view\)\{[\s\S]*?\n\}/)[0];
 const companyDisplayGroups=new Function(body+';return companyDisplayGroups;')();
 const at='2026-11-19T12:00:00Z',row=(name,score,extra={})=>({company:name,domain:name.toLowerCase()+'.example',researchedAt:at,qualification:{qualificationKind:'company',score,eligible:false,commercial:score===null?null:{}},...extra});
 const state={potentialMatches:[row('Alpha',55,{stale:true}),row('Bravo',null),row('Charlie',91,{stale:true}),row('Delta',66,{stale:true}),row('Echo',null)],candidates:[row('Zulu',84,{qualification:{qualificationKind:'company',score:84,eligible:true,commercial:{}}}),row('Yankee',97,{qualification:{qualificationKind:'company',score:97,eligible:true,commercial:{}}})]};
 const view=D.rankCompanyResults(state,{assess:c=>c.qualification,isCurrent:c=>!c.stale});
 const groups=companyDisplayGroups(view);
 assert.deepEqual(groups.ranked.map(r=>r.candidate.company),['Yankee','Zulu']);
 assert.deepEqual(groups.unranked.map(r=>[r.candidate.company,r.score,r.scoreState]),[['Charlie',91,'previous'],['Delta',66,'previous'],['Alpha',55,'previous'],['Bravo',null,'pending'],['Echo',null,'pending']]);
});
