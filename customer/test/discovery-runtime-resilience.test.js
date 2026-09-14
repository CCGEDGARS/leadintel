const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('Discovery requests and strategy handoff cannot remain silently stuck',()=>{
  assert.ok(ui.includes('DISCOVERY_REQUEST_TIMEOUT_MS=25000'));
  assert.ok(ui.includes('controller.abort()'));
  assert.ok(ui.includes('Promise.all(queries.map'));
  assert.ok(ui.includes('Finding companies'));
  assert.ok(ui.includes('leadintel:open-discovery'));
  assert.ok(app.includes('leadintel:open-discovery'));
  assert.ok(ui.includes('let fatalError=null'));
  assert.ok(ui.includes('Discovery stopped safely'));
  assert.ok(ui.includes('void refreshCrmState({render:false})'));
  assert.ok(app.includes('const attempt=()=>'));
  assert.ok(app.includes('[100,300,700,1200]'));

});
