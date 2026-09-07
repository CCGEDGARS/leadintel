const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8'):'';
const layout=read('profile-evidence-layout.js');
const evidenceView=read('evidence-view.js');

test('profile evidence owns the full row and intelligence gaps follow it',()=>{
  assert.ok(layout,'profile-evidence-layout.js must exist');
  assert.match(layout,/profile-evidence-panel/,'evidence panel needs a dedicated full-width class');
  assert.match(layout,/profile-gaps-panel/,'gaps panel needs a dedicated follow-up class');
  assert.match(layout,/\.profile-lower-grid\{grid-template-columns:1fr!important/,'lower profile section should stack full-width panels');
  assert.match(layout,/children\[0\][\s\S]*profile-evidence-panel[\s\S]*children\[1\][\s\S]*profile-gaps-panel/,'existing evidence and gaps panels should be classified in their current order');
});

test('evidence source cards use a balanced two-column desktop grid and collapse responsively',()=>{
  assert.match(layout,/\.profile-evidence-panel \.evidence-source-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'desktop evidence cards should use two columns');
  assert.match(layout,/@media\(max-width:980px\)[\s\S]*\.profile-evidence-panel \.evidence-source-list\{grid-template-columns:1fr!important\}/,'evidence cards should collapse to one column on narrower screens');
  assert.match(layout,/-webkit-line-clamp:5/,'long excerpts should be visually bounded');
});

test('intelligence gaps become a compact two-column summary block',()=>{
  assert.match(layout,/\.profile-gaps-panel \.gap-list\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'desktop gaps should use two columns');
  assert.match(layout,/@media\(max-width:760px\)[\s\S]*\.profile-gaps-panel \.gap-list\{grid-template-columns:1fr!important\}/,'gap list should collapse on small screens');
});

test('evidence dashboard layout is loaded with a fresh browser cache version',()=>{
  assert.match(evidenceView,/profile-evidence-layout\.js\?v=20260907-evidence-dashboard-v1/);
});
