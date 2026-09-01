const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const hygiene=fs.readFileSync(path.join(root,'workspace-reset-hygiene.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('legacy browser autosave is cleared exactly once by the hygiene migration',()=>{
  assert.match(hygiene,/LEGACY_LOCAL_CLEANUP_KEY/);
  assert.match(hygiene,/leadintel_customer_v2_legacy_local_cleanup_20260901_v2/,'v2 migration must rerun even if v1 already completed');
  assert.match(hygiene,/function clearLegacyLocalAutosaveOnce\s*\(/);
  assert.match(hygiene,/leadintel_customer_v2_state/);
  assert.match(hygiene,/leadintel_customer_v2_discovery/);
  assert.match(hygiene,/leadintel_customer_v2_outreach/);
  assert.match(hygiene,/leadintel_customer_v2_delivery/);
  assert.match(hygiene,/leadintel_customer_v2_website_activation_v1/);
  assert.match(hygiene,/leadintel_customer_v2_research_meta_v1/);
  assert.match(hygiene,/leadintel_customer_v2_server_dirty/);
  assert.match(hygiene,/localStorage\.getItem\(LEGACY_LOCAL_CLEANUP_KEY\)/);
  assert.match(hygiene,/localStorage\.setItem\(LEGACY_LOCAL_CLEANUP_KEY,["']done["']\)/);
  assert.match(hygiene,/location\.reload\s*\(\)/,'first migrated load must reload after clearing stale local state');
  assert.doesNotMatch(hygiene,/disconnectProvider\s*\(|\/api\/integrations\/ai\/provider[^\n]*(DELETE|disconnect)/i,'cleanup must not delete saved AI provider credentials');
});

test('process shell cache-busts the legacy cleanup release',()=>{
  assert.match(processMap,/workspace-reset-hygiene\.js\?v=20260901-legacy-local-cleanup-v2/);
});
