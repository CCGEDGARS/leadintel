import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldUseExternalResearch,buildExternalResearchQuery,runCopilotTurn} from '../src/copilot-service.js';

const context={company:{name:'Acme',website:'https://acme.example'},markets:['Latvia'],crmSummary:{topCompanies:[{name:'Private CRM Co'}]},profile:{private_notes:'Do not send this'},screen:{step:4,label:'Market Strategy'}};

test('external research policy is internal-first and freshness-aware',()=>{
  assert.equal(shouldUseExternalResearch({question:'What does this button do?',skillIds:['product_help'],knowledge:{freshness:'stable'}}),false);
  assert.equal(shouldUseExternalResearch({question:'Where is the current OpenAI API key control?',skillIds:['technical_setup'],knowledge:{freshness:'verify'}}),true);
  assert.equal(shouldUseExternalResearch({question:'What are the latest provider limits?',skillIds:['technical_setup'],knowledge:{freshness:'stable'}}),true);
});

test('external research query is minimized and excludes CRM/private context',()=>{
  const query=buildExternalResearchQuery({question:'Latest Apollo limits for buyer@example.com',context,skillIds:['technical_setup']});
  assert.match(query,/Apollo limits/i);assert.match(query,/Acme|Latvia/i);
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
