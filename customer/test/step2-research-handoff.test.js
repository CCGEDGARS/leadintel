const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js');
const researchUi=read('company-research-ui.js');

test('company research hands Step 2 into the live app without reload or implicit server save',()=>{
  assert.doesNotMatch(researchUi,/LeadIntelServerBridge\?\.saveNow\?\.\(/,'research must not auto-save the workspace behind the explicit Save workspace boundary');
  assert.doesNotMatch(researchUi,/location\.reload\s*\(/,'research completion must never reload and destroy an unsaved Step 2 draft');
  assert.match(researchUi,/dispatchEvent\(new CustomEvent\(['"]leadintel:company-research-complete['"]/,'research must publish an in-page completion event');
  assert.match(app,/addEventListener\(['"]leadintel:company-research-complete['"][\s\S]*state\s*=\s*loadState\(\)[\s\S]*syncInputsFromState\(\)[\s\S]*setStep\(2\)/,'the main app must reload the newly researched local state into memory before opening Step 2');
});
