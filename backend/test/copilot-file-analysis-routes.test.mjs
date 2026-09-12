import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {fixture,canonical,analysisRequest} from './helpers/copilot-file-ai.mjs';

test('analysis POST loads stored extraction and returns a validated result; follow-up updates the same analysis',async()=>{
  const {env,file,calls}=await fixture();
  let response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);
  assert.equal(response?.status,201);const {analysis}=await response.json();assert.equal(analysis.file_id,file.id);assert.deepEqual(analysis.result,canonical());
  assert.doesNotMatch(JSON.stringify(analysis),/fixture-secret|r2_key|upload_token|encrypted_api_key/);
  response=await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Explain'}}),env);
  assert.equal(response?.status,200);assert.equal((await response.json()).analysis.id,analysis.id);assert.equal(calls.length,2);
});

for(const path of ['file-analyses','file-analyses/id/messages'])test(`${path} requires session, membership and operating role before provider access`,async()=>{
  const {env,calls}=await fixture();
  assert.equal((await handleCopilotFileRoute(analysisRequest(path,{token:''}),env))?.status,401);
  assert.equal((await handleCopilotFileRoute(analysisRequest(path,{workspace:'unknown'}),env))?.status,403);
  env.DB.sqlite.exec("UPDATE workspace_members SET role='viewer' WHERE user_id='u1'");
  assert.equal((await handleCopilotFileRoute(analysisRequest(path),env))?.status,403);assert.equal(calls.length,0);
});

for(const scope of ['user:u1:write','workspace:w1:write'])for(const path of ['file-analyses','file-analyses/id/messages'])test(`${path} preserves ${scope} rate limiting`,async()=>{
  const {env,calls}=await fixture();
  env.DB.sqlite.prepare('INSERT INTO copilot_file_rate_limits(scope_key,window_start,count) VALUES(?,unixepoch()/60,999) ON CONFLICT(scope_key) DO UPDATE SET count=999').run(scope);
  const response=await handleCopilotFileRoute(analysisRequest(path),env);assert.equal(response?.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert.equal(calls.length,0);
});

test('cross-workspace file and analysis IDs cannot reach another workspace provider or source content',async()=>{
  const {env,file,calls}=await fixture();
  assert.equal((await handleCopilotFileRoute(analysisRequest('file-analyses',{workspace:'w2',body:{file_id:file.id,request:'Steal'}}),env))?.status,404);
  const response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);const {analysis}=await response.json();
  assert.equal((await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{workspace:'w2',body:{message:'Steal'}}),env))?.status,404);assert.equal(calls.length,1);
});

test('invalid, oversized and client-injected extraction JSON are refused before model use',async()=>{
  const {env,file,calls}=await fixture();
  for(const body of [{file_id:file.id,request:''},{file_id:file.id,request:'x'.repeat(8001)},{file_id:file.id,request:'ok',extraction:{blocks:[]}},{file_id:file.id,request:'ok',workspace_id:'w2'}])assert.equal((await handleCopilotFileRoute(analysisRequest('file-analyses',{body}),env))?.status,400);
  const oversized=analysisRequest('file-analyses',{body:{request:'x'.repeat(70000)}});assert.equal((await handleCopilotFileRoute(oversized,env))?.status,413);
  const malformed=new Request('https://test/api/copilot/file-analyses?workspace_id=w1',{method:'POST',headers:{Cookie:'leadintel_session=good','Content-Type':'application/json'},body:'{bad'});assert.equal((await handleCopilotFileRoute(malformed,env))?.status,400);assert.equal(calls.length,0);
});

test('partial extraction requires explicit confirmation, and empty extraction never completes',async()=>{
  const {env,file,calls}=await fixture();env.DB.sqlite.exec("UPDATE copilot_files SET extraction_status='partial',coverage_json='{\"complete\":false,\"omitted\":[\"page:2\"]}'");
  let response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);assert.equal(response?.status,409);assert.equal(calls.length,0);
  response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize',partial_confirmed:true}}),env);assert.equal(response?.status,201);
  env.DB.sqlite.exec("UPDATE copilot_file_extractions SET blocks_json='[]',evidence_index_json='{}'");
  response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize',partial_confirmed:true}}),env);assert.equal(response?.status,422);assert.equal(calls.length,1);
});

test('failed AI validation returns a visible safe error and never a completed analysis',async()=>{
  const {env,file}=await fixture({outputs:['SECRET DOCUMENT invalid']});
  const response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);assert.equal(response?.status,502);
  const body=await response.json();assert.ok(body.error);assert.doesNotMatch(JSON.stringify(body),/SECRET DOCUMENT|fixture-secret|completed/);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM copilot_file_analyses').get().n,0);
});

test('output preferences are bounded data passed to the provider, not executable instructions',async()=>{
  const {env,file,calls}=await fixture();
  const response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize',output_preferences:{formats:['pdf','docx']}}}),env);assert.equal(response?.status,201);
  assert.deepEqual(JSON.parse(calls[0].body.input).output_preferences,{formats:['pdf','docx']});
});

test('reloading follow-up messages keeps user then assistant ordering even when random IDs sort oppositely',async t=>{
  const {env,file}=await fixture();
  const first=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);const {analysis}=await first.json();
  const ids=['zz-user','aa-assistant'];t.mock.method(crypto,'randomUUID',()=>ids.shift());
  await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Explain'}}),env);
  const response=await handleCopilotFileRoute(new Request(`https://test/api/copilot/file-analyses/${analysis.id}?workspace_id=w1`,{headers:{Cookie:'leadintel_session=good'}}),env);
  assert.deepEqual((await response.json()).analysis.messages.map(message=>message.role),['user','assistant']);
});
