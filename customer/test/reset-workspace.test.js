const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const hygienePath=path.join(root,'workspace-reset-hygiene.js');
const hygiene=fs.existsSync(hygienePath)?fs.readFileSync(hygienePath,'utf8'):'';
const persistence=fs.readFileSync(path.join(root,'workspace-persistence.js'),'utf8');

test('workspace reset does not use a native browser confirmation dialog',()=>{
  assert.doesNotMatch(app,/window\.confirm\s*\(/);
});

test('workspace reset keeps a clear 30-second inline confirmation state on the existing button',()=>{
  assert.match(app,/RESET_CONFIRM_WINDOW_MS\s*=\s*30000/);
  assert.match(app,/dataset\.resetArmed\s*=\s*["']true["']/);
  assert.match(app,/classList\.add\(["']reset-armed["']\)/);
  assert.match(app,/Click again to reset/);
  assert.match(app,/within 30 seconds/);
  assert.match(app,/setTimeout\([^\n]*RESET_CONFIRM_WINDOW_MS\)/);
  assert.match(app,/style\.setProperty\(["']color["'],["']var\(--danger\)["']\)/);
});

test('confirmed workspace reset always restores the Stage 1 landing view after reset listeners finish',()=>{
  assert.match(app,/function restoreResetLanding/);
  assert.match(app,/setStep\(1\)/);
  assert.match(app,/setTimeout\(restoreResetLanding,0\)/);
  assert.match(app,/leadintel:workspace-reset/);
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

test('signed-in reset explicitly authorizes saving the blank workspace',()=>{
  const resetBlock=app.match(/async function resetWorkspace\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(resetBlock,/bridge\.saveNow\(\{saveIntent:true,explicitSave:true\}\)/);
  assert.match(resetBlock,/Reset failed to sync/);
});

test('confirmed workspace reset records durable reset intent for the next authenticated sync',()=>{
  assert.match(persistence,/leadintel_customer_v2_reset_pending_v1/,'server reset must have a durable pending-reset marker');
  assert.match(persistence,/function recordResetIntent/);
  assert.match(persistence,/workspace_id/,'reset intent must retain workspace provenance when known');
  assert.match(persistence,/localStorage\?\.setItem\(RESET_PENDING_KEY/,'reset intent must survive reload and sign-in');
  assert.match(persistence,/handleResetClick[\s\S]*recordResetIntent\(\)/,'the server reset marker must be written only on the confirmed reset click');
  assert.match(hygiene,/leadintel_customer_v2_brand_asset_reset_cleanup_v1/,'asset cleanup must retain its own durable reset record');
});

test('confirmed workspace reset clears the background task registry',()=>{
  let clearCount=0;
  const values=new Map([['leadintel_customer_v2_legacy_local_cleanup_20260901_v2','done']]);
  const sandbox={
    URLSearchParams,console,
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
    sessionStorage:{removeItem(){}},
    location:{search:'',reload(){},replace(){}},
    document:{addEventListener(){}},
    LeadIntelTaskCentre:{clearAll(){clearCount++;}},
    setTimeout(callback){callback();},
    addEventListener(){},dispatchEvent(){},CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(hygiene,sandbox,{filename:'workspace-reset-hygiene.js'});
  const button={dataset:{resetArmed:'true'}};

  sandbox.LeadIntelWorkspaceResetHygiene.handleResetClick({target:{closest:selector=>selector==='#reset-workspace'?button:null}});

  assert.equal(clearCount,1);
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
