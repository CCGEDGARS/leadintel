import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../market-research-guard.js',import.meta.url),'utf8');

test('running research keeps only the selected mode labelled Researching',()=>{
  assert.match(guard,/"run-market-research":Object\.freeze\(\{mode:"quick",label:"Market Scan"\}\)/);
  assert.match(guard,/"run-detailed-research":Object\.freeze\(\{mode:"deep",label:"Market Research"\}\)/);
  assert.match(guard,/"run-market-intelligence":Object\.freeze\(\{mode:"intelligence",label:"Market Intelligence"\}\)/);
  assert.match(guard,/market\.researchStatus!=="running"/);
  assert.match(guard,/const label=id===activeId\?"Researching…":BUTTON_META\[id\]\.label/);
  assert.match(guard,/button\.disabled=true/);
  assert.match(guard,/setActivated\(root,activeId\)/);
});
