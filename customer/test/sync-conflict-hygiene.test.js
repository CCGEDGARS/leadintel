const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const helperPath=path.join(root,'sync-conflict-hygiene.js');
const helper=fs.existsSync(helperPath)?fs.readFileSync(helperPath,'utf8'):'';

test('blank workspace clears stale dirty/conflict markers before the server bridge loads',()=>{
  assert.match(helper,/leadintel_customer_v2_server_dirty/);
  assert.match(helper,/leadintel_customer_v2_server_conflict/);
  assert.match(helper,/hasMeaningfulWorkspaceData/);
  assert.match(helper,/localStorage\.removeItem\(DIRTY_KEY\)/);
  assert.match(helper,/sessionStorage\?\.removeItem\(CONFLICT_KEY\)/);
  assert.match(processMap,/sync-conflict-hygiene\.js\?v=20260901-stale-blank-conflict-v1/);
  assert.ok(processMap.indexOf('sync-conflict-hygiene.js')<processMap.indexOf('server-bridge.js'),'conflict hygiene must load before server bridge');
});

test('meaningful local workspace data is preserved and must not be auto-cleared',()=>{
  assert.match(helper,/website/);
  assert.match(helper,/targetMarkets/);
  assert.match(helper,/answers/);
  assert.match(helper,/profile/);
  assert.match(helper,/discovery/);
  assert.match(helper,/outreach/);
  assert.match(helper,/delivery/);
  assert.match(helper,/if\(hasMeaningfulWorkspaceData\(\)\)return false/);
});