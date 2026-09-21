const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('customer workspace loads the enrichment model before its UI controller',()=>{
  const model='profile-enrichment-checkpoint.js?v=20260921-profile-enrichment-v2';
  const ui='profile-enrichment-checkpoint-ui.js?v=20260921-profile-enrichment-v2';
  assert.ok(html.includes(model));
  assert.ok(html.includes(ui));
  assert.ok(html.indexOf(model)<html.indexOf(ui));
});
