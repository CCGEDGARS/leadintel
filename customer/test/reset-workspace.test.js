const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const hygienePath=path.join(root,'workspace-reset-hygiene.js');
const hygiene=fs.existsSync(hygienePath)?fs.readFileSync(hygienePath,'utf8'):'';

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
  assert.match(processMap,/workspace-reset-hygiene\.js/,'customer shell must install reset hygiene');
  assert.equal(fs.existsSync(hygienePath),true,'workspace-reset-hygiene.js must exist');
  assert.match(hygiene,/leadintel_customer_v2_website_activation_v1/,'website activation cache must be resettable workspace residue');
  assert.match(hygiene,/leadintel_customer_v2_research_meta_v1/,'research cache must be resettable workspace residue');
  assert.match(hygiene,/dataset\.resetArmed!==["']true["']/,'derived caches must clear only on the confirmed second reset click');
  assert.match(hygiene,/localStorage\.removeItem\(key\)/,'reset hygiene must remove derived browser workspace keys');
  assert.doesNotMatch(hygiene,/\/api\/integrations\/ai\/provider|disconnectProvider|ai-settings/i,'workspace reset must not disconnect or delete saved AI provider credentials');
});
