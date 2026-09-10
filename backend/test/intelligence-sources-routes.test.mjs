import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleIntelligenceSourceRoute} from '../src/intelligence-sources.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));INSERT INTO workspaces VALUES('w1');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0017_intelligence_sources.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){for(const row of rows)await row.run();}}
async function fixture(role='owner'){const db=new DB(),token='source-token',hash=await sha256(token);db.raw.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u1','owner@example.com','Owner',role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);return {env:{DB:db},token,db};}
function req(path,{method='GET',token='',body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}

sqliteTest('owner can register and update a workspace source without raw credentials',async()=>{
  const {env,token}=await fixture();
  let response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{method:'POST',token,body:{name:'Firmas',url:'https://firmas.lv/',auth_mode:'google',password:'never-store-me',frequency:'daily'}}),env,{});
  assert.equal(response.status,201);let result=await response.json();assert.equal(result.source.name,'Firmas');assert.equal(result.source.authMode,'google');assert.equal('password' in result.source,false);
  response=await handleIntelligenceSourceRoute(req(`/api/intelligence-sources/${result.source.id}?workspace_id=w1`,{method:'PATCH',token,body:{monitoring_enabled:true,mandatory:true,trigger_ids:['growth']}}),env,{});
  result=await response.json();assert.equal(result.source.monitoringEnabled,true);assert.equal(result.source.mandatory,false,'not-tested sources cannot become mandatory');
});

sqliteTest('authenticated access cannot be promoted by frontend input without a sanctioned connector',async()=>{
  const {env,token}=await fixture();
  let response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{method:'POST',token,body:{name:'Firmas',url:'https://firmas.lv/',auth_mode:'google'}}),env,{});
  let result=await response.json();
  assert.equal(result.source.authenticatedAccessStatus,'not_connected');
  response=await handleIntelligenceSourceRoute(req(`/api/intelligence-sources/${result.source.id}?workspace_id=w1`,{method:'PATCH',token,body:{authenticated_access_status:'full'}}),env,{});
  result=await response.json();
  assert.equal(result.source.authenticatedAccessStatus,'not_connected','client input must never claim authenticated access');
});

sqliteTest('researcher can write, viewer cannot write, and reads are workspace scoped',async()=>{
  const researcher=await fixture('researcher');let response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{method:'POST',token:researcher.token,body:{url:'https://example.com'}}),researcher.env,{});assert.equal(response.status,201);
  const viewer=await fixture('viewer');response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{method:'POST',token:viewer.token,body:{url:'https://example.com'}}),viewer.env,{});assert.equal(response.status,403);
  response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{token:viewer.token}),viewer.env,{});assert.equal(response.status,200);
});

sqliteTest('public audit stores real provider result and permits mandatory status after useful access',async()=>{
  const {env,token,db}=await fixture();
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:{markdown:'Company registry annual report revenue directors employees legal address contacts '+('verified public company information '.repeat(80)),metadata:{title:'Registry'}}}),{status:200,headers:{'Content-Type':'application/json'}});
  try{
    let response=await handleIntelligenceSourceRoute(req('/api/intelligence-sources?workspace_id=w1',{method:'POST',token,body:{name:'Registry',url:'https://registry.example/'}}),env,{});let source=(await response.json()).source;
    response=await handleIntelligenceSourceRoute(req(`/api/intelligence-sources/${source.id}/audit?workspace_id=w1`,{method:'POST',token}),env,{});let result=await response.json();assert.equal(result.audit.accessStatus,'full');assert.ok(result.audit.extractableFields.includes('financials'));
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM intelligence_source_audits').get().n,1);
    response=await handleIntelligenceSourceRoute(req(`/api/intelligence-sources/${source.id}?workspace_id=w1`,{method:'PATCH',token,body:{mandatory:true,monitoring_enabled:true,trigger_ids:['growth']}}),env,{});result=await response.json();assert.equal(result.source.mandatory,true);
  } finally {globalThis.fetch=original;}
});
