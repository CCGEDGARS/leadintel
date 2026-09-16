const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const hygienePath=path.join(root,'workspace-reset-hygiene.js');
const hygiene=fs.existsSync(hygienePath)?fs.readFileSync(hygienePath,'utf8'):'';
const persistence=fs.readFileSync(path.join(root,'workspace-persistence.js'),'utf8');

test('workspace reset does not use a native browser confirmation dialog',()=>{
  assert.doesNotMatch(app,/window\.confirm\s*\(/);
});

test('workspace reset uses a five-second inline confirm state on the existing button',()=>{
  assert.match(app,/RESET_CONFIRM_WINDOW_MS\s*=\s*5000/);
  assert.match(app,/dataset\.resetArmed\s*=\s*["']true["']/);
  assert.match(app,/classList\.add\(["']reset-armed["']\)/);
  assert.match(app,/Confirm reset/);
  assert.match(app,/setTimeout\([^\n]*RESET_CONFIRM_WINDOW_MS\)/);
  assert.match(app,/style\.setProperty\(["']color["'],["']var\(--danger\)["']\)/);
});

test('workspace reset clears browser-only company residue but preserves saved API provider configuration',()=>{
  assert.match(processMap,/workspace-reset-hygiene\.js/,'customer shell must install reset hygiene');
  assert.equal(fs.existsSync(hygienePath),true,'workspace-reset-hygiene.js must exist');
  assert.match(hygiene,/leadintel_customer_v2_website_activation_v1/,'website activation cache must be resettable workspace residue');
  assert.match(hygiene,/leadintel_customer_v2_research_meta_v1/,'research cache must be resettable workspace residue');
  assert.match(hygiene,/dataset\.resetArmed!==["']true["']/,'derived caches must clear only on the confirmed second reset click');
  assert.match(hygiene,/localStorage\.removeItem\(key\)/,'reset hygiene must remove derived browser workspace keys');
  assert.doesNotMatch(hygiene,/\/api\/integrations\/ai\/provider|disconnectProvider|ai-settings/i,'workspace reset must not disconnect or delete saved AI provider credentials');
});

test('confirmed workspace reset records durable reset intent for the next authenticated sync',()=>{
  assert.match(persistence,/leadintel_customer_v2_reset_pending_v1/,'server reset must have a durable pending-reset marker');
  assert.match(persistence,/function recordResetIntent/);
  assert.match(persistence,/workspace_id/,'reset intent must retain workspace provenance when known');
  assert.match(persistence,/localStorage\?\.setItem\(RESET_PENDING_KEY/,'reset intent must survive reload and sign-in');
  assert.match(persistence,/handleResetClick[\s\S]*recordResetIntent\(\)/,'the server reset marker must be written only on the confirmed reset click');
  assert.match(hygiene,/leadintel_customer_v2_brand_asset_reset_cleanup_v1/,'asset cleanup must retain its own durable reset record');
});

test('pending reset auto-finishes through the existing version-safe sync path after authentication',()=>{
  assert.match(persistence,/async function clearPendingServerReset/);
  assert.match(persistence,/nativeFetch\(url\.toString\(\),\{method:"PUT"/,'pending reset must clear the server with the current version');
  assert.match(hygiene,/async function finalizePendingReset/);
  assert.match(hygiene,/resolveConflictKeepLocal/,'a reset that reconnects into a version conflict must reuse the safe keep-local resolver');
  assert.match(hygiene,/saveNow/,'a reset with no conflict must still save the blank workspace explicitly');
  assert.match(hygiene,/leadintel:server-ready/,'signed-out reset must resume automatically after Google sign-in');
  assert.match(persistence,/localStorage\?\.removeItem\(RESET_PENDING_KEY\)/,'pending server reset marker must clear after a successful version-safe PUT');
  assert.doesNotMatch(`${persistence}\n${hygiene}`,/deleteCrmCompany|\/api\/crm|\/api\/integrations\/ai\/provider|disconnectProvider/,'reset completion must not touch CRM or AI-provider credentials');
});

test('reset=1 provides a boot-safe browser recovery path before later runtimes can stall',()=>{
  assert.match(hygiene,/URLSearchParams/);
  assert.match(hygiene,/get\(["']reset["']\)===?["']1["']/);
  assert.match(hygiene,/leadintel_customer_v2_state/,'recovery must clear the core workspace state');
  assert.match(hygiene,/leadintel_customer_v2_server_hydration/,'recovery must clear stale session hydration');
  assert.match(hygiene,/location\.replace/,'recovery must navigate away from the reset query');
  assert.doesNotMatch(hygiene,/localStorage\.clear\(\)/,'recovery must not wipe unrelated storage or saved provider settings');
});
