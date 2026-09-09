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
