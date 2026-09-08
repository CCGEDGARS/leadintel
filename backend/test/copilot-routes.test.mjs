import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleCopilotRoute} from '../src/copilot-routes.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,market TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY,schema_version INTEGER,version INTEGER,payload_json TEXT,updated_by TEXT,updated_at TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,model TEXT,active INTEGER,verified_at TEXT,last_used_at TEXT,PRIMARY KEY(workspace_id,provider));CREATE TABLE workspace_service_integrations(workspace_id TEXT,provider TEXT,status TEXT,credential_source TEXT,verified_at TEXT,last_used_at TEXT,updated_at TEXT,encrypted_api_key TEXT,key_hint TEXT,PRIMARY KEY(workspace_id,provider));CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,status TEXT,google_email TEXT,connected_at TEXT,updated_at TEXT,encrypted_refresh_token TEXT);CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT,name TEXT,pipeline_stage TEXT,score REAL,updated_at TEXT);CREATE TABLE outreach_automation_policy(workspace_id TEXT PRIMARY KEY,mode TEXT,enabled INTEGER,paused INTEGER,emergency_stop INTEGER,updated_at TEXT);CREATE TABLE outreach_automation_queue(id TEXT PRIMARY KEY,workspace_id TEXT,status TEXT);INSERT INTO workspaces(id,name,market) VALUES('w1','One','Latvia'),('w2','Two','Estonia');INSERT INTO customer_workspace_state VALUES('w1',1,1,'{"main":{"company":{"website":"https://acme.example"},"market":{"targetMarkets":["Latvia"],"signals":[],"icps":[]}}}',NULL,CURRENT_TIMESTAMP);`);this.raw.exec(fs.readFileSync(new URL('../migrations/0016_ai_copilot.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){for(const row of rows)await row.run();}}
async function fixture({member=true,role='owner'}={}){const db=new DB();const token='copilot-test-token';const hash=await sha256(token);db.raw.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u1','owner@example.com','Owner',role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');if(member)db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);return {db,env:{DB:db,COPILOT_TEST_CONTEXT:{workspace:{id:'w1',role},screen:{step:1,label:'Company & Market'},company:{website:'https://acme.example'},markets:['Latvia'],profile:{},icps:[],signals:[],research:{count:0},discoverySummary:{},crmSummary:{},outreachSummary:{},integrationStatus:[],readiness:{}},COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{async generate(){return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Safe answer',action_proposals:[],memory_candidates:[]}),usage:{input_tokens:1,output_tokens:1}};},async search(){return {results:[],usage:{input_tokens:0,output_tokens:0}};}}},token};}
function req(path,{method='GET',token,body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{Cookie:token?`leadintel_session=${token}`:'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}

sqliteTest('copilot routes require explicit workspace id and authentication',async()=>{
  const {env,token}=await fixture();
  let response=await handleCopilotRoute(req('/api/copilot/bootstrap',{token}),env,{});assert.equal(response.status,400);
  response=await handleCopilotRoute(req('/api/copilot/bootstrap?workspace_id=w1'),env,{});assert.equal(response.status,401);
});

sqliteTest('authenticated non-members cannot read copilot workspace data',async()=>{
  const {env,token}=await fixture({member:false});
  const response=await handleCopilotRoute(req('/api/copilot/bootstrap?workspace_id=w1',{token}),env,{});assert.equal(response.status,403);
});

sqliteTest('bootstrap is workspace scoped, safe and does not expose credentials',async()=>{
  const {env,token,db}=await fixture();db.raw.prepare(`INSERT INTO workspace_ai_integrations VALUES('w1','openai','SECRET-ENVELOPE','gpt-test',1,CURRENT_TIMESTAMP,NULL)`).run();
  const response=await handleCopilotRoute(req('/api/copilot/bootstrap?workspace_id=w1',{token}),env,{});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.role,'owner');assert.equal(body.ai.configured,true);assert.equal(body.ai.provider,'openai');assert.doesNotMatch(JSON.stringify(body),/SECRET-ENVELOPE|encrypted_api_key|refresh_token/i);
});

sqliteTest('chat rejects authoritative client workspace payload and bounds message length',async()=>{
  const {env,token}=await fixture();
  let response=await handleCopilotRoute(req('/api/copilot/chat?workspace_id=w1',{method:'POST',token,body:{message:'hello',workspace:{id:'w2'}}}),env,{});assert.equal(response.status,400);
  response=await handleCopilotRoute(req('/api/copilot/chat?workspace_id=w1',{method:'POST',token,body:{message:'x'.repeat(9000)}}),env,{});assert.equal(response.status,413);
});

sqliteTest('conversation reads are always workspace scoped and cross-workspace ids do not leak',async()=>{
  const {env,token,db}=await fixture();db.raw.prepare(`INSERT INTO copilot_conversations(id,workspace_id,title) VALUES('c-other','w2','Other')`).run();
  const response=await handleCopilotRoute(req('/api/copilot/conversations/c-other?workspace_id=w1',{token}),env,{});assert.equal(response.status,404);
});

sqliteTest('chat persists bounded conversation and returns normalized safe answer',async()=>{
  const {env,token,db}=await fixture();
  const response=await handleCopilotRoute(req('/api/copilot/chat?workspace_id=w1',{method:'POST',token,body:{message:'What does this button do?',screen:{step:1,label:'Company & Market'}}}),env,{});assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.answer,'Safe answer');assert.ok(body.conversation_id);assert.equal(db.raw.prepare(`SELECT COUNT(*) AS n FROM copilot_messages WHERE workspace_id='w1' AND conversation_id=?`).get(body.conversation_id).n,2);
  assert.doesNotMatch(JSON.stringify(body),/system prompt|encrypted_api_key|SECRET/i);
});
