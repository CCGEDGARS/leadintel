const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-runtime.js'),'utf8');

test('Intelligence profile runtime must not observe the entire document for class/attribute mutations',()=>{
  assert.doesNotMatch(runtime,/observer\.observe\(document\.documentElement[\s\S]*attributes\s*:\s*true/,'document-wide attribute observation can create an unbounded feedback loop and freeze the page');
});

test('Intelligence profile refreshes from explicit lifecycle events instead of a global DOM observer',()=>{
  assert.match(runtime,/leadintel:workspace-changed/);
  assert.match(runtime,/leadintel:module-opened/);
  assert.match(runtime,/leadintel:reference-customers-updated/);
});

test('approved Intelligence Profile is restored when the legacy Step 3 editor rerenders',()=>{
  assert.match(runtime,/getElementById\('profile-editor'\)/);
  assert.match(runtime,/new MutationObserver/,'a narrowly scoped observer may watch only the Step 3 editor for legacy rerenders');
  assert.match(runtime,/observe\(editor,\{childList:true\}\)/,'observer must be limited to direct child replacement in the Step 3 editor');
  assert.match(runtime,/\.profile-field/,'restoration must trigger only when the legacy profile renderer replaces the approved Intelligence Profile');
  assert.doesNotMatch(runtime,/subtree\s*:\s*true/,'scoped restoration must not watch the whole Step 3 subtree');
  assert.doesNotMatch(runtime,/attributes\s*:\s*true/,'scoped restoration must not watch attributes');
});
