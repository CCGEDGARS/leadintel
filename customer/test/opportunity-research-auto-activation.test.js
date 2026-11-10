const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../opportunity-led-icp.js').install(require('../market-engine.js'));
const profile={targetMarkets:'Denmark',priorityOffers:'Industrial engineering',idealCustomer:'Manufacturers'};
function completed(extra={}){return {icps:Market.buildIcpCandidates(profile),researchStatus:'complete',researchContextStale:false,researchQuality:{passed:true},researchExecution:{version:1,runId:'run-one',status:'complete',completedAt:1000},researchHistory:[{id:'run-one',sourceCount:2}],opportunities:[{id:'opp-denmark',active:true,profileOnly:false,market:'Denmark',evidence:[{url:'https://factory.example/news'}]}],...extra};}
const opportunity=market=>market.icps.find(x=>x.type==='opportunity-led');
test('completed evidence-backed research automatically enables the Opportunity-led profile',()=>{
 const market=completed();assert.equal(opportunity(market).active,false);
 assert.equal(Market.autoActivateOpportunityAfterResearch(market),true);
 assert.equal(opportunity(market).active,true);assert.equal(opportunity(market).requestedActive,true);assert.equal(opportunity(market).value,'');
 const reopened=Market.normalizeMarketState(JSON.parse(JSON.stringify(market)));
 assert.equal(opportunity(reopened).active,true);assert.equal(reopened.opportunityAutoActivationRunId,'run-one');
});
test('a finished partial run with usable evidence can activate without concealing its source warnings',()=>{
 const market=completed({researchStatus:'partial',researchExecution:{version:1,runId:'run-one',status:'partial',completedAt:1000}});
 assert.equal(Market.autoActivateOpportunityAfterResearch(market),true);assert.equal(market.researchStatus,'partial');
});
for(const [label,extra] of Object.entries({running:{researchStatus:'running'},cancelled:{researchExecution:{version:1,runId:'run-one',status:'cancelled',completedAt:1000}},failed:{researchStatus:'error'},stale:{researchContextStale:true},qualityFailure:{researchQuality:{passed:false}},noNewResults:{researchHistory:[{id:'run-one',sourceCount:0}]},profileOnly:{opportunities:[{active:true,profileOnly:true,evidence:[]}]},deselected:{opportunities:[{active:false,profileOnly:false,evidence:[{url:'https://factory.example/news'}]}]}}))test(`${label} research cannot auto-enable the profile`,()=>{
 const market=completed(extra);assert.equal(Market.autoActivateOpportunityAfterResearch(market),false);assert.equal(opportunity(market).active,false);
});
test('a manual Off after completion survives reload and replay; a new successful research run enables it again',()=>{
 const market=completed();Market.autoActivateOpportunityAfterResearch(market);Object.assign(opportunity(market),{active:false,requestedActive:false});
 const reopened=Market.normalizeMarketState(JSON.parse(JSON.stringify(market)));
 assert.equal(Market.autoActivateOpportunityAfterResearch(reopened),false);assert.equal(opportunity(reopened).active,false);
 reopened.researchExecution={runId:'run-two',status:'complete',completedAt:2000};reopened.researchHistory.push({id:'run-two',sourceCount:1});
 assert.equal(Market.autoActivateOpportunityAfterResearch(reopened),true);assert.equal(opportunity(reopened).active,true);
});
test('activation preserves customer edits and works across industries and seller names',()=>{
 for(const seller of ['Industrial seller','Legal seller']){
  const market=completed(),icp=opportunity(market);Object.assign(icp,{name:seller,description:'My definition',offers:'My offer',exclusions:'My exclusions'});
  Market.autoActivateOpportunityAfterResearch(market);assert.equal(icp.name,seller);assert.equal(icp.description,'My definition');assert.equal(icp.offers,'My offer');assert.equal(icp.exclusions,'My exclusions');
 }
});

const vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const finish=app.slice(app.indexOf('function finishMarketResearchRun('),app.indexOf('\nfunction recordMarketResearchReceipt',app.indexOf('function finishMarketResearchRun(')));
function finishRuntime({current=true,cancelled=false,newerRun=false}={}){
 const run={id:'run-one',controller:{signal:{aborted:cancelled}}},market=completed();let saves=0,renders=0;
 const c={state:{market},activeMarketResearchRun:newerRun?{}:run,marketResearchScopeCurrent:r=>current&&c.activeMarketResearchRun===r,clearTimeout(){},clearInterval(){},LeadIntelMarket:Market,researchContextFingerprint:()=>opportunity(market).active?'after-automatic-selection':'before-automatic-selection',saveState(){assert.equal(c.activeMarketResearchRun,null,'the completed run must release its guard before changing selection');saves++;},renderMarketStrategy(){renders++;}};
 vm.runInNewContext(finish,c);c.finishMarketResearchRun(run);return {c,market,saves,renders};
}
test('the current completed run saves automatic activation after releasing its context guard',()=>{
 const r=finishRuntime();assert.equal(opportunity(r.market).active,true);assert.equal(r.saves,1);assert.equal(r.renders,1);assert.equal(r.market.researchContextFingerprint,'after-automatic-selection');
});
for(const options of [{current:false},{cancelled:true},{newerRun:true}])test(`obsolete/cancelled completion cannot activate or save: ${JSON.stringify(options)}`,()=>{
 const r=finishRuntime(options);assert.equal(opportunity(r.market).active,false);assert.equal(r.saves,0);assert.equal(r.renders,0);if(options.newerRun)assert.notEqual(r.c.activeMarketResearchRun,null);
});

test('the core state schema retains the completed-run marker before the optional UI extension loads',()=>{
 const bare={LeadIntelEvidencePolicy:require('../evidence-policy.js'),LeadIntelMonitoringModel:require('../monitoring-model.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../market-engine.js'),'utf8'),bare);
 assert.equal(bare.LeadIntelMarket.normalizeMarketState({opportunityAutoActivationRunId:'run-one'}).opportunityAutoActivationRunId,'run-one');
});
