const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('current Buyers handoff excludes stale selections from older company-search workspaces',()=>{
 const start=ui.indexOf('function buyerSelectionRows(){');
 const end=ui.indexOf('function currentJourneyFocus()',start);
 const block=ui.slice(start,end);
 assert.match(block,/const currentDomains=new Set/);
 assert.match(block,/discovery\.candidates/);
 assert.match(block,/selectedTargets\(\)/);
 assert.match(block,/!currentDomains\.has\(domain\)/);
});

test('current Buyers handoff remains canonical-domain deduplicated',()=>{
 const start=ui.indexOf('function buyerSelectionRows(){');
 const end=ui.indexOf('function currentJourneyFocus()',start);
 const block=ui.slice(start,end);
 assert.match(block,/const byDomain=new Map\(\)/);
 assert.match(block,/byDomain\.set\(domain,item\)/);
});
