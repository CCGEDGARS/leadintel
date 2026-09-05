const test=require('node:test');
const assert=require('node:assert/strict');
const identity=require('../business-identity.js');
const research=require('../company-research-engine.js');

test('profile derivation never substitutes furniture facts into another company',()=>{
  const result=identity.deriveIdentity({companyName:'Signal Labs',priorityOffers:'Our approach is laboratory testing only',idealCustomer:'Clinics in Sweden',buyingOutcomes:'Accurate test results'},{uiLanguage:'lv'});
  assert.doesNotMatch(JSON.stringify(result),/3D|Latvijā|darba vietu plānošan/);
  assert.match(JSON.stringify(result),/laboratory testing/);
});
test('a populated draft is not evidence-backed without accepted provenance',()=>{
  const result=identity.deriveIdentity({priorityOffers:'Laboratory tests',idealCustomer:'Clinics',buyingOutcomes:'Fewer errors',differentiation:'Fast tests'},{uiLanguage:'en',answerStatus:{differentiation:'draft'}});
  assert.notEqual(result.analysis.review.fab.advantages,'Evidence-backed');
  assert.notEqual(result.analysis.review.fab.benefits,'Evidence-backed');
});
test('source presence is labelled coverage rather than evidence quality',()=>{
  const result=identity.deriveIdentity({},{uiLanguage:'en',scrapedSources:[{text:'one sentence'}]});
  assert.equal(result.analysis.scoreKind,'input-coverage');
});
test('research rerun replaces old generated answers but preserves user edits',()=>{
  const current={priority_offers:'Old draft',ideal_customer:'My own audience'};
  const draft={priority_offers:{value:'New offer',sourceIds:['S1'],confidence:'medium'}};
  const result=research.mergeDraft(current,draft,{priority_offers:{origin:'research',reviewed:false},ideal_customer:{origin:'user'}});
  assert.equal(result.answers.priority_offers,'New offer');
  assert.equal(result.answers.ideal_customer,'My own audience');
});
test('research rerun preserves accepted evidence and its provenance',()=>{
  const result=research.mergeDraft({priority_offers:'Approved offer'},{},{priority_offers:{origin:'research',reviewed:true,sourceIds:['S1'],confidence:'high'}});
  assert.equal(result.answers.priority_offers,'Approved offer');
  assert.equal(result.meta.priority_offers.origin,'research');
  assert.deepEqual(result.meta.priority_offers.sourceIds,['S1']);
});
