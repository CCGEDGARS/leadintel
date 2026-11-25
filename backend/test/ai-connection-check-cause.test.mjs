import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {D1Fixture} from './writing-reference-fixture.mjs';
import {handleAiRoute} from '../src/ai-routes.js';import {sha256} from '../src/security.js';

// Live, 24 Nov 2026: "Save & test model" on a key whose Anthropic account had reached its spending limit answered
// "Anthropic connection check failed. Check the API key and model, then try again." — the key and the model were fine,
// and the audit row kept nothing about the reason. The test now says what the provider answered (status and code, never
// the provider's own sentence), names a reached spending limit as such, and keeps both in the audit row.
async function setup(){const DB=new D1Fixture();DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));DB.raw.exec(fs.readFileSync(new URL('../migrations/0044_company_dossier_settings.sql',import.meta.url),'utf8'));DB.raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);INSERT INTO users VALUES('u1','owner@test','Owner','owner');INSERT INTO workspace_members VALUES('w1','u1','owner');`);DB.raw.prepare("INSERT INTO sessions VALUES(?, 'u1', datetime('now','+1 day'))").run(await sha256('token'));return {env:{DB,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('x'.repeat(32))},DB};}
const put=provider=>new Request('https://api.test/api/integrations/ai/provider?workspace_id=w1',{method:'PUT',headers:{Cookie:'leadintel_session=token','Content-Type':'application/json'},body:JSON.stringify({provider,api_key:'private-test-key',model:provider==='anthropic'?'claude-sonnet-5-5':'gpt-6.1-sol'})});
async function check(provider,status,body){
 const {env,DB}=await setup(),old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 try{const response=await handleAiRoute(put(provider),env),answer=await response.json();
  const failed=DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='ai.provider_check_failed'").get();
  return {status:response.status,error:answer.error,audit:JSON.parse(failed.metadata_json)};
 }finally{globalThis.fetch=old;}
}
test('a reached spending limit is named, and kept in the audit row',async()=>{
 const r=await check('anthropic',400,{type:'error',error:{type:'invalid_request_error',message:'You have reached your specified API usage limits. You will regain access on 2026-12-01 at 00:00 UTC.'}});
 assert.equal(r.status,422);
 assert.equal(r.error,"Anthropic request failed · code: billing_hard_limit_reached · The account's spending limit is reached. Open Billing & credits, raise the limit, then retry.");
 assert.equal(r.audit.http_status,400);assert.equal(r.audit.provider_code,'billing_hard_limit_reached');
});
test('an empty balance keeps its existing message; the audit row gains the status and code',async()=>{
 const r=await check('anthropic',400,{type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API.'}});
 assert.equal(r.error,'Anthropic request failed · code: credits_exhausted · Open Billing & credits, add API credits or review limits, then retry.');
 assert.equal(r.audit.http_status,400);assert.equal(r.audit.provider_code,'credits_exhausted');
});
test('any other refusal shows the status and the code beside the general advice',async()=>{
 const down=await check('anthropic',529,{type:'error',error:{type:'overloaded_error',message:'Overloaded'}});
 assert.equal(down.error,'Anthropic connection check failed (error 529 · overloaded_error). Check the API key and model, then try again.');
 assert.deepEqual({http_status:down.audit.http_status,provider_code:down.audit.provider_code},{http_status:529,provider_code:'overloaded_error'});
 const key=await check('openai',401,{error:{message:'Incorrect API key provided: sk-private.',type:'invalid_request_error',code:'invalid_api_key'}});
 assert.equal(key.error,'OpenAI connection check failed (error 401 · invalid_api_key). Check the API key and model, then try again.');
 assert.doesNotMatch(JSON.stringify(key),/sk-private|private-test-key/);
});
