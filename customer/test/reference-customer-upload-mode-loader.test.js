import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');

test('Reference Customer upload mode is loaded during normal workspace boot before the profile CTA runtime',()=>{
  const uploadImport=processMap.indexOf("import './reference-customer-upload-mode.js");
  const profileImport=processMap.indexOf("import './profile-action-runtime.js");
  assert.ok(uploadImport>=0,'process-map must load reference-customer-upload-mode.js during normal boot');
  assert.ok(profileImport>=0,'process-map must load profile-action-runtime.js');
  assert.ok(uploadImport<profileImport,'upload mode must be installed before the profile CTA runtime can open Reference Customer UI');
});
