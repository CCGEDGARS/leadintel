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
test('the selected content language control is available in the main shell',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id=["']language-select["']/);
  assert.match(html,/value=["']lv["']/);
  assert.match(html,/content-variants\.js\?v=20260905-step1-language-v1/);
});
