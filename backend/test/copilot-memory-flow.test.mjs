import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {runCopilotTurn,memoryCue} from '../src/copilot-service.js';
import {handleCopilotRoute} from '../src/copilot-routes.js';

// B3 (CTO, 2026-10-25): the assistant remembers. Memories the model proposes are normalized, saved per workspace,
// shown to the person (who can forget them), fed back into every later turn, and reminders surface when due.
let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);

test('the prompt carries the workspace memories and the system instruction tells the model how to use and propose them',async()=>{
  let system='',prompt='';
  const env={COPILOT_TEST_CONTEXT:{workspace:{id:'w1'},screen:{step:4,label:'Strategy'},user:{name:'Jonathan Collins',firstName:'Jonathan'},activity:[],company:{name:'Acme'},markets:[],profile:{},icps:[],signals:[],research:{items:[],count:0},crmSummary:{topCompanies:[]},integrationStatus:[],readiness:{}},
    COPILOT_TEST_MEMORIES:[{id:'m1',kind:'preference',value:'Prefers expansion signals over tenders.',due:'',updated_at:'2026-10-20 10:00:00'},{id:'m2',kind:'reminder',value:'Ask Edgars for the pilot decision.',due:'2026-11-03',updated_at:'2026-10-24 10:00:00'}],
    COPILOT_TEST_PROVIDER:{async generate(options){system=options.system;prompt=options.prompt;return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Noted.',action_proposals:[],memory_candidates:[{kind:'decision',value:'Target dairy processors first.'}]})};},async search(){return {results:[]};}}};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'What is missing from my profile?',currentScreen:{step:4}}); // a diagnostic question goes straight to the answer prompt (no planning call)
  const payload=JSON.parse(prompt);
  assert.deepEqual(payload.workspace_memories.map(item=>[item.kind,item.value,item.due]),[['preference','Prefers expansion signals over tenders.',''],['reminder','Ask Edgars for the pilot decision.','2026-11-03']]);
  assert.match(system,/memory_candidates/);assert.match(system,/reminder/i);assert.match(system,/never (?:store|save|remember)[^.]*(?:secret|credential|password)/i);
  assert.deepEqual(result.memory_candidates,[{kind:'decision',value:'Target dairy processors first.',due:''}]);
});

test('a memory cue (a decision, a preference, "remind me") in any supported language sends the turn to the main prompt with the full memory rules',()=>{
  for(const q of ['Lēmums: sākam ar piena pārstrādi.','Atgādini man 3. novembrī pajautāt Edgaram.','Remind me on Monday to call them.','From now on we prefer expansion signals.','Please remember that we never target retail.'])assert.equal(memoryCue(q),true,q);
  for(const q of ['Explain anchoring in negotiation','What does this button do?','Find recent Latvian expansion signals'])assert.equal(memoryCue(q),false,q);
});

test('a conversational question (answered without private workspace data) still knows the person, the trail and the memories, and can create a reminder',async()=>{
  const prompts=[];
  const env={COPILOT_TEST_CONTEXT:{workspace:{id:'w1'},screen:{step:1,label:'Setup'},user:{name:'Jonathan Collins',firstName:'Jonathan'},activity:[{at:'2026-10-25T21:30:00Z',kind:'step',step:1,label:'Setup'}],company:{name:'Seller'},markets:['Latvia'],profile:{private_notes:'PRIVATE-NOTE'},icps:[],signals:[],research:{items:[],count:0},crmSummary:{topCompanies:[{name:'PRIVATE-CRM'}]},integrationStatus:[],readiness:{}},
    COPILOT_TEST_MEMORIES:[{id:'m1',kind:'preference',value:'Prefers expansion signals over tenders.',due:'',updated_at:'2026-10-20 10:00:00'}],
    COPILOT_TEST_PROVIDER:{async generate(options){prompts.push(options.prompt);return {provider:'openai',model:'gpt-test',text:JSON.stringify({research_query:'',answer:'Noted, Jonathan: dairy first. I will remind you on 3 November.',memory_candidates:[{kind:'decision',value:'Start with dairy processors in Latvia.'},{kind:'reminder',value:'Ask Edgars about the pilot decision.',due:'2026-11-03'}]})};},async search(){throw new Error('must not search');}}};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'Kā vislabāk sākt sarunu ar piena pārstrādes uzņēmumu?',currentScreen:{step:1}});
  assert.equal(prompts.length,1,'one reasoning call for a conversational turn');
  const payload=JSON.parse(prompts[0]);
  assert.deepEqual(payload.user,{name:'Jonathan Collins',firstName:'Jonathan'});assert.deepEqual(payload.activity_trail.map(item=>item.kind),['step']);
  assert.deepEqual(payload.workspace_memories.map(item=>item.value),['Prefers expansion signals over tenders.']);
  assert.doesNotMatch(prompts[0],/PRIVATE-CRM|PRIVATE-NOTE/,'general questions still do not carry private workspace data (11 October rule)');
  assert.deepEqual(result.memory_candidates,[{kind:'decision',value:'Start with dairy processors in Latvia.',due:''},{kind:'reminder',value:'Ask Edgars about the pilot decision.',due:'2026-11-03'}]);
  assert.match(result.answer,/^Noted, Jonathan/);
});

class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,market TEXT,owner_user_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
      CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);
      CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY,schema_version INTEGER DEFAULT 1,version INTEGER DEFAULT 1,payload_json TEXT NOT NULL,updated_by TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,model TEXT,active INTEGER,verified_at TEXT,last_used_at TEXT);
      INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','Acme','Latvia','u1'),('w2','Other','Estonia','u2');
      INSERT INTO users VALUES('u1','owner@example.com','Jonathan Collins','owner'),('u2','other@example.com','Other Person','owner');
      INSERT INTO workspace_members VALUES('w1','u1','owner'),('w2','u2','owner');
      INSERT INTO customer_workspace_state(workspace_id,payload_json) VALUES('w1','{"main":{"website":"https://acme.example","targetMarkets":["Latvia"],"profile":{"company":"Acme"},"market":{"icps":[],"signals":[]}}}');`);
    this.raw.exec(fs.readFileSync(new URL('../migrations/0016_ai_copilot.sql',import.meta.url),'utf8'));
    this.raw.exec(fs.readFileSync(new URL('../migrations/0051_copilot_memory_kinds.sql',import.meta.url),'utf8'));
    this.raw.exec("CREATE TABLE IF NOT EXISTS workspace_storage_accounts(workspace_id TEXT PRIMARY KEY,records_bytes INTEGER NOT NULL DEFAULT 0,files_bytes INTEGER NOT NULL DEFAULT 0,plan_key TEXT NOT NULL DEFAULT 'free',paid_until INTEGER NOT NULL DEFAULT 0,plus_records_limit INTEGER NOT NULL DEFAULT 999999999,included_records_limit INTEGER NOT NULL DEFAULT 999999999)");
  }
  prepare(sql){return new Statement(this.raw,sql);}
  async batch(statements){for(const statement of statements)await statement.run();}
}
async function fixture(){
  const db=new DB();const token='memory-flow-token';const hash=await sha256(token);
  db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');
  const provider={async generate(){return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Jonathan, noted: dairy first.',action_proposals:[],memory_candidates:[{kind:'decision',value:'Target dairy processors first.'},{kind:'reminder',value:'Ask Edgars for the pilot decision.',due:'2026-11-03'},{kind:'preference',value:'api_key=sk-live-abcdefghijklmnop'}]})};},async search(){return {results:[]};}};
  const env={DB:db,APP_ORIGIN:'https://example.test',CUSTOMER_APP_URL:'https://example.test/customer/',COPILOT_TEST_PROVIDER:provider};
  const req=(path,{method='GET',body}={})=>new Request(`https://api.example.test${path}`,{method,headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {env,db,req};
}

sqliteTest('a chat turn saves the valid memory candidates for the workspace and returns them with ids; secrets never land',async()=>{
  const {env,db,req}=await fixture();
  const response=await handleCopilotRoute(req('/api/copilot/chat?workspace_id=w1',{method:'POST',body:{message:'Where should we start?',screen:{step:4,label:'Strategy'}}}),env,{});
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(body.memory_candidates.length,2);
  assert.deepEqual(body.memory_candidates.map(item=>[item.kind,item.value,item.due]),[['decision','Target dairy processors first.',''],['reminder','Ask Edgars for the pilot decision.','2026-11-03']]);
  assert.ok(body.memory_candidates.every(item=>typeof item.id==='string'&&item.id.length>8));
  const rows=db.raw.prepare('SELECT kind,value_json,due_at,workspace_id FROM copilot_memories ORDER BY kind').all();
  assert.deepEqual(rows.map(row=>[row.kind,JSON.parse(row.value_json).value,row.due_at,row.workspace_id]),[['decision','Target dairy processors first.',null,'w1'],['reminder','Ask Edgars for the pilot decision.','2026-11-03','w1']]);
  assert.doesNotMatch(JSON.stringify(rows),/sk-live/);
  const message=db.raw.prepare("SELECT metadata_json FROM copilot_messages WHERE role='assistant'").get();
  assert.equal(JSON.parse(message.metadata_json).memory_ids.length,2,'the answer records which memories it created');
});

sqliteTest('memories can be listed and forgotten only inside the workspace; bootstrap surfaces due reminders',async()=>{
  const {env,db,req}=await fixture();
  db.raw.prepare(`INSERT INTO copilot_memories(id,workspace_id,kind,fingerprint,value_json,due_at,created_by) VALUES('m-due','w1','reminder','f-due','{"value":"Call the dairy plant."}','2026-01-01','u1'),('m-later','w1','reminder','f-later','{"value":"Renew Firecrawl."}','2999-01-01','u1'),('m-fact','w1','fact','f-fact','{"value":"Sells retrofit automation."}',NULL,'u1'),('m-other','w2','fact','f-other','{"value":"Other workspace"}',NULL,'u2')`).run();
  let response=await handleCopilotRoute(req('/api/copilot/memories?workspace_id=w1'),env,{});
  assert.equal(response.status,200);let body=await response.json();
  assert.deepEqual(body.memories.map(item=>item.id).sort(),['m-due','m-fact','m-later']);
  assert.deepEqual(body.reminders_due.map(item=>item.id),['m-due']);
  response=await handleCopilotRoute(req('/api/copilot/bootstrap?workspace_id=w1'),env,{});body=await response.json();
  assert.deepEqual(body.reminders_due.map(item=>item.value),['Call the dairy plant.']);assert.equal(body.memories.length,3);
  response=await handleCopilotRoute(req('/api/copilot/memories/m-other/archive?workspace_id=w1',{method:'POST',body:{}}),env,{});
  assert.equal(response.status,404,'another workspace\'s memory cannot be touched');
  response=await handleCopilotRoute(req('/api/copilot/memories/m-due/archive?workspace_id=w1',{method:'POST',body:{}}),env,{});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{archived:true,id:'m-due'});
  response=await handleCopilotRoute(req('/api/copilot/memories?workspace_id=w1'),env,{});body=await response.json();
  assert.deepEqual(body.memories.map(item=>item.id).sort(),['m-fact','m-later']);assert.deepEqual(body.reminders_due,[]);
  assert.equal(db.raw.prepare("SELECT archived_at FROM copilot_memories WHERE id='m-due'").get().archived_at!==null,true,'forgetting archives, it does not delete');
});

test('a cued turn skips the planning shortcut: one main-prompt call with full context and memory rules, candidates come back',async()=>{
  const prompts=[],systems=[];
  const env={COPILOT_TEST_CONTEXT:{workspace:{id:'w1'},screen:{step:1,label:'Setup'},user:{name:'Jonathan Collins',firstName:'Jonathan'},activity:[],company:{name:'Seller'},markets:['Latvia'],profile:{notes:'WORKSPACE-NOTE'},icps:[],signals:[],research:{items:[],count:0},crmSummary:{topCompanies:[]},integrationStatus:[],readiness:{}},
    COPILOT_TEST_MEMORIES:[],
    COPILOT_TEST_PROVIDER:{async generate(options){prompts.push(options.prompt);systems.push(options.system);return {provider:'openai',model:'gpt-test',text:JSON.stringify({answer:'Jonathan, sākam ar pienu; 3. novembrī atgādināšu.',action_proposals:[],memory_candidates:[{kind:'decision',value:'Sākam ar piena pārstrādes uzņēmumiem Latvijā.'},{kind:'reminder',value:'Pajautāt Edgaram par pilota lēmumu.',due:'2026-11-03'}]})};},async search(){throw new Error('must not search');}}};
  const result=await runCopilotTurn(env,{workspaceId:'w1',userId:'u1',role:'owner',question:'Lēmums: sākam ar piena pārstrādes uzņēmumiem Latvijā. Lūdzu atgādini man 3. novembrī pajautāt Edgaram par pilota lēmumu.',currentScreen:{step:1}});
  assert.equal(prompts.length,1,'no planning call, one main call');
  const payload=JSON.parse(prompts[0]);
  assert.ok(payload.workspace_context,'the main prompt carries the workspace');assert.ok(Array.isArray(payload.workspace_memories));assert.deepEqual(payload.user,{name:'Jonathan Collins',firstName:'Jonathan'});
  assert.doesNotMatch(systems[0],/planning bounded public research/);
  assert.deepEqual(result.memory_candidates,[{kind:'decision',value:'Sākam ar piena pārstrādes uzņēmumiem Latvijā.',due:''},{kind:'reminder',value:'Pajautāt Edgaram par pilota lēmumu.',due:'2026-11-03'}]);
});
