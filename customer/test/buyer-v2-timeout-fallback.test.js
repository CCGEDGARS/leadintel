const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Buyer V2 does not execute its multilingual query plan serially',()=>{
 const start=ui.indexOf('async function searchDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.match(block,/Promise\.allSettled/);
 assert.match(block,/offset\+=4/);
 assert.match(block,/plan\.queries\.slice\(0,18\)/);
 assert.doesNotMatch(block,/for\(const query of plan\.queries\)/);
});
test('zero public results continue to identity fallback instead of failing early',()=>{
 const start=ui.indexOf('async function searchDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.doesNotMatch(block,/if\(!rows\.length&&issues\.length\)throw/);
 assert.match(block,/publicPeople\.length<3/);
 assert.match(block,/searchApolloPeople/);
});
test('Buyer V2 timeout budget covers bounded multi-source research',()=>{
 assert.match(ui,/Math\.max\(DISCOVERY_REQUEST_TIMEOUT_MS\*14,350000\)/);
});
test('failed research persists V2 target and opportunity diagnostics rather than stale V1 target 20',()=>{
 const start=ui.indexOf('async function searchDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.match(block,/candidate\.buyerDiscovery=\{\.\.\.previousDiscovery,target:30/);
 assert.match(block,/Research timed out or was stopped/);
});
