const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('mobile layout keeps the workflow usable at phone widths',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/\.workspace\{grid-template-columns:1fr\}/);
  assert.match(css,/\.process-track\{display:flex;overflow-x:auto/);
  assert.match(css,/\.approval-card\{display:block\}/);
});
test('language controls are removed from the shell and reserved for Campaign Studio',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const outreach=fs.readFileSync(path.join(root,'outreach-ui.js'),'utf8');
  assert.doesNotMatch(html,/id=["']language-select["']/);
  assert.doesNotMatch(html,/src=["']language\.js/);
  assert.match(outreach,/id=["']translate-outreach["']/);
  assert.match(html,/content-variants\.js\?v=20260921-contact-gated-v2/);
});
