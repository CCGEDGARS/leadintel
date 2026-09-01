const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('workspace reset does not use a native browser confirmation dialog',()=>{
  assert.doesNotMatch(app,/window\.confirm\s*\(/);
});

test('workspace reset uses a five-second inline confirm state on the existing button',()=>{
  assert.match(app,/RESET_CONFIRM_WINDOW_MS\s*=\s*5000/);
  assert.match(app,/dataset\.resetArmed\s*=\s*["']true["']/);
  assert.match(app,/classList\.add\(["']reset-armed["']\)/);
  assert.match(app,/Confirm reset/);
  assert.match(app,/setTimeout\([^\n]*RESET_CONFIRM_WINDOW_MS\)/);
  assert.match(app,/style\.setProperty\(["']color["'],["']var\(--danger\)["']\)/);
});

test('workspace reset clears browser-only company residue but preserves saved API provider configuration',()=>{
  const resetStart=app.indexOf('async function resetWorkspace()');
  const bindStart=app.indexOf('function bind()',resetStart);
  assert.ok(resetStart>=0&&bindStart>resetStart,'resetWorkspace must exist before bind');
  const resetFlow=app.slice(resetStart,bindStart);
  assert.match(app,/leadintel_customer_v2_website_activation_v1/,'website activation cache must be identified as resettable workspace residue');
  assert.match(app,/leadintel_customer_v2_research_meta_v1/,'research cache must be identified as resettable workspace residue');
  assert.match(resetFlow,/localStorage\.removeItem\([^\n]*website_activation/i,'reset must clear saved browser website activation residue');
  assert.match(resetFlow,/localStorage\.removeItem\([^\n]*research_meta/i,'reset must clear saved browser research residue');
  assert.doesNotMatch(resetFlow,/\/api\/integrations\/ai\/provider|disconnectProvider|ai-settings/i,'workspace reset must not disconnect or delete saved AI provider credentials');
});
