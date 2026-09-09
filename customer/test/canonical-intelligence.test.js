const test=require('node:test');
const assert=require('node:assert/strict');
const Canonical=require('../canonical-intelligence.js');

function candidate(value,provenance,status='first_party_evidence',confidence='medium',sourceIds=[]){return {value,provenance,status,confidence,sourceIds};}

test('source authority classifies same-domain pages as first-party and unrelated sites as external validation',()=>{
  assert.equal(Canonical.classifySource({url:'https://www.ccgroup.lv/services'},'https://ccgroup.lv/').class,'first_party_website');
  assert.equal(Canonical.classifySource({url:'https://ccgroup.lv/about'},'https://www.ccgroup.lv/').class,'first_party_website');
  assert.equal(Canonical.classifySource({url:'https://www.klozers.com/case-studies'},'https://ccgroup.lv/').class,'external_validation');
});

test('canonical precedence is user then document then website then AI inference',()=>{
  const result=Canonical.reconcileField('idealCustomer',[
    candidate('AI guess','ai_inference','ai_inferred_first_party','low',['AI1']),
    candidate('Website segment','website','first_party_evidence','medium',['W1']),
    candidate('Document segment','document','first_party_evidence','high',['D1']),
    candidate('User segment','user','user_confirmed','high',['U1'])
  ]);
  assert.equal(result.value,'User segment');
  assert.equal(result.provenance,'user');
});

test('accepted research answer backed by an uploaded document keeps document authority',()=>{
  const profile=Canonical.buildCanonicalProfile({
    website:'https://acme.example/',targetMarkets:['Germany'],
    answers:{differentiation:'ISO-certified engineering and installation'},answerStatus:{differentiation:'accepted'},
    researchMeta:{fields:{differentiation:{origin:'research',reviewed:true,confidence:'high',sourceIds:['D1']}}},
    documents:[{name:'catalog.pdf',text:'ISO-certified engineering and installation'}],scrapedSources:[]
  },{});
  const field=profile.canonical.fields.differentiation;
  assert.equal(field.provenance,'document');
  assert.equal(field.status,'first_party_evidence');
  assert.equal(field.confidence,'high');
  assert.deepEqual(field.sourceIds,['D1']);
});

test('external evidence cannot overwrite first-party canonical value and contradiction is retained',()=>{
  const profile={canonical:{fields:{idealCustomer:candidate('Enterprise customers','user','user_confirmed','high',['U1'])}}};
  const result=Canonical.compareExternalEvidence(profile,[{id:'X1',url:'https://directory.example/acme',claims:{idealCustomer:'SME customers'}}]);
  assert.equal(profile.canonical.fields.idealCustomer.value,'Enterprise customers');
  assert.equal(result.length,1);
  assert.equal(result[0].field,'idealCustomer');
  assert.match(result[0].resolution,/primary retained/i);
});

test('diagnostics use canonical field state rather than raw questionnaire completion',()=>{
  const inferred={canonical:{fields:{customerPainPoints:candidate('Managers lack a consistent coaching system','ai_inference','ai_inferred_first_party','medium',['W1'])}}};
  const inferredDiag=Canonical.diagnoseCanonicalProfile(inferred).find(x=>x.field==='customerPainPoints');
  assert.equal(inferredDiag.state,'needs_confirmation');

  const confirmed={canonical:{fields:{customerPainPoints:candidate('Managers lack a consistent coaching system','user','user_confirmed','high',['U1'])}}};
  assert.equal(Canonical.diagnoseCanonicalProfile(confirmed).find(x=>x.field==='customerPainPoints').state,'known');

  const missing={canonical:{fields:{customerPainPoints:candidate('','ai_inference','unknown','low',[])}}};
  assert.equal(Canonical.diagnoseCanonicalProfile(missing).find(x=>x.field==='customerPainPoints').state,'missing');
});

test('buildCanonicalProfile keeps compatibility values generated from canonical records',()=>{
  const profile=Canonical.buildCanonicalProfile({
    website:'https://ccgroup.lv/',targetMarkets:['Germany'],answers:{priority_offers:'Sales training',ideal_customer:'B2B sales teams',buyer_roles:'Sales Director',differentiation:'Practical implementation',buying_triggers:'new sales leader',success_outcome:'Build pipeline'},answerStatus:{priority_offers:'user',ideal_customer:'user',buyer_roles:'user',differentiation:'user',buying_triggers:'user',success_outcome:'user'},scrapedSources:[],documents:[]
  },{customerPainPoints:'Inconsistent sales execution',recommendedSignals:[]});
  assert.equal(profile.priorityOffers,profile.canonical.fields.priorityOffers.value);
  assert.equal(profile.targetMarkets,profile.canonical.fields.targetMarkets.value);
  assert.equal(profile.customerPainPoints,'Inconsistent sales execution');
  assert.equal(profile.canonical.fields.customerPainPoints.status,'ai_inferred_first_party');
  assert.equal(profile.canonical.version,1);
});
