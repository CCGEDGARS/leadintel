import test from 'node:test';
import assert from 'node:assert/strict';
import {runCopilotTurn,buildExternalResearchQuery,shouldUseExternalResearch} from '../src/copilot-service.js';
const context={company:{name:'Seller',website:'https://seller.example'},markets:['Sweden'],crmSummary:{topCompanies:[{name:'PRIVATE-CRM'}]},profile:{private_notes:'PRIVATE-NOTE'},screen:{step:6}};
const generated=value=>({text:JSON.stringify(value),provider:'test',model:'test',usage:{input_tokens:2,output_tokens:3}});
const run=(provider,question)=>runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_PROVIDER:provider},{workspaceId:'w',question});
test('general knowledge is conversational and does not force workspace context or web search',async()=>{
 let system='';const result=await run({generate:async options=>{system=options.system;assert.doesNotMatch(options.prompt,/PRIVATE-CRM|PRIVATE-NOTE|Seller/);return generated({answer:'Anchoring affects the starting point.\n\nCompare alternatives.',research_query:''});},search:async()=>{throw Error('must not search');}},'Explain anchoring in negotiation');
 assert.match(system,/general knowledge/);assert.equal(result.research_used,false);assert.match(result.answer,/\n\n/);assert.deepEqual(result.action_proposals,[]);
});
test('semantic planning researches a Latvian company question and adaptively verifies a gap',async()=>{
 const queries=[],progress=[];let calls=0;
 const provider={generate:async options=>{calls++;if(calls===1){assert.doesNotMatch(options.prompt,/PRIVATE-CRM|PRIVATE-NOTE|Seller/);return generated({research_query:'LKAB Malmberget official sorting plant',answer:''});}if(calls===2){assert.match(options.prompt,/LKAB project/);return generated({research_query:'site:lkab.com Malmberget sorting plant opening date',answer:''});}assert.match(options.prompt,/PRIVATE-CRM/);return generated({answer:'The project is documented [1].\n\nIts timing is supported [2].',action_proposals:[{action_type:'crm.update'}],memory_candidates:[{value:'unsafe'}]});},search:async options=>{queries.push(options);return {results:[{title:queries.length===1?'LKAB project':'LKAB schedule',url:`https://lkab.com/project-${queries.length}`,description:'Official project evidence',date:'2026-10-01'}],usage:{input_tokens:4,output_tokens:5}};}};
 const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_PROVIDER:provider},{workspaceId:'w',question:'Pastāsti par LKAB rūpnīcu Malmbergetā',onProgress:x=>progress.push(x.phase)});
 assert.equal(queries.length,2);assert.ok(queries.every(x=>x.purpose==='assistant_research'));assert.equal(result.research_passes,2);assert.equal(result.sources.length,2);assert.equal(result.sources[0].date,'2026-10-01');assert.equal(result.research_status,'complete');assert.deepEqual(result.usage,{input_tokens:14,output_tokens:19});assert.deepEqual(progress,['thinking','researching','verifying','answering']);assert.deepEqual(result.action_proposals,[]);assert.deepEqual(result.memory_candidates,[]);
});
test('follow-up failure keeps first sources and exposes incomplete verification without private leakage',async()=>{
 let calls=0;const result=await run({generate:async()=>generated(++calls===1?{research_query:'Official public project schedule',answer:''}:{answer:'One source found [1]. Unsupported citation [9].'}),search:async()=>{if(calls)throw Error('sk-proj-secret1234567890');return {results:[{title:'Project',url:'https://company.example/project'}]};}},'Research a new project');
 assert.equal(result.research_status,'incomplete');assert.equal(result.research_used,true);assert.equal(result.sources.length,1);assert.match(result.answer,/incomplete|unverified/);assert.doesNotMatch(result.answer,/\[9\]|sk-proj/);
});
test('empty research results never claim that evidence was verified',async()=>{
 const result=await run({search:async()=>({results:[]}),generate:async()=>generated({answer:'Evidence is missing',research_query:''})},'Research this project');assert.equal(result.research_used,false);assert.equal(result.research_status,'incomplete');assert.match(result.answer,/unverified/);
});
test('explicit no-browse request is respected and unrelated queries exclude seller context',async()=>{
 let searches=0;const result=await run({generate:async()=>generated({answer:'A general explanation.'}),search:async()=>{searches++;}},'Explain pricing strategy without web search');assert.equal(searches,0);assert.equal(result.research_used,false);
 assert.equal(shouldUseExternalResearch({question:'Find one official LKAB source',skillIds:['market_intelligence']}),true);assert.equal(buildExternalResearchQuery({question:'Tell me about LKAB',context}),'Tell me about LKAB');assert.match(buildExternalResearchQuery({question:'Research our market',context}),/Seller|Sweden/);
});
