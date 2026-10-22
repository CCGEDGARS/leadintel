const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');

// Live 2026-10-22: after a hydration (applyPayload + reload) the next GET compared local storage with
// the snapshot the GET boundary had derived from the server payload. Local-only keys
// (research_meta_v1, website_activation_v1) differed, protectLocalChanges re-marked the workspace dirty
// and the unchanged workspace was saved back: one extra full save per update from another device.
// reconcileServerState already records the applied state with localData; hydration must do the same.
function hydrationBranch(){
  const start=source.indexOf('if(state.version>0&&sessionStorage.getItem(HYDRATION_KEY)!==marker){');
  assert.ok(start>0,'hydration apply branch');
  return source.slice(start,source.indexOf('return false;}',start)+'return false;}'.length);
}

test('hydration records the applied server state as the local baseline before reloading',()=>{
  const branch=hydrationBranch();
  const apply=branch.indexOf('applyPayload(state.payload)'),snapshot=branch.indexOf('snapshotFromServerPayload'),reload=branch.indexOf('location.reload()');
  assert.ok(apply>=0&&snapshot>apply&&reload>snapshot,'apply, then snapshot, then reload');
  assert.match(branch,/await root\.LeadIntelWorkspacePersistence\?\.snapshotFromServerPayload\?\.\(state\.payload,\{workspaceId:bridge\.workspace\.id,version:Number\(state\.version\),localData:root\.LeadIntelWorkspacePersistence\.currentWorkspaceData\(\),dirty:false\}\)/);
});

test('a failed baseline write never blocks hydration',()=>{
  assert.match(hydrationBranch(),/try\{await root\.LeadIntelWorkspacePersistence\?\.snapshotFromServerPayload[^]*?\}catch\{\}/);
});
