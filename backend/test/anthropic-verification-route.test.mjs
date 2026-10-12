import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Fixture} from './writing-reference-fixture.mjs';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {handleAiRoute} from '../src/ai-routes.js';

async function fixture(){
 const env={DB:new D1Fixture(),OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};
 env.DB.raw.exec(`CREATE TABLE users(id TEXT,email TEXT,display_name TEXT,role TEXT);
 CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);
 CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);
 CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,model TEXT,active INTEGER,verified_at TEXT,last_used_at TEXT);
 INSERT INTO users VALUES('u1','owner@example.com','Owner','customer');
 INSERT INTO workspace_members VALUES('w1','u1','owner');`);
 await env.DB.prepare("INSERT INTO sessions VALUES(?,'u1',datetime('now','+1 day'))").bind(await sha256('session')).run();
 const encrypted=await encryptSecret('existing-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 await env.DB.prepare("INSERT INTO workspace_ai_integrations VALUES('w1','anthropic',?,'existing-model',1,NULL,NULL)").bind(encrypted).run();
 return env;
}
test('PUT and PATCH preserve the existing credential/model when Anthropic rejects verification',async()=>{
 const env=await fixture();const before=env.DB.raw.prepare('SELECT * FROM workspace_ai_integrations').get();const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API. sk-ant-secret'}},{status:400});
 try{for(const method of ['PUT','PATCH']){
  const request=new Request('https://api.test/api/integrations/ai/provider?workspace_id=w1',{method,headers:{Cookie:'leadintel_session=session','Content-Type':'application/json'},body:JSON.stringify({provider:'anthropic',model:'claude-sonnet-5-5',api_key:'sk-ant-secret'})});
  const response=await handleAiRoute(request,env);assert.equal(response.status,422);const body=await response.text();assert.match(body,/credits_exhausted/);assert.match(body,/Billing & credits/);assert.doesNotMatch(body,/sk-ant-secret|encrypted_api_key/);
  assert.deepEqual(env.DB.raw.prepare('SELECT * FROM workspace_ai_integrations').get(),before);
 }}finally{globalThis.fetch=previous;env.DB.raw.close();}
});
