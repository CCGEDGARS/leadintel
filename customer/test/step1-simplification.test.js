const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('Step 1 removes the Additional links input and keeps Company materials as the third card',()=>{
  assert.doesNotMatch(html,/id="additional-links"/);
  assert.doesNotMatch(html,/<h3>Additional links<\/h3>/);
  assert.doesNotMatch(html,/Supporting pages and PDFs are optional evidence/);
  assert.match(html,/<span class="panel-number">03<\/span><div><h3>Company materials<\/h3>/);
});
