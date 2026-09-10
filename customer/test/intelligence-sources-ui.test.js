const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'intelligence-sources-ui.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('Step 4 exposes a dedicated Intelligence Sources registry',()=>{
  assert.match(ui,/Intelligence Sources/);
  assert.match(ui,/Add Source/);
  assert.match(ui,/Test Access/);
  assert.match(ui,/Configure Signals/);
  assert.match(ui,/Mandatory source/);
  assert.match(ui,/Monitoring enabled/);
  assert.match(ui,/Source Health/);
  assert.match(ui,/NOT TESTED/);
  assert.match(ui,/FULL ACCESS/);
  assert.match(ui,/PARTIAL ACCESS/);
  assert.match(ui,/NO ACCESS/);
});

test('source UI uses workspace API and distinguishes public from authenticated access',()=>{
  assert.match(ui,/\/api\/intelligence-sources/);
  assert.match(ui,/Anonymous access/);
  assert.match(ui,/Authenticated access/);
  assert.match(ui,/Google sign-in/);
  assert.match(ui,/does not automatically give LeadIntel access/);
  assert.match(ui,/public/);
  assert.match(ui,/google/);
  assert.match(ui,/username_password/);
  assert.match(ui,/api_key/);
  assert.match(ui,/subscription/);
  assert.match(ui,/manual_only/);
});

test('mandatory source controls are gated by useful audited access and use active strategy signals',()=>{
  assert.match(ui,/\['full','partial'\]\.includes/);
  assert.match(ui,/state\(\)\?\.market\?\.signals/);
  assert.match(ui,/triggerIds/);
  assert.match(ui,/frequency/);
});

test('process map loads Intelligence Sources with a versioned runtime',()=>{
  assert.match(processMap,/intelligence-sources-ui\.js\?v=20260910-intelligence-sources-v1/);
});
