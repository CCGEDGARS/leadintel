const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Companies Buyers count is driven only by explicit current selections, never CRM Pipeline membership',()=>{
 const start=ui.indexOf('function buyerSelectionRows(){');
 const end=ui.indexOf('function currentJourneyFocus()',start);
 const block=ui.slice(start,end);
 assert.match(block,/for\(const item of selectedProspects\(\)\)/);
 assert.doesNotMatch(block,/pipelineRows\(\)/);
 assert.match(block,/byDomain\.set\(domain,item\)/);
});

test('current Buyers selection remains deduplicated by canonical company domain',()=>{
 const start=ui.indexOf('function buyerSelectionRows(){');
 const end=ui.indexOf('function currentJourneyFocus()',start);
 const block=ui.slice(start,end);
 assert.match(block,/const byDomain=new Map\(\)/);
 assert.match(block,/canonicalDomain\(item\.domain\|\|item\.website\)/);
});

test('Companies counter uses explicit deduplicated selection length',()=>{
 assert.match(ui,/selection\.textContent=selected\.length/);
 assert.match(ui,/selected for Buyers/);
});
