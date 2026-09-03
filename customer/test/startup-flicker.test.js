const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const persistence=fs.readFileSync(path.join(root,'workspace-persistence.js'),'utf8');

test('blank app bootstrap state is cleared without reload while real stale or saved state can still reconcile once',()=>{
  assert.match(persistence,/function\s+hasMeaningfulWorkspaceData\s*\(/,'persistence guard must distinguish blank app bootstrap state from real workspace data');
  assert.match(persistence,/const explicitlySaved=isExplicitlySaved\(\);/);
  assert.match(persistence,/const hadMeaningfulUnsavedData=!explicitlySaved&&hasMeaningfulWorkspaceData\(\);/);
  assert.match(persistence,/const changed=prepareForLoad\(\);/);
  assert.match(persistence,/if\(changed&&\(explicitlySaved\|\|hadMeaningfulUnsavedData\)&&root\.location\?\.reload\)/,'reload must be reserved for saved-state reconciliation or real stale unsaved data');
  assert.doesNotMatch(persistence,/if\(changed&&root\.location\?\.reload\)/,'blank default state must never trigger the old unconditional reload loop');
});
