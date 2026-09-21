const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');

test('profile action offers missing enrichment without blocking continuation',()=>{
  const source=fs.readFileSync(path.join(root,'profile-enrichment-checkpoint-ui.js'),'utf8');
  assert.match(source,/Improve your Intelligence Profile/);
  assert.match(source,/Run Company Research/);
  assert.match(source,/Build Lookalike Audience/);
  assert.match(source,/Continue Without Enrichment/);
  assert.match(source,/addEventListener\("click",interceptProfileAction,true\)/);
  assert.match(source,/button\.click\(\)/);
});

test('checkpoint dialog is accessible and omits completed recommendations',()=>{
  const source=fs.readFileSync(path.join(root,'profile-enrichment-checkpoint-ui.js'),'utf8');
  assert.match(source,/role="dialog"/);
  assert.match(source,/aria-modal="true"/);
  assert.match(source,/pending\.includes\("company-research"\)/);
  assert.match(source,/pending\.includes\("lookalike-audience"\)/);
  assert.match(source,/event\.key==="Escape"/);
  assert.match(source,/function fallbackPending/);
});
