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
  assert.match(app,/state\.market\.marketConditions=mode==="quick"\?null/);
  assert.match(css,/\.market-condition-grid/);
  assert.match(css,/@media\(max-width:760px\).*market-condition-grid/s);
});

test('research preview and execution use the same category-reserved plan',()=>{
  for(const name of ['openResearchPreview','runMarketResearch']){const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+1);assert.match(app.slice(start,end<0?undefined:end),/LeadIntelMarket\.buildResearchPlan/);}
  assert.match(app,/reserveFollowUps:true/);
  assert.match(app,/remainingQueries/);
  assert.match(app,/researchCategory/);
});
