import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {handleAiRoute} from '../src/ai-routes.js';
import {handleServiceIntegrationRoute} from '../src/service-integrations.js';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';

async function fixture(){
 const DB=storageDb(),env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('p'.repeat(32))};
 DB.raw.prepare("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES('storage-owner',?,datetime('now','+1 day'))").run(await sha256('profile-token'));
 const encrypted=await encryptSecret('private-profile-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES('storage-w1','openai',?,'hidden','gpt-6.1-sol',1)").run(encrypted);
 return {DB,env};
}
function request(signal,workspace='storage-w1'){
 return new Request('https://api.test/api/ai/generate?workspace_id='+workspace,{method:'POST',signal,headers:{Cookie:'leadintel_session=profile-token','Content-Type':'application/json'},body:JSON.stringify({task:'profile-synthesis',system:'Use supplied seller evidence; keep hypotheses separate.',prompt:'S1 https://seller.example/ — Seller manufactures valves.',max_output_tokens:3200})});
}
const generated=()=>Response.json({output_text:'{"fields":{"mission":{"value":"Manufactures valves","source_ids":["S1"]}}}',usage:{input_tokens:14,output_tokens:10}});
async function firecrawlFixture(){
 const result=await fixture(),encrypted=await encryptSecret('private-firecrawl-key',await importAesKey(result.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 result.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('storage-w1','firecrawl',?,'hidden')").run(encrypted);
 return result;
}
function sourceRequest(kind='scrape',body){return new Request('https://api.test/api/integrations/services/firecrawl/'+kind+'?workspace_id=storage-w1',{method:'POST',headers:{Cookie:'leadintel_session=profile-token','Content-Type':'application/json'},body:JSON.stringify(body||(kind==='scrape'?{url:'https://seller.example/'}:{query:'Seller valve manufacturer',limit:4}))});}

test('an already canceled Profile synthesis does not start a provider call',async()=>{
 const {env}=await fixture(),controller=new AbortController(),old=globalThis.fetch;let calls=0;
 controller.abort();globalThis.fetch=async()=>{calls++;return generated();};
 try{const response=await handleAiRoute(request(controller.signal),env);assert.equal(response.status,499);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});

test('Profile synthesis discards provider output that settles after cancellation',async()=>{
 const {env,DB}=await fixture(),controller=new AbortController(),old=globalThis.fetch;
 globalThis.fetch=async()=>{controller.abort();return generated();};
 try{const response=await handleAiRoute(request(controller.signal),env);assert.equal(response.status,499);assert.doesNotMatch(await response.text(),/Manufactures valves/);assert.equal(DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='ai.generation_completed'").get().n,0);}finally{globalThis.fetch=old;}
});

test('Profile synthesis enforces its server deadline even when the provider ignores abort',async()=>{
 const {env}=await fixture(),old=globalThis.fetch,oldTimeout=globalThis.setTimeout,controller=new AbortController();
 let release,upstreamSettled=false;
 const watchdog=oldTimeout(()=>{upstreamSettled=true;release(generated());},250);
 globalThis.setTimeout=(callback,ms,...args)=>oldTimeout(callback,ms===55000?5:ms,...args);
 globalThis.fetch=async()=>new Promise(resolve=>{release=resolve;});
 try{const response=await handleAiRoute(request(controller.signal),env);assert.equal(response.status,504);assert.equal(upstreamSettled,false,'the route must finish without waiting for the uncooperative provider');assert.doesNotMatch(await response.text(),/Manufactures valves/);}finally{clearTimeout(watchdog);release?.(generated());globalThis.fetch=old;globalThis.setTimeout=oldTimeout;}
});

for(const [name,mutation,status] of [
 ['session removal',"DELETE FROM sessions WHERE user_id='storage-owner'",401],
 ['session expiry',"UPDATE sessions SET expires_at=datetime('now','-1 day') WHERE user_id='storage-owner'",401],
 ['membership removal',"DELETE FROM workspace_members WHERE workspace_id='storage-w1'",403],
 ['membership demotion',"UPDATE workspace_members SET role='viewer' WHERE workspace_id='storage-w1'",403]
])test('Profile synthesis does not return protected output after '+name,async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>{DB.raw.exec(mutation);return generated();};
 try{const response=await handleAiRoute(request(),env);assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/Manufactures valves/);assert.equal(DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='ai.generation_completed'").get().n,0);}finally{globalThis.fetch=old;}
});

test('Profile synthesis cannot read another workspace credential or make a provider call',async()=>{
 const {env}=await fixture(),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return generated();};
 try{const response=await handleAiRoute(request(undefined,'unknown-workspace'),env);assert.equal(response.status,403);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});

test('Profile synthesis reports only the provider that actually generated the supplied-evidence draft',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch,executions=[];
 globalThis.fetch=async(url,options)=>{executions.push({url:String(url),body:JSON.parse(options.body)});return generated();};
 try{const response=await handleAiRoute(request(),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.provider,'openai');assert.equal(executions.length,1);assert.equal(executions[0].url,'https://api.openai.com/v1/responses');assert.equal(executions[0].body.input,'S1 https://seller.example/ — Seller manufactures valves.');assert.equal(executions[0].body.tools,undefined);assert.doesNotMatch(JSON.stringify(body),/private-profile-key/);assert.equal(JSON.parse(DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='ai.generation_completed'").get().metadata_json).fallback_used,false);}finally{globalThis.fetch=old;}
});

test('Profile source extraction retains final URLs and an actual Firecrawl execution receipt',async()=>{
 const {env}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({success:true,data:{markdown:'Seller manufactures valves.',metadata:{sourceURL:'https://seller.example/about',url:'https://seller.example/about'}}});
 try{const response=await handleServiceIntegrationRoute(sourceRequest(),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.data.metadata.sourceURL,'https://seller.example/about');assert.equal(body.data.metadata.source,'firecrawl');assert.deepEqual(body.researchTrace,[{provider:'firecrawl',operation:'extract',status:'succeeded',results:1}]);}finally{globalThis.fetch=old;}
});

test('Profile public search retains a receipt for an executed empty search',async()=>{
 const {env}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({success:true,data:{web:[]}});
 try{const response=await handleServiceIntegrationRoute(sourceRequest('search'),env),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.data,[]);assert.deepEqual(body.researchTrace,[{provider:'firecrawl',operation:'search',status:'succeeded',results:0}]);}finally{globalThis.fetch=old;}
});

test('Profile direct fallback retains the failed provider and the final redirected public source',async()=>{
 const {env,DB}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async url=>{if(String(url).includes('api.firecrawl.dev'))return Response.json({error:'Unavailable'},{status:503});if(String(url)==='https://seller.example/')return new Response(null,{status:302,headers:{Location:'https://seller.example/about'}});return new Response('<title>Seller</title><p>Seller manufactures industrial valves for public waterworks.</p>',{headers:{'Content-Type':'text/html'}});};
 try{const req=sourceRequest();req.headers.set('X-LeadIntel-Operation-Id','profile-fallback-op-1234');const response=await handleServiceIntegrationRoute(req,env),body=await response.json();assert.equal(response.status,200);assert.equal(body.data.metadata.sourceURL,'https://seller.example/about');assert.equal(body.data.metadata.source,'direct-fallback');assert.deepEqual(body.researchTrace,[{provider:'firecrawl',operation:'extract',status:'failed',results:0,httpStatus:503},{provider:'direct',operation:'extract',status:'succeeded',results:1}]);assert.equal(response.headers.get('X-LeadIntel-Operation-Id'),'profile-fallback-op-1234');const metadata=JSON.parse(DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='service.firecrawl_scrape' ORDER BY rowid DESC LIMIT 1").get().metadata_json);assert.equal(metadata.operation_id,'profile-fallback-op-1234');}finally{globalThis.fetch=old;}
});

for(const kind of ['scrape','search'])test('Profile '+kind+' withholds late source evidence after session revocation',async()=>{
 const {env,DB}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>{DB.raw.exec("DELETE FROM sessions WHERE user_id='storage-owner'");return Response.json({success:true,data:kind==='search'?{web:[{url:'https://seller.example/',title:'Private research'}]}:{markdown:'Private research'}});};
 try{const response=await handleServiceIntegrationRoute(sourceRequest(kind),env);assert.equal(response.status,401);assert.doesNotMatch(await response.text(),/Private research/);}finally{globalThis.fetch=old;}
});

test('Profile search treats provider-declared failure as unavailable and redacts upstream errors',async()=>{
 const {env}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({success:false,error:'private-firecrawl-key rejected https://private-account.example'});
 try{const response=await handleServiceIntegrationRoute(sourceRequest('search'),env);assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-firecrawl-key|private-account/);}finally{globalThis.fetch=old;}
});

test('Profile source acquisition rejects IPv4-mapped private IPv6 URLs before any provider call',async()=>{
 const {env}=await firecrawlFixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({success:true,data:{markdown:'Must not read private network content.'}});};
 try{for(const url of ['http://[::ffff:127.0.0.1]/','http://[::ffff:192.168.1.1]/','http://[::ffff:169.254.169.254]/','http://[::ffff:a00:1]/']){const response=await handleServiceIntegrationRoute(sourceRequest('scrape',{url}),env);assert.equal(response.status,400,url);}assert.equal(calls,0);}finally{globalThis.fetch=old;}
});

for(const kind of ['cancel','revoke'])test('Profile web search withholds a completed primary result after '+kind,async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch,controller=new AbortController();
 globalThis.fetch=async()=>{
  if(kind==='cancel')controller.abort();else DB.raw.exec("DELETE FROM sessions WHERE user_id='storage-owner'");
  return Response.json({output_text:JSON.stringify({results:[{url:'https://seller.example/news',title:'Private research',description:'A project',date:''}]}),output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://seller.example/news',title:'Private research'}]}}]});
 };
 const req=new Request('https://api.test/api/ai/web-search?workspace_id=storage-w1',{method:'POST',signal:controller.signal,headers:{Cookie:'leadintel_session=profile-token','Content-Type':'application/json'},body:JSON.stringify({query:'Seller valve manufacturer'})});
 try{const response=await handleAiRoute(req,env);assert.equal(response.status,kind==='cancel'?499:401);assert.doesNotMatch(await response.text(),/Private research/);}finally{globalThis.fetch=old;}
});

test('Profile synthesis correlates only bounded validated operation IDs between its response and audit',async()=>{
 const {env,DB}=await fixture(),old=globalThis.fetch;globalThis.fetch=async()=>generated();
 try{for(const value of ['profile-synthesis-op-1234','short','x'.repeat(81),'private payload/with spaces']){
  const req=request();req.headers.set('X-LeadIntel-Operation-Id',value);
  const response=await handleAiRoute(req,env),operationId=response.headers.get('X-LeadIntel-Operation-Id');
  assert.equal(response.status,200);assert.match(operationId,/^[A-Za-z0-9._:-]{8,80}$/);if(value==='profile-synthesis-op-1234')assert.equal(operationId,value);else assert.notEqual(operationId,value);
  const row=DB.raw.prepare("SELECT workspace_id,user_id,metadata_json FROM audit_events WHERE event_type='ai.generation_completed' ORDER BY rowid DESC LIMIT 1").get();
  assert.equal(row.workspace_id,'storage-w1');assert.equal(row.user_id,'storage-owner');assert.equal(JSON.parse(row.metadata_json).operation_id,operationId);assert.doesNotMatch(row.metadata_json,/private-profile-key|Seller manufactures|seller\.example|private payload/);
 }}finally{globalThis.fetch=old;}
});

for(const kind of ['scrape','search'])test('Profile '+kind+' correlates only bounded validated operation IDs in its source audit',async()=>{
 const {env,DB}=await firecrawlFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({success:true,data:kind==='search'?{web:[]}:{markdown:'Seller manufactures valves.',metadata:{sourceURL:'https://seller.example/'}}});
 try{for(const value of ['profile-source-op-1234','short','x'.repeat(81),'private payload/with spaces']){
  const req=sourceRequest(kind);req.headers.set('X-LeadIntel-Operation-Id',value);
  const response=await handleServiceIntegrationRoute(req,env),operationId=response.headers.get('X-LeadIntel-Operation-Id');
  assert.equal(response.status,200);assert.match(operationId,/^[A-Za-z0-9._:-]{8,80}$/);if(value==='profile-source-op-1234')assert.equal(operationId,value);else assert.notEqual(operationId,value);
  const row=DB.raw.prepare('SELECT workspace_id,user_id,metadata_json FROM audit_events WHERE event_type=? ORDER BY rowid DESC LIMIT 1').get('service.firecrawl_'+kind);
  assert.equal(row.workspace_id,'storage-w1');assert.equal(row.user_id,'storage-owner');assert.equal(JSON.parse(row.metadata_json).operation_id,operationId);assert.doesNotMatch(row.metadata_json,/private-firecrawl-key|Seller manufactures|seller\.example|private payload/);
 }}finally{globalThis.fetch=old;}
});
