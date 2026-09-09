const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Step 2 keeps Question 03 in static HTML and connects it to Reference Customer Intelligence',()=>{
  const html=read('index.html');
  const processMap=read('process-map.js');

  assert.match(html,/<span>03<\/span>[\s\S]*data-question="lookalike_customers"/);
  assert.match(html,/data-question="lookalike_customers"[\s\S]*data-reference-customers-manage/);
  assert.doesNotMatch(processMap,/step2-reference-question-runtime\.js/,'Question 03 must not require an observer runtime during boot');
});

test('Question 03 does not depend on a MutationObserver repair loop',()=>{
  const processMap=read('process-map.js');
  assert.doesNotMatch(processMap,/step2-reference-question-runtime\.js/);
});
