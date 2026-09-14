import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
import {sha256} from '../src/security.js';
import {handleServiceIntegrationRoute,resolveWorkspaceServiceCredential,withWorkspaceServiceCredentials} from '../src/service-integrations.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const migration=fs.readFileSync(path.join(__dirname,'..','migrations','0013_workspace_service_integrations.sql'),'utf8');
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);

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
    this.raw.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
      CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
      CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
      INSERT INTO workspaces VALUES('w1','Workspace One');
    `);
    this.raw.exec(migration);
  }
  prepare(sql){return new D1Statement(this.raw,sql);}
}
async function fixture(role='owner'){
  const DB=new D1Db();const token=`service-${role}-session`;const tokenHash=await sha256(token);
  DB.raw.prepare(`INSERT INTO users VALUES(?,?,?,?)`).run('u1',`${role}@example.com`,role,role);
  DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(tokenHash,'u1');
  DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w1','u1',role);
  const encryption=Buffer.alloc(32,7).toString('base64');
  return {DB,token,env:{DB,OAUTH_TOKEN_ENCRYPTION_KEY:encryption,APOLLO_API_KEY:'managed-apollo-key',APOLLO_WEBHOOK_SECRET:'stable-webhook-secret',FIRECRAWL_PROXY_URL:'https://managed.example.test'}};
}
function req(pathname,{method='GET',token,body}={}){return new Request(`https://api.example.test${pathname}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{...{}}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function payload(response){return response.json();}

sqliteTest('owner save encrypts Apollo key, returns only a hint, and authenticated runtime receives the customer credential',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const seen=[];
  globalThis.fetch=async (url,options={})=>{seen.push({url:String(url),options});return new Response(JSON.stringify({healthy:true,is_logged_in:true}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'apollo',api_key:'apollo-customer-secret-ABCD'}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.source,'customer');assert.equal(result.key_hint,'••••ABCD');
    assert.equal(JSON.stringify(result).includes('apollo-customer-secret-ABCD'),false);
    assert.equal(seen.length,1);assert.equal(seen[0].options.headers['x-api-key'],'apollo-customer-secret-ABCD');
    const row=DB.raw.prepare(`SELECT * FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='apollo'`).get();
    assert.ok(row.encrypted_api_key);assert.equal(row.encrypted_api_key.includes('apollo-customer-secret-ABCD'),false);
    const resolved=await resolveWorkspaceServiceCredential(env,'w1','apollo');assert.equal(resolved.source,'customer');assert.equal(resolved.apiKey,'apollo-customer-secret-ABCD');
    const runtime=await withWorkspaceServiceCredentials(req('/api/crm/companies?workspace_id=w1',{token}),env);
    assert.equal(runtime.APOLLO_API_KEY,'apollo-customer-secret-ABCD');assert.equal(runtime.APOLLO_WEBHOOK_SECRET,'stable-webhook-secret');
    const anonymous=await withWorkspaceServiceCredentials(req('/api/crm/companies?workspace_id=w1'),env);assert.equal(anonymous,env);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('non-owner cannot replace workspace service credentials',async()=>{
  const {env,token}=await fixture('researcher');let fetchCalled=false;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{fetchCalled=true;return new Response('{}',{status:200});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'apollo',api_key:'should-not-be-used'}}),env,{});
    assert.equal(response.status,403);assert.equal(fetchCalled,false);assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM workspace_service_integrations`).get().count,0);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('customer Firecrawl key is verified, used for signed-in research, and records last use',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/v2/team/credit-usage'))return new Response(JSON.stringify({success:true,data:{remainingCredits:321,planCredits:500,billingPeriodEnd:'2026-10-01'}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).endsWith('/v2/search'))return new Response(JSON.stringify({success:true,data:{web:[{url:'https://example.com',title:'Example'}]}}),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error(`Unexpected fetch ${url}`);
  };
  try{
    let response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-customer-secret-WXYZ'}}),env,{});
    assert.equal(response.status,200);const saved=await payload(response);assert.equal(saved.metadata.remaining_credits,321);assert.equal(saved.key_hint,'••••WXYZ');
    response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian companies expanding offices',limit:4}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);assert.equal(result.data[0].url,'https://example.com');
    assert.equal(calls[1].url,'https://api.firecrawl.dev/v2/search');assert.equal(calls[1].options.headers.Authorization,'Bearer fc-customer-secret-WXYZ');
    const row=DB.raw.prepare(`SELECT last_used_at FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='firecrawl'`).get();assert.ok(row.last_used_at);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Firecrawl research falls back to managed proxy when customer key is absent',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({success:true,data:[{url:'https://fallback.example'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'expansion',limit:3}}),env,{});
    assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://managed.example.test/firecrawl-search');assert.equal(Boolean(calls[0].options.headers.Authorization),false);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('signed-in Company Discovery keeps its first search pass metadata-only',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({success:true,data:[{url:'https://fallback.example',title:'Fallback company',description:'Company description'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian companies expanding offices',limit:4}}),env,{});
    assert.equal(response.status,200);assert.equal(calls.length,1);
    assert.deepEqual(JSON.parse(calls[0].options.body),{query:'Latvian companies expanding offices',limit:4});
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('signed-in deeper research preserves explicitly requested Markdown extraction',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({success:true,data:[{url:'https://evidence.example',title:'Evidence'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian expansion evidence',limit:4,scrapeOptions:{formats:['markdown']}}}),env,{});
    assert.equal(response.status,200);assert.equal(calls.length,1);
    assert.deepEqual(JSON.parse(calls[0].options.body),{query:'Latvian expansion evidence',limit:4,scrapeOptions:{formats:['markdown']}});
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('website scrape survives a dead managed Firecrawl route by using a bounded direct public-page fallback',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    const target=String(url);calls.push({url:target,options});
    if(target==='https://managed.example.test/firecrawl-scrape')return new Response(JSON.stringify({error:'Route not found'}),{status:404,headers:{'Content-Type':'application/json'}});
    if(target==='https://www.ajprodukti.lv/')return new Response('<!doctype html><html><head><title>AJ Produkti</title><meta name="description" content="Workplace equipment"></head><body><h1>AJ Produkti</h1><p>Biroja mēbeles un darba vides aprīkojums.</p></body></html>',{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Content-Length':'208'}});
    throw new Error(`Unexpected fetch ${target}`);
  };
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://www.ajprodukti.lv',formats:['markdown'],onlyMainContent:true}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.success,true);assert.match(result.data.markdown,/AJ Produkti/);assert.match(result.data.markdown,/Biroja mēbeles/);
    assert.equal(result.data.metadata.title,'AJ Produkti');assert.equal(result.data.metadata.source,'direct-fallback');
    assert.deepEqual(calls.map(row=>row.url),['https://managed.example.test/firecrawl-scrape','https://www.ajprodukti.lv/']);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('direct website fallback refuses local or private-network targets',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({error:'Route not found'}),{status:404,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'http://127.0.0.1/admin',formats:['markdown']}}),env,{});
    assert.equal(response.status,400);const result=await payload(response);assert.match(result.error,/public research URL/i);
    assert.equal(calls.length,0,'private-network URL must be rejected before any outbound request');
  }finally{globalThis.fetch=originalFetch;}
});
