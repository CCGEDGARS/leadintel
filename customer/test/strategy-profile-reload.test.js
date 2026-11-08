const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function runtime(){
  const scope={URL,console,Date,TextEncoder};vm.createContext(scope);
  for(const file of ['step2-brief-schema.js','profile-engine.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js','step2-readiness-engine.js','market-engine.js','strategy-integrity.js']){
    vm.runInContext('(function(){'+fs.readFileSync(require.resolve('../'+file),'utf8')+'\n})()',scope);
  }
  scope.LeadIntelStep2Readiness.patchProfileEngine(scope.LeadIntelProfile,scope);
  return scope;
}

for(const [offer,buyers] of [['Custom metal manufacturing','Industrial project contractors operating in Denmark'],['Clinical scheduling software','Independent clinics operating in Denmark']]){
  test(`approved ${offer} Strategy survives the real Profile reload pipeline`,()=>{
    const r=runtime(),P=r.LeadIntelProfile,I=r.LeadIntelStrategyIntegrity;
    const input={website:'https://seller.example/',targetMarkets:['Denmark'],answers:{priority_offers:offer,ideal_customer:buyers,buyer_roles:'Operations Director',exclusions:'Private consumers without business projects',buying_outcomes:'Improve operating efficiency and reduce project delays'},answerStatus:{priority_offers:'user',ideal_customer:'user',buyer_roles:'user',exclusions:'user',buying_outcomes:'user'},scrapedSources:[{id:'S1',type:'website',url:'https://seller.example/',text:`We provide ${offer}.`} ]};
    const state={...P.normalizeSavedState(input),profile:P.buildCompanyIntelligenceProfile(input),approved:true,market:{icps:[{id:'core',active:true,description:buyers}],signals:[{id:'expansion',keywords:'new facility',active:true,weight:9}],strategyApproved:true}};
    r.LeadIntelCanonicalIntelligence.confirmProfileContext(state);
    state.market=r.LeadIntelMarket.normalizeMarketState(state.market);
    state.market.strategyApproval=I.approval(state);
    assert.equal(I.status(state).current,true);
    for(let cycle=0;cycle<3;cycle++){
      const saved=JSON.parse(JSON.stringify(state));
      const restored=P.normalizeSavedState(saved);
      restored.market=r.LeadIntelMarket.recoverInterruptedResearch(saved.market);
      assert.equal(restored.profile.marketFocus,restored.profile.canonical.fields.marketFocus.value,'compatibility field must respect the canonical value, including empty');
      assert.equal(I.status(restored).current,true,JSON.stringify({status:I.status(restored),changes:Object.keys(I.material(saved)).filter(k=>JSON.stringify(I.material(saved)[k])!==JSON.stringify(I.material(restored)[k]))})+' opening a saved workspace must not require Strategy reapproval');
      Object.assign(state,restored);
    }
    state.profile.priorityOffers='A materially different service';
    assert.equal(I.status(state).current,false,'real commercial edits still invalidate Strategy');
  });
}
