const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('Market Strategy exposes Quick Research and Deep Research as separate actions',()=>{
  assert.match(html,/id="run-market-research-quick"/);
  assert.match(html,/Quick Research/);
  assert.match(html,/id="run-market-research-deep"/);
  assert.match(html,/Deep Research/);
  assert.match(app,/function runQuickMarketResearch|async function runQuickMarketResearch/);
  assert.match(app,/function runDeepMarketResearch|async function runDeepMarketResearch/);
});

test('idle opportunity copy says research has not run yet',()=>{
  assert.match(app,/Profile hypothesis[^\n]{0,100}research not run yet/i);
});
