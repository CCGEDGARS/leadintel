const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=fs.readFileSync(path.join(__dirname,'..','server-bridge.js'),'utf8');

test('server bridge knows all Customer V2 storage namespaces and API base',()=>{
  for(const key of ['leadintel_customer_v2_state','leadintel_customer_v2_discovery','leadintel_customer_v2_outreach','leadintel_customer_v2_delivery','leadintel_customer_v2_discovery_meta'])assert.match(bridge,new RegExp(key));
  assert.match(bridge,/https:\/\/leadintel-api\.edgars-7e7\.workers\.dev/);
});

test('server bridge supports Google sign in and versioned workspace state',()=>{
  assert.match(bridge,/\/api\/auth\/google\/start/);assert.match(bridge,/\/api\/session/);assert.match(bridge,/\/api\/workspaces/);assert.match(bridge,/\/api\/customer\/state/);assert.match(bridge,/version:bridge\.stateVersion/);assert.match(bridge,/response\.status===409/);
});

test('server bridge makes authenticated server state authoritative and preserves local fallback',()=>{
  assert.match(bridge,/applyPayload\(state\.payload\)/);assert.match(bridge,/Local workspace · Sign in to sync/);assert.match(bridge,/Synced to LeadIntel/);assert.match(bridge,/hasLocalData\(\)/);
});

test('server bridge exposes Gmail server actions without browser token storage',()=>{
  for(const pathPart of ['gmail/status','gmail/start','gmail/disconnect','gmail/send','gmail/sync'])assert.match(bridge,new RegExp(pathPart.replace('/','\\/')));
  assert.doesNotMatch(bridge,/access_token\s*=|refresh_token\s*=|localStorage\.setItem\([^\n]*token/i);
});

test('server bridge exposes CRM-native Apollo enrichment without exposing Apollo credentials',()=>{
  assert.match(bridge,/enrichCrmContact/);
  assert.match(bridge,/\/enrich-contact/);
  assert.match(bridge,/person_id/);
  assert.match(bridge,/phone_lookup/);
  assert.match(bridge,/allow_personal_email/);
  assert.doesNotMatch(bridge,/APOLLO_API_KEY|X-Api-Key/);
});

test('dirty local state survives reload and is retried before reporting synced',()=>{
  assert.match(bridge,/DIRTY_KEY/);
  assert.match(bridge,/localStorage\.setItem\(DIRTY_KEY/);
  assert.match(bridge,/localStorage\.removeItem\(DIRTY_KEY/);
  assert.match(bridge,/hasDirtyLocalState\(\)/);
  assert.match(bridge,/if\(hasDirtyLocalState\(\)\).*scheduleSave\(\)/s);
});

test('workspace switching is blocked while the active workspace has unsynced local state',()=>{
  assert.match(bridge,/async function selectWorkspace\(id\).*hasDirtyLocalState\(\)/s);
  assert.match(bridge,/Finish syncing before switching workspaces/);
});

test('version conflicts expose explicit keep-local and use-server recovery actions',()=>{
  assert.match(bridge,/resolveConflictKeepLocal/);
  assert.match(bridge,/resolveConflictUseServer/);
  assert.match(bridge,/Use server version/);
  assert.match(bridge,/Keep my local changes/);
  assert.match(bridge,/conflictState/);
});

test('signed-out edits retain workspace and server-version provenance for safe reconciliation after sign-in',()=>{
  assert.match(bridge,/VERSION_KEY/);
  assert.match(bridge,/rememberServerVersion/);
  assert.match(bridge,/readRememberedVersion/);
  assert.doesNotMatch(bridge,/function markDirtyLocalState\(\)\{if\(!bridge\.workspace\)return/);
  assert.match(bridge,/localStorage\.getItem\(WORKSPACE_KEY\)/);
});

test('server account escaping uses a complete HTML quote entity',()=>{
  assert.match(bridge,/&quot;/);
});

test('workspace switching clears the shared customer cache before loading another workspace',()=>{
  assert.match(bridge,/clearCustomerCache/);
  assert.match(bridge,/async function selectWorkspace\(id\).*clearCustomerCache\(\).*localStorage\.setItem\(WORKSPACE_KEY,id\)/s);
});

test('pending explicit reset clears saved workspace before normal hydration without touching CRM or AI credentials',()=>{
  assert.match(bridge,/leadintel_customer_v2_reset_pending_v1/,'server bridge must recognize reset intent written before sign-in');
  assert.match(bridge,/async function completePendingReset/);
  assert.match(bridge,/emptyWorkspacePayload/);
  assert.match(bridge,/completePendingReset[\s\S]*\/api\/customer\/state[\s\S]*method:["']PUT["'][\s\S]*version:state\.version/,'reset must overwrite the latest saved workspace version explicitly');
  assert.match(bridge,/await completePendingReset\(\)[\s\S]*hydrateAuthenticated\(\)/,'reset intent must be handled before ordinary conflict/hydration logic');
  const resetFunction=(bridge.match(/async function completePendingReset\(\)\{[\s\S]*?\n  \}/)||[])[0]||'';
  assert.ok(resetFunction,'reset routine must be inspectable');
  assert.doesNotMatch(resetFunction,/\/api\/integrations\/ai\/provider|disconnectProvider/,'workspace reset must not touch saved AI provider credentials');
  assert.doesNotMatch(resetFunction,/deleteCrmCompany|\/api\/crm/,'workspace reset must not delete CRM records');
});