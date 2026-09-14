const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery starts at ten and exposes a bounded custom target field',()=>{
  assert.match(source,/option value="10">10 companies/);
  assert.match(source,/option value="25">25 companies/);
  assert.match(source,/option value="50">50 companies/);
  assert.match(source,/option value="custom">Custom number/);
  assert.match(source,/id="discovery-target-custom"/);
  assert.match(source,/max="50"/);
  assert.match(source,/Find companies/);
  assert.match(source,/Choose amount/);
  assert.match(source,/discovery-control-row/);
});
