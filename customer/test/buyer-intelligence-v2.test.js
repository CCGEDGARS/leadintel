const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engine=fs.readFileSync(path.join(__dirname,'../discovery-engine.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const workflow=fs.readFileSync(path.join(__dirname,'../approved-workflow-ui.js'),'utf8');

test('Buyer Intelligence V2 derives opportunity-specific and Swedish buyer roles',()=>{
 assert.match(engine,/function opportunityBuyerRoles/);
 assert.match(engine,/CAPEX Manager/);
 assert.match(engine,/Strategic Sourcing Manager/);
 assert.match(engine,/Inköpschef/);
 assert.match(engine,/Projektchef/);
 assert.match(engine,/Underhållschef/);
});

test('Buyer Intelligence V2 searches opportunity context beyond exact LinkedIn titles',()=>{
 assert.match(engine,/buyerOpportunityTerms/);
 assert.match(engine,/Malmberget/);
 assert.match(engine,/processing plant/);
 assert.match(engine,/official company\/project pages/);
 assert.match(engine,/local-language title variants/);
});

test('manual Buyer Intelligence uses identity provider fallback without provider-branded confirmation buttons',()=>{
 assert.match(ui,/searchApolloPeople/);
 assert.doesNotMatch(ui,/publicPeople\.length<3/);
 assert.match(ui,/Confirm email/);
 assert.match(ui,/Confirm phone/);
 assert.doesNotMatch(ui,/>Confirm email with Apollo</);
 assert.doesNotMatch(ui,/>Confirm phone with Apollo</);
});

test('automatic workflow requires explicit provider-neutral contact confirmation consent',()=>{
 assert.match(workflow,/name="confirmContacts"/);
 assert.match(workflow,/I approve automatic email and phone confirmation when needed/);
 assert.doesNotMatch(workflow,/Find and enrich buyers with Apollo/);
});
