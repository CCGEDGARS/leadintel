import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldUseExternalResearch,externalResearchPurpose,buildExternalResearchQuery,runCopilotTurn} from '../src/copilot-service.js';

const context={company:{name:'Acme',website:'https://acme.example'},markets:['Latvia'],crmSummary:{topCompanies:[{name:'Private CRM Co'}]},profile:{private_notes:'Do not send this'},screen:{step:4,label:'Market Strategy'}};

test('external research policy is internal-first and freshness-aware',()=>{
  assert.equal(shouldUseExternalResearch({question:'What does this button do?',skillIds:['product_help'],knowledge:{freshness:'stable'}}),false);
  assert.equal(shouldUseExternalResearch({question:'Where is the current OpenAI API key control?',skillIds:['technical_setup'],knowledge:{freshness:'verify'}}),true);
  assert.equal(shouldUseExternalResearch({question:'What are the latest provider limits?',skillIds:['technical_setup'],knowledge:{freshness:'stable'}}),true);
});

test('website access and analytics questions always trigger a source-access audit',()=>{
  const question='Find if we can access www.lursoft.lv and how deep is the analytics';
  assert.equal(shouldUseExternalResearch({question,skillIds:['product_help'],knowledge:{freshness:'stable'}}),true);
  assert.equal(externalResearchPurpose(question),'source_access_audit');
  assert.equal(externalResearchPurpose('Find recent Latvian expansion signals'),'general');
});

test('source-access audit requests wider research and gives the model an explicit evidence checklist',async()=>{
  let searchOptions;let generatedPrompt='';
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async search(options){searchOptions=options;return {results:[{title:'Provider API',url:'https://www.lursoft.lv/lv/api-iespejas',description:'Official API information',date:'2026-09-12'}],usage:{input_tokens:1,output_tokens:1}};},
    async generate(options){generatedPrompt=options.prompt;return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Public pages are visible; database access is not proven. Use the authorised API subject to agreement.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'Can LeadIntel access https://www.lursoft.lv and how deep is the analytics?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(searchOptions.purpose,'source_access_audit');assert.equal(searchOptions.maxResults,8);
  assert.match(generatedPrompt,/official API and available fields/);assert.match(generatedPrompt,/automation and legal restrictions/);
  assert.equal(result.research_used,true);
});

test('external research query is minimized and excludes CRM/private context',()=>{
  const query=buildExternalResearchQuery({question:'Latest Apollo limits for buyer@example.com',context,skillIds:['technical_setup']});
  assert.match(query,/Apollo limits/i);assert.doesNotMatch(query,/Acme|Latvia/i);
  assert.doesNotMatch(query,/Private CRM Co|Do not send this|buyer@example\.com/i);
  assert.ok(query.length<=1000);
});

test('stable product help does not invoke web research and forbidden model actions/memories are discarded',async()=>{
  const calls=[];const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async generate(){calls.push('generate');return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'This button opens Market Strategy.',action_proposals:[{action_type:'gmail.send',payload:{to:'x@example.com'}}],memory_candidates:[{kind:'preference',value:'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'}]}),usage:{input_tokens:10,output_tokens:20}};},
    async search(){calls.push('search');throw new Error('should not search');}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',conversation:[],question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.deepEqual(calls,['generate']);assert.equal(result.research_used,false);assert.match(result.answer,/Market Strategy/);assert.deepEqual(result.action_proposals,[]);assert.deepEqual(result.memory_candidates,[]);
});

test('freshness-dependent help uses minimized research and returns only safe http sources',async()=>{
  const calls=[];const env={COPILOT_TEST_CONTEXT:{...context,company:{name:'Acme',website:'https://acme.example',secret:'NOPE'},crmSummary:{topCompanies:[{name:'PRIVATE-CUSTOMER'}]}},COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async search({query}){calls.push({type:'search',query});return {provider:'openai',model:'gpt-test',results:[{title:'Apollo docs',url:'https://docs.apollo.io/current',description:'Current limits',date:'2026-09-08'},{title:'Bad',url:'javascript:alert(1)',description:'bad'}],sources:[],usage:{input_tokens:4,output_tokens:5}};},
    async generate(){calls.push({type:'generate'});return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'The current provider documentation says to check the account settings.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:10,output_tokens:15}};}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',conversation:[],question:'Where is the current Apollo API key control?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(result.research_used,true);assert.equal(calls[0].type,'search');assert.doesNotMatch(calls[0].query,/PRIVATE-CUSTOMER|NOPE|@/);assert.equal(result.sources.length,1);assert.match(result.sources[0].url,/^https:/);
});

test('web research failure degrades to internal guidance with freshness caveat',async()=>{
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{async search(){throw new Error('search unavailable');},async generate(){return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Use the LeadIntel integration settings.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:2}};}}};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',conversation:[],question:'What are the latest Apollo API limits?',currentScreen:{step:1,label:'Company & Market'}});
  assert.equal(result.research_used,false);assert.match(result.answer,/verify|current|fresh|unavailable/i);
});

test('provider failure returns bounded safe response without upstream secret material',async()=>{
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{async generate(){throw new Error('upstream sk-proj-SECRET123456789 body password=hunter2');},async search(){throw new Error('unused');}}};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',conversation:[],question:'Improve my ICP',currentScreen:{step:4,label:'Market Strategy'}});
  assert.match(result.answer,/temporarily|unable|available|try again/i);assert.doesNotMatch(JSON.stringify(result),/sk-proj|hunter2|SECRET123/i);assert.ok(result.answer.length<500);
});

test('copilot unwraps fenced JSON responses before rendering the answer',async()=>{
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async generate(){return {provider:'openai',model:'gpt-test',text:'```json\n{"answer":"Public pages are accessible; paid database access is not proven.","action_proposals":[],"memory_candidates":[]}\n```',usage:{input_tokens:1,output_tokens:2}};},
    async search(){throw new Error('unused');}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',conversation:[],question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(result.answer,'Public pages are accessible; paid database access is not proven.');
  assert.doesNotMatch(result.answer,/```|\{"answer"/);
});
// Speed burst (2026-10-26): the founder measured 10–15 s per answer and wants 2–3 s. Before anything changes, every turn says where its time went.
test('a direct answer reports its timings: context, memories, provider, planning, search, answer and total, with call counts',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));let generates=0;
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async search(){throw new Error('no research expected for stable product help');},
    async generate(){generates++;await wait(12);return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Step 4 lets you review the market strategy.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  const t=result.timings_ms;
  assert.deepEqual(Object.keys(t).sort(),['context','generate','memories','plan','provider','search','total']);
  for(const [key,value] of Object.entries(t))assert.ok(Number.isInteger(value)&&value>=0,`${key} is a whole number of milliseconds, got ${value}`);
  assert.ok(t.generate>=10,`the answer call is measured (${t.generate} ms)`);assert.ok(t.total>=t.generate,'total covers the answer call');
  assert.equal(t.plan,0,'product help never plans research');assert.equal(t.search,0);
  assert.equal(result.model_calls,1);assert.equal(result.search_calls,0);assert.equal(generates,1);
});

test('a planned answer that is reused counts one model call under planning, not under the answer',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));let generates=0;
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async search(){throw new Error('an empty research_query means no search');},
    async generate(){generates++;await wait(12);return {provider:'openai',model:'gpt-test',text:JSON.stringify({research_query:'',answer:'Positioning explains the value for a specific customer.',memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}
  }};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What is positioning in sales?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(generates,1);assert.equal(result.model_calls,1);assert.equal(result.search_calls,0);
  assert.ok(result.timings_ms.plan>=10,`planning is measured (${result.timings_ms.plan} ms)`);assert.equal(result.timings_ms.generate,0,'no second answer call happened');
  assert.ok(result.timings_ms.total>=result.timings_ms.plan);
});

// Speed burst fix 1 (2026-10-26): live baseline with timings showed the model call is 92–97 % of each answer (plan 16.9 s of 17.4; answer 8.9 s of 9.6)
// at the model's default reasoning level. Both copilot model calls now ask for low effort, as the web-search calls already do.
test('both copilot model calls ask for no reasoning first',async()=>{
  const efforts=[];
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    async search(){throw new Error('no research expected');},
    async generate(options){efforts.push(options.reasoningEffort);return {provider:'openai',model:'gpt-test',text:JSON.stringify({research_query:'',answer:'Short answer.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}
  }};
  await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What is positioning in sales?',currentScreen:{step:4,label:'Market Strategy'}});
  await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.deepEqual(efforts,['none','none'],'the planning call and the main answer call both start without reasoning');
});

// Speed burst step 1 (2026-10-26), founder decisions: answers are at most eighty words by default, and the model is asked for no reasoning first.
// Live rounds A/B/C showed the model call is 92–97 % of each answer and that answer length is the variable left after effort and model.
test('the system instruction keeps answers to eighty words by default and reaches both the planning and the answer call',async()=>{
  const systems=[];
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{key:'openai:test-prompt',async search(){throw new Error('no research expected');},async generate(options){systems.push(options.system);return {provider:'openai',model:'gpt-test',text:JSON.stringify({research_query:'',answer:'Short.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}}};
  await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What is positioning in sales?',currentScreen:{step:4,label:'Market Strategy'}});
  await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(systems.length,2);
  for(const system of systems){assert.match(system,/at most 80 words by default/);assert.match(system,/Go longer only when the person asks/);}
});

test('a provider that rejects no-reasoning with 400 answers once more at low effort, and that model is remembered',async()=>{
  const efforts=[];
  const provider={key:'openai:test-rejects-none',async search(){throw new Error('no research expected');},async generate(options){efforts.push(options.reasoningEffort);if(options.reasoningEffort==='none')throw new Error('OpenAI request failed (400)');return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Step 4 is the market strategy.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}};
  const env={COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider};
  const first=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.deepEqual(efforts,['none','low']);assert.equal(first.model_calls,2);assert.equal(first.provider.effort,'low');assert.match(first.answer,/market strategy/);
  const second=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.deepEqual(efforts,['none','low','low'],'the rejection is remembered for that provider and model');assert.equal(second.model_calls,1);
});

test('other provider failures are not retried at low effort',async()=>{
  let calls=0;const provider={key:'openai:test-other-failure',async search(){throw new Error('no research expected');},async generate(){calls++;throw new Error('OpenAI request failed (503)');}};
  const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider},{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(calls,1);assert.match(result.answer,/temporarily unavailable/);
});

test('the models the vendor documents as rejecting no-reasoning start at low effort without a wasted call',async()=>{
  const efforts=[];
  const provider={key:'openai:gpt-6.1-sol',async search(){throw new Error('no research expected');},async generate(options){efforts.push(options.reasoningEffort);return {provider:'openai',model:'gpt-6.1-sol',text:JSON.stringify({answer:'Short.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}};
  const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider},{workspaceId:'w1',userId:'u1',role:'owner',question:'What does this button do?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.deepEqual(efforts,['low']);assert.equal(result.model_calls,1);assert.equal(result.provider.effort,'low');
});

// Speed burst step 2 (2026-10-26): a turn can stream its answer. The provider's raw JSON chunks become answer text deltas, redacted on the accumulated text.
test('the answer is streamed out of the model JSON as deltas that add up to the final answer',async()=>{
  const chunks=['{"research_query":"","answer":"Start with ','Latvia, then ','Estonia.","action_proposals":[],','"memory_candidates":[]}'];
  const provider={key:'openai:test-stream',async search(){throw new Error('no research expected');},async generate(options){for(const chunk of chunks)options.onDelta?.(chunk);return {provider:'openai',model:'gpt-test',text:chunks.join(''),usage:{input_tokens:1,output_tokens:1}};}};
  const deltas=[];const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider},{workspaceId:'w1',userId:'u1',role:'owner',question:'What is positioning in sales?',currentScreen:{step:4,label:'Market Strategy'},onDelta:event=>deltas.push(event)});
  assert.equal(result.answer,'Start with Latvia, then Estonia.');assert.ok(deltas.length>=2,'text arrived in more than one piece');assert.equal(deltas.map(event=>event.text).join(''),'Start with Latvia, then Estonia.');assert.ok(deltas.every(event=>!event.replace));
});
test('without a delta listener the turn behaves as before',async()=>{
  const provider={key:'openai:test-no-stream',async search(){throw new Error('no research expected');},async generate(options){assert.equal(options.onDelta,undefined,'no listener is forwarded');return {provider:'openai',model:'gpt-test',text:JSON.stringify({research_query:'',answer:'Short.',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};}};
  const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:provider},{workspaceId:'w1',userId:'u1',role:'owner',question:'What is positioning in sales?',currentScreen:{step:4,label:'Market Strategy'}});
  assert.equal(result.answer,'Short.');
});
