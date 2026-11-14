const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function runtime(){
  const scope={URL,console,Date,TextEncoder};vm.createContext(scope);
  for(const file of ['step2-brief-schema.js','profile-engine.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js','step2-readiness-engine.js','monitoring-model.js','market-engine.js','strategy-integrity.js']){
    vm.runInContext('(function(){'+fs.readFileSync(require.resolve('../'+file),'utf8')+'\n})()',scope);
  }
  scope.LeadIntelStep2Readiness.patchProfileEngine(scope.LeadIntelProfile,scope);
  return scope;
}

function approvedReloadFixture(answerOverrides={}){
  const r=runtime(),P=r.LeadIntelProfile,I=r.LeadIntelStrategyIntegrity;
  const input={website:'https://seller.example/',targetMarkets:['Denmark'],answers:{priority_offers:'Clinical scheduling software',ideal_customer:'Independent clinics operating in Denmark',buyer_roles:'Operations Director',buying_outcomes:'Improve operating efficiency and reduce project delays',...answerOverrides},answerStatus:{priority_offers:'user',ideal_customer:'user',buyer_roles:'user',buying_outcomes:'user'},scrapedSources:[{id:'S1',type:'website',url:'https://seller.example/',text:'We provide clinical scheduling software.'}]};
  const state={...P.normalizeSavedState(input),profile:P.buildCompanyIntelligenceProfile(input),approved:true,market:r.LeadIntelMarket.normalizeMarketState({icps:[{id:'core',active:true,description:input.answers.ideal_customer}],signals:[{id:'expansion',keywords:'new facility',active:true,weight:9}],strategyApproved:true})};
  r.LeadIntelCanonicalIntelligence.confirmProfileContext(state);
  state.profile.customerPainPointsStatus='User confirmed';state.profile.customerPainPointsLanguage='en';
  return {r,P,I,state,reload(saved){const restored=P.normalizeSavedState(JSON.parse(JSON.stringify(saved)));restored.market=r.LeadIntelMarket.recoverInterruptedResearch(saved.market);return restored;}};
}

test('a reviewed multiline commercial objective survives approval and repeated reopening',()=>{
  const f=approvedReloadFixture(),objective='Find qualified opportunities\n\nPrepare source-backed outreach';
  // The canonical editor writes this textarea directly; success_outcome has no Brief.applyAnswers mapping.
  f.state.profile.commercialObjective=objective;
  Object.assign(f.state.profile.canonical.fields.commercialObjective,{value:objective,status:'user_confirmed',provenance:'user',sourceIds:['U:commercialObjective']});
  f.state.workspaceGoals.successOutcome=objective;
  f.r.LeadIntelCanonicalIntelligence.confirmProfileContext(f.state);
  f.state.market.strategyApproval=f.I.approval(f.state);
  for(let cycle=0;cycle<3;cycle++){
    f.state=f.reload(f.state);
    assert.equal(f.state.approved,true);
    assert.equal(f.state.profile.commercialObjective,objective);
    assert.equal(f.state.workspaceGoals.successOutcome,objective);
    assert.equal(f.I.status(f.state).current,true);
  }
  f.state.workspaceGoals.successOutcome='A genuinely different objective';
  const changed=f.reload(f.state);
  assert.equal(changed.approved,false,'a changed authoritative goal still requires review');
  assert.equal(f.I.status(changed).current,false);
});

test('saved source evidence metadata remains available to the approved Strategy after reopen',()=>{
  const f=approvedReloadFixture();
  Object.assign(f.state.scrapedSources[0],{description:'Published company context',extractedBy:'firecrawl',sourceProviders:['firecrawl'],publishedDate:'2026-10-30',verification:{status:'read',sourceUrl:'https://seller.example/'}});
  f.state.market.strategyApproval=f.I.approval(f.state);
  for(let cycle=0;cycle<3;cycle++){
    const previous=f.state;f.state=f.reload(previous);
    assert.deepEqual(JSON.parse(JSON.stringify(f.I.material(f.state).sources)),JSON.parse(JSON.stringify(f.I.material(previous).sources)));
    assert.equal(f.I.status(f.state).current,true);
  }
  f.state.scrapedSources[0].text='Materially changed evidence';
  assert.equal(f.I.status(f.state).current,false,'new source content still requires review');
});

test('approving inferred pain synchronizes its downstream buying-outcome alias before Strategy signing',()=>{
  // Build and approve through the real input pipeline with the optional answer absent.
  const f=approvedReloadFixture({buying_outcomes:''});
  assert.equal(f.state.profile.buyingOutcomes,f.state.profile.canonical.fields.customerPainPoints.value);
  f.state.market.strategyApproval=f.I.approval(f.state);
  assert.equal(f.I.status(f.reload(f.state)).current,true);
});

test('Profile approval gives freshly scraped sources stable identities before Strategy signing',()=>{
  const f=approvedReloadFixture();
  // app.scrapeSource returns a successfully read page without a generated source ID.
  delete f.state.scrapedSources[0].id;
  f.r.LeadIntelCanonicalIntelligence.confirmProfileContext(f.state);
  assert.equal(f.state.scrapedSources[0].id,'S1');
  f.state.market.strategyApproval=f.I.approval(f.state);
  const restored=f.reload(f.state);
  assert.equal(f.I.status(restored).current,true);
  assert.equal(restored.profile.canonical.fields.priorityOffers.sourceIds.join(','),f.state.profile.canonical.fields.priorityOffers.sourceIds.join(','));
});

for(const [offer,buyers] of [['Custom metal manufacturing','Industrial project contractors operating in Denmark'],['Clinical scheduling software','Independent clinics operating in Denmark']]){
  test(`approved ${offer} Strategy survives the real Profile reload pipeline`,()=>{
    const r=runtime(),P=r.LeadIntelProfile,I=r.LeadIntelStrategyIntegrity;
    const input={website:'https://seller.example/',targetMarkets:['Denmark'],answers:{priority_offers:offer,ideal_customer:buyers,buyer_roles:'Operations Director',exclusions:'Private consumers without business projects',buying_outcomes:'Improve operating efficiency and reduce project delays'},answerStatus:{priority_offers:'user',ideal_customer:'user',buyer_roles:'user',exclusions:'user',buying_outcomes:'user'},scrapedSources:[{id:'S1',type:'website',url:'https://seller.example/',text:`We provide ${offer}.`} ]};
    const state={...P.normalizeSavedState(input),profile:P.buildCompanyIntelligenceProfile(input),approved:true,market:{icps:[{id:'core',active:true,description:buyers}],signals:[{id:'expansion',keywords:'new facility',active:true,weight:9}],strategyApproved:true}};
    r.LeadIntelCanonicalIntelligence.confirmProfileContext(state);
    state.profile.customerPainPointsStatus='User confirmed';state.profile.customerPainPointsLanguage='en';
    state.market=r.LeadIntelMarket.normalizeMarketState(state.market);
    state.market.strategyApproval=I.approval(state);
    assert.equal(I.status(state).current,true);
    for(let cycle=0;cycle<3;cycle++){
      const saved=JSON.parse(JSON.stringify(state));
      const restored=P.normalizeSavedState(saved);
      restored.market=r.LeadIntelMarket.recoverInterruptedResearch(saved.market);
      assert.equal(restored.profile.customerPainPointsStatus,'User confirmed','a rebuild cannot relabel the approved customer context as AI-inferred');
      assert.equal(restored.profile.customerPainPointsLanguage,'en');
      assert.equal(restored.profile.marketFocus,restored.profile.canonical.fields.marketFocus.value,'compatibility field must respect the canonical value, including empty');
      assert.equal(I.status(restored).current,true,JSON.stringify({status:I.status(restored),changes:Object.keys(I.material(saved)).filter(k=>JSON.stringify(I.material(saved)[k])!==JSON.stringify(I.material(restored)[k]))})+' opening a saved workspace must not require Strategy reapproval');
      Object.assign(state,restored);
    }
    state.profile.priorityOffers='A materially different service';
    assert.equal(I.status(state).current,false,'real commercial edits still invalidate Strategy');
  });
}
