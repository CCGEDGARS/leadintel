import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Reference Customer upload runtime remains loaded before the profile CTA runtime',()=>{
  const processMap=read('process-map.js');
  const aiRuntime=read('reference-customer-ai-runtime.js');
  const profileImport=processMap.indexOf("import './profile-action-runtime.js");
  const aiImport=processMap.indexOf("import './reference-customer-ai-runtime.js");
  assert.ok(aiImport>=0,'process-map must load reference-customer-ai-runtime.js');
  assert.ok(profileImport>=0,'process-map must load profile-action-runtime.js');
  assert.ok(aiImport<profileImport,'Reference Customer runtime must load before profile CTA runtime');
  assert.match(aiRuntime,/import '\.\/reference-customer-upload-mode\.js\?/,'Reference Customer AI runtime must load upload mode');
});

test('approving the profile must not reload the page and destroy the Reference Customer upload interaction',()=>{
  const profileRuntime=read('profile-action-runtime.js');
  assert.doesNotMatch(profileRuntime,/location\?\.reload|location\.reload/);
  assert.match(profileRuntime,/persistApprovedState\(\)/);
  assert.match(profileRuntime,/syncApprovalControls\(\)/);
});
