const test=require('node:test');
const assert=require('node:assert/strict');
const plan=require('../firecrawl-plan.js');

test('plan is the largest allotment at or below the reported credits; unknown credits make no claim',()=>{
  assert.equal(plan.planFromCredits(0),null);assert.equal(plan.planFromCredits('x'),null);assert.equal(plan.planFromCredits(undefined),null);
  assert.deepEqual([plan.planFromCredits(1000).name,plan.planFromCredits(1500).name,plan.planFromCredits(5000).name,plan.planFromCredits(100000).name,plan.planFromCredits(9e9).name],['Free','Free','Hobby','Standard','Scale']);
  assert.deepEqual(plan.planFromStatus({providers:[{provider:'apollo'},{provider:'firecrawl',metadata:{plan_credits:1500,remaining_credits:651}}]}),{plan:plan.PLANS[0],remainingCredits:651});
  assert.deepEqual(plan.planFromStatus({firecrawl:{provider:'firecrawl',metadata:{}}}),{plan:null,remainingCredits:null});
  assert.deepEqual(plan.planFromStatus(null),{plan:null,remainingCredits:null});
});

test('credits follow the published formula and match the measured runs',()=>{
  assert.equal(plan.creditsForSearch(8),10,'2 per 10 results rounded up + 1 per scraped result');
  assert.equal(plan.creditsForSearch(5),7);assert.equal(plan.creditsForSearch(11),15);assert.equal(plan.creditsForSearch(1,{scrapeResults:false}),2);
  assert.equal(plan.estimateCredits({searches:4,resultsPerSearch:5}),28,'Quick Overview: measured 31');
  assert.equal(plan.estimateCredits({searches:12,resultsPerSearch:8}),120,'Market Research: measured 106');
  assert.equal(plan.estimateCredits({searches:150,resultsPerSearch:8,pages:40}),1540,'Companies default ceiling: measured 1 224 for 200 calls');
  assert.equal(plan.estimateCredits({}),0);
});

test('minutes are the paced duration on the plan, never below one minute',()=>{
  const free=plan.planFromCredits(1000),hobby=plan.planFromCredits(5000);
  assert.equal(plan.minutesOnPlan({searches:40,pages:20},free),4);
  assert.equal(plan.minutesOnPlan({searches:40,pages:20},hobby),1);
  assert.equal(plan.minutesOnPlan({searches:5},free),1);
  assert.equal(plan.minutesOnPlan({searches:40},null),null);
});

test('the sentence names credits always, minutes and plan only when known, and warns when the balance is short',()=>{
  const free=plan.planFromCredits(1500);
  assert.equal(plan.describe({searches:12,resultsPerSearch:8},null).text,'up to 120 Firecrawl credits');
  assert.equal(plan.describe({searches:12,resultsPerSearch:8},free).text,'up to 120 Firecrawl credits · about 2 min on the Free plan (10 searches/min)');
  assert.equal(plan.describe({searches:150,resultsPerSearch:8,pages:40},free,{remainingCredits:651}).text,'up to 1,540 Firecrawl credits · about 15 min on the Free plan (10 searches/min) · only 651 remaining — this run may stop early');
  assert.equal(plan.describe({searches:1,resultsPerSearch:1,pages:0},free,{remainingCredits:5000}).text,'up to 3 Firecrawl credits · about 1 min on the Free plan (10 searches/min) · 5,000 remaining');
});
