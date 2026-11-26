import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleServiceIntegrationRoute,verifyPerplexity} from '../src/service-integrations.js';
import {sha256} from '../src/security.js';

// Perplexity joins as a customer-owned research provider (owner decision, 26 Nov 2026): every workspace connects its
// own key, checked at no cost. Perplexity answers 400 invalid_request to an empty query when the key is valid and 401
// invalid_api_key when it is not (probe 26 Nov 2026); invalid requests are not billed.
const read=file=>fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8');
const INTEGRATION_CHAIN=['0013_workspace_service_integrations.sql','0023_hunter_service_integration.sql','0046_treg_workspace_credentials.sql'];
const insert=(db,provider)=>db.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w',?,'c','h')").run(provider);

test('Perplexity migration keeps every saved credential and the workspace index, then accepts perplexity keys only',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY);INSERT INTO workspaces VALUES('w');");
 for(const file of INTEGRATION_CHAIN)db.exec(read(file));
 for(const provider of ['apollo','firecrawl','hunter','treg'])db.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,last_used_at) VALUES('w',?,?,?,?,'2026-11-26 10:00:00')").run(provider,'cipher-'+provider,'hint-'+provider,JSON.stringify({provider}));
 const before=db.prepare('SELECT * FROM workspace_service_integrations ORDER BY provider').all();
 assert.throws(()=>insert(db,'perplexity'),/CHECK constraint failed/);
 db.exec(read('0083_perplexity_service_integration.sql'));
 assert.deepEqual(db.prepare('SELECT * FROM workspace_service_integrations ORDER BY provider').all(),before);
 insert(db,'perplexity');
 assert.throws(()=>insert(db,'unknown'),/CHECK constraint failed/);
 assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='workspace_service_integrations_workspace_idx'").get());
 db.close();
});

const reply=(status,body)=>{const calls=[];const fetchImpl=async(url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});};return {calls,fetchImpl};};

test('a Perplexity key is checked with an empty query that Perplexity refuses before any search is billed',async()=>{
 const {calls,fetchImpl}=reply(400,{error:{message:'query validation: query is required',type:'invalid_request',code:400}});
 const result=await verifyPerplexity('pplx-customer-key',{fetchImpl});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.perplexity.ai/search');
 assert.equal(calls[0].init.method,'POST');
 assert.equal(calls[0].init.headers.Authorization,'Bearer pplx-customer-key');
 assert.deepEqual(JSON.parse(calls[0].init.body),{query:[]});
 assert.equal(result.search_api,'available');
 assert.equal(result.check,'no_credit_validation');
 assert.equal((await verifyPerplexity('pplx-customer-key',{fetchImpl:reply(200,{results:[]}).fetchImpl})).search_api,'available');
});

test('a rejected, unpaid, rate-limited or failing Perplexity check never reads as connected',async()=>{
 for(const [status,pattern] of [[401,/Perplexity rejected this API key/],[403,/Perplexity rejected this API key/],[402,/Perplexity credits exhausted or payment required/],[429,/Perplexity rate limit/],[500,/Perplexity connection check failed \(500\)/]]){
  await assert.rejects(verifyPerplexity('pplx-customer-key',{fetchImpl:reply(status,{error:{code:status}}).fetchImpl}),error=>pattern.test(error.message)&&error.httpStatus===status,String(status));
 }
});

class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...a){this.args=a;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');for(const file of ['0001_initial.sql','0009_customer_saas.sql',...INTEGRATION_CHAIN,'0083_perplexity_service_integration.sql'])this.raw.exec(read(file));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){return Promise.all(rows.map(s=>s.run()));}}
async function fixture(){
 const db=new DB();
 db.raw.exec("INSERT INTO users(id,email,display_name) VALUES('u1','owner@example.com','Owner');INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','First','DK','u1');INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('w1','u1','owner');");
 db.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'u1',datetime('now','+1 day'))").run(await sha256('token'));
 return {DB:db,OAUTH_TOKEN_ENCRYPTION_KEY:btoa('k'.repeat(32))};
}
const request=(method,path,body)=>new Request(`https://api.test/api/integrations/services/${path}?workspace_id=w1`,{method,headers:{Cookie:'leadintel_session=token','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function withFetch(stub,run){const original=globalThis.fetch;globalThis.fetch=stub;try{return await run();}finally{globalThis.fetch=original;}}

test('an owner connects a Perplexity key: checked for free, stored encrypted and listed as the customer connection',async()=>{
 const env=await fixture();const calls=[];
 const saved=await withFetch(async(url,init)=>{calls.push([String(url),init?.body]);return new Response(JSON.stringify({error:{type:'invalid_request',code:400}}),{status:400});},()=>handleServiceIntegrationRoute(request('PUT','provider',{provider:'perplexity',api_key:'pplx-customer-key-123'}),env,{}));
 assert.equal(saved.status,200,await saved.clone().text());
 assert.deepEqual(calls,[['https://api.perplexity.ai/search','{"query":[]}']]);
 const row=env.DB.raw.prepare("SELECT encrypted_api_key FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='perplexity'").get();
 assert.ok(row);assert.ok(!row.encrypted_api_key.includes('pplx-customer-key-123'));
 const status=await handleServiceIntegrationRoute(request('GET','status'),env,{});
 const perplexity=(await status.json()).providers.find(p=>p.provider==='perplexity');
 assert.equal(perplexity.name,'Perplexity');assert.equal(perplexity.configured,true);assert.equal(perplexity.source,'customer');
});

test('a Perplexity key that Perplexity rejects is not saved and is never sent to another provider',async()=>{
 const env=await fixture();const calls=[];
 const response=await withFetch(async url=>{calls.push(String(url));return new Response(JSON.stringify({error:{type:'invalid_api_key',code:401}}),{status:401});},()=>handleServiceIntegrationRoute(request('PUT','provider',{provider:'perplexity',api_key:'pplx-bad-key-123'}),env,{}));
 assert.notEqual(response.status,200);
 assert.deepEqual(calls,['https://api.perplexity.ai/search']);
 assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM workspace_service_integrations WHERE provider='perplexity'").get().n,0);
});
