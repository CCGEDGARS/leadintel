const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
test('actual extractor failure category and HTTP status survive workspace and CRM reload',()=>{
 const report=D.createBuyerResearchAccountability();D.recordBuyerResearchTool(report,{provider:'scrapling',status:'failed',results:0,failureKind:'authentication',code:'SCRAPLING_AUTH_FAILED',httpStatus:401,elapsedMs:125,timeoutMs:15000,reason:'Scrapling service authentication failed'});
 const candidate={company:'Northwind',domain:'northwind.example',buyerSearchMode:'user_selected_target',publicResearch:{accountability:report}},saved=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0],snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.publicResearch.accountability;
 const row=snapshot.tools.find(p=>p.provider==='scrapling');assert.equal(row.failed,1);assert.deepEqual(row.lastFailure,{failureKind:'authentication',code:'SCRAPLING_AUTH_FAILED',httpStatus:401,elapsedMs:125,timeoutMs:15000});
});
test('unsafe diagnostic codes are discarded and timing fields remain bounded',()=>{
 const report=D.createBuyerResearchAccountability();D.recordBuyerResearchTool(report,{provider:'scrapling',status:'failed',code:'Bearer secret-value',failureKind:'bad kind',httpStatus:9999,elapsedMs:-2,timeoutMs:Infinity});
 const failure=D.safeBuyerResearchAccountability(report).tools.find(p=>p.provider==='scrapling').lastFailure;assert.deepEqual(failure,{failureKind:'',code:'',httpStatus:null,elapsedMs:0,timeoutMs:null});
});
