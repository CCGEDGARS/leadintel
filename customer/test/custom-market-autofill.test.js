const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

function helperSource(){
  const helperPath=path.join(root,'custom-market-input-hygiene.js');
  return fs.existsSync(helperPath)?fs.readFileSync(helperPath,'utf8'):'';
}

test('custom target market rejects browser-autofilled website/domain values',()=>{
  const helper=helperSource();
  assert.match(helper,/custom-target-market/);
  assert.match(helper,/looksLikeUrlOrDomain/);
  assert.ok(helper.includes('^https?:\\/\\/'),'guard must recognize protocol URLs');
  assert.ok(helper.includes('^www\\.'),'guard must recognize www domains');
  assert.match(helper,/input\.value\s*=\s*["']{2}/);
  assert.match(helper,/addEventListener\(["']input["']/);
});

test('process shell loads the custom market autofill guard',()=>{
  assert.match(processMap,/custom-market-input-hygiene\.js\?v=20260901-custom-market-autofill-v1/);
});
