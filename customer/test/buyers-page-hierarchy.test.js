const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Buyers page has one primary page heading and one operational guide',()=>{
 assert.match(ui,/Find the right decision-makers\./);
 assert.match(ui,/id="discovery-buyers-title">Find decision-makers</);
 assert.doesNotMatch(ui,/Find the buyers behind each company\./);
 assert.doesNotMatch(ui,/Find the people who own the decision\./);
 assert.doesNotMatch(ui,/Find decision-makers at saved companies/);
});

test('pipeline wrapper no longer repeats a second Buyers section heading',()=>{
 const mount=ui.slice(ui.indexOf('buyers-focus-guide'),ui.indexOf('restoreDiscoveryTarget'));
 assert.match(mount,/pipeline-panel" hidden><div class="customer-pipeline"/);
 assert.doesNotMatch(mount,/pipeline-stage-title/);
});

test('before research the company card is the only lower-level decision-maker action',()=>{
 const start=ui.indexOf('function renderSelectedProspects');
 const end=ui.indexOf('function renderPipeline',start);
 const block=ui.slice(start,end);
 assert.match(block,/Find decision-makers →/);
 assert.doesNotMatch(block,/Buyer intelligence<\/span><h3>Find decision-makers/);
});
