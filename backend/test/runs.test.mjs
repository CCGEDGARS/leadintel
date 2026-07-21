import test from "node:test";
import assert from "node:assert/strict";
import {budgetDecision,normalizePolicy,validDispatchUrl} from "../src/runs.js";

test("only dedicated Make webhook hosts are accepted",()=>{
  assert.equal(validDispatchUrl("https://hook.eu2.make.com/123456789012345678901"),true);
  assert.equal(validDispatchUrl("https://make.com.example.org/hook/eu2/123456789012345678901"),false);
  assert.equal(validDispatchUrl("http://hook.eu2.make.com/123456789012345678901"),false);
});

test("active and duplicate-cost runs are blocked",()=>{
  const policy=normalizePolicy({daily_run_limit:3,monthly_candidate_limit:9,per_run_candidate_limit:3,cooldown_seconds:300});
  assert.equal(budgetDecision({policy,activeRun:{id:"RUN-1"}}).reason,"run_in_progress");
  assert.equal(budgetDecision({policy,dailyRuns:3}).reason,"daily_run_limit");
  assert.equal(budgetDecision({policy,monthlyCandidates:7}).reason,"monthly_candidate_limit");
});

test("cooldown and successful budgets return actionable decisions",()=>{
  const policy=normalizePolicy({cooldown_seconds:300});
  const now=Date.parse("2026-07-21T09:00:00Z");
  const cooling=budgetDecision({policy,lastRunAt:"2026-07-21T08:58:00Z",now});
  assert.equal(cooling.reason,"cooldown");
  assert.equal(cooling.retryAfter,180);
  assert.deepEqual(budgetDecision({policy,lastRunAt:"2026-07-21T08:00:00Z",now}),{allowed:true,reason:"within_budget",candidateBudget:3});
});

test("test runs are free and zero cooldown is preserved",()=>{
  const policy=normalizePolicy({cooldown_seconds:0});
  assert.equal(policy.cooldown_seconds,0);
  assert.deepEqual(budgetDecision({policy,activeRun:{id:"RUN-1"},dailyRuns:99,monthlyCandidates:999,test:true}),{allowed:true,reason:"test_run",candidateBudget:0});
});
