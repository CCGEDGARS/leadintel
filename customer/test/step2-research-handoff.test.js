const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const persistence=read('workspace-persistence.js');
const researchUi=read('company-research-ui.js');
const profileHandoff=read('company-profile-handoff.js');
const shell=read('index.html');
const processMap=read('process-map.js');
const supportLoader=read('shell-support-loader.js');

test('internal Step 2 and Step 3 reloads preserve the current local draft instead of restoring or clearing older state',()=>{
  assert.match(researchUi,/next\.step=2;writeState\(next\)/,'company research writes the Step 2 draft before its internal reload');
  assert.match(profileHandoff,/state\.step=\[3,4\][\s\S]*writeState\(state\)/,'profile handoff writes the researched profile before its internal reload');
  assert.match(persistence,/function\s+prepareForLoad\s*\(\)\{\s*if\(!isExplicitlySaved\(\)\)return false;\s*if\(hasMeaningfulWorkspaceData\(\)\)return false;\s*return restoreSavedSnapshot\(\);\s*\}/,'ordinary reload must preserve meaningful local draft data; a saved snapshot is only a recovery fallback when current workspace data is missing');
  const prepare=persistence.match(/function\s+prepareForLoad\s*\(\)\{[\s\S]*?\n\s*\}/)?.[0]||'';
  assert.doesNotMatch(prepare,/clearWorkspaceData\(/,'startup must never erase a current draft merely because Save workspace was not pressed');
});

test('Step 2 repairs a split research handoff before rendering empty fields',()=>{
  assert.match(researchUi,/recoverDraftAnswers\?\.\(state\.answers\|\|\{\},meta\.fields\|\|\{\}\)/);
  assert.match(researchUi,/state\.answers=recovered;writeState\(state\)/);
});

test('the repaired research handoff is cache-busted at every browser entry point',()=>{
  assert.match(supportLoader,/company-research-ui\.js\?v=20260924-evidence-synthesis-retry-v1/);
  assert.match(shell,/shell-support-loader\.js\?v=20260925-firecrawl-health-warning-v1/);
  assert.match(researchUi,/company-research-engine\.js\?v=20260918-translation-fidelity-v3/);
  assert.match(processMap,/step2-readiness-engine\.js\?v=20260924-friendly-workflow-labels-v1/);
});
