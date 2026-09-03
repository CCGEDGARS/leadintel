const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

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

test('custom market field uses search semantics so browser URL autofill does not target it',()=>{
  assert.match(index,/id="custom-target-market"[^>]*type="search"/,'custom market must not be a generic text field');
  assert.match(index,/id="custom-target-market"[^>]*name="leadintel-market-definition"/,'custom market must have a unique non-URL field name');
  assert.match(index,/id="custom-target-market"[^>]*autocomplete="off"/);
  assert.match(index,/id="custom-target-market"[^>]*inputmode="text"/);
});

test('app has a final URL/domain rejection gate before adding a custom market',()=>{
  assert.match(app,/looksLikeCustomMarketWebsite/,'app must independently detect website-like custom-market values');
  assert.match(app,/Use the Main company website field above/,'user must be told where the website belongs');
});

test('process shell loads the v3 custom market autofill guard',()=>{
  assert.match(processMap,/custom-market-input-hygiene\.js\?v=20260903-custom-market-autofill-v3/);
});
