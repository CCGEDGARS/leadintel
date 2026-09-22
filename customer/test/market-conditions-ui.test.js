import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../market.css',import.meta.url),'utf8');

test('Market Research and Deep Analysis render a compact six-topic evidence pack',()=>{
  assert.match(index,/market-conditions-engine\.js/);
  assert.match(index,/id="market-conditions"/);
  assert.match(app,/function renderMarketConditions\(\)/);
  for(const topic of ['Market direction','Competition','Funding','Pricing','Demand and buying points','Practical advice'])assert.match(app,new RegExp(topic));
  assert.match(app,/state\.market\.researchMode==="quick"\?null/);
  assert.match(css,/\.market-condition-grid/);
  assert.match(css,/@media\(max-width:760px\).*market-condition-grid/s);
});

test('research preview and execution use the same category-reserved plan',()=>{
  const calls=app.match(/LeadIntelMarket\.buildResearchPlan/g)||[];
  assert.equal(calls.length,2);
  assert.match(app,/researchCategory/);
});
