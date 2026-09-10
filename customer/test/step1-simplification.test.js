const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const sync=read('website-input-sync.js');

test('Step 1 runtime removes Additional links and promotes Company materials to card 03',()=>{
  assert.match(sync,/function simplifyStepOne\(\)/);
  assert.match(sync,/getElementById\("additional-links"\)/);
  assert.match(sync,/closest\("\.panel\.source-panel"\)\?\.remove\(\)/);
  assert.match(sync,/Company materials/);
  assert.match(sync,/textContent="03"/);
  assert.match(sync,/Your company website and at least one target market are required\. PDFs are optional evidence/);
});
