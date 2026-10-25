import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleCopilotRoute} from '../src/copilot-routes.js';

// B4 (CTO, 2026-10-25): the assistant reminds by itself — a cheap attention count for the launcher badge (open important
// checks + reminders due, no context build, no model) and a "since you were here" digest on bootstrap.
let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{
  constructor(){
    this.raw=new DatabaseSync(':memory:');this.queries=[];
    this.raw.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,market TEXT,owner_user_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
      CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);
      CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY,schema_version INTEGER DEFAULT 1,version INTEGER DEFAULT 1,payload_json TEXT NOT NULL,updated_by TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,model TEXT,active INTEGER,verified_at TEXT,last_used_at TEXT);
      INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','Acme','Latvia','u1'),('w2','Other','Estonia','u2');
      INSERT INTO users VALUES('u1','owner@example.com','Jonathan Collins','owner'),('u2','other@example.com','Other','owner');
      INSERT INTO workspace_members VALUES('w1','u1','owner'),('w2','u2','owner');
      INSERT INTO customer_workspace_state(workspace_id,payload_json,updated_at) VALUES('w1','{"main":{"website":"","targetMarkets":[],"profile":{"company":"Acme"},"market":{"icps":[],"signals":[]}}}','2026-10-25 20:40:00');`);
    this.raw.exec(fs.readFileSync(new URL('../migrations/0016_ai_copilot.sql',import.meta.url),'utf8'));
    this.raw.exec(fs.readFileSync(new URL('../migrations/0051_copilot_memory_kinds.sql',import.meta.url),'utf8'));
    this.raw.exec("CREATE TABLE IF NOT EXISTS workspace_storage_accounts(workspace_id TEXT PRIMARY KEY,records_bytes INTEGER NOT NULL DEFAULT 0,files_bytes INTEGER NOT NULL DEFAULT 0,plan_key TEXT NOT NULL DEFAULT 'free',paid_until INTEGER NOT NULL DEFAULT 0,plus_records_limit INTEGER NOT NULL DEFAULT 999999999,included_records_limit INTEGER NOT NULL DEFAULT 999999999)");
    this.raw.exec(`INSERT INTO copilot_diagnostics(id,workspace_id,category,severity,status,fingerprint,title,summary,details_json) VALUES
      ('d1','w1','completeness','important','open','completeness:website_missing','Company website is missing','Add it.','{}'),
      ('d2','w1','readiness','important','open','readiness:target_market_missing','Target market is missing','Pick one.','{}'),
      ('d3','w1','quality','improve','open','quality:icp_missing','ICP needs definition','Define it.','{}'),
      ('d4','w1','readiness','important','resolved','readiness:old','Old','Gone.','{}'),
      ('d5','w2','readiness','important','open','readiness:other','Other workspace','x','{}');
      INSERT INTO copilot_memories(id,workspace_id,kind,fingerprint,value_json,due_at,created_by) VALUES
      ('m1','w1','reminder','f1','{"value":"Call the dairy plant."}','2026-01-01','u1'),('m2','w1','reminder','f2','{"value":"Later."}','2999-01-01','u1'),('m3','w1','fact','f3','{"value":"Sells automation."}',NULL,'u1');
      INSERT INTO copilot_conversations(id,workspace_id,created_by,title,created_at,updated_at) VALUES('c1','w1','u1','Older','2026-10-20 10:00:00','2026-10-25 19:04:00');`);
  }
  prepare(sql){this.queries.push(sql);return new Statement(this.raw,sql);}
  async batch(statements){for(const statement of statements)await statement.run();}
}
async function fixture(){const db=new DB();const token='attention-token';db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(await sha256(token),'u1');const env={DB:db,APP_ORIGIN:'https://example.test',CUSTOMER_APP_URL:'https://example.test/customer/'};const req=(path,{method='GET',body,auth=true}={})=>new Request(`https://api.example.test${path}`,{method,headers:{...(auth?{Cookie:`leadintel_session=${token}`}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {env,db,req};}

sqliteTest('attention is a cheap workspace-scoped count: open important checks plus reminders due, no context build, no model',async()=>{
  const {env,db,req}=await fixture();
  assert.equal((await handleCopilotRoute(req('/api/copilot/attention?workspace_id=w1',{auth:false}),env,{})).status,401);
  assert.equal((await handleCopilotRoute(req('/api/copilot/attention?workspace_id=w2'),env,{})).status,403);
  db.queries.length=0;
  const response=await handleCopilotRoute(req('/api/copilot/attention?workspace_id=w1'),env,{});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{important:2,reminders_due:1,total:3,last_conversation_at:'2026-10-25 19:04:00',workspace_updated_at:'2026-10-25 20:40:00'});
  assert.ok(!db.queries.some(sql=>/customer_workspace_state.*payload_json|payload_json.*customer_workspace_state/is.test(sql)&&!/updated_at/.test(sql)),'the attention count never loads the workspace payload');
  assert.ok(!db.queries.some(sql=>/crm_companies|workspace_company_dossiers|audit_events/i.test(sql)),'no context queries');
});

sqliteTest('bootstrap carries the digest inputs: last conversation time and when the workspace last changed',async()=>{
  const {env,req}=await fixture();
  const response=await handleCopilotRoute(req('/api/copilot/bootstrap?workspace_id=w1'),env,{});
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.latestConversation.id,'c1');
  assert.deepEqual(body.since,{last_conversation_at:'2026-10-25 19:04:00',workspace_updated_at:'2026-10-25 20:40:00',important:body.unreadImportant});
  assert.equal(body.reminders_due.length,1);assert.ok(body.unreadImportant>=2);
});
