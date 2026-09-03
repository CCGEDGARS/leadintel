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

test('autofill guard gives the custom market field non-URL search semantics at runtime',()=>{
  const helper=helperSource();
  assert.match(helper,/setAttribute\("type","search"\)/,'custom market must be reclassified away from a generic text field');
  assert.match(helper,/setAttribute\("name","leadintel-market-definition"\)/,'custom market must use a unique non-URL form name');
  assert.match(helper,/setAttribute\("autocomplete","off"\)/);
  assert.match(helper,/setAttribute\("inputmode","text"\)/);
});

test('persistent browser restoration is severed by replacing the original custom-market control',()=>{
  const helper=helperSource();
  assert.match(helper,/replaceAutofilledControl/,'guard must have an explicit control replacement path');
  assert.match(helper,/replaceWith\(/,'restored browser state must be detached from the original DOM node');
  assert.match(helper,/replacement\.value\s*=\s*["']{2}/,'fresh replacement must always start empty');
  assert.match(helper,/createElement\(["']input["']\)/,'replacement must be newly created rather than cloning browser autofill state');
});

test('replacement control preserves Enter-to-add behavior through delegated key handling',()=>{
  const helper=helperSource();
  assert.match(helper,/keydown/);
  assert.match(helper,/event\.key\s*(?:===|!==)\s*["']Enter["']/);
  assert.match(helper,/add-target-market/);
  assert.match(helper,/\.click\(\)/,'Enter on the replacement should invoke the existing add-market button path');
});

test('add market has a capture-phase final safety gate for URL/domain autofill',()=>{
  const helper=helperSource();
  assert.match(helper,/add-target-market/);
  assert.match(helper,/preventDefault\(\)/);
  assert.match(helper,/stopImmediatePropagation\(\)/);
  assert.match(helper,/Use the Main company website field above/);
  assert.match(helper,/root\.document\.addEventListener\("click",[\s\S]+?\},true\);/,'safety gate must run before the app click handler');
});

test('process shell loads the v4 custom market node-reset guard',()=>{
  assert.match(processMap,/custom-market-input-hygiene\.js\?v=20260903-custom-market-node-reset-v4/);
});
