import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleSaasRoute} from '../src/saas-routes.js';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret,decryptSecret} from '../src/oauth.js';

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes||0)}};}
}
class D1Db{
  constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,display_name TEXT NOT NULL,role TEXT NOT NULL,last_login_at TEXT);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,market TEXT NOT NULL,owner_user_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
    CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
    CREATE TABLE oauth_states(id_hash TEXT PRIMARY KEY,purpose TEXT NOT NULL,user_id TEXT,workspace_id TEXT,return_to TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,consumed_at TEXT,pkce_verifier TEXT);
    CREATE TABLE customer_projects(id TEXT PRIMARY KEY,workspace_id TEXT,name TEXT,website TEXT,status TEXT,created_by TEXT,created_at TEXT,updated_at TEXT,archived_at TEXT);
    CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT DEFAULT 'connected',history_id TEXT,connected_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,disconnected_at TEXT);
    CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,status TEXT,sent_at TEXT,customer_project_id TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
    CREATE TABLE gmail_replies(id TEXT PRIMARY KEY,workspace_id TEXT,customer_project_id TEXT,received_at TEXT);
    CREATE TABLE microsoft_mail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,microsoft_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT DEFAULT 'connected',connected_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,disconnected_at TEXT);
    CREATE TABLE microsoft_mail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,customer_project_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,sent_by TEXT,sent_at TEXT,status TEXT,provider_status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
    CREATE TABLE email_activity_events(id TEXT PRIMARY KEY,workspace_id TEXT,customer_project_id TEXT,user_id TEXT,kind TEXT,provider TEXT,provider_message_id TEXT,provider_thread_id TEXT,occurred_at TEXT,payload_json TEXT);
    CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT,normalized_domain TEXT,company_name TEXT,lifecycle_status TEXT,pipeline_stage TEXT,updated_at TEXT,deleted_at TEXT,UNIQUE(workspace_id,normalized_domain));
    CREATE TABLE crm_activities(id TEXT PRIMARY KEY,workspace_id TEXT,company_id TEXT,contact_id TEXT,activity_type TEXT,channel TEXT,direction TEXT,subject TEXT,summary TEXT,metadata_json TEXT,occurred_at TEXT,created_at TEXT,actor_user_id TEXT);
  `);}
  prepare(sql){return new D1Statement(this.raw,sql);}
  async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results;}
}
async function fixture(){
  const DB=new D1Db();const token='microsoft-route-session';const tokenHash=await sha256(token);const encryption=Buffer.alloc(32,11).toString('base64');
  DB.raw.prepare(`INSERT INTO users VALUES('u1','owner@example.com','Owner','owner',NULL)`).run();
  DB.raw.prepare(`INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','Workspace','Global','u1')`).run();
  DB.raw.prepare(`INSERT INTO workspace_members VALUES('w1','u1','owner')`).run();
  DB.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(tokenHash,'u1');
  return {DB,token,env:{DB,APP_ORIGIN:'https://leadintel.ccgroup.lv',CUSTOMER_APP_URL:'https://leadintel.ccgroup.lv/customer/',GOOGLE_OAUTH_CLIENT_ID:'google-client',GOOGLE_OAUTH_CLIENT_SECRET:'google-secret',GMAIL_OAUTH_REDIRECT_URI:'https://api.example.test/api/integrations/gmail/callback',MICROSOFT_OAUTH_CLIENT_ID:'microsoft-client',MICROSOFT_OAUTH_CLIENT_SECRET:'microsoft-secret',MICROSOFT_OAUTH_REDIRECT_URI:'https://api.example.test/api/auth/microsoft/callback',MICROSOFT_MAIL_OAUTH_REDIRECT_URI:'https://api.example.test/api/integrations/microsoft-mail/callback',OAUTH_TOKEN_ENCRYPTION_KEY:encryption}};
}
function req(path,{method='GET',token,body,idempotencyKey}={}){return new Request(`https://api.example.test${path}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:body?JSON.stringify(body):undefined});}

test('owner can begin Microsoft mailbox consent with PKCE and least-privilege scopes',async()=>{
  const {env,DB,token}=await fixture();
  const response=await handleSaasRoute(req('/api/integrations/microsoft-mail/start?workspace_id=w1&return_to=https%3A%2F%2Fleadintel.ccgroup.lv%2Fcustomer%2F',{token}),env,{});
  assert.ok(response,'Microsoft mailbox start route must handle the request');
  assert.equal(response.status,302);
  const location=new URL(response.headers.get('Location'));
  assert.equal(location.hostname,'login.microsoftonline.com');
  assert.match(location.searchParams.get('scope'),/Mail\.Send/);
  assert.doesNotMatch(location.searchParams.get('scope'),/Mail\.Read/);
  assert.equal(location.searchParams.get('code_challenge_method'),'S256');
  const state=DB.raw.prepare('SELECT pkce_verifier FROM oauth_states').get();
  assert.match(state.pkce_verifier,/^[A-Za-z0-9_-]{43,128}$/);
  assert.notEqual(state.pkce_verifier,location.searchParams.get('code_challenge'));
});

test('Microsoft send is idempotent, rotates refresh tokens, and records a provider-accepted send',async()=>{
  const {env,DB,token}=await fixture();const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret('refresh-1',key);
  DB.raw.prepare(`INSERT INTO microsoft_mail_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes,status) VALUES('w1','u1','owner@example.com',?,?,'connected')`).run(encrypted,'openid offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send');
  const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init={})=>{calls.push({url:String(url),init});if(String(url).includes('/oauth2/v2.0/token'))return new Response(JSON.stringify({access_token:'access-2',refresh_token:'refresh-2',expires_in:3600,scope:'Mail.Send'}),{status:200,headers:{'content-type':'application/json'}});if(String(url)==='https://graph.microsoft.com/v1.0/me/sendMail')return new Response(null,{status:202});throw new Error(`Unexpected fetch ${url}`);};
  try{
    const body={domain:'example.com',recipient:'buyer@example.com',subject:'Tailored subject',body:'Tailored body',idempotency_key:'microsoft-idempotency-1234'};
    let response=await handleSaasRoute(req('/api/integrations/microsoft-mail/send?workspace_id=w1',{method:'POST',token,body,idempotencyKey:body.idempotency_key}),env,{});
    assert.ok(response,'Microsoft mailbox send route must handle the request');
    assert.equal(response.status,201);let result=await response.json();assert.equal(result.message.status,'sent');assert.equal(result.message.provider,'microsoft');assert.equal(result.message.provider_status,'accepted');assert.equal(result.duplicate,false);
    response=await handleSaasRoute(req('/api/integrations/microsoft-mail/send?workspace_id=w1',{method:'POST',token,body,idempotencyKey:body.idempotency_key}),env,{});
    result=await response.json();assert.equal(response.status,200);assert.equal(result.duplicate,true);assert.equal(calls.length,2,'duplicate request must not refresh or send again');
    const connection=DB.raw.prepare(`SELECT encrypted_refresh_token FROM microsoft_mail_connections WHERE workspace_id='w1'`).get();
    assert.equal(await decryptSecret(connection.encrypted_refresh_token,key),'refresh-2');
    assert.equal(DB.raw.prepare(`SELECT COUNT(*) count FROM email_activity_events WHERE provider='microsoft' AND kind='sent'`).get().count,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('manual Gmail and Microsoft routes deliver validated branded HTML without changing idempotency',async()=>{
  const {env,DB,token}=await fixture();const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const encrypted=await encryptSecret('refresh-1',key);
  DB.raw.prepare("INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status) VALUES('w1','u1','owner@example.com',?,'gmail.send','connected')").run(encrypted);
  DB.raw.prepare("INSERT INTO microsoft_mail_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes,status) VALUES('w1','u1','owner@example.com',?,'Mail.Send','connected')").run(encrypted);
  const originalFetch=globalThis.fetch;const sends=[];
  globalThis.fetch=async(url,init={})=>{
    const target=String(url);
    if(target.includes('oauth2.googleapis.com/token'))return new Response(JSON.stringify({access_token:'google-access'}),{status:200,headers:{'content-type':'application/json'}});
    if(target.includes('login.microsoftonline.com/'))return new Response(JSON.stringify({access_token:'microsoft-access',refresh_token:'refresh-1'}),{status:200,headers:{'content-type':'application/json'}});
    if(target.includes('gmail.googleapis.com/')){sends.push({provider:'gmail',payload:JSON.parse(init.body)});return new Response(JSON.stringify({id:'gmail-1',threadId:'thread-1'}),{status:200,headers:{'content-type':'application/json'}});}
    if(target.includes('graph.microsoft.com/')){sends.push({provider:'microsoft',payload:JSON.parse(init.body)});return new Response(null,{status:202});}
    throw new Error('Unexpected fetch '+target);
  };
  try{
    const content={domain:'example.com',recipient:'buyer@example.com',subject:'Branded',body:'Canonical',text_body:'Rendered text ✓',html_body:'<div style="color:#0f6557;">Rendered HTML ✓</div>'};
    let response=await handleSaasRoute(req('/api/integrations/gmail/send?workspace_id=w1',{method:'POST',token,body:{...content,idempotency_key:'gmail-branded-1234'},idempotencyKey:'gmail-branded-1234'}),env,{});
    assert.equal(response.status,201);
    response=await handleSaasRoute(req('/api/integrations/microsoft-mail/send?workspace_id=w1',{method:'POST',token,body:{...content,idempotency_key:'microsoft-branded-1234'},idempotencyKey:'microsoft-branded-1234'}),env,{});
    assert.equal(response.status,201);
    const gmailRaw=Buffer.from(sends.find(item=>item.provider==='gmail').payload.raw.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    assert.match(gmailRaw,/Content-Type: multipart\/alternative/);assert.match(gmailRaw,/Content-Type: text\/html/);
    assert.deepEqual(sends.find(item=>item.provider==='microsoft').payload.message.body,{contentType:'HTML',content:content.html_body});
  }finally{globalThis.fetch=originalFetch;}
});

test('manual send routes reject unsafe HTML before provider calls or durable side effects',async()=>{
  for(const provider of ['gmail','microsoft-mail']){
    const {env,DB,token}=await fixture();let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;return new Response(null,{status:500});};
    try{
      const idempotency_key=provider.replace('-mail','')+'-unsafe-1234';
      const body={domain:'example.com',recipient:'buyer@example.com',subject:'Unsafe',body:'Canonical',text_body:'Canonical',html_body:'<form action="https://evil.example"><input></form>',idempotency_key};
      const response=await handleSaasRoute(req('/api/integrations/'+provider+'/send?workspace_id=w1',{method:'POST',token,body,idempotencyKey:idempotency_key}),env,{});
      assert.equal(response.status,400);assert.match((await response.json()).error,/unsafe email HTML/i);assert.equal(calls,0);
      const table=provider==='gmail'?'gmail_messages':'microsoft_mail_messages';
      assert.equal(DB.raw.prepare('SELECT COUNT(*) count FROM '+table).get().count,0);
      assert.equal(DB.raw.prepare('SELECT COUNT(*) count FROM audit_events').get().count,0);
    }finally{globalThis.fetch=originalFetch;}
  }
});

test('Microsoft and Gmail share one daily send limit',async()=>{
  const {env,DB,token}=await fixture();for(let i=0;i<20;i++)DB.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,sent_at) VALUES(?,?,?,?,?,?,?,datetime('now'))`).run(`g${i}`,'w1',`gmail-${i}`,'example.com',`buyer${i}@example.com`,'Subject','sent');
  let called=false;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{called=true;return new Response(null,{status:500});};
  try{const body={domain:'example.com',recipient:'buyer@example.com',subject:'Subject',body:'Body',idempotency_key:'microsoft-daily-limit-1'};const response=await handleSaasRoute(req('/api/integrations/microsoft-mail/send?workspace_id=w1',{method:'POST',token,body,idempotencyKey:body.idempotency_key}),env,{});assert.ok(response,'Microsoft mailbox send route must handle the request');assert.equal(response.status,429);const result=await response.json();assert.equal(result.code,'DAILY_EMAIL_LIMIT');assert.equal(called,false);}finally{globalThis.fetch=originalFetch;}
});

test('Microsoft idempotent retry succeeds even when the shared daily limit is reached',async()=>{
  const {env,DB,token}=await fixture();
  DB.raw.prepare(`INSERT INTO microsoft_mail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,sent_by,sent_at,status,provider_status) VALUES('m-existing','w1','microsoft-existing-1234','example.com','buyer@example.com','Subject','u1',datetime('now'),'sent','accepted')`).run();
  for(let i=0;i<19;i++)DB.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,sent_at) VALUES(?,?,?,?,?,?,?,datetime('now'))`).run(`g${i}`,'w1',`gmail-${i}`,'example.com',`buyer${i}@example.com`,'Subject','sent');
  let called=false;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{called=true;return new Response(null,{status:500});};
  try{
    const body={domain:'example.com',recipient:'buyer@example.com',subject:'Subject',body:'Body',idempotency_key:'microsoft-existing-1234'};
    const response=await handleSaasRoute(req('/api/integrations/microsoft-mail/send?workspace_id=w1',{method:'POST',token,body,idempotencyKey:body.idempotency_key}),env,{});
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.duplicate,true);assert.equal(result.message.id,'m-existing');assert.equal(called,false);
  }finally{globalThis.fetch=originalFetch;}
});

test('customer activity combines Gmail and Microsoft sends and identifies each provider',async()=>{
  const {env,DB,token}=await fixture();
  DB.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,sent_at,gmail_thread_id) VALUES('g1','w1','gmail-activity-1234','gmail.example','gmail@example.com','Gmail subject','sent',datetime('now'),'thread-1')`).run();
  DB.raw.prepare(`INSERT INTO microsoft_mail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,sent_by,sent_at,status,provider_status) VALUES('m1','w1','microsoft-activity-1234','microsoft.example','microsoft@example.com','Microsoft subject','u1',datetime('now'),'sent','accepted')`).run();
  const response=await handleSaasRoute(req('/api/customer/activity?workspace_id=w1',{token}),env,{});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.limits.sent_today,2);assert.equal(result.limits.remaining_today,18);
  assert.deepEqual(new Set(result.recent.map(item=>item.provider)),new Set(['gmail','microsoft']));
});
