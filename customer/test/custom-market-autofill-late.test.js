const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'custom-market-input-hygiene.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('custom market guard keeps watching for delayed browser autofill beyond startup timers',()=>{
  assert.match(helper,/setInterval\?\.\(sweep\s*,\s*\d+\)/,'guard must keep sweeping after Chrome delayed autofill');
  assert.match(helper,/visibilitychange/,'guard must sweep again when the page becomes visible');
});

test('process shell cache-busts the delayed-autofill guard release',()=>{
  assert.match(processMap,/custom-market-input-hygiene\.js\?v=20260903-custom-market-autofill-v3/);
});
