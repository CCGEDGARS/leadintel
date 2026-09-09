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

test('Question 03 does not depend on a boot-time MutationObserver repair runtime',()=>{
  const processMap=read('process-map.js');
  assert.doesNotMatch(processMap,/step2-reference-question-runtime\.js/);
});
