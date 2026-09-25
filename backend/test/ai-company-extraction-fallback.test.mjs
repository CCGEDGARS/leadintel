import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../src/security.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import {handleAiRoute} from '../src/ai-routes.js';

const migration=fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8');
const extraction={companies:[{company:'Northstar Manufacturing',market:'Sweden',sourceUrl:'https://news.example/northstar-expansion'}]};

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes||0)}};}
}
class D1Db{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);INSERT INTO workspaces VALUES('w1','Workspace One');`);
    this.raw.exec(migration);
  }
  prepare(sql){return new D1Statement(this.raw,sql);}
}

async function fixture({provider='openai',includeGemini=true,geminiVerified=true}={}){
  const DB=new D1Db();const token='ai-extraction-session';const tokenHash=await sha256(token);const rawKey=Buffer.alloc(32,9).toString('base64');const key=await importAesKey(rawKey);
  DB.raw.prepare(`INSERT INTO users VALUES(?,?,?,?)`).run('u1','owner@example.test','Owner','owner');
  DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(tokenHash,'u1');
  DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w1','u1','owner');
  const primarySecret='openai-private-test-key';
  DB.raw.prepare(`INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active,verified_at) VALUES(?,?,?,?,?,1,CURRENT_TIMESTAMP)`).run('w1',provider,await encryptSecret(primarySecret,key),'••••key','gpt-5.6');
  if(includeGemini){
    DB.raw.prepare(`INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active,verified_at) VALUES(?,?,?,?,?,0,?)`).run('w1','gemini',await encryptSecret('gemini-private-test-key',key),'••••key','gemini-3.7-flash',geminiVerified?'2026-09-20 10:00:00':'');
  }
  return {DB,token,primarySecret,env:{DB,OAUTH_TOKEN_ENCRYPTION_KEY:rawKey}};
}

function extractionRequest(token,{purpose='company_discovery_extraction',signal}={}){
  return new Request('https://api.example.test/api/ai/generate?workspace_id=w1',{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({purpose,system:'Return strict JSON only.',prompt:'Extract source-verified company names.',max_output_tokens:1800}),signal});
}
function openAiResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});}
function geminiResponse(text){return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}],usageMetadata:{promptTokenCount:31,candidatesTokenCount:17}}),{status:200,headers:{'Content-Type':'application/json'}});}

test('company extraction retries one OpenAI quota failure with verified Gemini and reports provenance',async()=>{
  const {env,DB,token,primarySecret}=await fixture();const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url)==='https://api.openai.com/v1/responses')return openAiResponse({error:{code:'insufficient_quota'}},429);
    if(String(url).includes('generativelanguage.googleapis.com'))return geminiResponse(JSON.stringify(extraction));
    throw new Error('Unexpected provider request');
  };
  try{
    const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();
    assert.equal(response.status,200);assert.equal(payload.provider,'gemini');assert.equal(payload.failover.used,true);assert.equal(payload.failover.attempted,true);assert.equal(payload.failover.primary,'openai');assert.equal(payload.failover.provider,'gemini');assert.equal(payload.failover.reason,'quota_or_rate_limit');
    assert.equal(calls.length,2);assert.equal(calls[0].url,'https://api.openai.com/v1/responses');assert.match(calls[1].url,/generativelanguage\.googleapis\.com/);
    assert.equal(calls[0].options.headers.Authorization,`Bearer ${primarySecret}`);assert.equal(calls[1].options.headers['x-goog-api-key'],'gemini-private-test-key');
    const geminiBody=JSON.parse(calls[1].options.body);assert.match(geminiBody.contents[0].parts[0].text,/Extract source-verified company names/);assert.equal(geminiBody.generationConfig.maxOutputTokens,1800);
    assert.equal(JSON.stringify(payload).includes('private-test-key'),false);
    const used=DB.raw.prepare(`SELECT provider,last_used_at FROM workspace_ai_integrations WHERE workspace_id='w1' ORDER BY provider`).all();assert.ok(used.find(row=>row.provider==='gemini').last_used_at);assert.equal(used.find(row=>row.provider==='openai').last_used_at,null);
    const audit=DB.raw.prepare(`SELECT event_type,entity_id,metadata_json FROM audit_events`).get();assert.equal(audit.event_type,'ai.generation_completed');assert.equal(audit.entity_id,'gemini');assert.deepEqual(JSON.parse(audit.metadata_json).failover_from,'openai');
  }finally{globalThis.fetch=originalFetch;}
});

test('valid empty extraction results do not spend a Gemini fallback call',async()=>{
  const {env,token}=await fixture();const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls+=1;return openAiResponse({output_text:'{"companies":[]}',usage:{input_tokens:10,output_tokens:3}});};
  try{
    const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();
    assert.equal(response.status,200);assert.equal(payload.provider,'openai');assert.equal(payload.text,'{"companies":[]}');assert.equal(payload.failover,undefined);assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('Gemini failover is limited to the exact company-extraction purpose',async()=>{
  const {env,token}=await fixture();const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls+=1;return openAiResponse({error:{code:'insufficient_quota'}},429);};
  try{
    const response=await handleAiRoute(extractionRequest(token,{purpose:'general_generation'}),env,{});const payload=await response.json();
    assert.equal(response.status,502);assert.equal(payload.failover,undefined);assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('unconfigured Gemini is reported without changing the active OpenAI provider',async()=>{
  const {env,token}=await fixture({includeGemini:false});const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls+=1;return openAiResponse({error:{code:'insufficient_quota'}},429);};
  try{
    const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();
    assert.equal(response.status,502);assert.equal(payload.failover.attempted,false);assert.equal(payload.failover.configured,false);assert.equal(payload.failover.reason,'gemini_not_configured');assert.equal(calls,1);
    assert.equal(DBProvider(env.DB),'openai');
  }finally{globalThis.fetch=originalFetch;}
});

test('Gemini must be verified before it can be used as an automatic fallback',async()=>{
  const {env,token}=await fixture({geminiVerified:false});const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls+=1;return openAiResponse({error:{code:'insufficient_quota'}},429);};
  try{
    const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();
    assert.equal(response.status,502);assert.equal(payload.failover.attempted,false);assert.equal(payload.failover.configured,true);assert.equal(payload.failover.reason,'gemini_not_verified');assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('an aborted company extraction request does not start a paid Gemini fallback',async()=>{
  const {env,token}=await fixture();const originalFetch=globalThis.fetch;const controller=new AbortController();let calls=0;
  globalThis.fetch=async()=>{calls+=1;controller.abort();return openAiResponse({error:{code:'insufficient_quota'}},429);};
  try{
    const response=await handleAiRoute(extractionRequest(token,{signal:controller.signal}),env,{});const payload=await response.json();
    assert.equal(response.status,502);assert.equal(payload.failover,undefined);assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('invalid extraction JSON retries Gemini, while an active non-OpenAI provider does not',async t=>{
  await t.test('malformed output invokes the one verified fallback',async()=>{
    const {env,token}=await fixture();const originalFetch=globalThis.fetch;const calls=[];
    globalThis.fetch=async(url)=>{calls.push(String(url));return calls.length===1?openAiResponse({output_text:'not JSON'}):geminiResponse(JSON.stringify(extraction));};
    try{const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();assert.equal(response.status,200);assert.equal(payload.failover.used,true);assert.equal(payload.failover.reason,'invalid_output');assert.equal(calls.length,2);}finally{globalThis.fetch=originalFetch;}
  });
  await t.test('Anthropic remains the selected provider and has no implicit Gemini failover',async()=>{
    const {env,token}=await fixture({provider:'anthropic'});const originalFetch=globalThis.fetch;let calls=0;
    globalThis.fetch=async()=>{calls+=1;return openAiResponse({error:{code:'insufficient_quota'}},429);};
    try{const response=await handleAiRoute(extractionRequest(token),env,{});const payload=await response.json();assert.equal(response.status,502);assert.equal(payload.failover,undefined);assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
  });
});

function DBProvider(DB){return DB.raw.prepare(`SELECT provider FROM workspace_ai_integrations WHERE active=1`).get()?.provider;}
