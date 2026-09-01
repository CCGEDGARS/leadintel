const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('legacy browser autosave is cleared exactly once before app state is loaded',()=>{
  assert.match(app,/LEGACY_LOCAL_CLEANUP_KEY/);
  assert.match(app,/function clearLegacyLocalAutosaveOnce\s*\(/);
  const cleanupCall=app.indexOf('clearLegacyLocalAutosaveOnce();');
  const stateLoad=app.indexOf('let state=loadState();');
  assert.ok(cleanupCall>=0&&stateLoad>cleanupCall,'legacy cleanup must run before loadState');
  assert.match(app,/leadintel_customer_v2_state/);
  assert.match(app,/leadintel_customer_v2_discovery/);
  assert.match(app,/leadintel_customer_v2_outreach/);
  assert.match(app,/leadintel_customer_v2_delivery/);
  assert.match(app,/leadintel_customer_v2_website_activation_v1/);
  assert.match(app,/leadintel_customer_v2_research_meta_v1/);
  assert.match(app,/leadintel_customer_v2_server_dirty/);
  assert.doesNotMatch(app,/disconnectProvider\s*\(|\/api\/integrations\/ai\/provider[^\n]*(DELETE|disconnect)/i,'cleanup must not delete saved AI provider credentials');
});

test('customer page cache-busts the cleanup release so existing tabs receive it',()=>{
  assert.match(index,/app\.js\?v=20260901-legacy-local-cleanup-v1/);
});
