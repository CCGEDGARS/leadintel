const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-delete-ui.js'),'utf8');
const loader=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8');

test('saved list UI exposes explicit delete with confirmation',()=>{
  assert.match(runtime,/data-delete-reference-list/);
  assert.match(runtime,/This cannot be undone/);
  assert.match(runtime,/Portfolio\.deleteList/);
});

test('working-list clear action is distinguished from saved-list deletion',()=>{
  assert.match(runtime,/Clear current draft/);
  assert.match(runtime,/Saved Lists are not deleted/);
});

test('reference customer runtime loads deletion controls',()=>{
  assert.match(loader,/reference-customer-delete-ui\.js\?v=20260911-reference-delete-v1/);
  assert.match(loader,/reference-customer-portfolio\.js\?v=20260911-reference-delete-v1/);
});
