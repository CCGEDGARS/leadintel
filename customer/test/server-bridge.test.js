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
