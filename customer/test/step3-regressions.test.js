const test=require('node:test');
const assert=require('node:assert/strict');
const profileEngine=require('../profile-engine.js');
const approvalUI=require('../profile-approval-ui.js');

test('partial saved signal sets are backfilled without re-enabling a disabled signal',()=>{
  const state=profileEngine.normalizeSavedState({
    website:'ercon.lv',
    targetMarkets:['Sweden'],
    answers:{buying_triggers:'Tender and procurement activity'},
    profile:{
      companyName:'Ercon',
      targetMarkets:'Sweden',
      buyingTriggers:'Tender and procurement activity',
      recommendedSignals:[{
        id:'tender',
        name:'Tender or procurement activity',
        active:false,
        priority:'High',
        reason:'User disabled this recommendation.'
      }]
    }
  });

  assert.ok(state.profile.recommendedSignals.length>=4);
  assert.equal(state.profile.recommendedSignals.find(signal=>signal.id==='tender').active,false);
  assert.ok(state.profile.recommendedSignals.filter(signal=>signal.active!==false).length>=3);
});

test('approval UI tolerates older Step 3 markup with missing controls',()=>{
  const status={textContent:'',classList:{toggle(){}}};
  const document={getElementById(id){return id==='profile-status'?status:null;}};

  assert.doesNotThrow(()=>approvalUI.updateProfileApprovalUI(document,true));
  assert.equal(status.textContent,'Approved');
});
