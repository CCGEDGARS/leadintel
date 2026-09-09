const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Step 2 keeps Question 03 in static HTML',()=>{
  const html=read('index.html');
  assert.match(html,/<span>03<\/span>[\s\S]*data-question="lookalike_customers"/);
  assert.match(html,/data-question="lookalike_customers"/);
});

test('Question 03 has a finite non-observer recovery runtime',()=>{
  const runtime=read('step2-reference-question-runtime.js');
  const processMap=read('process-map.js');

  assert.match(runtime,/ensureReferenceQuestion/);
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/scheduleRepairs/);
  assert.doesNotMatch(runtime,/MutationObserver/);
  assert.match(processMap,/step2-reference-question-runtime\.js\?v=20260909-question03-v4/);

  const referencePos=processMap.indexOf('step2-reference-question-runtime.js');
  const readinessPos=processMap.indexOf('step2-readiness-engine.js');
  assert.ok(referencePos>=0&&readinessPos>referencePos,'Question 03 recovery must load before readiness binds Step 2 fields');
});

test('customer HTML cache-busts the process map after Question 03 recovery changes',()=>{
  const html=read('index.html');
  assert.match(html,/process-map\.js\?v=20260909-question03-v4/);
});
