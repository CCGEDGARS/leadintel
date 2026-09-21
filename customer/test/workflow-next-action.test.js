const test=require('node:test');
const assert=require('node:assert/strict');
const NextAction=require('../workflow-next-action.js');

test('Company Discovery blocks Campaign Studio until one opportunity is saved',()=>{
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:0}),{label:'Save an Opportunity First',enabled:false});
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:1}),{label:'Continue to Campaign Studio →',enabled:true});
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
