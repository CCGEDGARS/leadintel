import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleMarketMonitoringRoute} from '../src/market-monitoring.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY,schema_version INTEGER,version INTEGER,payload_json TEXT,updated_by TEXT,updated_at TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);INSERT INTO workspaces VALUES('w1');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0014_market_monitoring.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){for(const row of rows)await row.run();}}
async function fixture(role='owner'){const db=new DB();const token='monitor-token';const hash=await sha256(token);db.raw.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u1','owner@example.com','Owner',role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);return {env:{DB:db},token,db};}
function request(path,{method='GET',token,body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}

sqliteTest('owner can enable monitoring and retrieve the durable configuration',async()=>{
  const {env,token}=await fixture();
  let response=await handleMarketMonitoringRoute(request('/api/market-monitoring/config?workspace_id=w1',{method:'PUT',token,body:{enabled:true,frequency:'daily',research_depth:'deep',minimum_score:72,source_types:['news','tenders'],signal_ids:['move']}}),env,{});
  assert.equal(response.status,200);
  response=await handleMarketMonitoringRoute(request('/api/market-monitoring/config?workspace_id=w1',{token}),env,{});const result=await response.json();
  assert.equal(result.config.enabled,true);assert.equal(result.config.frequency,'daily');assert.equal(result.config.minimumScore,72);assert.ok(result.config.nextRunAt);
});

sqliteTest('monitoring alerts are workspace scoped and can be marked read',async()=>{
  const {env,token,db}=await fixture();
  db.raw.prepare(`INSERT INTO market_monitoring_runs(id,workspace_id,trigger_type,research_depth,status) VALUES('r1','w1','scheduled','deep','completed')`).run();
  db.raw.prepare(`INSERT INTO market_monitoring_evidence(id,workspace_id,run_id,fingerprint,source_url,source_type,title,score) VALUES('e1','w1','r1','fp1','https://example.com','news','Expansion',85)`).run();
  db.raw.prepare(`INSERT INTO market_monitoring_alerts(id,workspace_id,evidence_id,score,title,source_url) VALUES('a1','w1','e1',85,'Expansion','https://example.com')`).run();
  let response=await handleMarketMonitoringRoute(request('/api/market-monitoring/alerts?workspace_id=w1',{token}),env,{});let result=await response.json();assert.equal(result.alerts.length,1);assert.equal(result.unread,1);
  response=await handleMarketMonitoringRoute(request('/api/market-monitoring/alerts/a1?workspace_id=w1',{method:'PATCH',token,body:{status:'read'}}),env,{});assert.equal(response.status,200);
  assert.equal(db.raw.prepare(`SELECT status FROM market_monitoring_alerts WHERE id='a1'`).get().status,'read');
});
