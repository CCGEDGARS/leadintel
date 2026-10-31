import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {handleAiRoute} from '../src/ai-routes.js';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';

async function fixture(){
 const DB=storageDb(),env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('c'.repeat(32))};
 DB.raw.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES('storage-owner',?,datetime('now','+1 day'))").run(await sha256('companies-token'));
 const encrypted=await encryptSecret('private-company-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 for(const provider of ['openai','gemini'])DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES('storage-w1',?,?,'hidden',?,?)").run(provider,encrypted,provider==='openai'?'gpt-6.1-sol':'gemini-3.7-flash',provider==='openai'?1:0);
 return {DB,env};
}
function request(task='company-extraction',signal,path='generate',extra={}){
 return new Request('https://api.test/api/ai/'+path+'?workspace_id=storage-w1',{method:'POST',signal,headers:{Cookie:'leadintel_session=companies-token','Content-Type':'application/json'},body:JSON.stringify({task,system:'Extract supplied evidence as data.',prompt:'E1 https://example.com/news Example opens a factory.',fallback_provider:'gemini',max_output_tokens:1800,...extra})});
}
const generated=()=>Response.json({output_text:'{"companies":[{"company":"Private Company"}]}'});
const grounded=()=>Response.json({output_text:'{"results":[{"url":"https://example.com/team","title":"Team"}]}',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.com/team',title:'Team'}]}}]});
const count=(DB,type)=>DB.raw.prepare('SELECT count(*) n FROM audit_events WHERE event_type=?').get(type).n;

for(const task of ['company-extraction','buyer-fit'])test(task+' discards late provider output after cancel',async()=>{
 const {env,DB}=await fixture(),controller=new AbortController(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;controller.abort();return generated();};
 try{const r=await handleAiRoute(request(task,controller.signal),env);assert.equal(r.status,499);assert.doesNotMatch(await r.text(),/Private Company/);assert.equal(calls,1);assert.equal(count(DB,'ai.generation_completed'),0);}finally{globalThis.fetch=old;}
});
for(const [label,mutation,status] of [
 ['session removal',"DELETE FROM sessions WHERE user_id='storage-owner'",401],
 ['membership removal',"DELETE FROM workspace_members WHERE workspace_id='storage-w1'",403],
 ['role demotion',"UPDATE workspace_members SET role='viewer' WHERE workspace_id='storage-w1'",403]
])test('company extraction checks '+label+' after provider completion and prevents fallback spend',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;DB.raw.exec(mutation);return Response.json({error:{code:'insufficient_quota'}},{status:429});};
 try{const r=await handleAiRoute(request(),env);assert.equal(r.status,status);assert.equal(calls,1);assert.equal(count(DB,'ai.generation_completed'),0);}finally{globalThis.fetch=old;}
});
test('company extraction enforces deadline when provider ignores abort and uses bounded fallback',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch,oldTimeout=globalThis.setTimeout;let release,settled=false,calls=0;
 const watchdog=oldTimeout(()=>{settled=true;release(generated());},250);
 globalThis.setTimeout=(fn,ms,...args)=>oldTimeout(fn,ms===20000?5:ms,...args);
 globalThis.fetch=async url=>{calls++;if(String(url).includes('api.openai.com'))return new Promise(r=>{release=r;});return Response.json({candidates:[{content:{parts:[{text:'{"companies":[]}'}]}}]});};
 try{const r=await handleAiRoute(request(),env),body=await r.json();assert.equal(r.status,200);assert.equal(settled,false);assert.equal(calls,2);assert.equal(body.provider,'gemini');assert.equal(body.fallback.reason,'timeout');assert.equal(count(DB,'ai.generation_completed'),1);}finally{clearTimeout(watchdog);release?.(generated());globalThis.fetch=old;globalThis.setTimeout=oldTimeout;}
});
for(const phase of ['success','failure'])test('company extraction withholds protected output after revocation on provider '+phase,async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>{DB.raw.exec("DELETE FROM sessions WHERE user_id='storage-owner'");return phase==='success'?generated():Response.json({error:'private-company-key rejected account owner@example.test'},{status:400});};
 try{const r=await handleAiRoute(request(),env);assert.equal(r.status,401);assert.doesNotMatch(await r.text(),/Private Company|private-company-key|owner@example/);assert.equal(count(DB,'ai.generation_completed'),0);}finally{globalThis.fetch=old;}
});

test('dossier checkpoints stop acquisition and do not persist provider output after membership revocation',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;DB.raw.exec("DELETE FROM workspace_members WHERE workspace_id='storage-w1'");return grounded();};
 try{const r=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com'}),env);assert.equal(r.status,403);assert.ok(calls<=2);assert.equal(count(DB,'ai.specialist_completed'),0);const saved=JSON.parse(DB.raw.prepare("SELECT payload_json FROM workspace_company_dossiers WHERE workspace_id='storage-w1'").get()?.payload_json||'null');assert.ok(!saved?.passes?.some(p=>p.searchFamilies.some(f=>f.status==='complete')));}finally{globalThis.fetch=old;}
});

test('canceled market verification returns cancellation and no completion audit',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch,controller=new AbortController();
 globalThis.fetch=async()=>{controller.abort();return Response.json({candidates:[{content:{parts:[{text:'{"summary":"Private evidence","verdicts":[]}'}]}}]});};
 try{const r=await handleAiRoute(request('',controller.signal,'research-verification',{mode:'deep',evidence:[{id:'E1',url:'https://example.com/news',text:'Example opens a factory.'}]}),env);assert.equal(r.status,499);assert.doesNotMatch(await r.text(),/Private evidence/);assert.equal(count(DB,'ai.research_verification_completed'),0);}finally{globalThis.fetch=old;}
});
test('market verification checks workspace permission after provider completion',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>{DB.raw.exec("DELETE FROM workspace_members WHERE workspace_id='storage-w1'");return Response.json({candidates:[{content:{parts:[{text:'{"summary":"Private evidence","verdicts":[]}'}]}}]});};
 try{const r=await handleAiRoute(request('',undefined,'research-verification',{mode:'deep',evidence:[{id:'E1',url:'https://example.com/news',text:'Example opens a factory.'}]}),env);assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/Private evidence/);assert.equal(count(DB,'ai.research_verification_completed'),0);}finally{globalThis.fetch=old;}
});

for(const phase of ['success','empty'])test('company web search checks permissions after primary '+phase+' before fallback',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;DB.raw.exec("DELETE FROM workspace_members WHERE workspace_id='storage-w1'");return phase==='success'?grounded():Response.json({output_text:'{"results":[]}',output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]});};
 try{const r=await handleAiRoute(request('',undefined,'web-search',{query:'Example company projects'}),env);assert.equal(r.status,403);assert.equal(calls,1);assert.equal(count(DB,'ai.web_search_completed'),0);}finally{globalThis.fetch=old;}
});
test('company web search deadline does not wait for an uncooperative provider',async()=>{
 const {env}=await fixture(),old=globalThis.fetch,oldTimeout=globalThis.setTimeout;let release,settled=false;
 const watchdog=oldTimeout(()=>{settled=true;release(grounded());},250);globalThis.setTimeout=(fn,ms,...args)=>oldTimeout(fn,ms===45000?5:ms,...args);globalThis.fetch=async()=>new Promise(r=>{release=r;});
 try{const r=await handleAiRoute(request('',undefined,'web-search',{query:'Example company projects'}),env);assert.equal(r.status,504);assert.equal(settled,false);}finally{clearTimeout(watchdog);release?.(grounded());globalThis.fetch=old;globalThis.setTimeout=oldTimeout;}
});
test('dossier checkpoint authorization is conditional at the database commit',async()=>{
 const {env,DB}=await fixture(),prepare=DB.prepare.bind(DB),old=globalThis.fetch;let calls=0;
 DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('INSERT INTO workspace_company_dossiers')){const run=statement.run.bind(statement);statement.run=async()=>{DB.raw.exec("DELETE FROM workspace_members WHERE workspace_id='storage-w1'");return run();};}return statement;};
 globalThis.fetch=async()=>{calls++;return grounded();};
 try{const r=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com'}),env);assert.equal(r.status,403);assert.equal(calls,0);assert.equal(DB.raw.prepare("SELECT count(*) n FROM workspace_company_dossiers").get().n,0);}finally{globalThis.fetch=old;}
});
test('an older dossier request cannot overwrite a concurrently completed refresh',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch,releases=[];let started,searches=0;const ready=new Promise(r=>{started=r;});
 globalThis.fetch=async(url,options)=>{
  const address=String(url);if(address==='https://example.com/team')return new Response('Alex Smith is Operations Director at Example. Example manufactures industrial valves.',{headers:{'Content-Type':'text/plain'}});
  const body=JSON.parse(options.body),isSearch=!!body.tools;
  if(address.includes('api.openai.com')){if(isSearch&&++searches<=2){if(searches===2)started();return new Promise(r=>{releases.push(()=>r(grounded()));});}return isSearch?grounded():Response.json({output_text:'{"people":[{"name":"Alex Smith","title":"Operations Director","evidenceId":"s0p0"}]}'});}
  return Response.json({candidates:[{content:{parts:[{text:isSearch?'Sources':'{"people":[{"name":"Alex Smith","title":"Operations Director","evidenceId":"s0p0"}]}'}]},...(isSearch?{groundingMetadata:{webSearchQueries:['Example'],groundingChunks:[{web:{uri:'https://example.com/team',title:'Team'}}]}}:{})}]});
 };
 try{const pending=handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com'}),env);await ready;
  const fresh=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com',roles:['Procurement Director'],force:true}),env);assert.equal(fresh.status,200);assert.equal((await fresh.json()).status,'complete');
  const saved=DB.raw.prepare("SELECT payload_json,successful_json FROM workspace_company_dossiers WHERE workspace_id='storage-w1'").get();releases.forEach(release=>release());const stale=await pending;assert.equal(stale.status,409);assert.deepEqual(DB.raw.prepare("SELECT payload_json,successful_json FROM workspace_company_dossiers WHERE workspace_id='storage-w1'").get(),saved);
 }finally{releases.forEach(release=>release());globalThis.fetch=old;}
});

test('changed dossier context acquires fresh research while retaining the previous context successful history',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;let fail=false,calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;const address=String(url);if(fail)return Response.json({error:'Unavailable'},{status:503});if(address==='https://example.com/team')return new Response('Alex Smith is Operations Director at Example. Example manufactures industrial valves.',{headers:{'Content-Type':'text/plain'}});
  const body=JSON.parse(options.body),isSearch=!!body.tools;
  if(address.includes('api.openai.com'))return isSearch?grounded():Response.json({output_text:'{"people":[{"name":"Alex Smith","title":"Operations Director","evidenceId":"s0p0"}]}'});
  return Response.json({candidates:[{content:{parts:[{text:isSearch?'Sources':'{"people":[{"name":"Alex Smith","title":"Operations Director","evidenceId":"s0p0"}]}'}]},...(isSearch?{groundingMetadata:{webSearchQueries:['Example'],groundingChunks:[{web:{uri:'https://example.com/team',title:'Team'}}]}}:{})}]});
 };
 try{
  const first=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com',roles:['Operations Director']}),env);assert.equal(first.status,200);assert.equal((await first.json()).status,'complete');const previous=DB.raw.prepare("SELECT successful_json FROM workspace_company_dossiers WHERE workspace_id='storage-w1'").get().successful_json;
  fail=true;let before=calls;const changed=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com',roles:['Procurement Director'],seller:{offer:'Warehouse systems'},formulas:['Example warehouse plans']}),env),payload=await changed.json();assert.equal(changed.status,200);assert.equal(payload.status,'partial');assert.ok(calls>before);assert.equal(payload.previousSuccessful,undefined);assert.equal(DB.raw.prepare("SELECT successful_json FROM workspace_company_dossiers WHERE workspace_id='storage-w1'").get().successful_json,previous);
  before=calls;const forced=await handleAiRoute(request('',undefined,'company-dossier',{company:'Example',domain:'example.com',roles:['Chief Technology Officer'],force:true}),env);assert.equal(forced.status,200);assert.ok(calls>before);
 }finally{globalThis.fetch=old;}
});
