const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const engine=fs.readFileSync(path.join(__dirname,'../discovery-engine.js'),'utf8');

test('Buyer V2 records explicit provider outcomes instead of silent zero results',()=>{
 assert.match(ui,/providerStatus=\{firecrawl/);
 assert.match(ui,/Identity-provider discovery is not connected/);
 assert.match(ui,/Identity-provider discovery failed/);
 assert.match(ui,/Research coverage/);
 assert.match(ui,/Public web \/ Firecrawl/);
 assert.match(ui,/Grounded web research/);
 assert.match(ui,/Identity directory fallback/);
});
test('Buyer V2 generated buying committee and diagnostics survive state normalization',()=>{
 assert.match(engine,/opportunityRoles:/);
 assert.match(engine,/expandedRoles:/);
 assert.match(engine,/opportunityTerms:/);
 assert.match(engine,/providerStatus:/);
 assert.match(engine,/target:clamp\(Number\(value.target\)\|\|30/);
 assert.match(ui,/candidate\.buyerDiscovery\?\.opportunityRoles/);
});
test('Buyer recommendations carry a visible relevance score and matched buying function',()=>{
 assert.match(engine,/buyerRelevanceScore:/);
 assert.match(engine,/matchedBuyerRole:/);
 assert.match(ui,/Buyer relevance/);
 assert.match(ui,/matched to/);
});
test('generic company contacts are not rendered as person buyer evidence',()=>{
 assert.match(ui,/filter\(row=>row\.personId\|\|row\.personName\)/);
});
