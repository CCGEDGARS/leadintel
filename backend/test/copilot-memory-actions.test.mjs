import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeMemoryCandidate,listCopilotMemories,saveCopilotMemory,archiveCopilotMemory} from '../src/copilot-memory.js';
import {COPILOT_ACTION_TYPES,normalizeActionProposal,createActionProposal,executeConfirmedAction} from '../src/copilot-actions.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT);CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,schema_version INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),updated_by TEXT,updated_at TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);INSERT INTO workspaces VALUES('w1');INSERT INTO workspaces VALUES('w2');INSERT INTO users VALUES('u1','owner@example.com');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0016_ai_copilot.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){const out=[];for(const item of rows)out.push(await item.run());return out;}}
function fixture(){const db=new DB();const payload={main:{market:{signals:[{id:'s1',name:'Factory expansion',keywords:['factory expansion'],weight:70,priority:'high',active:true}],icps:[{id:'i1',name:'Manufacturers',criteria:'50-500 employees',exclusions:'consumer'}]}},discovery:{},outreach:{},delivery:{},meta:{}};db.raw.prepare(`INSERT INTO customer_workspace_state(workspace_id,schema_version,version,payload_json,updated_by,updated_at) VALUES('w1',1,3,?,'u1',CURRENT_TIMESTAMP)`).run(JSON.stringify(payload));return {env:{DB:db},db};}

test('memory normalization accepts only concise commercial decisions preferences and constraints',()=>{
  for(const [kind,value] of [['constraint','Do not target micro-companies.'],['preference','Prefer expansion signals over tenders.'],['decision','Prioritize Procurement Director and Production Director roles.']]){
    const item=normalizeMemoryCandidate({kind,value});assert.equal(item.kind,kind);assert.equal(item.value,value);assert.ok(item.fingerprint.length>=8);
  }
  assert.throws(()=>normalizeMemoryCandidate({kind:'note',value:'anything'}),/kind/i);
  assert.throws(()=>normalizeMemoryCandidate({kind:'decision',value:'user: '+ 'full transcript '.repeat(120)}),/memory|long|transcript/i);
});

test('memory normalization rejects secret-like content instead of persisting redacted credentials',()=>{
  for(const value of ['sk-proj-abcdefghijklmnopqrstuvwxyz0123456789','APOLLO_API_KEY=abc123456789','password=hunter2-secret','Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef123456789.signature','refresh_token=1//0gLongOAuthTokenValue123456789'])assert.throws(()=>normalizeMemoryCandidate({kind:'preference',value}),/secret|credential|protected/i,value);
});

sqliteTest('memory persistence deduplicates per workspace and supports archive without cross-workspace access',async()=>{
  const {env,db}=fixture();const candidate={kind:'preference',value:'Prefer expansion signals over tenders.'};
  const first=await saveCopilotMemory(env,{workspaceId:'w1',userId:'u1',conversationId:null,candidate});const second=await saveCopilotMemory(env,{workspaceId:'w1',userId:'u1',conversationId:null,candidate});
  assert.equal(first.id,second.id);assert.equal((await listCopilotMemories(env,'w1')).length,1);
  assert.equal((await archiveCopilotMemory(env,{workspaceId:'w2',memoryId:first.id})).archived,false);
  assert.equal((await archiveCopilotMemory(env,{workspaceId:'w1',memoryId:first.id})).archived,true);
  assert.equal((await listCopilotMemories(env,'w1')).length,0);
  assert.equal(db.raw.prepare('SELECT COUNT(*) count FROM copilot_memories').get().count,1);
});

test('action proposal normalization allowlists only signal and ICP mutations with explicit safe fields',()=>{
  assert.deepEqual([...COPILOT_ACTION_TYPES],['signal.add','signal.update','icp.update_field']);
  const state={main:{market:{signals:[{id:'s1',name:'Old',keywords:['old'],weight:50,priority:'medium',active:true}],icps:[{id:'i1',name:'Manufacturers',criteria:'old'}]}}};
  for(const candidate of [
    {action_type:'signal.add',payload:{signal:{id:'s2',name:'New factory',keywords:['new factory'],weight:80,priority:'high',active:true}}},
    {action_type:'signal.update',payload:{signal_id:'s1',changes:{name:'Factory expansion',keywords:['expansion'],weight:85,active:true}}},
    {action_type:'icp.update_field',payload:{icp_id:'i1',field:'criteria',value:'Manufacturers with 50-500 employees'}}
  ]){const normalized=normalizeActionProposal(candidate,{state});assert.equal(normalized.action_type,candidate.action_type);assert.ok(normalized.preview.before!==undefined);assert.ok(normalized.preview.after!==undefined);}
  for(const action_type of ['crm.delete','gmail.send','provider.update','security.disable','code.execute'])assert.throws(()=>normalizeActionProposal({action_type,payload:{}},{state}),/action|allowed|prohibited/i);
  assert.throws(()=>normalizeActionProposal({action_type:'icp.update_field',payload:{icp_id:'i1',field:'__proto__',value:'x'}},{state}),/field/i);
  assert.throws(()=>normalizeActionProposal({action_type:'signal.update',payload:{signal_id:'s1',changes:{command:'DELETE ALL'}}},{state}),/field|change/i);
});

sqliteTest('proposal creation never mutates workspace state before explicit confirmation',async()=>{
  const {env,db}=fixture();const before=db.raw.prepare(`SELECT payload_json,version FROM customer_workspace_state WHERE workspace_id='w1'`).get();
  const proposal=await createActionProposal(env,{workspaceId:'w1',userId:'u1',conversationId:null,expectedStateVersion:3,idempotencyKey:'proposal-safe-0001',candidate:{action_type:'signal.update',payload:{signal_id:'s1',changes:{weight:90}}},state:JSON.parse(before.payload_json)});
  const after=db.raw.prepare(`SELECT payload_json,version FROM customer_workspace_state WHERE workspace_id='w1'`).get();
  assert.equal(after.payload_json,before.payload_json);assert.equal(after.version,before.version);assert.equal(proposal.status,'proposed');
});

sqliteTest('confirmed signal update applies only allowlisted target, audits safely and is idempotent',async()=>{
  const {env,db}=fixture();const current=JSON.parse(db.raw.prepare(`SELECT payload_json FROM customer_workspace_state WHERE workspace_id='w1'`).get().payload_json);
  const proposal=await createActionProposal(env,{workspaceId:'w1',userId:'u1',expectedStateVersion:3,idempotencyKey:'proposal-safe-0002',candidate:{action_type:'signal.update',payload:{signal_id:'s1',changes:{weight:92,name:'Expansion detected'}}},state:current});
  const first=await executeConfirmedAction(env,{workspaceId:'w1',userId:'u1',role:'owner',proposalId:proposal.id,idempotencyKey:'proposal-safe-0002'});assert.equal(first.applied,true);
  const state=db.raw.prepare(`SELECT version,payload_json FROM customer_workspace_state WHERE workspace_id='w1'`).get();const payload=JSON.parse(state.payload_json);assert.equal(state.version,4);assert.equal(payload.main.market.signals[0].weight,92);assert.equal(payload.main.market.signals[0].name,'Expansion detected');assert.equal(payload.main.market.icps[0].criteria,'50-500 employees');
  const second=await executeConfirmedAction(env,{workspaceId:'w1',userId:'u1',role:'owner',proposalId:proposal.id,idempotencyKey:'proposal-safe-0002'});assert.equal(second.applied,true);assert.equal(second.duplicate,true);assert.equal(db.raw.prepare(`SELECT version FROM customer_workspace_state WHERE workspace_id='w1'`).get().version,4);
  const audit=db.raw.prepare(`SELECT metadata_json FROM audit_events WHERE event_type='copilot.action_applied'`).get();assert.ok(audit);assert.match(audit.metadata_json,/signal\.update/);assert.doesNotMatch(audit.metadata_json,/Expansion detected|prompt|secret/i);
});

sqliteTest('confirmation rejects stale proposal version without mutating state and enforces operating roles',async()=>{
  const {env,db}=fixture();const current=JSON.parse(db.raw.prepare(`SELECT payload_json FROM customer_workspace_state WHERE workspace_id='w1'`).get().payload_json);
  const proposal=await createActionProposal(env,{workspaceId:'w1',userId:'u1',expectedStateVersion:2,idempotencyKey:'proposal-safe-0003',candidate:{action_type:'icp.update_field',payload:{icp_id:'i1',field:'criteria',value:'New criteria'}},state:current});
  const conflict=await executeConfirmedAction(env,{workspaceId:'w1',userId:'u1',role:'owner',proposalId:proposal.id,idempotencyKey:'proposal-safe-0003'});assert.equal(conflict.conflict,true);assert.equal(db.raw.prepare(`SELECT version FROM customer_workspace_state WHERE workspace_id='w1'`).get().version,3);
  await assert.rejects(()=>executeConfirmedAction(env,{workspaceId:'w1',userId:'u1',role:'viewer',proposalId:proposal.id,idempotencyKey:'proposal-safe-0003'}),/role|permission/i);
});
