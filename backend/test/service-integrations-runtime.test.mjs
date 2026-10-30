import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {sha256} from '../src/security.js';
import {fetchDirectPublicPage,handleServiceIntegrationRoute,resolveWorkspaceServiceCredential,withWorkspaceServiceCredentials} from '../src/service-integrations.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const migration=fs.readFileSync(path.join(__dirname,'..','migrations','0013_workspace_service_integrations.sql'),'utf8');
const hunterMigration=fs.readFileSync(path.join(__dirname,'..','migrations','0023_hunter_service_integration.sql'),'utf8');
const gateMigration=fs.readFileSync(path.join(__dirname,'..','migrations','0049_firecrawl_rate_gate.sql'),'utf8');
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes||0)}};}
}
class D1Db{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
      CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
      CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
      INSERT INTO workspaces VALUES('w1','Workspace One');
    `);
    this.raw.exec(migration);
    this.raw.exec(hunterMigration);
    this.raw.exec(gateMigration);
  }
  prepare(sql){return new D1Statement(this.raw,sql);}
}
async function fixture(role='owner'){
  const DB=new D1Db();const token=`service-${role}-session`;const tokenHash=await sha256(token);
  DB.raw.prepare(`INSERT INTO users VALUES(?,?,?,?)`).run('u1',`${role}@example.com`,role,role);
  DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(tokenHash,'u1');
  DB.raw.prepare(`INSERT INTO workspace_members VALUES(?,?,?)`).run('w1','u1',role);
  const encryption=Buffer.alloc(32,7).toString('base64');
  return {DB,token,env:{DB,OAUTH_TOKEN_ENCRYPTION_KEY:encryption,APOLLO_API_KEY:'managed-apollo-key',APOLLO_WEBHOOK_SECRET:'stable-webhook-secret',FIRECRAWL_PROXY_URL:'https://managed.example.test'}};
}
async function connectFirecrawl(env,metadata=null){
 const encrypted=await encryptSecret('fc-customer-test',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 env.DB.raw.prepare("INSERT OR REPLACE INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','firecrawl',?,'test',?)").run(encrypted,JSON.stringify(metadata||{}));
}
sqliteTest('public extraction reports actual direct use and skips unused extractors',async()=>{
 const {env,token}=await fixture(),old=globalThis.fetch;globalThis.fetch=async()=>new Response('<h1>Company team</h1><p>Anna Andersson, Head of Procurement. '+('Company professional contact information. '.repeat(5))+'</p>',{headers:{'Content-Type':'text/html'}});
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/team',publicFirst:true}}),env,{}),p=await r.json();assert.equal(r.status,200);assert.equal(p.researchTrace.find(e=>e.provider==='direct').status,'succeeded');for(const provider of ['firecrawl','scrapling'])assert.equal(p.researchTrace.find(e=>e.provider===provider).status,'skipped');}finally{globalThis.fetch=old;}
});
sqliteTest('cancellation during extraction retains the attempted extractor and never starts another tool',async()=>{
 const {env,token}=await fixture(),controller=new AbortController(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;controller.abort();throw Object.assign(new Error('Canceled'),{name:'AbortError'});};
 try{const request=new Request(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/team',publicFirst:true}}),{signal:controller.signal}),r=await handleServiceIntegrationRoute(request,env,{}),p=await r.json();assert.equal(r.status,499);assert.equal(calls,1);assert.deepEqual(p.researchTrace.map(e=>[e.provider,e.status]),[['direct','failed']]);}finally{globalThis.fetch=old;}
});
sqliteTest('public extraction records direct and Firecrawl failures before successful configured Scrapling fallback',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env);env.SCRAPLING_SERVICE_URL='https://scrapling.example/api/scrapling';env.SCRAPLING_SERVICE_TOKEN='service-test';const old=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('api.firecrawl.dev'))return new Response(JSON.stringify({error:'Temporary failure'}),{status:503});if(String(url).includes('scrapling.example'))return new Response(JSON.stringify({success:true,data:{markdown:'Anna Andersson — Head of Procurement — Company. '+('Public team contact details. '.repeat(8)),metadata:{source:'scrapling-fallback',sourceURL:'https://company.example/team'}}}));return new Response('Access denied',{status:503});};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/team',publicFirst:true}}),env,{}),p=await r.json();assert.equal(r.status,200);assert.deepEqual(p.researchTrace.map(e=>[e.provider,e.status]),[['direct','failed'],['firecrawl','failed'],['scrapling','succeeded']]);assert.equal(calls.length,3);}finally{globalThis.fetch=old;}
});
sqliteTest('public-first extraction reads company staff without any provider key or credit call',async()=>{
 const {env,token}=await fixture();const old=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return new Response('<html><title>Company contact</title><h3>Personal</h3><p><strong>Anna Andersson</strong> CEO</p><p>anna@company.example</p><a href="/team">Team</a></html>',{headers:{'Content-Type':'text/html'}});};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/contact',publicFirst:true,formats:['markdown','links']}}),env,{});assert.equal(r.status,200);const p=await r.json();assert.match(p.data.markdown,/### Personal/);assert.match(p.data.markdown,/\*\*Anna Andersson\*\*/);assert.ok(p.data.links.includes('https://company.example/team'));assert.deepEqual(calls,['https://company.example/contact']);assert.equal(p.data.metadata.source,'direct-fallback');}finally{globalThis.fetch=old;}
});
sqliteTest('cancelled public-first reads do not start a page or extractor request',async()=>{
 const {env,token}=await fixture(),controller=new AbortController();controller.abort();const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected request');};
 try{const request=new Request(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/contact',publicFirst:true}}),{signal:controller.signal});const r=await handleServiceIntegrationRoute(request,env,{});assert.equal(r.status,499);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('direct staff extraction preserves inline names and roles when the source wraps a break inside bold text',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('<h3>Personal</h3><p><strong>Lars Olausson<br/></strong>Ordermottagare/konstruktör</p><p>Tel. 08 50 10 37 28</p>',{headers:{'Content-Type':'text/html'}});
 try{const p=await fetchDirectPublicPage('https://company.example/contact');assert.match(p.data.markdown,/\*\*Lars Olausson\*\* Ordermottagare\/konstruktör/);}finally{globalThis.fetch=old;}
});
sqliteTest('a public-first blocker page falls through to configured extraction rather than becoming a completed empty read',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env);const old=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('api.firecrawl.dev'))return new Response(JSON.stringify({success:true,data:{markdown:'### Team\nAnna Andersson\nCEO\nanna@company.example',metadata:{sourceURL:'https://company.example/contact'}}}),{headers:{'Content-Type':'application/json'}});return new Response('<title>Just a moment</title><p>Verify you are human. Cloudflare ray id.</p>',{headers:{'Content-Type':'text/html'}});};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/contact',publicFirst:true}}),env,{});assert.equal(r.status,200);assert.match((await r.json()).data.markdown,/Anna Andersson/);assert.equal(calls.length,2);}finally{globalThis.fetch=old;}
});
sqliteTest('company-wide Apollo identity searches do not force management filters and keyword fallback stays identity-only',async()=>{
 const {env,token}=await fixture();const encrypted=await encryptSecret('customer-test',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));env.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w1','apollo',?,'test')").run(encrypted);
 const old=globalThis.fetch,bodies=[];globalThis.fetch=async(_,options)=>{bodies.push(JSON.parse(options.body));return new Response(JSON.stringify({people:[{id:'p1',name:'Anna Andersson',title:'Design Engineer',email:'hidden@company.example',organization:{name:'Company AB'}}]}),{headers:{'Content-Type':'application/json'}});};
 try{for(const fallback of [false,true]){const r=await handleServiceIntegrationRoute(req('/api/integrations/services/apollo/people-search?workspace_id=w1',{method:'POST',token,body:{q_organization_domains_list:['company.example'],discovery_scope:'company',person_titles:[],...(fallback?{companyNameFallback:true,company_name:'Company AB',q_keywords:'Company AB'}:{})}}),env,{});assert.equal(r.status,200);assert.equal('email' in (await r.json()).people[0],false);}
 assert.deepEqual(bodies[0].person_seniorities,[]);assert.deepEqual(bodies[0].person_titles,[]);assert.deepEqual(bodies[0].q_organization_domains_list,['company.example']);assert.equal(bodies[1].q_keywords,'Company AB');assert.equal('q_organization_domains_list' in bodies[1],false);assert.equal(bodies[1].per_page,25);
 }finally{globalThis.fetch=old;}
});
function req(pathname,{method='GET',token,body,headers={}}={}){return new Request(`https://api.example.test${pathname}`,{method,headers:{...headers,...(token?{Cookie:`leadintel_session=${token}`}:{...{}}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}

sqliteTest('Setup connection operations correlate bounded provider checks and persistence without secrets',async()=>{
 const {env,token,DB}=await fixture(),old=globalThis.fetch,operationId='setup-connect-1234',secret='fc-private-team-token';let reject=false;
 globalThis.fetch=async()=>reject?new Response(JSON.stringify({error:'Rejected '+secret}),{status:401}):new Response(JSON.stringify({success:true,data:{remainingCredits:42}}));
 try{
  const saved=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:secret},headers:{'X-LeadIntel-Operation-Id':operationId}}),env,{});
  assert.equal(saved.status,200);assert.equal(saved.headers.get('X-LeadIntel-Operation-Id'),operationId);
  let events=DB.raw.prepare("SELECT event_type,metadata_json FROM audit_events WHERE entity_type='workspace_service_integration' ORDER BY rowid").all();
  assert.deepEqual(events.map(e=>e.event_type),['service.provider_check_started','service.provider_saved']);assert.ok(events.every(e=>JSON.parse(e.metadata_json).operation_id===operationId));assert.doesNotMatch(JSON.stringify(events),/fc-private-team-token|encrypted_api_key/);
  reject=true;const checked=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token,headers:{'X-LeadIntel-Operation-Id':'setup-recheck-5678'}}),env,{});
  assert.equal(checked.headers.get('X-LeadIntel-Operation-Id'),'setup-recheck-5678');events=DB.raw.prepare("SELECT event_type,metadata_json FROM audit_events WHERE entity_type='workspace_service_integration' ORDER BY rowid").all();
  assert.equal(events.at(-1).event_type,'service.provider_check_failed');assert.equal(JSON.parse(events.at(-1).metadata_json).operation_id,'setup-recheck-5678');assert.doesNotMatch(JSON.stringify(events),/fc-private-team-token/);
  const invalid=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token,headers:{'X-LeadIntel-Operation-Id':'https://private.example/token?secret=bad'}}),env,{});
  assert.match(invalid.headers.get('X-LeadIntel-Operation-Id'),/^[0-9a-f-]{36}$/);
 }finally{globalThis.fetch=old;}
});

sqliteTest('connection rejection and status checks never expose credential-bearing upstream errors',async()=>{
 const {env,token}=await fixture(),old=globalThis.fetch,secret='fc-private-customer-token';
 globalThis.fetch=async()=>new Response(JSON.stringify({error:`Rejected Authorization: Bearer ${secret}; account private@example.test`}),{status:401});
 try{
  const rejected=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:secret}}),env,{});
  assert.equal(rejected.status,422);assert.doesNotMatch(await rejected.text(),/fc-private-customer-token|private@example/);
  await connectFirecrawl(env);
  const checked=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token}),env,{}),status=await checked.json();
  assert.equal(status.providers.find(p=>p.provider==='firecrawl').state,'bad');assert.doesNotMatch(JSON.stringify(status),/fc-private-customer-token|private@example/);
 }finally{globalThis.fetch=old;}
});

sqliteTest('a late status verification cannot overwrite a replacement credential balance or flags',async()=>{
 const {env,token,DB}=await fixture(),old=globalThis.fetch;await connectFirecrawl(env,{remaining_credits:40,plan_credits:1000});
 let release,started;const entered=new Promise(resolve=>{started=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async()=>{started();await waiting;return new Response(JSON.stringify({success:true,data:{remainingCredits:0,planCredits:1000}}));};
 try{
  const pending=handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token}),env,{});await entered;
  const encrypted=await encryptSecret('fc-replacement-token',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
  DB.raw.prepare("UPDATE workspace_service_integrations SET encrypted_api_key=?,key_hint='new!',metadata_json=? WHERE workspace_id='w1' AND provider='firecrawl'").run(encrypted,JSON.stringify({remaining_credits:900,plan_credits:1000}));
  release();const status=await (await pending).json(),provider=status.providers.find(p=>p.provider==='firecrawl');
  assert.equal(JSON.parse(DB.raw.prepare("SELECT metadata_json FROM workspace_service_integrations WHERE provider='firecrawl'").get().metadata_json).remaining_credits,900);
  assert.equal(provider.key_hint,'new!');assert.equal(provider.metadata.remaining_credits,900);assert.equal(provider.credit_issue,null);
 }finally{release();globalThis.fetch=old;}
});

sqliteTest('a verification finishing after disconnect reports the current disconnected state',async()=>{
 const {env,token,DB}=await fixture(),old=globalThis.fetch;await connectFirecrawl(env);
 let release,started;const entered=new Promise(resolve=>{started=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async()=>{started();await waiting;return new Response(JSON.stringify({success:true,data:{remainingCredits:50}}));};
 try{
  const pending=handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token}),env,{});await entered;
  const disconnected=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'DELETE',token,body:{provider:'firecrawl'}}),env,{});assert.equal(disconnected.status,200);
  release();const provider=(await (await pending).json()).providers.find(p=>p.provider==='firecrawl');
  assert.equal(provider.configured,false);assert.equal(DB.raw.prepare("SELECT count(*) n FROM workspace_service_integrations").get().n,0);
 }finally{release();globalThis.fetch=old;}
});

sqliteTest('a reconnect started before disconnect cannot restore the disconnected credential',async()=>{
 const {env,token,DB}=await fixture(),old=globalThis.fetch;await connectFirecrawl(env);
 let release,started;const entered=new Promise(resolve=>{started=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async()=>{started();await waiting;return new Response(JSON.stringify({success:true,data:{remainingCredits:50}}));};
 try{
  const pending=handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-slow-replacement'}}),env,{});await entered;
  assert.equal((await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'DELETE',token,body:{provider:'firecrawl'}}),env,{})).status,200);
  release();const saved=await pending;
  assert.equal(saved.status,409);assert.equal(DB.raw.prepare('SELECT count(*) n FROM workspace_service_integrations').get().n,0);
 }finally{release();globalThis.fetch=old;}
});

sqliteTest('concurrent first connections preserve the credential that completed first',async()=>{
 const {env,token}=await fixture(),old=globalThis.fetch;
 let release,started;const entered=new Promise(resolve=>{started=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async(_,options)=>{if(options.headers.Authorization==='Bearer fc-slow-first'){started();await waiting;}return new Response(JSON.stringify({success:true,data:{remainingCredits:50}}));};
 try{
  const pending=handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-slow-first'}}),env,{});await entered;
  const winner=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-fast-second'}}),env,{});assert.equal(winner.status,200);
  release();assert.equal((await pending).status,409);assert.equal((await resolveWorkspaceServiceCredential(env,'w1','firecrawl')).apiKey,'fc-fast-second');
 }finally{release();globalThis.fetch=old;}
});

sqliteTest('Hunter zero balances flag payment and fresh positive balances clear it without consuming credits',async()=>{
 const {env,token}=await fixture(),original=globalThis.fetch;let remaining=0,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify({data:{requests:{credits:{remaining},verifications:{remaining:30},searches:{remaining:20}}}}));};
 try{
  await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-test-secret'}}),env,{});
  const status=async verify=>{const response=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1'+(verify?'&verify=1':''),{token}),env,{});return (await response.json()).providers.find(row=>row.provider==='hunter');};
  assert.equal((await status(false)).credit_issue.code,'credits_exhausted');assert.equal((await status(true)).state,'bad');
  remaining=10;assert.equal((await status(true)).credit_issue,null);assert.equal((await status(false)).state,'good');
  assert.equal(calls.some(url=>/email-verifier|email-finder/.test(url)),false);
 }finally{globalThis.fetch=original;}
});

sqliteTest('Hunter real-request payment failures persist across status reload and clear after recovery',async()=>{
 const {env,token,DB}=await fixture(),original=globalThis.fetch;let statusCode=402;
 globalThis.fetch=async url=>String(url).includes('/account')?new Response(JSON.stringify({data:{requests:{verifications:{remaining:42}}}})):new Response(JSON.stringify(statusCode===200?{data:{email:'marta@example.com',status:'valid'}}:{errors:[{id:'not_enough_credits'}]}),{status:statusCode});
 try{
  await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-test-secret'}}),env,{});
  await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:true}}),env,{});
  const check=async()=>{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token}),env,{});return (await r.json()).providers.find(row=>row.provider==='hunter');};
  for(const [route,body] of [['verify-email',{email:'marta@example.com'}],['find-email',{domain:'example.com',first_name:'Marta',last_name:'Smith'}]]){
   statusCode=route==='verify-email'?402:403;const failed=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/'+route+'?workspace_id=w1',{method:'POST',token,body}),env,{});assert.equal(failed.status,statusCode);assert.match((await failed.json()).error,/credits exhausted or payment/);assert.equal((await check()).credit_issue.code,'credits_exhausted');
   statusCode=200;await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta@example.com'}}),env,{});assert.equal((await check()).credit_issue,null);
  }
  assert.ok(DB.raw.prepare("SELECT count(*) AS count FROM audit_events WHERE entity_id='hunter' AND event_type='provider.credit_exhausted'").get().count>=2);
 }finally{globalThis.fetch=original;}
});

sqliteTest('reconnecting a provider with verified positive credits clears the old credential billing alert',async()=>{
 const {env,token,DB}=await fixture(),old=globalThis.fetch;
 DB.raw.prepare("INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json) VALUES('old-credit-failure','w1','provider.credit_exhausted','provider_credit','firecrawl','{\"source\":\"customer\"}')").run();
 globalThis.fetch=async()=>Response.json({success:true,data:{remainingCredits:900,planCredits:1000}});
 try{
  const saved=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-new-funded-account'}}),env,{});assert.equal(saved.status,200);
  const status=await (await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token}),env,{})).json(),provider=status.providers.find(p=>p.provider==='firecrawl');
  assert.equal(provider.credit_issue,null);assert.equal(provider.state,'good');
 }finally{globalThis.fetch=old;}
});

sqliteTest('Hunter authentication failures and ordinary rate limits do not become payment alerts',async()=>{
 const {env,token}=await fixture(),original=globalThis.fetch;let failure=0;
 globalThis.fetch=async url=>String(url).includes('/account')?new Response(JSON.stringify({data:{requests:{verifications:{remaining:null,available:0,used:0}}}})):new Response(JSON.stringify({errors:[{id:failure===429?'rate_limit_exceeded':'invalid_api_key'}]}),{status:failure});
 try{
  await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-test-secret'}}),env,{});await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:true}}),env,{});
  for(failure of [401,403,429]){
   const r=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta@example.com'}}),env,{});assert.equal(r.status,failure);
   const status=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token}),env,{});assert.equal((await status.json()).providers.find(row=>row.provider==='hunter').credit_issue,null);
  }
 }finally{globalThis.fetch=original;}
});
async function payload(response){return response.json();}

sqliteTest('owner save encrypts Apollo key, returns only a hint, and authenticated runtime receives the customer credential',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const seen=[];
  globalThis.fetch=async (url,options={})=>{seen.push({url:String(url),options});return new Response(JSON.stringify({healthy:true,is_logged_in:true}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'apollo',api_key:'apollo-customer-secret-ABCD'}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.source,'customer');assert.equal(result.key_hint,'••••ABCD');
    assert.equal(JSON.stringify(result).includes('apollo-customer-secret-ABCD'),false);
    assert.equal(seen.length,1);assert.equal(seen[0].options.headers['x-api-key'],'apollo-customer-secret-ABCD');
    const row=DB.raw.prepare(`SELECT * FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='apollo'`).get();
    assert.ok(row.encrypted_api_key);assert.equal(row.encrypted_api_key.includes('apollo-customer-secret-ABCD'),false);
    const resolved=await resolveWorkspaceServiceCredential(env,'w1','apollo');assert.equal(resolved.source,'customer');assert.equal(resolved.apiKey,'apollo-customer-secret-ABCD');
    const runtime=await withWorkspaceServiceCredentials(req('/api/crm/companies?workspace_id=w1',{token}),env);
    assert.equal(runtime.APOLLO_API_KEY,'apollo-customer-secret-ABCD');assert.equal(runtime.APOLLO_WEBHOOK_SECRET,'stable-webhook-secret');
    const anonymous=await withWorkspaceServiceCredentials(req('/api/crm/companies?workspace_id=w1'),env);assert.equal(anonymous.APOLLO_API_KEY,'');assert.equal(env.APOLLO_API_KEY,'managed-apollo-key');
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Apollo buyer search uses the authenticated workspace key and returns identity-only results',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/auth/health'))return new Response(JSON.stringify({healthy:true,is_logged_in:true}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({people:[{id:'apollo-person-1',name:'Marta Buyer',title:'Procurement Director',seniority:'director',email:'private@example.com',organization:{name:'Example AB'},city:'Stockholm',country:'Sweden',linkedin_url:'https://www.linkedin.com/in/marta-buyer'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const saved=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'apollo',api_key:'apollo-customer-secret-ABCD'}}),env,{});
    assert.equal(saved.status,200);
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/apollo/people-search?workspace_id=w1',{method:'POST',token,body:{q_organization_domains_list:['example.com'],person_titles:['Procurement Director'],include_similar_titles:true,person_seniorities:['director'],page:1,per_page:10}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(calls[1].url,'https://api.apollo.io/api/v1/mixed_people/api_search');
    assert.equal(calls[1].options.headers['X-Api-Key'],'apollo-customer-secret-ABCD');
    assert.deepEqual(JSON.parse(calls[1].options.body),{q_organization_domains_list:['example.com'],person_titles:['Procurement Director'],include_similar_titles:true,person_seniorities:['owner','founder','c_suite','partner','vp','head','director','manager'],page:1,per_page:10});
    assert.equal(result.people[0].id,'apollo-person-1');assert.equal(result.people[0].organization_name,'Example AB');
    assert.equal('email' in result.people[0],false,'buyer search must not expose contact details before explicit enrichment');
    const row=DB.raw.prepare(`SELECT last_used_at FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='apollo'`).get();assert.ok(row.last_used_at);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Apollo buyer search fails clearly when no workspace or managed key is available',async()=>{
  const {env,token}=await fixture('owner');delete env.APOLLO_API_KEY;
  const response=await handleServiceIntegrationRoute(req('/api/integrations/services/apollo/people-search?workspace_id=w1',{method:'POST',token,body:{q_organization_domains_list:['example.com'],person_titles:['CEO']}}),env,{});
  assert.equal(response.status,409);const result=await payload(response);
  assert.equal(result.code,'SERVICE_APOLLO_NOT_CONFIGURED');
  assert.match(result.error,/Apollo.*workspace/i);
});

sqliteTest('non-owner cannot replace workspace service credentials',async()=>{
  const {env,token}=await fixture('researcher');let fetchCalled=false;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{fetchCalled=true;return new Response('{}',{status:200});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'apollo',api_key:'should-not-be-used'}}),env,{});
    assert.equal(response.status,403);assert.equal(fetchCalled,false);assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM workspace_service_integrations`).get().count,0);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Hunter key uses the free account check and stays encrypted without a managed fallback',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({data:{plan_name:'Starter',requests:{verifications:{remaining:42}},email:'private@example.test'}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const saved=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-secret-WXYZ'}}),env,{});
    assert.equal(saved.status,200);const data=await payload(saved);assert.equal(data.metadata.remaining_verifications,42);
    assert.equal(JSON.stringify(data).includes('hunter-secret-WXYZ'),false);assert.equal(JSON.stringify(data).includes('private@example.test'),false);
    assert.equal(calls[0].url,'https://api.hunter.io/v2/account');assert.equal(calls[0].options.headers['X-API-KEY'],'hunter-secret-WXYZ');
    const row=DB.raw.prepare("SELECT encrypted_api_key FROM workspace_service_integrations WHERE provider='hunter'").get();assert.ok(row.encrypted_api_key);assert.equal(row.encrypted_api_key.includes('hunter-secret-WXYZ'),false);
    const status=await payload(await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token}),env,{}));
    assert.equal(status.providers.find(item=>item.provider==='hunter').source,'customer');
    const removed=await payload(await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'DELETE',token,body:{provider:'hunter'}}),env,{}));assert.equal(removed.fallback,false);
    const unconfigured=await payload(await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1',{token}),env,{}));assert.equal(unconfigured.providers.find(item=>item.provider==='hunter').source,'none');
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Hunter verifies one requested pattern without claiming a Gmail identity',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    return new Response(JSON.stringify(calls.length===1?{data:{plan_name:'Starter',requests:{verifications:{remaining:10}}}}:{data:{email:'marta.buyer@gmail.com',status:'webmail',webmail:true,score:50}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const before=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta.buyer@gmail.com'}}),env,{});
    assert.equal(before.status,409);assert.equal(calls.length,0);
    const saved=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-secret-WXYZ'}}),env,{});assert.equal(saved.status,200);
    await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:true}}),env,{});
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta.buyer@gmail.com'}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.status,'webmail');assert.equal(result.deliverability,'inconclusive');assert.equal(result.identity_confirmed,false);
    assert.equal(calls[1].url,'https://api.hunter.io/v2/email-verifier?email=marta.buyer%40gmail.com');
    assert.equal(calls[1].options.headers['X-API-KEY'],'hunter-secret-WXYZ');assert.equal(JSON.stringify(result).includes('hunter-secret'),false);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Hunter finder is scoped to a company domain and returns only a safe email and source',async()=>{
  const {env,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify(calls.length===1?{data:{plan_name:'Starter'}}:{data:{email:'marta.berzina@example.lv',source_type:'found',verification:{status:'valid'},sources:[{uri:'https://example.lv/team'}],phone_number:'private',api_key:'leak'}}),{status:200});};
  try{
    const save=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-secret-WXYZ'}}),env,{});assert.equal(save.status,200);
    const invalid=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/find-email?workspace_id=w1',{method:'POST',token,body:{domain:'localhost',first_name:'Marta',last_name:'Berzina'}}),env,{});assert.equal(invalid.status,400);
    await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:true}}),env,{});
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/find-email?workspace_id=w1',{method:'POST',token,body:{domain:'example.lv',first_name:'Marta',last_name:'Berzina'}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.email,'marta.berzina@example.lv');assert.equal(result.source,'https://example.lv/team');assert.equal(result.identity_confirmed,false);
    assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('hunter-secret'),false);
    assert.match(calls[1].url,/^https:\/\/api\.hunter\.io\/v2\/email-finder\?/);assert.equal(calls[1].options.headers['X-API-KEY'],'hunter-secret-WXYZ');
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('customer Firecrawl key is verified, used for signed-in research, and records last use',async()=>{
  const {env,DB,token}=await fixture('owner');const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).endsWith('/v2/team/credit-usage'))return new Response(JSON.stringify({success:true,data:{remainingCredits:321,planCredits:500,billingPeriodEnd:'2026-10-01'}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).endsWith('/v2/search'))return new Response(JSON.stringify({success:true,data:{web:[{url:'https://example.com',title:'Example'}]}}),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error(`Unexpected fetch ${url}`);
  };
  try{
    let response=await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'firecrawl',api_key:'fc-customer-secret-WXYZ'}}),env,{});
    assert.equal(response.status,200);const saved=await payload(response);assert.equal(saved.metadata.remaining_credits,321);assert.equal(saved.key_hint,'••••WXYZ');
    response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian companies expanding offices',limit:4}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);assert.equal(result.data[0].url,'https://example.com');
    assert.equal(calls[1].url,'https://api.firecrawl.dev/v2/search');assert.equal(calls[1].options.headers.Authorization,'Bearer fc-customer-secret-WXYZ');
    const row=DB.raw.prepare(`SELECT last_used_at FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='firecrawl'`).get();assert.ok(row.last_used_at);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('Firecrawl rejects an empty workspace instead of billing the platform',async()=>{
 const {env,token}=await fixture();const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'expansion'}}),env,{});assert.equal(r.status,409);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});

sqliteTest('signed-in Company Discovery keeps its first search pass metadata-only',async()=>{
  const {env,token}=await fixture('owner');await connectFirecrawl(env);const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({success:true,data:[{url:'https://fallback.example',title:'Fallback company',description:'Company description'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian companies expanding offices',limit:4}}),env,{});
    assert.equal(response.status,200);assert.equal(calls.length,1);
    assert.deepEqual(JSON.parse(calls[0].options.body),{query:'Latvian companies expanding offices',limit:4});
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('signed-in deeper research preserves explicitly requested Markdown extraction',async()=>{
  const {env,token}=await fixture('owner');await connectFirecrawl(env);const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({success:true,data:[{url:'https://evidence.example',title:'Evidence'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'Latvian expansion evidence',limit:4,scrapeOptions:{formats:['markdown']}}}),env,{});
    assert.equal(response.status,200);assert.equal(calls.length,1);
    assert.deepEqual(JSON.parse(calls[0].options.body),{query:'Latvian expansion evidence',limit:4,scrapeOptions:{formats:['markdown']}});
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('website scrape survives a customer Firecrawl outage by using a bounded direct public-page fallback',async()=>{
  const {env,token}=await fixture('owner');await connectFirecrawl(env);const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    const target=String(url);calls.push({url:target,options});
    if(target==='https://api.firecrawl.dev/v2/scrape')return new Response(JSON.stringify({error:'Route not found'}),{status:503,headers:{'Content-Type':'application/json'}});
    if(target==='https://www.ajprodukti.lv/')return new Response('<!doctype html><html><head><title>AJ Produkti</title><meta name="description" content="Workplace equipment"></head><body><h1>AJ Produkti</h1><p>Biroja mēbeles un darba vides aprīkojums.</p></body></html>',{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Content-Length':'208'}});
    throw new Error(`Unexpected fetch ${target}`);
  };
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://www.ajprodukti.lv',formats:['markdown'],onlyMainContent:true}}),env,{});
    assert.equal(response.status,200);const result=await payload(response);
    assert.equal(result.success,true);assert.match(result.data.markdown,/AJ Produkti/);assert.match(result.data.markdown,/Biroja mēbeles/);
    assert.equal(result.data.metadata.title,'AJ Produkti');assert.equal(result.data.metadata.source,'direct-fallback');
    assert.deepEqual(calls.map(row=>row.url),['https://api.firecrawl.dev/v2/scrape','https://www.ajprodukti.lv/']);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('first-party research forwards link extraction without accepting arbitrary formats',async()=>{
  const {env,token}=await fixture('owner');await connectFirecrawl(env);const originalFetch=globalThis.fetch;let forwarded;
  globalThis.fetch=async(_,options)=>{forwarded=JSON.parse(options.body);return new Response(JSON.stringify({success:true,data:{markdown:'Readable company evidence',links:['/products']}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.se/',formats:['markdown','links','executeJavascript']}}),env,{});
    assert.equal(response.status,200);assert.deepEqual(forwarded.formats,['markdown','links']);assert.deepEqual((await payload(response)).data.links,['/products']);
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('direct website fallback refuses local or private-network targets',async()=>{
  const {env,token}=await fixture('owner');await connectFirecrawl(env);const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({error:'Route not found'}),{status:404,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'http://127.0.0.1/admin',formats:['markdown']}}),env,{});
    assert.equal(response.status,400);const result=await payload(response);assert.match(result.error,/public research URL/i);
    assert.equal(calls.length,0,'private-network URL must be rejected before any outbound request');
  }finally{globalThis.fetch=originalFetch;}
});

sqliteTest('missing customer key never invokes the shared Scrapling service',async()=>{
 const {env,token}=await fixture();env.SCRAPLING_SERVICE_URL='https://scrapling.example/api/scrapling';env.SCRAPLING_SERVICE_TOKEN='owner-secret';const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.se/'}}),env,{});assert.equal(r.status,409);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
sqliteTest('Hunter remains off after connecting and explicit owner opt-in survives connection checks',async()=>{
 const {env,token,DB}=await fixture();const original=globalThis.fetch;let verifications=0;
 globalThis.fetch=async url=>{if(String(url).includes('email-verifier'))verifications++;return new Response(JSON.stringify({data:{email:'marta@example.com',status:'valid',requests:{verifications:{available:100,used:0}}}}));};
 try{
  await handleServiceIntegrationRoute(req('/api/integrations/services/provider?workspace_id=w1',{method:'PUT',token,body:{provider:'hunter',api_key:'hunter-test-secret'}}),env,{});
  const blocked=await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta@example.com'}}),env,{});
  assert.equal(blocked.status,409);assert.equal(verifications,0);
  assert.equal((await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:true}}),env,{})).status,200);
  await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token}),env,{});
  assert.equal(JSON.parse(DB.raw.prepare("SELECT metadata_json FROM workspace_service_integrations WHERE workspace_id='w1' AND provider='hunter'").get().metadata_json).additional_verification_enabled,true);
  assert.equal((await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/verify-email?workspace_id=w1',{method:'POST',token,body:{email:'marta@example.com'}}),env,{})).status,200);assert.equal(verifications,1);
  DB.raw.exec("UPDATE workspace_members SET role='sales' WHERE workspace_id='w1'");assert.equal((await handleServiceIntegrationRoute(req('/api/integrations/services/hunter/settings?workspace_id=w1',{method:'PUT',token,body:{enabled:false}}),env,{})).status,403);
 }finally{globalThis.fetch=original;}
});

sqliteTest('customer-only billing never resolves platform keys for an empty workspace',async()=>{
 const {env}=await fixture();
 for(const provider of ['apollo','firecrawl','hunter']){
  const credential=await resolveWorkspaceServiceCredential(env,'w1',provider);
  assert.equal(credential.source,'none');assert.equal(credential.configured,false);assert.equal(credential.apiKey,'');
 }
});
sqliteTest('empty workspace service checks make no platform provider calls',async()=>{
 const {env,token}=await fixture(),original=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response('{}');};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/status?workspace_id=w1&verify=1',{token}),env,{});assert.equal(r.status,200);
 for(const row of (await r.json()).providers){assert.equal(row.source,'none');assert.equal(row.configured,false);assert.equal(row.state,'neutral');}assert.deepEqual(calls,[]);
 }finally{globalThis.fetch=original;}
});
sqliteTest('legacy CRM runtime cannot inherit the platform Apollo key without a workspace key',async()=>{
 const {env,token}=await fixture();
 for(const request of [req('/api/crm/companies?workspace_id=w1',{token}),req('/api/crm/companies?workspace_id=w1'),req('/api/enrichment-policy',{token})]){
  const runtime=await withWorkspaceServiceCredentials(request,env);assert.equal(runtime.APOLLO_API_KEY,'');assert.equal(env.APOLLO_API_KEY,'managed-apollo-key');
 }
});
sqliteTest('missing Firecrawl key blocks search and scrape without outbound paid calls',async()=>{
 const {env,token}=await fixture(),original=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response('{}');};
 try{for(const kind of ['search','scrape']){const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/'+kind+'?workspace_id=w1',{token,method:'POST',body:kind==='search'?{query:'expansion'}:{url:'https://example.com'}}),env,{});assert.equal(r.status,409);assert.match((await r.json()).error,/Connect your own Firecrawl/);}assert.deepEqual(calls,[]);
 }finally{globalThis.fetch=original;}
});

sqliteTest('cancelled Firecrawl requests never start extraction fallback or another provider call',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env);const original=globalThis.fetch,controller=new AbortController();let calls=0,forwarded;
 globalThis.fetch=async(url,options)=>{calls++;forwarded=options.signal;controller.abort();throw new DOMException('Cancelled','AbortError');};
 try{
  const request=new Request('https://api.example.test/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({url:'https://example.com'}),signal:controller.signal});
  const r=await handleServiceIntegrationRoute(request,env,{});assert.equal(r.status,499);assert.equal(calls,1);assert.equal(forwarded.aborted,true);assert.equal((await r.json()).code,'SERVICE_REQUEST_CANCELLED');
 }finally{globalThis.fetch=original;}
});

sqliteTest('Firecrawl search propagates a bounded signal and skips already cancelled requests',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env);const original=globalThis.fetch,controller=new AbortController();let calls=0,signal;
 globalThis.fetch=async(url,options)=>{calls++;signal=options.signal;return new Response(JSON.stringify({success:true,data:{web:[]}}));};
 try{
  const request=()=>new Request('https://api.example.test/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:'company expansion'}),signal:controller.signal});
  assert.equal((await handleServiceIntegrationRoute(request(),env,{})).status,200);assert.ok(signal instanceof AbortSignal);assert.notEqual(signal,controller.signal);
  controller.abort();assert.equal((await handleServiceIntegrationRoute(request(),env,{})).status,499);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});


test('direct website fallback bounds streamed bytes before buffering a complete oversized page',async()=>{
 const original=globalThis.fetch;let cancelled=false,read=0;
 globalThis.fetch=async()=>new Response(new ReadableStream({pull(controller){read++;controller.enqueue(new Uint8Array(600000));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/html'}});
 try{await assert.rejects(fetchDirectPublicPage('https://example.com/'),/too large/);assert.equal(cancelled,true);assert.ok(read<=5,'must stop the stream promptly');}
 finally{globalThis.fetch=original;}
});

sqliteTest('Firecrawl forwards validated geographic search settings with the customer credential',async()=>{
 const {env,token}=await fixture(),original=globalThis.fetch,calls=[];await connectFirecrawl(env);
 globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(JSON.stringify({web:[]}));};
 try{
  const response=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'insurance companies sales teams',location:'Latvia',country:'lv',limit:4}}),env,{});
  assert.equal(response.status,200);assert.equal(calls[0].location,'Latvia');assert.equal(calls[0].country,'LV');
  await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'insurance companies',location:{invalid:true},country:'INVALID',limit:4}}),env,{});
  assert.equal(calls[1].location,undefined);assert.equal(calls[1].country,undefined);
 }finally{globalThis.fetch=original;}
});
sqliteTest('dynamic official staff extraction waits for rendered cards after a thin direct shell',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env);const old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{if(String(url).includes('api.firecrawl.dev')){const body=JSON.parse(options.body);assert.equal(body.waitFor,2000);assert.equal(body.maxAge,0);return new Response(JSON.stringify({success:true,data:{markdown:'## Jane Smith\nChief Executive Officer\nOfficial company management contact information.',metadata:{sourceURL:'https://company.example/management'}}}),{headers:{'Content-Type':'application/json'}});}return new Response('<html><title>Company</title><div id="app">Company</div></html>',{headers:{'Content-Type':'text/html'}});};
 try{const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/management',publicFirst:true}}),env,{}),p=await r.json();assert.equal(r.status,200);assert.match(p.data.markdown,/Jane Smith/);assert.deepEqual(p.researchTrace.map(e=>[e.provider,e.status]),[['direct','failed'],['firecrawl','succeeded'],['scrapling','skipped']]);}finally{globalThis.fetch=old;}
});

sqliteTest('the workspace gate answers 429 with Retry-After and the plan limit when the Free plan minute is full, without calling Firecrawl',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env,{plan_credits:1000,remaining_credits:900});
 env.DB.raw.prepare("INSERT INTO firecrawl_rate_gate(workspace_id,kind,window_started_at,count,prev_count) VALUES('w1','search',?,10,0)").run(Date.now()-1000);
 const old=globalThis.fetch;let upstreamCalls=0;globalThis.fetch=async()=>{upstreamCalls++;throw new Error('Firecrawl must not be called while the minute is full');};
 try{
  const r=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'procurement software Latvia',limit:4}}),env,{});
  const p=await r.json();
  assert.equal(r.status,429);assert.equal(p.code,'FIRECRAWL_RATE_LIMIT');assert.equal(p.plan,'Free');assert.equal(p.limit_per_minute,10);
  assert.match(p.error,/10 requests per minute/);assert.ok(Number(r.headers.get('Retry-After'))>=1&&Number(r.headers.get('Retry-After'))<=60);
  assert.equal(upstreamCalls,0);
 }finally{globalThis.fetch=old;}
});
sqliteTest('an upstream Firecrawl 429 is announced with its retry-after and blocks the next request of that workspace and kind',async()=>{
 const {env,token}=await fixture();await connectFirecrawl(env,{plan_credits:1000});const old=globalThis.fetch;let upstreamCalls=0;
 globalThis.fetch=async url=>{upstreamCalls++;assert.match(String(url),/api\.firecrawl\.dev\/v2\/search/);return new Response(JSON.stringify({success:false,error:'Rate limit exceeded. Consumed 11 req/min, remaining 0. Resets in 43s. Retry after 43 s'}),{status:429,headers:{'Content-Type':'application/json'}});};
 try{
  const first=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'procurement software Latvia',limit:4}}),env,{});
  const p1=await first.json();assert.equal(first.status,429);assert.equal(p1.code,'FIRECRAWL_UPSTREAM_RATE_LIMIT');assert.equal(p1.retry_after,43);assert.equal(first.headers.get('Retry-After'),'43');assert.equal(upstreamCalls,1);
  const second=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/search?workspace_id=w1',{method:'POST',token,body:{query:'procurement software Latvia',limit:4}}),env,{});
  const p2=await second.json();assert.equal(second.status,429);assert.equal(p2.code,'FIRECRAWL_RATE_LIMIT');assert.ok(Number(second.headers.get('Retry-After'))>=40);
  assert.equal(upstreamCalls,1,'the second request never reaches Firecrawl during the announced block');
  const scrape=await handleServiceIntegrationRoute(req('/api/integrations/services/firecrawl/scrape?workspace_id=w1',{method:'POST',token,body:{url:'https://company.example/team'}}),env,{});
  assert.notEqual(scrape.status,429,'the block is per endpoint kind: scrape is not blocked by a search 429');
 }finally{globalThis.fetch=old;}
});
