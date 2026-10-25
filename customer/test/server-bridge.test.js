const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=fs.readFileSync(path.join(__dirname,'..','server-bridge.js'),'utf8');

test('server bridge knows all Customer V2 storage namespaces and API base',()=>{
  for(const key of ['leadintel_customer_v2_state','leadintel_customer_v2_discovery','leadintel_customer_v2_outreach','leadintel_customer_v2_delivery','leadintel_customer_v2_discovery_meta'])assert.match(bridge,new RegExp(key));
  assert.match(bridge,/https:\/\/leadintel-api\.edgars-7e7\.workers\.dev/);
});

test('startup requests /api/workspaces beside /api/session and applies it only once the session is authenticated',()=>{
  const init=bridge.slice(bridge.indexOf('async function init()'),bridge.indexOf('function runWorkspaceSave'));
  const prefetchAt=init.indexOf('const workspacesEarly=prefetchWorkspaces();'),sessionAt=init.indexOf('await fetchSession();');
  assert.ok(prefetchAt>=0&&sessionAt>prefetchAt,'the workspaces request starts before the session answer arrives');
  assert.ok(init.indexOf('bridge.workspaces=early.workspaces')>init.indexOf("if(!bridge.session?.authenticated){"),'workspaces are applied only on the authenticated path');
  assert.doesNotMatch(init,/await fetchWorkspaces\(\)/);
  assert.match(bridge,/function prefetchWorkspaces\(\)\{return bootstrapRead\('\/api\/workspaces',validWorkspaces\)\.then\(\(\{payload\}\)=>\(\{workspaces:payload\.workspaces\}\),error=>\(\{error\}\)\);\}/);
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

test('server bridge routes buyer search through workspace-authenticated Apollo integration',()=>{
  assert.match(bridge,/searchApolloPeople/);
  assert.match(bridge,/\/api\/integrations\/services\/apollo\/people-search/);
  assert.match(bridge,/searchApolloPeople\(payload,options=\{\}\)/);
});

test('customer entry point cache-busts the changed buyer-search scripts',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/server-bridge\.js\?v=20260925-apollo-buyer-search-v1/);
  assert.match(html,/discovery-ui\.js\?v=20260930-contact-suppression-v1/);
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
test('server bridge applies a hard deadline to every backend request',()=>{
  assert.match(bridge,/const API_REQUEST_TIMEOUT_MS=15000/);
  assert.match(bridge,/controller\.abort\(new DOMException\('LeadIntel request timed out','TimeoutError'\)\)/);
  assert.match(bridge,/signal:controller\.signal/);
  assert.match(bridge,/LeadIntel server request timed out/);
  assert.match(bridge,/clearTimeout\(timeout\)/);
});

test('a failed startup read names what failed: HTTP status and path, or the error name and path when no answer came (2026-10-26)',async()=>{
  // Source contract (release smoke keeps the retry loop) …
  assert.match(bridge,/async function bootstrapRead\(path,valid,\{allowUnauthorized=false\}=\{\}\)\{\n\s*const requestPath=String\(path\)\.split\('\?'\)\[0\];/);
  assert.match(bridge,/code:'startup_http_'\+response\.status,requestPath,phase:'request',status:response\.status/);
  assert.match(bridge,/throw startupFailure\(cause,requestPath\)/);
  assert.match(bridge,/function startupFailure\(cause,requestPath\)/);
  // … and the behaviour, with the function lifted out of the bridge and a stubbed api().
  const src=bridge.slice(bridge.indexOf('async function bootstrapRead('),bridge.indexOf('async function fetchSession()'));
  const make=api=>new Function('api','root',src+'\nreturn bootstrapRead;')(api,{});
  await assert.rejects(make(async()=>({response:{ok:false,status:429},payload:{}}))('/api/workspaces?x=1',()=>true),error=>error.code==='startup_http_429'&&error.requestPath==='/api/workspaces'&&error.phase==='request'&&error.status===429&&/HTTP 429 on \/api\/workspaces/.test(error.message));
  await assert.rejects(make(async()=>({response:{ok:false,status:409},payload:{}}))('/api/customer/state?workspace_id=w1',()=>true),error=>error.code==='startup_http_409'&&error.requestPath==='/api/customer/state');
  let calls=0;const offline=make(async()=>{calls++;throw new TypeError('Failed to fetch');});
  await assert.rejects(offline('/api/session',()=>true),error=>error.code==='startup_typeerror'&&error.requestPath==='/api/session'&&error.phase==='request');
  assert.equal(calls,3,'a network failure is retried three times before it is reported');
  await assert.rejects(make(async()=>{throw Object.assign(new Error('timed out'),{code:'request_timeout',requestPath:'/api/session',phase:'request'});})('/api/session',()=>true),error=>error.code==='request_timeout','an error that already carries a code keeps it');
  const ok=await make(async()=>({response:{ok:true,status:200},payload:{workspaces:[]}}))('/api/workspaces',()=>true);
  assert.equal(ok.response.status,200);
});
