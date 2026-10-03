const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('research review uses compact neutral qualification copy',()=>{
  assert.match(ui,/research-checks-compact/);
  assert.match(ui,/Research review/);
  assert.match(ui,/Needs more evidence/);
  assert.match(ui,/verified hard criterion failed/);
  assert.doesNotMatch(ui,/Research checks · \$\{rows\.length\} companies did not qualify/);
});

test('research review exposes per-company qualification reasons as tags',()=>{
  assert.match(ui,/research-check-row/);
  assert.match(ui,/research-check-tags/);
  assert.match(ui,/Not qualified/);
});

test('research review is visually compact rather than warning-box styled',()=>{
  assert.match(css,/\.research-checks-compact/);
  assert.match(css,/\.research-checks-count/);
  assert.match(css,/\.research-check-row/);
  assert.match(css,/#discovery-potential-matches\.potential-matches/);
});
