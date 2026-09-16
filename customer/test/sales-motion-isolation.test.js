const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('legacy sales motion is not injected into the ten-field brief',()=>{
  assert.doesNotMatch(source,/sales_motion/);
  assert.doesNotMatch(source,/profile-lookalikeCustomers/);
});
