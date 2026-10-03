const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Buyers renders exactly the current Companies handoff rather than CRM Pipeline history',()=>{
 const start=ui.indexOf('function renderPipeline(){');
 const end=ui.indexOf('async function addSelectedProspectToPipeline',start);
 const block=ui.slice(start,end);
 assert.match(block,/const prospects=selected/);
 assert.match(block,/const rows=\[\]/);
 assert.doesNotMatch(block,/const rows=pipelineRows\(\)/);
});

test('Buyers copy has one clear decision-maker research task',()=>{
 assert.match(ui,/Find decision-makers/);
 assert.match(ui,/Run decision-maker research for each selected company/);
 assert.match(ui,/continuing to Messages/);
});

test('decision-maker research includes public identity and contact evidence automatically',()=>{
 const start=ui.indexOf('async function searchDecisionMakers');
 const end=ui.indexOf('function saveLocalPipeline',start);
 const block=ui.slice(start,end);
 assert.match(block,/findPublicProspectContacts\(candidate\.domain/);
 assert.match(block,/candidate\.publicContactVersion!==PUBLIC_NAME_CHECK_VERSION/);
});

test('public contacts are no longer a competing initial action',()=>{
 const start=ui.indexOf('function renderSelectedProspects');
 const end=ui.indexOf('function renderPipeline',start);
 const block=ui.slice(start,end);
 assert.match(block,/Public contact evidence/);
 assert.doesNotMatch(block,/>Find public contacts</);
});
