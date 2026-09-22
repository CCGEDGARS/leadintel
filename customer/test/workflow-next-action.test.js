const test=require('node:test');
const assert=require('node:assert/strict');
const NextAction=require('../workflow-next-action.js');

test('Company Discovery blocks Campaign Studio until one opportunity is saved',()=>{
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:0}),{label:'Save an Opportunity First',enabled:false,visible:false});
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:1}),{label:'Continue to Campaign Studio →',enabled:true,visible:true});
});

test('Campaign Studio blocks Delivery until one campaign is approved',()=>{
  assert.deepEqual(NextAction.forStage(6,{approvedCampaignCount:0}),{label:'Approve a Campaign First',enabled:false});
  assert.deepEqual(NextAction.forStage(6,{approvedCampaignCount:1}),{label:'Continue to Delivery & Learning →',enabled:true});
});

test('Delivery footer explains the remaining action and ends with a completion state',()=>{
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:0}),{label:'Approve a Campaign First',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:false}),{label:'Send an Approved Campaign First',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:true,outcome:false}),{label:'Record the Campaign Outcome',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:true,outcome:true}),{label:'Workflow Complete ✓',enabled:false});
});


test('Step 5 hides the empty pipeline and continuation control until an opportunity is saved',()=>{
  assert.equal(typeof NextAction.applyStageVisibility,'function');

  const pipeline={hidden:false};
  const footer={hidden:false};
  const gate={closest:()=>footer};
  const document={
    querySelector(selector){return selector==='.pipeline-panel'?pipeline:null;},
    getElementById(id){return id==='continue-to-outreach'?gate:null;}
  };

  NextAction.applyStageVisibility(document,5,{pipelineCount:0});
  assert.equal(pipeline.hidden,true);
  assert.equal(footer.hidden,true);

  NextAction.applyStageVisibility(document,5,{pipelineCount:1});
  assert.equal(pipeline.hidden,false);
  assert.equal(footer.hidden,false);
});
