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
    this.raw.exec(fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0022_crm_public_contact_sources.sql',import.meta.url),'utf8'));
    this.raw.exec(fs.readFileSync(migrationPath,'utf8'));
    this.raw.exec("CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,metadata_json TEXT,key_hint TEXT,verified_at TEXT,last_used_at TEXT,status TEXT,PRIMARY KEY(workspace_id,provider)); INSERT INTO workspace_service_integrations VALUES('w1','apollo','fixture','{\"discovery_enabled\":true,\"email_enrichment_enabled\":true,\"phone_enrichment_enabled\":true}',NULL,NULL,NULL,'connected');");
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

sqliteTest('uncertain email dispatch retains its credit reservation and prevents another paid attempt',async()=>{
 const {env,token}=await fixture();env.DB.raw.exec("UPDATE enrichment_policies SET daily_credit_limit=1,monthly_credit_limit=1");
 const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('transport interrupted after submission');};
 try{
  const url=`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,body={person_id:'apollo-p1',name:'Anna Andersson'};
  await handleCrmRoute(req(url,{method:'POST',token,body}),env,{});
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_reserved,1);assert.equal(ledger.status,'cancelled');assert.equal(JSON.parse(ledger.response_summary_json).needs_review,1);
  const second=await handleCrmRoute(req(url,{method:'POST',token,body:{...body,person_id:'apollo-other'}}),env,{});assert.equal(second.status,429);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('revoking a CRM session during paid dispatch preserves charge evidence and blocks contact writes',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>{env.DB.raw.exec('DELETE FROM sessions');return Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});};
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,401);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_used,1);assert.equal(ledger.credits_reserved,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('unreadable successful Apollo response cannot become completed no-result evidence',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('bad-json');
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,502);const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_reserved,1);assert.equal(JSON.parse(ledger.response_summary_json).budget_retained,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('membership revoked between final guard and contact INSERT cannot commit a paid contact',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const batch=env.DB.batch.bind(env.DB);let revoked=false;env.DB.batch=async statements=>{if(!revoked&&statements.some(s=>/INSERT(?: OR IGNORE)? INTO crm_contacts/i.test(s.sql))){revoked=true;env.DB.raw.exec('DELETE FROM workspace_members');}return batch(statements);};
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(revoked,true);assert.equal(response.status,403);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_used,1);assert.equal(ledger.credits_reserved,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('Apollo connection replacement after dispatch retains charge evidence and stops CRM writes',async()=>{
 const {env,token}=await fixture();env.APOLLO_CREDENTIAL_REVISION='fixture';const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>{env.DB.raw.exec("UPDATE workspace_service_integrations SET encrypted_api_key='replacement'");return Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});};
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,409);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_used,1);assert.equal(ledger.credits_reserved,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('archiving a company during paid dispatch preserves charges without saving a contact',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>{env.DB.raw.prepare("UPDATE crm_companies SET lifecycle_status='archived' WHERE id=?").run(company.id);return Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});};
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,409);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_used,1);assert.equal(ledger.credits_reserved,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('uncertain email lookup cannot be purchased twice while other budget remains available',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('transport interrupted after submission');};
 try{
  const url=`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,body={person_id:'apollo-p1',name:'Anna Andersson'};
  await handleCrmRoute(req(url,{method:'POST',token,body}),env,{});const second=await handleCrmRoute(req(url,{method:'POST',token,body}),env,{});
  assert.equal(calls,1);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_enrichment_requests').get().n,1);assert.equal(second.status,202);assert.equal((await payload(second)).reason,'apollo_outcome_unknown');
 }finally{globalThis.fetch=original;}
});

sqliteTest('Apollo display name cannot hide conflicting returned name components',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({person:{id:'apollo-p1',name:'Anna Andersson',first_name:'Someone',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,502);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);assert.equal(env.DB.raw.prepare('SELECT credits_used FROM crm_enrichment_requests').get().credits_used,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('Apollo company email cannot hide a conflicting returned employer domain',async()=>{
 const {env,token}=await fixture();const company=(await payload(await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{}))).company;
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'different.example'}}});
 try{
  const response=await handleCrmRoute(req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson'}}),env,{});
  assert.equal(response.status,502);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);assert.equal(env.DB.raw.prepare('SELECT credits_used FROM crm_enrichment_requests').get().credits_used,1);
 }finally{globalThis.fetch=original;}
});

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

async function phoneFixture(){
 const f=await fixture('owner',{APOLLO_WEBHOOK_URL:'https://api.example.test/api/webhooks/apollo/crm-contact',APOLLO_WEBHOOK_SECRET:'fixture-secret'});
 f.company=(await (await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token:f.token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),f.env,{})).json()).company;
 f.request=(person='fixture-person')=>req(`/api/crm/companies/${f.company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token:f.token,body:{person_id:person,name:'Alex Buyer',title:'Procurement Director',phone_lookup:true}});return f;
}
const apolloPerson=()=>({request_id:'fixture-request',person:{id:'fixture-person',name:'Alex Buyer',title:'Procurement Director',email:'alex@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});
const phoneCallback=(phones=true)=>({status:'success',credits_consumed:phones?8:0,people:[{id:'fixture-person',phone_numbers:phones?[{sanitized_number:'+12025550142',status_cd:'valid_number',type_cd:'work_direct'}]:[]}]});
const callbackRequest=(url,body)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

sqliteTest('concurrent phone lookups atomically reserve once and call the paid endpoint once',async()=>{
 const f=await phoneFixture();let calls=0,release,started;const dispatched=new Promise(r=>started=r);const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;await new Promise(r=>{release=r;started();});return Response.json(apolloPerson());};
 try{const first=handleCrmRoute(f.request(),f.env,{}),second=handleCrmRoute(f.request(),f.env,{});await dispatched;assert.equal(calls,1);release();const p=await Promise.all((await Promise.all([first,second])).map(r=>r.json()));assert.equal(p.filter(r=>r.duplicate).length,1);assert.equal(f.env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_enrichment_requests').get().n,1);}finally{globalThis.fetch=original;}
});

sqliteTest('early and concurrent callbacks preserve phone and actual credits exactly once',async()=>{
 const f=await phoneFixture();const original=globalThis.fetch;let callbackUrl;
 globalThis.fetch=async url=>{callbackUrl=new URL(url).searchParams.get('webhook_url');const results=await Promise.all([1,2].map(()=>CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{})));assert.ok(results.every(r=>r.status===200));return Response.json(apolloPerson());};
 try{const p=await (await handleCrmRoute(f.request(),f.env,{})).json();assert.equal(p.contact.phone_number,'+12025550142');assert.equal(p.contact.phone_status,'Verified');assert.equal(p.request.status,'verified');assert.equal(p.request.credits_used,9);assert.equal(f.env.DB.raw.prepare("SELECT COUNT(*) n FROM crm_activities WHERE activity_type='contact.phone_enriched'").get().n,1);assert.equal((await (await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{})).json()).duplicate,true);}finally{globalThis.fetch=original;}
});

sqliteTest('no-number callback is terminal without downgrading email and repeat lookup respects cooldown',async()=>{
 const f=await phoneFixture();let calls=0,callbackUrl;const original=globalThis.fetch;globalThis.fetch=async url=>{calls++;callbackUrl=new URL(url).searchParams.get('webhook_url');return Response.json(apolloPerson());};
 try{await handleCrmRoute(f.request(),f.env,{});const callback=await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback(false)),f.env,{});assert.equal(callback.status,200);assert.equal((await callback.json()).request.status,'not_found');assert.equal((await (await handleCrmRoute(f.request(),f.env,{})).json()).duplicate,true);assert.equal(calls,1);const c=f.env.DB.raw.prepare('SELECT * FROM crm_contacts').get();assert.equal(c.phone_status,'Not found');assert.equal(c.email_status,'Verified');}finally{globalThis.fetch=original;}
});

sqliteTest('uncertain dispatch timeout retains reservation and blocks another paid attempt',async()=>{
 const f=await phoneFixture();let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('connection lost after dispatch');};
 try{const r=await handleCrmRoute(f.request(),f.env,{});assert.equal(r.status,202);assert.equal((await r.json()).reason,'apollo_outcome_unknown');assert.equal((await (await handleCrmRoute(f.request(),f.env,{})).json()).duplicate,true);assert.equal(calls,1);assert.equal(f.env.DB.raw.prepare('SELECT credits_reserved FROM crm_enrichment_requests').get().credits_reserved,9);}finally{globalThis.fetch=original;}
});

sqliteTest('distinct concurrent phone requests cannot overbook the workspace budget',async()=>{
 const f=await phoneFixture();f.env.DB.raw.exec("UPDATE enrichment_policies SET daily_credit_limit=9 WHERE workspace_id='w1'");let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;return Response.json(apolloPerson());};
 try{const results=await Promise.all([handleCrmRoute(f.request(),f.env,{}),handleCrmRoute(f.request('other-person'),f.env,{})]);assert.equal(calls,1);assert.equal(results.filter(r=>r.status===429).length,1);}finally{globalThis.fetch=original;}
});

sqliteTest('callback identity mismatch cannot settle another person or mutate a contact',async()=>{
 const f=await phoneFixture();let callbackUrl;const original=globalThis.fetch;globalThis.fetch=async url=>{callbackUrl=new URL(url).searchParams.get('webhook_url');return Response.json(apolloPerson());};
 try{await handleCrmRoute(f.request(),f.env,{});const body=phoneCallback();body.people[0].id='wrong-person';const r=await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,body),f.env,{});assert.equal(r.status,422);assert.equal(f.env.DB.raw.prepare('SELECT status FROM crm_enrichment_requests').get().status,'pending_phone');}finally{globalThis.fetch=original;}
});

sqliteTest('callback inbox survives a projection failure and CRM refresh repairs it without a second lookup',async()=>{
 const f=await phoneFixture();let callbackUrl,calls=0;const original=globalThis.fetch;globalThis.fetch=async url=>{calls++;callbackUrl=new URL(url).searchParams.get('webhook_url');return Response.json(apolloPerson());};
 try{await handleCrmRoute(f.request(),f.env,{});const prepare=f.env.DB.prepare.bind(f.env.DB);let failed=false;f.env.DB.prepare=sql=>{if(!failed&&sql.includes('UPDATE crm_contacts SET phone_number=CASE')){failed=true;throw Error('simulated write interruption');}return prepare(sql);};
 await assert.rejects(CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{}),/simulated/);f.env.DB.prepare=prepare;
 const saved=f.env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(saved.credits_used,9);assert.ok(saved.webhook_received_at);
 const refresh=await handleCrmRoute(req(`/api/crm/companies/${f.company.id}?workspace_id=w1`,{token:f.token}),f.env,{}),detail=await refresh.json();assert.equal(refresh.status,200);assert.equal(detail.contacts[0].phone_number,'+12025550142');assert.equal(detail.phoneRequests[0].status,'verified');assert.equal(calls,1);
 const retry=await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{});assert.equal((await retry.json()).duplicate,true);assert.equal(f.env.DB.raw.prepare('SELECT credits_used FROM crm_enrichment_requests').get().credits_used,9);
 }finally{globalThis.fetch=original;}
});

sqliteTest('an interim callback cannot turn unfinished phone research into not found',async()=>{
 const f=await phoneFixture();let callbackUrl;const original=globalThis.fetch;globalThis.fetch=async url=>{callbackUrl=new URL(url).searchParams.get('webhook_url');return Response.json(apolloPerson());};
 try{await handleCrmRoute(f.request(),f.env,{});const partial={...phoneCallback(false),status:'processing'};assert.equal((await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,partial),f.env,{})).status,202);assert.equal(f.env.DB.raw.prepare('SELECT webhook_received_at FROM crm_enrichment_requests').get().webhook_received_at,null);assert.equal((await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{})).status,200);}finally{globalThis.fetch=original;}
});

sqliteTest('an early callback for another Apollo person cannot write their phone or email onto the selected buyer',async()=>{
 const f=await phoneFixture(),{upsertCrmContacts}=await import('../src/crm.js');const target=(await upsertCrmContacts(f.env.DB,{workspaceId:'w1',userId:'u1',role:'owner'},f.company.id,[{name:'Alice Buyer',external_person_id:'public-alice',source:'public',work_email:'alice@acme.example',email_status:'verified'}]))[0];
 const original=globalThis.fetch;globalThis.fetch=async url=>{const callbackUrl=new URL(url).searchParams.get('webhook_url');const response=await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{});assert.equal(response.status,200);assert.equal(f.env.DB.raw.prepare('SELECT phone_number FROM crm_contacts WHERE id=?').get(target.id).phone_number,null);return Response.json(apolloPerson());};
 try{const response=await handleCrmRoute(req(`/api/crm/companies/${f.company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token:f.token,body:{person_id:'fixture-person',contact_id:target.id,name:'Alice Buyer',phone_lookup:true}}),f.env,{});assert.equal(response.status,202);const saved=f.env.DB.raw.prepare('SELECT * FROM crm_contacts WHERE id=?').get(target.id);assert.equal(saved.normalized_email,'alice@acme.example');assert.equal(saved.phone_number,null);assert.equal(f.env.DB.raw.prepare('SELECT status FROM crm_enrichment_requests').get().status,'pending_phone');}finally{globalThis.fetch=original;}
});

sqliteTest('duplicate callbacks preserve a later customer phone correction',async()=>{
 const f=await phoneFixture();let callbackUrl;const original=globalThis.fetch;globalThis.fetch=async url=>{callbackUrl=new URL(url).searchParams.get('webhook_url');return Response.json(apolloPerson());};
 try{await handleCrmRoute(f.request(),f.env,{});await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{});f.env.DB.raw.exec("UPDATE crm_contacts SET phone_number='+12025550199',phone_status='Manual',verification_provider='Manual',updated_at='2099-01-01'");await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{});const contact=f.env.DB.raw.prepare('SELECT * FROM crm_contacts').get();assert.equal(contact.phone_number,'+12025550199');assert.equal(contact.phone_status,'Manual');assert.equal(contact.updated_at,'2099-01-01');}finally{globalThis.fetch=original;}
});

sqliteTest('a partial response without exact provider identity cannot overwrite the selected contact',async()=>{
 const f=await phoneFixture(),{upsertCrmContacts}=await import('../src/crm.js');const target=(await upsertCrmContacts(f.env.DB,{workspaceId:'w1',userId:'u1',role:'owner'},f.company.id,[{name:'Alice Buyer',external_person_id:'public-alice',source:'public',work_email:'alice@acme.example',email_status:'verified'}]))[0];
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({person:{name:'Bob Buyer',email:'bob@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});
 try{await handleCrmRoute(req(`/api/crm/companies/${f.company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token:f.token,body:{person_id:'fixture-person',contact_id:target.id,name:'Alice Buyer',phone_lookup:true}}),f.env,{});const saved=f.env.DB.raw.prepare('SELECT * FROM crm_contacts WHERE id=?').get(target.id);assert.equal(saved.normalized_email,'alice@acme.example');assert.equal(saved.verification_provider,null);assert.equal(saved.phone_number,null);}finally{globalThis.fetch=original;}
});

sqliteTest('phone-only Apollo results preserve the existing email verifier and verification date',async()=>{
 const f=await phoneFixture(),{upsertCrmContacts}=await import('../src/crm.js');const target=(await upsertCrmContacts(f.env.DB,{workspaceId:'w1',userId:'u1',role:'owner'},f.company.id,[{name:'Alex Buyer',external_person_id:'public-alex',source:'treg',work_email:'alex@acme.example',email_status:'verified'}]))[0];f.env.DB.raw.prepare("UPDATE crm_contacts SET verification_provider='Treg',verified_at='2026-10-01T10:00:00Z' WHERE id=?").run(target.id);
 let callbackUrl;const original=globalThis.fetch;globalThis.fetch=async url=>{callbackUrl=new URL(url).searchParams.get('webhook_url');const data=apolloPerson();delete data.person.email;delete data.person.email_status;return Response.json(data);};
 try{await handleCrmRoute(req(`/api/crm/companies/${f.company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token:f.token,body:{person_id:'fixture-person',contact_id:target.id,name:'Alex Buyer',phone_lookup:true}}),f.env,{});await CrmRoutes.handleApolloCrmWebhook(callbackRequest(callbackUrl,phoneCallback()),f.env,{});const saved=f.env.DB.raw.prepare('SELECT * FROM crm_contacts WHERE id=?').get(target.id);assert.equal(saved.phone_status,'Verified');assert.equal(saved.verification_provider,'Treg');assert.equal(saved.verified_at,'2026-10-01T10:00:00Z');assert.equal(saved.normalized_email,'alex@acme.example');}finally{globalThis.fetch=original;}
});
sqliteTest('main phone OFF blocks legacy Apollo reveal without reserving credits or calling a provider',async()=>{
 const f=await phoneFixture();f.env.DB.raw.exec("CREATE TABLE additional_contact_policies(workspace_id TEXT,provider TEXT,phone_enabled INTEGER);INSERT INTO additional_contact_policies VALUES('w1','treg',0),('other','treg',1)");let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;return Response.json(apolloPerson());};
 try{const response=await handleCrmRoute(f.request(),f.env,{});assert.equal(response.status,409);assert.equal((await response.json()).code,'CRM_PHONE_LOOKUP_DISABLED');assert.equal(calls,0);assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);}finally{globalThis.fetch=original;}
});

sqliteTest('cancelled Apollo responses retain paid credit receipts without saving a late contact',async()=>{
 const {env,token}=await fixture(),controller=new AbortController();
 const company=(await (await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{})).json()).company;
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;controller.abort();return Response.json({person:{id:'apollo-p1',name:'Anna Andersson',email:'anna@acme.example',email_status:'verified',organization:{primary_domain:'acme.example'}}});};
 try{
  const source=req(`/api/crm/companies/${company.id}/enrich-contact?workspace_id=w1`,{method:'POST',token,body:{person_id:'apollo-p1',name:'Anna Andersson',title:'Procurement Director'}});
  const response=await handleCrmRoute(new Request(source,{signal:controller.signal}),env,{});assert.equal(response.status,499);assert.equal((await response.json()).code,'CRM_ENRICHMENT_CANCELLED');assert.equal(calls,1);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,0);
  const ledger=env.DB.raw.prepare('SELECT * FROM crm_enrichment_requests').get();assert.equal(ledger.credits_used,1);assert.equal(ledger.credits_reserved,1);assert.equal(ledger.status,'cancelled');
  const {apolloCreditUsage}=await import('../src/apollo-credit-policy.js');assert.equal((await apolloCreditUsage(env.DB,'w1')).daily,1);
 }finally{globalThis.fetch=original;}
});

sqliteTest('atomic Apollo reservations include submitted requests cancelled after dispatch',async()=>{
 const {env,token}=await fixture(),company=(await (await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{})).json()).company,now=new Date().toISOString();
 const values=['cancelled-paid','w1',company.id,null,'apollo','apollo-p1','Director','cancelled',0,0,1,1,'{"budget_retained":1}','u1',now,now];
 env.DB.raw.prepare('INSERT INTO crm_enrichment_requests(id,workspace_id,company_id,contact_id,provider,person_provider_id,role_requested,status,personal_email_requested,phone_requested,credits_reserved,credits_used,response_summary_json,requested_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values);
 const {reserveCrmEnrichment}=await import('../src/apollo-crm-reservation.js');
 const next=[...values];next[0]='next-paid';next[5]='apollo-p2';next[7]='processing';next[11]=0;
 const result=await reserveCrmEnrichment(env.DB,{values:next,workspaceId:'w1',companyId:company.id,personId:'apollo-p2',phone:false,reserved:1},{daily_credit_limit:1,monthly_credit_limit:1});assert.equal(result,null);
});
