const test=require('node:test'),assert=require('node:assert/strict'),Progress=require('../company-search-progress.js');
test('a spent budget with unfinished saved checks is paused rather than a completed no-match finding',()=>{
 const result=Progress.outcome({status:'no_results',targetCount:5,checked:[],pendingCount:31,run:{callsUsed:11,callLimit:11}}),view=Progress.model({status:'no_results',result});
 assert.equal(result.state,'partial');assert.equal(result.stopReason,'budget_limit');assert.match(view.title,/Search paused/);assert.equal(view.percent,null);assert.match(view.note,/11 of 11/);assert.match(view.note,/31 companies await/);assert.equal(view.stats[2][1],0);
 const completed=Progress.outcome({status:'no_results',targetCount:5,checked:[],pendingCount:0,run:{callsUsed:3,callLimit:11}});assert.equal(completed.state,'no_results');
});

// These cases reproduce the owner's screenshot: two checked companies are not
// two strong-fit prospects, and a bounded pass limit is not a spent budget.
test('mixed fit scores keep manual research visible without inflating the strong-fit count',()=>{
 const q=Progress.outcome({targetCount:5,checked:[{qualification:{score:81,automaticEligible:true}},{qualification:{score:69,automaticEligible:false}}],pendingCount:22,status:'complete',run:{pass:3,maxPasses:3,callsUsed:90,callLimit:200,exhausted:true}});
 assert.equal(q.checkedCount,2);assert.equal(q.strongFitCount,1);assert.equal(q.automaticReadyCount,1);assert.equal(q.pendingCount,22);assert.equal(q.targetMet,false);assert.equal(q.state,'partial');assert.equal(q.stopReason,'pass_limit');assert.doesNotMatch(q.note,/budget (?:exhausted|used up)/i);
});
test('only measured spent calls establish an exhausted provider budget',()=>{
 for(const [used,reason] of [[0,'pass_limit'],[199,'pass_limit'],[200,'budget_limit']]){
  const q=Progress.outcome({targetCount:5,checked:[],pendingCount:4,status:'complete',run:{pass:3,maxPasses:3,callsUsed:used,callLimit:200,exhausted:true}});
  assert.equal(q.stopReason,reason);assert.equal(q.state,'partial');
 }
});
test('a reached checked-company target stays separate from automatic readiness',()=>{
 const q=Progress.outcome({targetCount:2,checked:[{qualification:{score:70}},{qualification:{score:90,automaticEligible:true}}],pendingCount:3,status:'complete'});
 assert.equal(q.targetMet,true);assert.equal(q.state,'complete');assert.equal(q.strongFitCount,1);assert.equal(q.automaticReadyCount,1);
});
test('a small remaining allowance is distinct from spent credits and a shortfall never shows a full success meter',()=>{
 const q=Progress.outcome({targetCount:5,checked:[{qualification:{score:81}}],pendingCount:22,status:'complete',run:{pass:1,callsUsed:197,callLimit:200,remainingBudgetInsufficient:true}});
 assert.equal(q.stopReason,'budget_reserve');assert.doesNotMatch(q.note,/used up|exhausted/i);
 const m=Progress.model({status:'complete',result:q});assert.equal(m.state,'partial');assert.equal(m.percent,null);assert.match(m.title,/1 of 5/);assert.match(m.note,/22 companies/);assert.doesNotMatch(Progress.html(m),/aria-valuenow="100"/);
});
test('failure and cancellation cannot become a successful target merely because retained companies exist',()=>{
 for(const [status,run,reason] of [['error',{},'provider_failure'],['partial',{canceled:true},'canceled']]){
  const q=Progress.outcome({targetCount:1,checked:[{qualification:{score:90}}],pendingCount:1,status,run});assert.equal(q.stopReason,reason);assert.notEqual(q.state,'complete');
 }
});


test('a changed strategy does not present a historical budget stop as the current search outcome',()=>{
 const q=Progress.outcome({goal:'strong_fit',targetCount:5,checked:[],pendingCount:31,status:'complete',run:{contextChanged:true,completedAt:'2026-11-10T00:00:00Z',callsUsed:20,callLimit:20}});
 assert.equal(q.stopReason,'context_changed');assert.match(q.note,/strategy changed/i);assert.match(q.note,/previous run.*20 of 20/i);assert.equal(q.state,'partial');
 const m=Progress.model({status:'complete',result:q});assert.match(m.title,/review/i);assert.doesNotMatch(m.title,/Search paused/);
});
