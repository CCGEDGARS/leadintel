const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const launcherPath=path.join(__dirname,'..','reference-customer-launcher.js');
const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
const profileRuntime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');

test('Reference Customer CTA is owned by one dedicated launcher and loads the upload runtime before opening',()=>{
  assert.ok(fs.existsSync(launcherPath),'dedicated Reference Customer launcher must exist');
  const launcher=fs.readFileSync(launcherPath,'utf8');
  assert.match(processMap,/reference-customer-launcher\.js\?v=20260924-reference-consensus-v1/);
  assert.match(launcher,/data-reference-customers-manage/);
  assert.match(launcher,/reference-customer-upload-mode\.js/);
  assert.match(launcher,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.doesNotMatch(profileRuntime,/data-reference-customers-manage/,'profile approval runtime must not own Reference Customer launch clicks');
});
