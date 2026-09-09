const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Step 2 keeps Question 03 visible and connects it to Reference Customer Intelligence',()=>{
  const runtime=read('step2-reference-question-runtime.js');
  const processMap=read('process-map.js');

  assert.match(runtime,/lookalike_customers/);
  assert.match(runtime,/Which 3–5 existing customers would you most like to replicate\?/);
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/03/);
  assert.match(runtime,/ensureReferenceQuestion/);
  assert.match(processMap,/step2-reference-question-runtime\.js/);

  const referencePos=processMap.indexOf('step2-reference-question-runtime.js');
  const readinessPos=processMap.indexOf('step2-readiness-engine.js');
  assert.ok(referencePos>=0&&readinessPos>referencePos,'Question 03 runtime must load before readiness binds Step 2 fields');
});

test('Question 03 runtime repairs late DOM mutations after research rendering',()=>{
  const runtime=read('step2-reference-question-runtime.js');
  assert.match(runtime,/MutationObserver/);
  assert.match(runtime,/questionGrid\(\)/);
  assert.match(runtime,/childList:true/);
  assert.match(runtime,/subtree:true/);
});
