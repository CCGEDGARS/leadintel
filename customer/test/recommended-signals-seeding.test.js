const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const profileEngine=require('../profile-engine.js');
const marketEngine=require('../market-engine.js');

test('legacy saved profiles are repopulated with recommended buying signals',()=>{
  const state=profileEngine.normalizeSavedState({
    website:'ercon.lv',
    targetMarkets:['Latvia'],
    answers:{
      priority_offers:'Office furniture',
      buying_triggers:'Office relocation and workplace renovation'
    },
    scrapedSources:[{
      type:'website',
      url:'https://ercon.lv/',
      title:'Ercon',
      text:'Office relocation and workplace renovation services.'
    }],
    profile:{
      companyName:'Ercon',
      targetMarkets:'Latvia',
      buyingTriggers:'Office relocation and workplace renovation'
    }
  });
  assert.ok(Array.isArray(state.profile.recommendedSignals));
  assert.ok(state.profile.recommendedSignals.length>=4);
  const signals=marketEngine.normalizeSignals(state.profile.recommendedSignals,[]);
  assert.ok(signals.length>=4);
  assert.ok(signals.some(signal=>/facility expansion/i.test(signal.name)));
});

test('existing user-selected recommendations are preserved during migration',()=>{
  const state=profileEngine.normalizeSavedState({
    website:'ercon.lv',
    targetMarkets:['Latvia'],
    answers:{buying_triggers:'Office relocation'},
    profile:{
      companyName:'Ercon',
      targetMarkets:'Latvia',
      recommendedSignals:[{
        id:'facility-expansion',
        name:'Facility expansion or new site',
        active:false,
        priority:'High',
        reason:'User disabled this recommendation.'
      }]
    }
  });
  assert.equal(state.profile.recommendedSignals.length,1);
  assert.equal(state.profile.recommendedSignals[0].active,false);
});

test('strategy UI identifies generated recommendations before the optional custom signal form',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/Recommended buying signals/);
  assert.match(html,/Add buying signal/);
  assert.match(html,/profile-engine\.js\?v=20260915-brand-identity-v3/);
});
