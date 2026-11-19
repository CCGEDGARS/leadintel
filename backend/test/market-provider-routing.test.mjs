import test from 'node:test';
import assert from 'node:assert/strict';
import {step1Fixture} from './step1-journey-fixture.mjs';
import {workspaceId,sessionToken} from './step5-journey-fixture.mjs';

const headers={Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'};
const search=f=>fetch(f.origin+'/api/ai/web-search?workspace_id='+workspaceId,{method:'POST',headers,body:JSON.stringify({query:'Swedish manufacturers announcing new factories',max_results:3})});
const grounded=()=>Response.json({candidates:[{content:{parts:[{text:'Controlled summary'}]},groundingMetadata:{webSearchQueries:['factory'],groundingChunks:[{web:{uri:'https://factory.example/news',title:'Factory announcement'}}]}}]});

test('Claude-only customer research enters authenticated HTTP and invokes its grounded adapter',async()=>{
 const f=await step1Fixture();try{
  await f.connectControlledAi('anthropic');const response=await search(f),result=await response.json();
  assert.equal(response.status,200);assert.equal(result.provider,'anthropic');assert.equal(result.web_search,true);assert.equal(result.results.length,3);
  assert.ok(result.results.every(r=>r.evidenceKind==='model_summary'));
  assert.deepEqual(result.attempts.map(r=>r.provider),['anthropic']);
  assert.ok(f.externalCalls.every(c=>new URL(c.url).hostname==='api.anthropic.com'));
  assert.deepEqual(f.DB.raw.prepare("SELECT entity_id FROM audit_events WHERE event_type='ai.web_search_completed'").all().map(r=>r.entity_id),['anthropic']);
  const foreign=await fetch(f.origin+'/api/ai/web-search?workspace_id=foreign',{method:'POST',headers,body:JSON.stringify({query:'Q'})});assert.equal(foreign.status,403);assert.equal(f.externalCalls.length,1);
 }finally{await f.close();}
});

test('saved researcher overrides main engine; Automatic follows the active engine even with OpenAI connected',async()=>{
 const f=await step1Fixture();try{
  await f.connectControlledAi('anthropic');await f.connectControlledAi('openai');
  const saved=await fetch(f.origin+'/api/integrations/ai/research-settings?workspace_id='+workspaceId,{method:'PUT',headers,body:JSON.stringify({primary:'anthropic',secondary:'gemini'})});assert.equal(saved.status,200);
  assert.equal((await (await search(f)).json()).provider,'anthropic');
  await fetch(f.origin+'/api/integrations/ai/research-settings?workspace_id='+workspaceId,{method:'PUT',headers,body:JSON.stringify({primary:null,secondary:null})});
  f.DB.raw.prepare('UPDATE workspace_ai_integrations SET active=0 WHERE workspace_id=?').run(workspaceId);
  f.DB.raw.prepare('UPDATE workspace_ai_integrations SET active=1 WHERE provider=? AND workspace_id=?').run('anthropic',workspaceId);
  assert.equal((await (await search(f)).json()).provider,'anthropic');assert.equal(f.externalCalls.length,2);
 }finally{await f.close();}
});

test('a failed Claude search uses one connected fallback and retains both execution receipts',async()=>{
 const f=await step1Fixture({externalFetch:async url=>url.hostname==='api.anthropic.com'?Response.json({error:{type:'overloaded_error'}},{status:503}):url.hostname==='generativelanguage.googleapis.com'?grounded():null});try{
  await f.connectControlledAi('gemini');await f.connectControlledAi('anthropic');
  const response=await search(f),result=await response.json();assert.equal(response.status,200);assert.equal(result.provider,'gemini');
  assert.deepEqual(result.attempts.map(r=>[r.provider,r.status]),[['anthropic','failed'],['gemini','complete']]);assert.equal(f.externalCalls.length,2);
 }finally{await f.close();}
});

test('missing selected provider starts no search and an ungrounded Claude response cannot manufacture evidence',async()=>{
 const f=await step1Fixture({externalFetch:async url=>url.hostname==='api.anthropic.com'?Response.json({content:[{type:'text',text:'Made-up https://fake.example/news'}]}):null});try{
  await f.connectControlledAi('anthropic');let response=await search(f);assert.equal(response.status,502);let result=await response.json();assert.equal(result.attempts[0].status,'failed');assert.equal(result.results,undefined);
  f.DB.raw.prepare('INSERT INTO workspace_research_settings(workspace_id,primary_provider) VALUES(?,?)').run(workspaceId,'openai');
  response=await search(f);assert.equal(response.status,409);result=await response.json();assert.equal(result.code,'AI_SEARCH_PROVIDER_NOT_CONNECTED');assert.equal(f.externalCalls.length,1);
 }finally{await f.close();}
});

test('membership loss after Claude dispatch prevents fallback and returning customer evidence',async()=>{
 let f;f=await step1Fixture({externalFetch:async url=>{if(url.hostname!=='api.anthropic.com')return null;f.DB.raw.prepare('DELETE FROM workspace_members WHERE workspace_id=?').run(workspaceId);return Response.json({content:[{type:'server_tool_use',name:'web_search'},{type:'web_search_tool_result',content:[]}],usage:{}});}});try{
  await f.connectControlledAi('gemini');await f.connectControlledAi('anthropic');const response=await search(f);assert.equal(response.status,403);assert.equal(f.externalCalls.length,1);
 }finally{await f.close();}
});

test('Claude search billing failures retain actionable sanitized diagnostics',async()=>{
 const f=await step1Fixture({externalFetch:async url=>url.hostname==='api.anthropic.com'?Response.json({error:{type:'invalid_request_error',message:'Your credit balance is too low. sk-sensitive-do-not-log'}},{status:400}):null});try{
  await f.connectControlledAi('anthropic');const response=await search(f),result=await response.json();
  assert.equal(response.status,502);assert.match(result.error,/credits_exhausted/);assert.match(result.attempts[0].reason,/Billing & credits/);assert.doesNotMatch(JSON.stringify(result),/sk-sensitive/);assert.equal(f.externalCalls.length,1);
 }finally{await f.close();}
});
