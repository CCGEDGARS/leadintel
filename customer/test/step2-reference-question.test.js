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
  assert.match(runtime,/STEP2_REFERENCE_VERSION='20260909-question03-v5'/);
  assert.match(runtime,/ensureReferenceQuestion/);
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/scheduleRepairs/);
  assert.doesNotMatch(runtime,/MutationObserver/);
});

test('Question 03 recovery is bootstrapped by the classic language entrypoint',()=>{
  const language=read('language.js');
  const processMap=read('process-map.js');
  assert.match(language,/step2-reference-question-runtime\.js\?v=20260909-question03-v5/);
  assert.match(language,/document\.createElement\(["']script["']\)/);
  assert.doesNotMatch(processMap,/step2-reference-question-runtime\.js/);
});
