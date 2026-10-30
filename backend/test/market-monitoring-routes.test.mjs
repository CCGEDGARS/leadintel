import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleMarketMonitoringRoute,runDueMarketMonitoring} from '../src/market-monitoring.js';
import capacityFixture from '../../customer/test/helpers/workspace-capacity.js';
import stateBudget from '../../customer/state-budget.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import '../../customer/strategy-integrity.js';
const integrity=globalThis.LeadIntelStrategyIntegrity;

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));CREATE TABLE customer_workspace_state(workspace_id TEXT PRIMARY KEY,schema_version INTEGER,version INTEGER,payload_json TEXT,updated_by TEXT,updated_at TEXT);CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);INSERT INTO workspaces VALUES('w1');`);for(const migration of ['0013_workspace_service_integrations.sql','0014_market_monitoring.sql','0017_intelligence_sources.sql','0065_strategy_monitoring_integrity.sql'])this.raw.exec(fs.readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){for(const row of rows)await row.run();}}
async function fixture(role='owner'){const db=new DB();const token='monitor-token';const hash=await sha256(token);db.raw.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u1','owner@example.com','Owner',role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);const env={DB:db,OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};return {env,token,db};}
function request(path,{method='GET',token,body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}

sqliteTest('monitoring reads the seller markets from a packed workspace',async()=>{
 const {env,token,db}=await fixture(),payload=capacityFixture();payload.main={...payload.main,...approvedMain()};
 db.raw.prepare('INSERT INTO customer_workspace_state VALUES(?,1,1,?,NULL,NULL)').run('w1',JSON.stringify(stateBudget.prepareForSync(payload,{allowBundlePacking:true,allowCompressionPacking:true}).payload));
 await handleMarketMonitoringRoute(request('/api/market-monitoring/config?workspace_id=w1',{method:'PUT',token,body:{enabled:true,source_types:['news']}}),env,{});
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:[]}),{status:200});
 try{const response=await handleMarketMonitoringRoute(request('/api/market-monitoring/run?workspace_id=w1',{method:'POST',token}),env,{});assert.equal(response.status,200);}finally{globalThis.fetch=oldFetch;}
 assert.equal(JSON.parse(db.raw.prepare('SELECT snapshot_json FROM market_monitoring_runs').get().snapshot_json).markets,'Finland');
});

sqliteTest('owner can enable monitoring and retrieve the durable configuration',async()=>{
  const {env,token,db}=await fixture();saveMain(db,approvedMain());
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

function approvedMain(){
 const main={approved:true,website:'https://seller.example',profile:{companyName:'Fixture seller',targetMarkets:'Finland',priorityOffers:'Industrial automation'},targetMarkets:['Finland'],market:{strategyApproved:true,signals:[{id:'move',active:true,name:'Relocation',keywords:'new office; relocation',weight:10}],icps:[{id:'industrial',active:true,name:'Industrial buyers',description:'Manufacturers'}]}};
 main.market.strategyApproval=integrity.approval(main,new Date().toISOString());return main;
}
function saveMain(db,main){db.raw.prepare('INSERT INTO customer_workspace_state VALUES(?,1,1,?,NULL,NULL) ON CONFLICT(workspace_id) DO UPDATE SET payload_json=excluded.payload_json,version=customer_workspace_state.version+1').run('w1',JSON.stringify({main}));}
async function configure(f,extra={}){return handleMarketMonitoringRoute(request('/api/market-monitoring/config?workspace_id=w1',{method:'PUT',token:f.token,body:{enabled:true,source_types:['news'],signal_ids:['move'],...extra}}),f.env,{});}
async function connectedFixture(){const f=await fixture();saveMain(f.db,approvedMain());const secret=await encryptSecret('fc-fixture-only',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));f.db.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w1','firecrawl',?,'fixture')").run(secret);assert.equal((await configure(f)).status,200);return f;}
const evidence=()=>({url:'https://example.com/story?utm_source=fixture#fragment',title:'New office relocation',description:'Company announced new office relocation',date:new Date().toISOString()});
async function run(f,signal){return handleMarketMonitoringRoute(new Request(request('/api/market-monitoring/run?workspace_id=w1',{method:'POST',token:f.token}),signal?{signal}:{}),f.env,{});}

sqliteTest('monitoring enable rejects absent, legacy and materially stale approval',async()=>{
 const f=await fixture();assert.equal((await configure(f)).status,409);
 const main=approvedMain();delete main.market.strategyApproval;saveMain(f.db,main);assert.equal((await configure(f)).status,409);
 main.market.strategyApproval=integrity.approval(main,new Date().toISOString());main.profile.priorityOffers='Changed offer';saveMain(f.db,main);assert.equal((await configure(f)).status,409);
 assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_configs').get().n,0);
});

sqliteTest('monitoring config CAS rejects stale or missing revisions and preserves winning pause',async()=>{
 const f=await connectedFixture();assert.equal((await configure(f,{enabled:false,revision:1})).status,200);
 assert.equal((await configure(f,{frequency:'monthly',revision:1})).status,409);assert.equal((await configure(f,{enabled:false})).status,409);
 const row=f.db.raw.prepare('SELECT * FROM market_monitoring_configs').get();assert.equal(row.enabled,0);assert.equal(row.revision,2);
});

sqliteTest('concurrent cron and manual monitoring share one lease and one paid execution',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;let release,entered;const ready=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);let calls=0;
 globalThis.fetch=async()=>{calls++;entered();if(calls===1)await waiting;return Response.json({data:[evidence()]});};
 try{const pending=runDueMarketMonitoring(f.env);await ready;assert.equal((await run(f)).status,409);assert.equal(calls,1);release();const [result]=await pending;assert.equal(result.status,'completed');assert.equal(calls,result.queryCount);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_runs').get().n,1);}finally{release();globalThis.fetch=old;}
});

for(const selectedSchedule of [null,'2020-01-01T00:00:00.000Z'])sqliteTest('delayed cron selection cannot replay a completed schedule '+selectedSchedule,async()=>{
 const f=await connectedFixture(),old=globalThis.fetch,prepare=f.env.DB.prepare.bind(f.env.DB);let release,selected,selects=0,calls=0,pending;
 f.db.raw.prepare('UPDATE market_monitoring_configs SET next_run_at=?').run(selectedSchedule);
 const ready=new Promise(resolve=>selected=resolve),waiting=new Promise(resolve=>release=resolve);
 f.env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('SELECT * FROM market_monitoring_configs WHERE enabled=1')){const all=statement.all.bind(statement);statement.all=async()=>{const rows=await all();if(++selects===1){selected();await waiting;}return rows;};}return statement;};
 globalThis.fetch=async()=>{calls++;return Response.json({data:[]});};
 try{
  pending=runDueMarketMonitoring(f.env);await ready;
  const [winner]=await runDueMarketMonitoring(f.env);assert.equal(winner.status,'completed');assert.ok(winner.queryCount>0);
  const rescheduled=f.db.raw.prepare('SELECT next_run_at,last_run_at,lease_id FROM market_monitoring_configs').get();assert.equal(rescheduled.lease_id,null);assert.ok(Date.parse(rescheduled.next_run_at)>Date.now());
  release();const [stale]=await pending;assert.equal(stale.status,'skipped');assert.equal(calls,winner.queryCount);
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_runs').get().n,1);
  assert.deepEqual(f.db.raw.prepare('SELECT next_run_at,last_run_at,lease_id FROM market_monitoring_configs').get(),rescheduled);
 }finally{release();if(pending)await pending;globalThis.fetch=old;}
});

sqliteTest('explicit manual monitoring runs while paused or before the scheduled due time',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({data:[]});};
 try{
  f.db.raw.exec("UPDATE market_monitoring_configs SET next_run_at='2099-01-01T00:00:00.000Z'");assert.equal((await runDueMarketMonitoring(f.env)).length,0);
  const future=(await (await run(f)).json()).run;assert.equal(future.status,'completed');
  assert.equal((await configure(f,{enabled:false,revision:1})).status,200);assert.equal((await runDueMarketMonitoring(f.env)).length,0);
  const paused=(await (await run(f)).json()).run;assert.equal(paused.status,'completed');assert.equal(calls,future.queryCount+paused.queryCount);
  assert.equal(f.db.raw.prepare('SELECT enabled FROM market_monitoring_configs').get().enabled,0);
 }finally{globalThis.fetch=old;}
});

for(const mutation of ['pause','strategy','membership','session','abort'])sqliteTest('late provider results are discarded after '+mutation,async()=>{
 const f=await connectedFixture(),old=globalThis.fetch,controller=new AbortController();let release,entered;const ready=new Promise(resolve=>entered=resolve),waiting=new Promise(resolve=>release=resolve);
 globalThis.fetch=async()=>{entered();await waiting;return Response.json({data:[evidence()]});};
 try{const pending=run(f,controller.signal);await ready;
  if(mutation==='pause')assert.equal((await configure(f,{enabled:false,revision:1,frequency:'monthly'})).status,200);
  if(mutation==='strategy'){const main=approvedMain();main.profile.priorityOffers='Different offer';saveMain(f.db,main);}
  if(mutation==='membership')f.db.raw.exec("UPDATE workspace_members SET role='viewer'");
  if(mutation==='session')f.db.raw.exec('DELETE FROM sessions');
  if(mutation==='abort')controller.abort();
  release();const result=await (await pending).json();assert.equal(result.run.status,'failed');assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,0);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,0);
  const ledger=f.db.raw.prepare('SELECT * FROM market_monitoring_runs').get();assert.equal(ledger.status,'failed');assert.ok(ledger.error_message);assert.ok(ledger.completed_at);
  if(mutation==='pause'){const row=f.db.raw.prepare('SELECT * FROM market_monitoring_configs').get();assert.equal(row.enabled,0);assert.equal(row.frequency,'monthly');assert.equal(row.next_run_at,null);assert.equal(row.last_run_at,null);}
 }finally{release();globalThis.fetch=old;}
});

sqliteTest('missing credentials and unreadable saved state become durable failed runs without external research',async()=>{
 const f=await fixture();saveMain(f.db,approvedMain());assert.equal((await configure(f)).status,200);const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call');};
 try{assert.equal((await (await run(f)).json()).run.status,'failed');f.db.raw.exec("UPDATE customer_workspace_state SET payload_json='broken'");assert.equal((await (await run(f)).json()).run.status,'failed');assert.equal(calls,0);assert.equal(f.db.raw.prepare("SELECT count(*) n FROM market_monitoring_runs WHERE status='failed' AND completed_at IS NOT NULL").get().n,2);}finally{globalThis.fetch=old;}
});

sqliteTest('expired lease is reclaimed and its abandoned run is durably failed',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;f.db.raw.exec("UPDATE market_monitoring_configs SET lease_id='old',lease_expires_at='2000-01-01T00:00:00.000Z'; INSERT INTO market_monitoring_runs(id,workspace_id,trigger_type,research_depth,status) VALUES('old','w1','scheduled','deep','running')");globalThis.fetch=async()=>Response.json({data:[]});
 try{assert.equal((await (await run(f)).json()).run.status,'completed');assert.equal(f.db.raw.prepare("SELECT error_message FROM market_monitoring_runs WHERE id='old'").get().error_message,'lease_expired');assert.equal(f.db.raw.prepare('SELECT lease_id FROM market_monitoring_configs').get().lease_id,null);}finally{globalThis.fetch=old;}
});

sqliteTest('canonical URL dedup survives repeated runs and filters unsafe evidence',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:[evidence(),{...evidence(),url:'https://example.com/story'},{...evidence(),url:'http://127.0.0.1/private'}]});
 try{for(let i=0;i<2;i++)assert.equal((await (await run(f)).json()).run.status,'completed');assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,1);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,1);assert.equal(f.db.raw.prepare('SELECT source_url FROM market_monitoring_evidence').get().source_url,'https://example.com/story');}finally{globalThis.fetch=old;}
});

sqliteTest('unrelated saved workspace work survives and does not invalidate unchanged Strategy execution',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;globalThis.fetch=async()=>{const main=JSON.parse(f.db.raw.prepare('SELECT payload_json FROM customer_workspace_state').get().payload_json).main;main.manualNote='Keep customer work';saveMain(f.db,main);return Response.json({data:[evidence()]});};
 try{assert.equal((await (await run(f)).json()).run.status,'completed');assert.equal(JSON.parse(f.db.raw.prepare('SELECT payload_json FROM customer_workspace_state').get().payload_json).main.manualNote,'Keep customer work');assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,1);}finally{globalThis.fetch=old;}
});

sqliteTest('all migrations and storage triggers support approved monitoring config, execution and retained evidence',async()=>{
 const {storageDb}=await import('./workspace-storage-fixture.mjs'),DB=storageDb(),token='full-monitoring-fixture';
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256(token));
 DB.raw.prepare("INSERT INTO customer_workspace_state(workspace_id,schema_version,version,payload_json,updated_by) VALUES('storage-w1',1,1,?,'storage-owner')").run(JSON.stringify({main:approvedMain()}));
 const env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')},encrypted=await encryptSecret('fc-full-fixture',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('storage-w1','firecrawl',?,'test')").run(encrypted);
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:[evidence()]});
 try{assert.equal((await handleMarketMonitoringRoute(request('/api/market-monitoring/config?workspace_id=storage-w1',{method:'PUT',token,body:{enabled:true,sourceTypes:['news']}}),env)).status,200);const response=await handleMarketMonitoringRoute(request('/api/market-monitoring/run?workspace_id=storage-w1',{method:'POST',token}),env);assert.equal((await response.json()).run.status,'completed');assert.equal(DB.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,1);assert.equal(DB.raw.prepare('SELECT revision FROM market_monitoring_configs').get().revision,1);}finally{globalThis.fetch=old;DB.raw.close();}
});

sqliteTest('provider response bounds and tender exclusion apply to actual monitoring evidence',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({data:Array.from({length:100},(_,i)=>({...evidence(),title:i===0?'New office procurement tender':'New office relocation',url:`https://example.com/story-${i}`}))});
 try{const result=(await (await run(f)).json()).run;assert.equal(result.status,'completed');assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,7);assert.equal(f.db.raw.prepare("SELECT count(*) n FROM market_monitoring_evidence WHERE title LIKE '%tender%'").get().n,0);}finally{globalThis.fetch=old;}
});

sqliteTest('stale saved Strategy and revoked scheduling authority suspend due automation with durable reasons',async()=>{
 for(const mutation of ['strategy','membership']){const f=await connectedFixture(),old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call');};
  try{if(mutation==='strategy'){const main=approvedMain();main.profile.priorityOffers='Changed';saveMain(f.db,main);}else f.db.raw.exec("UPDATE workspace_members SET role='viewer'");
   const [result]=await runDueMarketMonitoring(f.env);assert.equal(result.status,'failed');assert.ok(result.reason);assert.equal(calls,0);assert.equal(f.db.raw.prepare('SELECT enabled FROM market_monitoring_configs').get().enabled,0);assert.equal(f.db.raw.prepare('SELECT status FROM market_monitoring_runs').get().status,'failed');
  }finally{globalThis.fetch=old;}
 }
});

sqliteTest('missed scheduler periods coalesce once, fail safely and retry on the saved cadence',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;f.db.raw.exec("UPDATE market_monitoring_configs SET next_run_at='2020-01-01T00:00:00.000Z',frequency='daily'");let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({error:'private upstream detail'},{status:503});};
 try{const [result]=await runDueMarketMonitoring(f.env);assert.equal(result.status,'failed');assert.equal(calls,result.queryCount);assert.equal((await runDueMarketMonitoring(f.env)).length,0);const row=f.db.raw.prepare('SELECT next_run_at,last_run_at FROM market_monitoring_configs').get();assert.equal(Date.parse(row.next_run_at)-Date.parse(row.last_run_at),86400000);assert.doesNotMatch(f.db.raw.prepare('SELECT error_message FROM market_monitoring_runs').get().error_message,/private/);}finally{globalThis.fetch=old;}
});

sqliteTest('saving threshold does not unexpectedly move an existing future schedule to now',async()=>{
 const f=await connectedFixture(),future='2099-01-01T10:00:00.000Z';f.db.raw.prepare('UPDATE market_monitoring_configs SET next_run_at=?').run(future);
 assert.equal((await configure(f,{revision:1,minimumScore:80})).status,200);assert.equal(f.db.raw.prepare('SELECT next_run_at FROM market_monitoring_configs').get().next_run_at,future);
});

sqliteTest('pause remains available when saved workspace content is unreadable',async()=>{
 const f=await connectedFixture();f.db.raw.exec("UPDATE customer_workspace_state SET payload_json='broken'");
 assert.equal((await configure(f,{enabled:false,revision:1})).status,200);const row=f.db.raw.prepare('SELECT enabled,next_run_at FROM market_monitoring_configs').get();assert.equal(row.enabled,0);assert.equal(row.next_run_at,null);assert.equal((await configure(f,{revision:2})).status,409);
});

sqliteTest('atomic evidence commit guard rejects revocation after final asynchronous authorization check',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch,prepare=f.env.DB.prepare.bind(f.env.DB);let revoked=false;
 f.env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('INSERT INTO market_monitoring_evidence')){const originalRun=statement.run.bind(statement);statement.run=async()=>{if(!revoked){revoked=true;f.db.raw.exec("UPDATE workspace_members SET role='viewer'");}return originalRun();};}return statement;};
 globalThis.fetch=async()=>Response.json({data:[evidence()]});
 try{assert.equal((await (await run(f)).json()).run.status,'failed');assert.equal(revoked,true);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,0);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,0);}finally{globalThis.fetch=old;}
});

sqliteTest('hourly scheduler enforces ten-workspace bound and leaves the remainder for a later invocation',async()=>{
 const f=await connectedFixture();
 for(let i=2;i<=11;i++){const id='w'+i;f.db.raw.prepare('INSERT INTO workspaces VALUES(?)').run(id);f.db.raw.prepare("INSERT INTO workspace_members VALUES(?,'u1','owner')").run(id);f.db.raw.prepare('INSERT INTO customer_workspace_state(workspace_id,schema_version,version,payload_json) VALUES(?,1,1,?)').run(id,JSON.stringify({main:approvedMain()}));f.db.raw.prepare('INSERT INTO market_monitoring_configs(workspace_id,enabled,frequency,research_depth,source_types_json,signal_ids_json,created_by,next_run_at,strategy_signature) SELECT ?,enabled,frequency,research_depth,source_types_json,signal_ids_json,created_by,next_run_at,strategy_signature FROM market_monitoring_configs WHERE workspace_id=\'w1\'').run(id);}
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:[]});
 try{assert.equal((await runDueMarketMonitoring(f.env)).length,10);assert.equal((await runDueMarketMonitoring(f.env)).length,1);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_runs').get().n,11);}finally{globalThis.fetch=old;}
});

sqliteTest('regular, mandatory and snapshot targeting share active ICP offers and markets',async()=>{
 const f=await connectedFixture(),main=approvedMain();main.targetMarkets=['Sweden'];main.profile.targetMarkets='Finland';main.profile.priorityOffers='Steel';main.answers={priority_offers:'Reviewed offer'};main.market.icps=[{id:'clinical',active:true,targetMarkets:'Norway',offers:'Clinical training'}];main.market.strategyApproval=integrity.approval(main);saveMain(f.db,main);assert.equal((await configure(f,{revision:1})).status,200);
 f.db.raw.exec("INSERT INTO intelligence_sources(id,workspace_id,name,canonical_url,host,source_type,access_status,monitoring_enabled,mandatory,trigger_ids_json) VALUES('s1','w1','Company','https://evidence.example/','evidence.example','company','full',1,1,'[\"move\"]')");
 const old=globalThis.fetch,queries=[];globalThis.fetch=async(_,init)=>{queries.push(JSON.parse(init.body).query);return Response.json({data:[]});};
 try{assert.equal((await (await run(f)).json()).run.status,'completed');assert.ok(queries.some(q=>q.includes('site:evidence.example')));assert.ok(queries.every(q=>q.includes('Norway')&&q.includes('Clinical training')&&!q.includes('Finland')&&!q.includes('Steel')));assert.equal(JSON.parse(f.db.raw.prepare('SELECT snapshot_json FROM market_monitoring_runs').get().snapshot_json).markets,'Norway');}finally{globalThis.fetch=old;}
});

for(const phase of ['fetch','json'])sqliteTest('provider deadline settles ignored abort during '+phase,async()=>{
 const f=await connectedFixture(),oldFetch=globalThis.fetch,oldTimer=globalThis.setTimeout,oldTimeout=AbortSignal.timeout;let release;
 const waiting=new Promise(resolve=>release=resolve);globalThis.setTimeout=(fn,ms,...args)=>oldTimer(fn,ms===30000?5:ms,...args);AbortSignal.timeout=()=>oldTimeout(5);
 globalThis.fetch=phase==='fetch'?async()=>{await waiting;return Response.json({data:[]});}:async()=>({ok:true,status:200,json:async()=>{await waiting;return {data:[]};}});
 let pending;
 try{pending=run(f);const result=await Promise.race([pending.then(r=>r.json()),new Promise(resolve=>oldTimer(()=>resolve('did_not_settle'),100))]);assert.notEqual(result,'did_not_settle');assert.equal(result.run.status,'failed');assert.equal(result.run.reason,'provider_timeout');assert.equal(f.db.raw.prepare('SELECT lease_id FROM market_monitoring_configs').get().lease_id,null);}finally{release();if(pending)await pending;globalThis.fetch=oldFetch;globalThis.setTimeout=oldTimer;AbortSignal.timeout=oldTimeout;}
});

sqliteTest('HTTP 200 provider success false cannot become a successful empty research receipt',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;globalThis.fetch=async()=>Response.json({success:false,error:'sensitive upstream failure'});
 try{const result=(await (await run(f)).json()).run;assert.equal(result.status,'failed');assert.match(f.db.raw.prepare('SELECT error_message FROM market_monitoring_runs').get().error_message,/failed/);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,0);}finally{globalThis.fetch=old;}
});

const syndicatedEvidence=(company='Northstar Robotics')=>({url:'https://publisher.example/event',title:`${company} announces new office relocation in Norway`,date:new Date().toISOString(),markdown:`${company} announces a new office relocation in Norway. The industrial robotics manufacturer will consolidate its engineering and customer support teams in a newly leased Oslo building during November. The company confirmed a three year facility investment with dedicated testing laboratories, expanded training capacity and new technical recruitment. Its current service team will continue operations throughout the move, with customer demonstrations scheduled after the relocation is complete.`});
sqliteTest('identical syndicated company events preserve both URLs and create one alert across runs',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;let syndicated=false;globalThis.fetch=async()=>Response.json({data:[{...syndicatedEvidence(),url:syndicated?'https://second-publisher.example/story':'https://first-publisher.example/story'}]});
 try{await run(f);syndicated=true;await run(f);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,2);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,1);}finally{globalThis.fetch=old;}
});

for(const mutation of ['session_removed','session_expired','role_revoked'])for(const action of ['config','alert'])sqliteTest(action+' commit rejects '+mutation+' after final access recheck',async()=>{
 const f=await connectedFixture(),prepare=f.env.DB.prepare.bind(f.env.DB);
 f.db.raw.exec("INSERT INTO market_monitoring_runs(id,workspace_id,trigger_type,research_depth,status) VALUES('seed','w1','manual','deep','completed'); INSERT INTO market_monitoring_evidence(id,workspace_id,run_id,fingerprint,source_url,source_type,title,score) VALUES('seed-e','w1','seed','seed','https://example.com','news','Seed',80); INSERT INTO market_monitoring_alerts(id,workspace_id,evidence_id,score,title,source_url) VALUES('seed-a','w1','seed-e',80,'Seed','https://example.com')");
 f.env.DB.prepare=sql=>{const statement=prepare(sql);if((action==='config'&&sql.startsWith('INSERT INTO market_monitoring_configs'))||(action==='alert'&&sql.startsWith('UPDATE market_monitoring_alerts SET status='))){const originalRun=statement.run.bind(statement);statement.run=async()=>{if(mutation==='session_removed')f.db.raw.exec('DELETE FROM sessions');if(mutation==='session_expired')f.db.raw.exec("UPDATE sessions SET expires_at='2000-01-01'");if(mutation==='role_revoked')f.db.raw.exec("UPDATE workspace_members SET role='viewer'");return originalRun();};}return statement;};
 const response=action==='config'?await configure(f,{enabled:false,revision:1}):await handleMarketMonitoringRoute(request('/api/market-monitoring/alerts/seed-a?workspace_id=w1',{method:'PATCH',token:f.token,body:{status:'read'}}),f.env);
 assert.ok(response.status>=400);if(action==='config')assert.equal(f.db.raw.prepare('SELECT enabled FROM market_monitoring_configs').get().enabled,1);else assert.equal(f.db.raw.prepare("SELECT status FROM market_monitoring_alerts WHERE id='seed-a'").get().status,'new');
});

for(const variation of ['short_generic','long_generic','different_company','different_event'])sqliteTest('event alert dedup preserves distinct '+variation+' evidence',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch;let evidenceRows;
 if(variation==='short_generic')evidenceRows=[{...evidence(),url:'https://one.example/1'},{...evidence(),url:'https://two.example/2'}];
 if(variation==='long_generic'){const generic={...syndicatedEvidence(),title:'Company announces new office relocation',markdown:syndicatedEvidence('Company').markdown};evidenceRows=[{...generic,url:'https://one.example/1'},{...generic,url:'https://two.example/2'}];}
 if(variation==='different_company')evidenceRows=[{...syndicatedEvidence('Northstar Robotics'),url:'https://one.example/1'},{...syndicatedEvidence('Brightwater Foods'),url:'https://two.example/2'}];
 if(variation==='different_event')evidenceRows=[{...syndicatedEvidence(),url:'https://one.example/1'},{...syndicatedEvidence(),markdown:syndicatedEvidence().markdown.replace('Oslo','Bergen').replace('November','December'),url:'https://two.example/2'}];
 globalThis.fetch=async()=>Response.json({data:evidenceRows});
 try{await run(f);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,2);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,2);}finally{globalThis.fetch=old;}
});

sqliteTest('per-query settlement uses remaining run budget when less than thirty seconds remain',async()=>{
 const f=await connectedFixture(),oldFetch=globalThis.fetch,oldNow=Date.now,prepare=f.env.DB.prepare.bind(f.env.DB),start=oldNow();let release;
 f.env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('UPDATE market_monitoring_runs SET query_count=')){const originalRun=statement.run.bind(statement);statement.run=async()=>{Date.now=()=>start+299995;return originalRun();};}return statement;};
 const waiting=new Promise(resolve=>release=resolve);globalThis.fetch=async()=>{await waiting;return Response.json({data:[]});};
 try{const result=await Promise.race([run(f).then(r=>r.json()),new Promise(resolve=>setTimeout(()=>resolve('did_not_settle'),100))]);assert.notEqual(result,'did_not_settle');assert.equal(result.run.status,'failed');assert.equal(result.run.reason,'provider_timeout');assert.equal(f.db.raw.prepare('SELECT lease_id FROM market_monitoring_configs').get().lease_id,null);}finally{release();Date.now=oldNow;globalThis.fetch=oldFetch;}
});

sqliteTest('manual run atomic guard checks the acting member separately from the schedule creator',async()=>{
 const f=await connectedFixture(),old=globalThis.fetch,prepare=f.env.DB.prepare.bind(f.env.DB);f.token='second-researcher';
 f.db.raw.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u2','second@example.com','Researcher','researcher');f.db.raw.prepare("INSERT INTO sessions VALUES(?,'u2',datetime('now','+1 day'))").run(await sha256(f.token));f.db.raw.exec("INSERT INTO workspace_members VALUES('w1','u2','researcher')");
 f.env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('INSERT INTO market_monitoring_evidence')){const originalRun=statement.run.bind(statement);statement.run=async()=>{f.db.raw.exec("UPDATE workspace_members SET role='viewer' WHERE user_id='u2'");return originalRun();};}return statement;};globalThis.fetch=async()=>Response.json({data:[evidence()]});
 try{const result=(await (await run(f)).json()).run;assert.equal(result.status,'failed');assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,0);assert.equal(f.db.raw.prepare("SELECT role FROM workspace_members WHERE user_id='u1'").get().role,'owner');}finally{globalThis.fetch=old;}
});

sqliteTest('enabling rejects a supplied UI Strategy binding that differs from current saved approval',async()=>{
 const f=await fixture();saveMain(f.db,approvedMain());
 const response=await configure(f,{strategy_signature:'different-current-ui-strategy'});assert.equal(response.status,409);assert.match((await response.json()).error,/Strategy changed.*review.*reload/i);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM market_monitoring_configs').get().n,0);
});

sqliteTest('enabling accepts a supplied UI Strategy binding matching the current saved approval',async()=>{
 const f=await fixture(),main=approvedMain();saveMain(f.db,main);
 const binding=integrity.digest(integrity.signature(main));const response=await configure(f,{strategy_signature:binding});assert.equal(response.status,200);const row=f.db.raw.prepare('SELECT enabled,strategy_signature FROM market_monitoring_configs').get();assert.equal(row.enabled,1);assert.equal(row.strategy_signature,binding);
});
