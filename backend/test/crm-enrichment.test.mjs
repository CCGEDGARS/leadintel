import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
import {sha256} from '../src/security.js';
import * as CrmRoutes from '../src/crm-routes.js';

const {handleCrmRoute}=CrmRoutes;
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const migrationPath=path.join(__dirname,'..','migrations','0012_crm_contact_enrichment.sql');

class D1Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes||0)}};}}
class D1Db{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));CREATE TABLE enrichment_policies(workspace_id TEXT PRIMARY KEY,minimum_score REAL NOT NULL DEFAULT 7,daily_credit_limit INTEGER NOT NULL DEFAULT 30,monthly_credit_limit INTEGER NOT NULL DEFAULT 300,retry_after_days INTEGER NOT NULL DEFAULT 30,allow_personal_email INTEGER NOT NULL DEFAULT 0,phone_lookup_mode TEXT NOT NULL DEFAULT 'on_request');`);
    this.raw.exec(fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8'));
    this.raw.exec(fs.readFileSync(migrationPath,'utf8'));
  }
  prepare(sql){return new D1Statement(this.raw,sql);}
  async batch(statements){const out=[];for(const s of statements)out.push(await s.run());return out;}
}
async function fixture(role='owner',extraEnv={}){
  const DB=new D1Db();const token='crm-enrichment-session';const hash=await sha256(token);
  DB.raw.prepare(`INSERT INTO users VALUES(?,?,?,?)`).run('u1','owner@example.com','Owner','owner');
  DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');
  DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w1','u1',role);
  DB.raw.prepare(`INSERT INTO enrichment_policies(workspace_id,daily_credit_limit,monthly_credit_limit,allow_personal_email,phone_lookup_mode) VALUES(?,?,?,?,?)`).run('w1',30,300,0,'on_request');
  return {env:{DB,APOLLO_API_KEY:'test-apollo-key',...extraEnv},token};
}
function req(pathname,{method='GET',token,body}={}){return new Request(`https://api.example.test${pathname}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{...{}}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function payload(response){return response.json();}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);

sqliteTest('CRM enrichment migration adds durable verification fields and request ledger',()=>{
  const db=new D1Db();
  const contactColumns=db.raw.prepare(`PRAGMA table_info(crm_contacts)`).all().map(row=>row.name);
  for(const field of ['phone_number','phone_status','email_type','match_confidence','verification_provider','verified_at'])assert.ok(contactColumns.includes(field),`${field} missing`);
  const tables=db.raw.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(row=>row.name);
  assert.ok(tables.includes('crm_enrichment_requests'));
  const requestColumns=db.raw.prepare(`PRAGMA table_info(crm_enrichment_requests)`).all().map(row=>row.name);
  for(const field of ['workspace_id','company_id','contact_id','person_provider_id','provider_request_id','status','credits_reserved','credits_used','phone_requested','response_summary_json','webhook_received_at'])assert.ok(requestColumns.includes(field),`${field} missing`);
});

sqliteTest('selected Apollo person is enriched directly into Master CRM without running a second people search',async()=>{
  const {env,token}=await fixture();
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example',source:'discovery'}}}),env,{});
  const company=(await payload(response)).company;
  const calls=[];const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({person:{id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director',email:'anna@acme.example',email_status:'verified',linkedin_url:'https://linkedin.example/anna',organization:{primary_domain:'acme.example'}}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director'}}),env,{});
  }finally{globalThis.fetch=originalFetch;}
  assert.equal(response.status,201);
  const result=await payload(response);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/\/api\/v1\/people\/match/);
  assert.doesNotMatch(calls[0].url,/mixed_people/);
  assert.equal(new URL(calls[0].url).searchParams.get('id'),'apollo-p1');
  assert.equal(new URL(calls[0].url).searchParams.get('reveal_phone_number'),'false');
  assert.equal(result.contact.work_email,'anna@acme.example');
  assert.equal(result.contact.email_status,'Verified');
  assert.equal(result.contact.verification_provider,'Apollo');
  assert.equal(result.request.status,'verified');
  assert.equal(result.request.credits_used,1);

  const detailResponse=await handleCrmRoute(req(`/api/crm/companies/${company.id}?workspace_id=w1`,{token}),env,{});
  const detail=await payload(detailResponse);
  assert.equal(detail.contacts.length,1);
  assert.equal(detail.contacts[0].external_person_id,'apollo-p1');
  assert.ok(detail.activities.some(activity=>activity.activity_type==='contact.enriched'));
  const ledger=env.DB.raw.prepare(`SELECT * FROM crm_enrichment_requests WHERE company_id=?`).all(company.id);
  assert.equal(ledger.length,1);
  assert.equal(ledger[0].status,'verified');
});

sqliteTest('phone enrichment is fail-closed when Apollo webhook delivery is not configured',async()=>{
  const {env,token}=await fixture();
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{});
  const company=(await payload(response)).company;
  let fetchCalled=false;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{fetchCalled=true;throw new Error('should not call Apollo');};
  try{
    response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',phone_lookup:true}}),env,{});
  }finally{globalThis.fetch=originalFetch;}
  assert.equal(response.status,409);
  assert.equal((await payload(response)).code,'CRM_APOLLO_WEBHOOK_REQUIRED');
  assert.equal(fetchCalled,false);
});

sqliteTest('phone enrichment sends Apollo a request-specific signed webhook URL and keeps the request pending',async()=>{
  const {env,token}=await fixture('owner',{APOLLO_WEBHOOK_URL:'https://api.example.test/api/webhooks/apollo/crm-contact',APOLLO_WEBHOOK_SECRET:'super-secret-webhook-key'});
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example',source:'discovery'}}}),env,{});
  const company=(await payload(response)).company;
  const calls=[];const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({request_id:'-9223372036854775001',person:{id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director',phone_lookup:true}}),env,{});
  }finally{globalThis.fetch=originalFetch;}
  assert.equal(response.status,201);
  const result=await payload(response);
  assert.equal(result.request.status,'pending_phone');
  assert.equal(result.request.credits_used,1);
  assert.equal(calls.length,1);
  const apolloUrl=new URL(calls[0].url);const webhook=new URL(apolloUrl.searchParams.get('webhook_url'));
  assert.equal(webhook.origin+webhook.pathname,'https://api.example.test/api/webhooks/apollo/crm-contact');
  assert.equal(webhook.searchParams.get('request_id'),result.request.id);
  assert.ok(webhook.searchParams.get('sig'));
  assert.notEqual(webhook.searchParams.get('sig'),env.APOLLO_WEBHOOK_SECRET);
  const row=env.DB.raw.prepare(`SELECT * FROM crm_enrichment_requests WHERE id=?`).get(result.request.id);
  assert.equal(row.provider_request_id,'-9223372036854775001');
  assert.equal(row.status,'pending_phone');
});

sqliteTest('Apollo phone webhook rejects an invalid signature without mutating CRM',async()=>{
  assert.equal(typeof CrmRoutes.handleApolloCrmWebhook,'function');
  if(typeof CrmRoutes.handleApolloCrmWebhook!=='function')return;
  const {env}=await fixture('owner',{APOLLO_WEBHOOK_SECRET:'super-secret-webhook-key'});
  const response=await CrmRoutes.handleApolloCrmWebhook(req('/api/webhooks/apollo/crm-contact?request_id=missing&sig=wrong',{method:'POST',body:{status:'success',credits_consumed:8,people:[]}}),env,{});
  assert.equal(response.status,403);
  assert.equal((await payload(response)).code,'CRM_APOLLO_WEBHOOK_INVALID');
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities`).get().count,0);
});

sqliteTest('valid Apollo phone webhook stores a verified phone once, adds actual phone credits, and is idempotent',async()=>{
  assert.equal(typeof CrmRoutes.handleApolloCrmWebhook,'function');
  if(typeof CrmRoutes.handleApolloCrmWebhook!=='function')return;
  const {env,token}=await fixture('owner',{APOLLO_WEBHOOK_URL:'https://api.example.test/api/webhooks/apollo/crm-contact',APOLLO_WEBHOOK_SECRET:'super-secret-webhook-key'});
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{});
  const company=(await payload(response)).company;
  let webhookUrl='';const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{const apolloUrl=new URL(String(url));webhookUrl=apolloUrl.searchParams.get('webhook_url');return new Response(JSON.stringify({request_id:'-77',person:{id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director',phone_lookup:true}}),env,{});
  }finally{globalThis.fetch=originalFetch;}
  const started=await payload(response);assert.ok(webhookUrl);
  const callbackBody={status:'success',total_requested_enrichments:1,unique_enriched_records:1,missing_records:0,credits_consumed:8,people:[{id:'apollo-p1',status:'success',phone_numbers:[{raw_number:'+1 202 555 0199',sanitized_number:'+12025550199',status_cd:'invalid_number',type_cd:'mobile'},{raw_number:'+1 202 555 0142',sanitized_number:'+12025550142',status_cd:'valid_number',type_cd:'work_direct'}]}]};
  const callbackRequest=new Request(webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(callbackBody)});
  response=await CrmRoutes.handleApolloCrmWebhook(callbackRequest,env,{});
  assert.equal(response.status,200);
  const first=await payload(response);assert.equal(first.ok,true);assert.equal(first.duplicate,false);
  const contact=env.DB.raw.prepare(`SELECT * FROM crm_contacts WHERE company_id=? AND external_person_id='apollo-p1'`).get(company.id);
  assert.equal(contact.phone_number,'+12025550142');
  assert.equal(contact.phone_status,'Verified');
  const row=env.DB.raw.prepare(`SELECT * FROM crm_enrichment_requests WHERE id=?`).get(started.request.id);
  assert.equal(row.status,'verified');
  assert.equal(Number(row.credits_used),9);
  assert.ok(row.webhook_received_at);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities WHERE company_id=? AND activity_type='contact.phone_enriched'`).get(company.id).count,1);

  const duplicateRequest=new Request(webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(callbackBody)});
  response=await CrmRoutes.handleApolloCrmWebhook(duplicateRequest,env,{});
  assert.equal(response.status,200);
  const duplicate=await payload(response);assert.equal(duplicate.duplicate,true);
  const rowAfter=env.DB.raw.prepare(`SELECT * FROM crm_enrichment_requests WHERE id=?`).get(started.request.id);
  assert.equal(Number(rowAfter.credits_used),9);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities WHERE company_id=? AND activity_type='contact.phone_enriched'`).get(company.id).count,1);
});
