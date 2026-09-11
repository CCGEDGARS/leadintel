const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-delete-ui.js'),'utf8');
const loader=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8');

test('saved list UI exposes explicit branded inline delete confirmation',()=>{
  assert.match(runtime,/data-delete-reference-list/);
  assert.match(runtime,/data-confirm-delete-list/);
  assert.match(runtime,/Confirm delete/);
  assert.match(runtime,/data-cancel-delete-list/);
  assert.match(runtime,/Portfolio\.deleteList/);
  assert.doesNotMatch(runtime,/\bconfirm\s*\(/);
});

test('working-list clear action is distinguished from saved-list deletion',()=>{
  assert.match(runtime,/Clear current draft/);
  assert.match(runtime,/Saved Lists are not deleted/);
});

test('reference customer actions use unambiguous list labels',()=>{
  assert.match(runtime,/Create New List/);
  assert.match(runtime,/Import Customer List/);
});

test('reference customer action relabeling is idempotent so MutationObserver cannot self-trigger forever',()=>{
  assert.match(runtime,/function setText\(node,text\)\{if\(node&&node\.textContent!==text\)node\.textContent=text;\}/);
  assert.match(runtime,/setText\(create,'Create New List'\)/);
  assert.match(runtime,/setText\(upload,'Import Customer List'\)/);
  assert.doesNotMatch(runtime,/if\(create\)create\.textContent='Create New List'/);
  assert.doesNotMatch(runtime,/if\(upload\)upload\.textContent='Import Customer List'/);
});

test('reference customer runtime loads deletion controls',()=>{
  assert.match(loader,/reference-customer-delete-ui\.js\?v=20260911-reference-delete-v1/);
  assert.match(loader,/reference-customer-portfolio\.js\?v=20260911-reference-delete-v1/);
});