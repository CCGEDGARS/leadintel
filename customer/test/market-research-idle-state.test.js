const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('market research mode controls are equal and idle until explicitly activated',()=>{
  const guard=read('market-research-guard.js');
  const evidence=read('evidence-view.js');

  assert.match(guard,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(guard,/height:96px!important/);
  assert.match(guard,/research-mode-idle/);
  assert.match(guard,/research-mode-selected/);
  assert.match(guard,/research-run-preview/);
  assert.match(guard,/preview\.hidden=true/);
  assert.match(guard,/Company profile context/);
  assert.match(evidence,/market-research-guard\.js/);
});
