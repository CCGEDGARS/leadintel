const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const evidence=fs.readFileSync(path.join(root,'evidence-sources.css'),'utf8');

test('profile evidence owns the full row and intelligence gaps follow it',()=>{
  assert.match(html,/profile-evidence-panel/,'evidence panel needs a dedicated full-width class');
  assert.match(html,/profile-gaps-panel/,'gaps panel needs a dedicated follow-up class');
  assert.ok(html.indexOf('profile-evidence-panel')<html.indexOf('profile-gaps-panel'),'evidence must appear before gaps');
  assert.match(styles,/\.profile-lower-grid\{display:grid;grid-template-columns:1fr/,'lower profile section should stack full-width panels');
});

test('evidence source cards use a balanced two-column desktop grid and collapse responsively',()=>{
  assert.match(evidence,/\.evidence-source-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'desktop evidence cards should use two columns');
  assert.match(evidence,/@media\(max-width:980px\)[\s\S]*\.evidence-source-list\{grid-template-columns:1fr\}/,'evidence cards should collapse to one column on narrower screens');
  assert.match(evidence,/line-clamp:5/,'long excerpts should be visually bounded');
});

test('intelligence gaps become a compact two-column summary block',()=>{
  assert.match(styles,/\.profile-gaps-panel \.gap-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'desktop gaps should use two columns');
  assert.match(styles,/@media\(max-width:760px\)[\s\S]*\.profile-gaps-panel \.gap-list\{grid-template-columns:1fr\}/,'gap list should collapse on small screens');
});
