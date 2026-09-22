import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../market-research-guard.js',import.meta.url),'utf8');
const evidenceView=fs.readFileSync(new URL('../evidence-view.js',import.meta.url),'utf8');

test('running research keeps only the selected mode labelled Researching',()=>{
  assert.match(guard,/"run-market-research":Object\.freeze\(\{mode:"quick",label:"Quick Overview"\}\)/);
  assert.match(guard,/"run-detailed-research":Object\.freeze\(\{mode:"deep",label:"Market Research"\}\)/);
  assert.match(guard,/"run-market-intelligence":Object\.freeze\(\{mode:"intelligence",label:"Deep Analysis"\}\)/);
  assert.match(guard,/market\.researchStatus!=="running"/);
  assert.match(guard,/const label=id===activeId\?"Researching…":BUTTON_META\[id\]\.label/);
  assert.match(guard,/button\.disabled=true/);
  assert.match(guard,/setActivated\(root,activeId\)/);
});

test('browser loads the running-state guard through the current render-loop-safe cache version',()=>{
  assert.match(evidenceView,/market-research-guard\.js\?v=20260908-render-loop-v1/);
});
