const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('Research review distinguishes uncertainty from verified disqualification',()=>{
  assert.match(ui,/Research review/);
  assert.match(ui,/Needs more evidence/);
  assert.match(ui,/Not qualified/);
  assert.match(ui,/verified hard criterion failed/);
  assert.match(ui,/need evidence/);
  assert.match(ui,/not qualified/);
});

test('Research review deduplicates companies by canonical identity',()=>{
  assert.match(ui,/function researchReviewKey/);
  assert.match(ui,/const byKey=new Map/);
  assert.match(ui,/byKey\.set\(key,candidate\)/);
});

test('Research review supports recheck, buyer override, remove and clear actions',()=>{
  for(const action of ['recheck','recheck-all','buyers','remove','clear']) assert.match(ui,new RegExp(`data-review-action="${action}"`));
  assert.match(ui,/selectResearchReviewForBuyers/);
  assert.match(ui,/removeResearchReviewCompany/);
  assert.match(ui,/clearResearchReview/);
  assert.match(ui,/CRM records unchanged/);
});

test('Research review has compact status and action styling',()=>{
  assert.match(css,/\.research-review-status/);
  assert.match(css,/\.research-review-actions/);
  assert.match(css,/\.research-review-bulk/);
});

test('missing purchasing proof and low unverified buyer fit remain research gaps, not hard rejections',()=>{
 const classification=ui.match(/function researchReviewStatus\(candidate\)\{([\s\S]*?)\n \}/);
 assert.ok(classification,'research review classifier exists');
 const fn=classification[1];
 assert.doesNotMatch(fn,/buyer fit below\|/i,'a low score alone must never prove disqualification');
 assert.match(fn,/seller or reference customer cannot be a new prospect/);
 assert.match(fn,/company offers the same service rather than the required buyer profile/);
 assert.match(fn,/needs-evidence/);
});

test('Step 4 exposes reference similarity independently of company qualification',()=>{
 assert.match(ui,/Reference similarity \$\{q\.lookalikeScore\}\/100/);
 assert.match(ui,/Reference similarity \$\{assessment\.lookalikeScore\}\/100/);
 assert.match(ui,/Number\.isFinite\(q\.lookalikeScore\)/);
});
