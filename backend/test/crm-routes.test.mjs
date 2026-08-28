import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
import {sha256} from '../src/security.js';
import {handleCrmRoute} from '../src/crm-routes.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
class D1Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes||0)}};}}
class D1Db{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));`);this.raw.exec(fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8'));}prepare(sql){return new D1Statement(this.raw,sql);}async batch(statements){const out=[];for(const s of statements)out.push(await s.run());return out;}}
async function fixture(role='owner'){
  const DB=new D1Db();const token='test-session-token';const hash=await sha256(token);DB.raw.prepare(`INSERT INTO users VALUES(?,?,?,?)`).run('u1','owner@example.com','Owner','owner');DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w1','u1',role);return {env:{DB},token};
}
function req(path,{method='GET',token,body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{...{}}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function payload(response){return response.json();}

const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);

sqliteTest('CRM router returns null for unrelated routes and requires authentication for CRM routes',async()=>{
  const {env}=await fixture();
  assert.equal(await handleCrmRoute(req('/api/health'),env,{}),null);
  const response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1'),env,{});
  assert.equal(response.status,401);
});

sqliteTest('company API upserts, lists, reads and preserves record when removed from pipeline',async()=>{
  const {env,token}=await fixture();
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example',pipeline_stage:'Discovered',source:'discovery'},intelligence:{evidence:[{url:'https://acme.example'}]}}}),env,{});
  assert.equal(response.status,201);
  const created=await payload(response);const id=created.company.id;
  response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{token}),env,{});assert.equal(response.status,200);assert.equal((await payload(response)).companies.length,1);
  response=await handleCrmRoute(req(`/api/crm/companies/${id}/pipeline?workspace_id=w1`,{method:'DELETE',token}),env,{});assert.equal(response.status,200);
  response=await handleCrmRoute(req(`/api/crm/companies/${id}?workspace_id=w1`,{token}),env,{});const detail=await payload(response);assert.equal(detail.company.pipeline_stage,null);assert.equal(detail.company.company_name,'Acme');assert.ok(detail.activities.some(x=>x.activity_type==='pipeline.removed'));
});

sqliteTest('suppressed companies return stable conflict code and permanent delete is owner-only',async()=>{
  const owner=await fixture('owner');
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token:owner.token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),owner.env,{});const id=(await payload(response)).company.id;
  response=await handleCrmRoute(req(`/api/crm/companies/${id}/suppress?workspace_id=w1`,{method:'POST',token:owner.token}),owner.env,{});assert.equal(response.status,200);
  response=await handleCrmRoute(req(`/api/crm/companies/${id}/pipeline?workspace_id=w1`,{method:'POST',token:owner.token,body:{stage:'Discovered'}}),owner.env,{});assert.equal(response.status,409);assert.equal((await payload(response)).code,'CRM_COMPANY_SUPPRESSED');

  const sales=await fixture('sales');
  response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token:sales.token,body:{company:{company_name:'Beta',domain:'beta.example'}}}),sales.env,{});const salesId=(await payload(response)).company.id;
  response=await handleCrmRoute(req(`/api/crm/companies/${salesId}?workspace_id=w1`,{method:'DELETE',token:sales.token}),sales.env,{});assert.equal(response.status,403);
});

sqliteTest('CRM activity POST is idempotent and cross-workspace company ids do not leak',async()=>{
  const {env,token}=await fixture();
  let response=await handleCrmRoute(req('/api/crm/companies?workspace_id=w1',{method:'POST',token,body:{company:{company_name:'Acme',domain:'acme.example'}}}),env,{});const id=(await payload(response)).company.id;
  const activity={id:'content-approved-0001',type:'content.approved',summary:'Approved'};
  for(let i=0;i<2;i++){response=await handleCrmRoute(req(`/api/crm/companies/${id}/activities?workspace_id=w1`,{method:'POST',token,body:activity}),env,{});assert.equal(response.status,200);}
  response=await handleCrmRoute(req(`/api/crm/companies/${id}?workspace_id=w1`,{token}),env,{});assert.equal((await payload(response)).activities.filter(x=>x.id==='content-approved-0001').length,1);
  env.DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w2','u1','owner');
  response=await handleCrmRoute(req(`/api/crm/companies/${id}?workspace_id=w2`,{token}),env,{});assert.equal(response.status,404);
});

sqliteTest('production app delegates CRM routes before SaaS and core routers',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','src','app.js'),'utf8');
  assert.match(source,/import \{handleCrmRoute\} from ['"]\.\/crm-routes\.js['"]/);
  const crmIndex=source.indexOf('handleCrmRoute');
  const saasIndex=source.indexOf('handleSaasRoute(request');
  assert.ok(crmIndex>=0&&saasIndex>crmIndex);
});
