const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evidence=require('../evidence-view.js');

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

test('evidence detail groups stay collapsed by default so Step 3 remains compact',()=>{
  const html=Evidence.renderEvidence({
    evidenceSources:[{id:'W1',title:'Company site',url:'https://example.com',excerpt:'Official source'}],
    externalValidationSources:[{id:'X1',title:'External source',url:'https://external.example',excerpt:'External'}],
    canonical:{contradictions:[]},
    evidenceCoverage:{level:'supported',label:'Supported coverage',message:'Supported'}
  });
  assert.match(html,/<details class="evidence-group">/);
  assert.doesNotMatch(html,/<details class="evidence-group" open>/);
});

test('new intelligence profile CSS owns a compact single-column evidence area',()=>{
  const css=read('intelligence-profile.css');
  assert.match(css,/\.intel-evidence-panel \.evidence-source-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.profile-lower-grid\.intel-lower-compact\{grid-template-columns:1fr/);
  assert.match(css,/@media\(max-width:800px\)[\s\S]*\.intel-evidence-panel \.evidence-source-list\{grid-template-columns:1fr\}/);
});

test('legacy evidence dashboard layout is no longer a runtime dependency',()=>{
  assert.doesNotMatch(evidenceView,/profile-evidence-layout\.js/);
  assert.match(evidenceView,/intelligence-profile-runtime\.js\?v=20260923-reference-interface-v1/);
});
