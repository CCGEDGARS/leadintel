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
  assert.match(runtime,/ensureReferenceQuestion/);
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/scheduleRepairs/);
  assert.doesNotMatch(runtime,/MutationObserver/);
});

test('Question 03 recovery loads directly from HTML and does not depend on process-map module evaluation',()=>{
  const html=read('index.html');
  const processMap=read('process-map.js');
  assert.match(html,/<script defer src="step2-reference-question-runtime\.js\?v=20260909-question03-v5"><\/script>/);
  assert.doesNotMatch(processMap,/step2-reference-question-runtime\.js/);
});

test('Question 03 direct recovery loads before app and process-map modules',()=>{
  const html=read('index.html');
  const recoveryPos=html.indexOf('step2-reference-question-runtime.js?v=20260909-question03-v5');
  const appPos=html.indexOf('app.js?v=');
  const processPos=html.indexOf('process-map.js?v=');
  assert.ok(recoveryPos>=0&&appPos>recoveryPos&&processPos>recoveryPos,'Question 03 recovery must boot independently before application modules');
});
