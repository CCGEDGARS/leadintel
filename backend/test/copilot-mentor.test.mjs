import test from 'node:test';
import assert from 'node:assert/strict';
import {runCopilotTurn,shouldUseExternalResearch} from '../src/copilot-service.js';
import {routeCopilotSkills,skillInstructions} from '../src/copilot-skills.js';
const generated=value=>({text:JSON.stringify(value),provider:'test',model:'test'});
const context={workspace:{id:'w1'},screen:{step:6,label:'Messages'},company:{name:'Example Seller',website:'https://seller.example'},goals:{successOutcome:'Twelve qualified meetings'},profile:{description:'Manufacturing services'},markets:['Sweden'],icps:[],signals:[],research:{count:0}};
const run=(provider,question,ctx=context)=>runCopilotTurn({COPILOT_TEST_CONTEXT:ctx,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider},{workspaceId:'w1',question,currentScreen:ctx.screen});

test('market forecasts and statistical comparisons select business specialists instead of billing help',()=>{
 const forecast=routeCopilotSkills('Forecast demand in our market next year');assert.ok(forecast.includes('business_scenarios'));assert.ok(!forecast.includes('cost_planning'));
 const comparison=routeCopilotSkills('Compare market statistics and growth rates');assert.ok(comparison.includes('statistics_comparison'));assert.ok(comparison.includes('market_intelligence'));
 assert.equal(shouldUseExternalResearch({question:'Compare market statistics and growth rates',skillIds:comparison}),true);
 assert.ok(routeCopilotSkills('Forecast our API credit costs').includes('cost_planning'));
 assert.match(skillInstructions(forecast),/scenario|assumption/i);assert.match(skillInstructions(comparison),/period|denominator/i);
});
test('personal business mentoring uses saved goals and profile rather than the context-free planning shortcut',async()=>{
 let prompt;const result=await run({generate:async options=>{prompt=JSON.parse(options.prompt);return generated({answer:'Start with the twelve-meeting objective.'});},search:async()=>{throw Error('No search required');}},'How should we grow our business?');
 assert.equal(prompt.workspace_context.goals.successOutcome,'Twelve qualified meetings');assert.equal(result.research_used,false);assert.deepEqual(result.action_proposals,[]);
});
test('first-person singular and non-English mentoring receive saved context too',async()=>{
 for(const question of ['How can I grow the business?','Help me choose a business strategy.','Kā man attīstīt savu uzņēmumu?','Как мне развивать бизнес?','Explain how to grow this business.','What is the right strategy for this business?']){
  let prompt;await run({generate:async options=>{prompt=JSON.parse(options.prompt);return generated({answer:'A tailored recommendation.',research_query:''});},search:async()=>({results:[]})},question);
  assert.ok(prompt.workspace_context,question);assert.equal(prompt.workspace_context.goals.successOutcome,'Twelve qualified meetings',question);
 }
});
test('tailored mentoring follows each seller context across unrelated industries and company names',async()=>{
 for(const [name,description,goal] of [['Orchid Care','Dental practice','Eight new consultations'],['Northwind Systems','Industrial automation','Three factory pilots'],['Renamed Seller','Industrial automation','Three factory pilots']]){
  const seller={...context,company:{name,website:'https://seller.example'},profile:{description},goals:{successOutcome:goal}};let payload;
  await run({generate:async options=>{payload=JSON.parse(options.prompt);return generated({answer:'A tailored next step.'});},search:async()=>{throw Error('No search required');}},'How should we grow our business?',seller);
  assert.equal(payload.workspace_context.company.name,name);assert.equal(payload.workspace_context.profile.description,description);assert.equal(payload.workspace_context.goals.successOutcome,goal);
  assert.doesNotMatch(JSON.stringify(payload),/Example Seller|Twelve qualified meetings/);
 }
});
test('requests to change operational data are declined before tools or model execution',async()=>{
 let calls=0;const provider={generate:async()=>{calls++;return generated({answer:'Changed'});},search:async()=>{calls++;return {results:[]};}};
 const result=await run(provider,'Update my CRM records and enable automatic follow-ups');assert.equal(calls,0);assert.match(result.answer,/advice|draft|recommend/i);assert.match(result.answer,/cannot|never/i);assert.deepEqual(result.action_proposals,[]);
});
test('a supplied public website is actually read and its evidence and execution receipt reach the answer',async()=>{
 const reads=[];let prompt;const result=await run({read:async url=>{reads.push(url);return {url,title:'Official company page',description:'Alex Example is the purchasing director. Business contact is published here.',evidenceKind:'page_extract',accessed_at:'2026-10-27T10:00:00Z'};},search:async()=>({results:[]}),generate:async options=>{prompt=JSON.parse(options.prompt);return generated({answer:'The company lists Alex Example as purchasing director [1].',research_query:''});}},'Analyse this website and find the decision-makers: https://company.example/team');
 assert.deepEqual(reads,['https://company.example/team']);assert.match(JSON.stringify(prompt),/Alex Example/);assert.equal(result.sources[0].evidenceKind,'page_extract');assert.ok(result.research_tools.some(t=>t.operation==='read_public_page'&&t.status==='succeeded'));assert.equal(result.research_used,true);assert.deepEqual(result.action_proposals,[]);
});
test('blocked direct-page reads remain explicit and do not fabricate extraction evidence',async()=>{
 const result=await run({read:async()=>{throw Error('Blocked');},search:async()=>({results:[]}),generate:async()=>generated({answer:'Direct evidence is unavailable.',research_query:''})},'Read https://company.example/team');
 assert.equal(result.research_used,false);assert.equal(result.research_status,'incomplete');assert.ok(result.research_tools.some(t=>t.operation==='read_public_page'&&t.status==='failed'));assert.match(result.answer,/unverified|unavailable/i);
});
test('explicit no-browse requests perform no page reads or searches',async()=>{
 let reads=0,searches=0;const result=await run({read:async()=>{reads++;},search:async()=>{searches++;},generate:async()=>generated({answer:'Here is a framework using the supplied facts only.'})},'Without web search, suggest questions about https://company.example');assert.equal(reads,0);assert.equal(searches,0);assert.equal(result.research_used,false);
});
test('an ungrounded provider result never becomes a successful search receipt or invented evidence',async()=>{
 const result=await run({read:async url=>({url,title:'Page',description:'Actual page evidence',evidenceKind:'page_extract'}),search:async()=>({provider:'gemini',model:'grounded-model',web_search:false,results:[{url:'https://invented.example/',title:'Not grounded'}],routing:{role:'research_specialist',reason:'primary_unavailable'},warning:'No grounding evidence returned'}),generate:async()=>generated({answer:'Only the page was read [1].',research_query:''})},'Read https://company.example/team and compare market statistics');
 const receipt=result.research_tools.find(t=>t.operation==='web_search');assert.equal(receipt.status,'not_executed');assert.equal(receipt.web_search,false);assert.equal(receipt.provider,'gemini');assert.equal(receipt.model,'grounded-model');assert.equal(receipt.routing.reason,'primary_unavailable');assert.match(receipt.warning,/grounding/);assert.equal(result.research_status,'incomplete');assert.ok(!result.sources.some(s=>s.url==='https://invented.example/'));
});
