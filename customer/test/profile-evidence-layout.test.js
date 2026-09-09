const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8'):'';
const layout=read('profile-evidence-layout.js');
const evidenceView=read('evidence-view.js');

test('legacy profile evidence layout remains available only as migration reference',()=>{
  assert.ok(layout,'profile-evidence-layout.js remains available during migration');
  assert.match(layout,/profile-evidence-panel/);
});

test('canonical evidence view separates first-party evidence from external validation',()=>{
  assert.match(evidenceView,/First-party/);
  assert.match(evidenceView,/External validation/);
  assert.match(evidenceView,/never overwrite first-party truth/i);
});

test('new intelligence profile CSS owns the evidence card responsive layout',()=>{
  const css=read('intelligence-profile.css');
  assert.match(css,/\.intel-evidence-panel \.evidence-source-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:800px\)[\s\S]*\.intel-evidence-panel \.evidence-source-list\{grid-template-columns:1fr\}/);
});

test('legacy evidence dashboard layout is no longer a runtime dependency',()=>{
  assert.doesNotMatch(evidenceView,/profile-evidence-layout\.js/);
  assert.match(evidenceView,/intelligence-profile-runtime\.js\?v=20260909-canonical-profile-v1/);
});
