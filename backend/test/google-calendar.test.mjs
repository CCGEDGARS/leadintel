import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../src/security.js';
import {decryptSecret,importAesKey} from '../src/oauth.js';

const M=await import('../src/google-calendar.js').catch(()=>({}));
test('calendar availability excludes overlaps, past slots and times outside local working hours',()=>{
 assert.equal(typeof M.availableSlots,'function');
 const slots=M.availableSlots({date:'2026-10-26',timeZone:'Europe/Riga',duration:20,busy:[{start:'2026-10-26T07:10:00Z',end:'2026-10-26T07:30:00Z'}],now:Date.parse('2026-10-26T07:00:00Z')});
 assert.equal(slots[0].start,'2026-10-26T07:40:00.000Z');
 assert.equal(slots.at(-1).end,'2026-10-26T15:00:00.000Z');
 assert.equal(slots.length,22);
});
test('calendar availability respects DST and half-hour zones',()=>{
 assert.equal(typeof M.availableSlots,'function');
 for(const [date,zone,first] of [['2026-10-24','Europe/Riga','2026-10-24T06:00:00.000Z'],['2026-10-26','Europe/Riga','2026-10-26T07:00:00.000Z'],['2026-10-26','Asia/Kolkata','2026-10-26T03:30:00.000Z']])assert.equal(M.availableSlots({date,timeZone:zone,busy:[],now:0})[0].start,first);
 assert.throws(()=>M.availableSlots({date:'2026-02-30',timeZone:'Europe/Riga',busy:[]}),/date/i);
 assert.throws(()=>M.availableSlots({date:'2026-10-26',timeZone:'Invalid/Zone',busy:[]}),/zone/i);
});
test('Google availability is fail-closed for errors or missing calendar entries',async()=>{
 assert.equal(typeof M.queryFreeBusy,'function');
 const input={ids:['primary','work@example.com'],timeMin:'2026-10-26T00:00:00Z',timeMax:'2026-10-27T00:00:00Z',timeZone:'Europe/Riga'};
 for(const calendars of [{primary:{busy:[]}},{primary:{busy:[]},'work@example.com':{errors:[{reason:'notFound'}]}},{primary:{busy:[{start:'garbage',end:'garbage'}]},'work@example.com':{busy:[]}}])await assert.rejects(()=>M.queryFreeBusy('secret',input,async()=>Response.json({calendars})),/availability/i);
 const result=await M.queryFreeBusy('secret',input,async(url,options)=>{assert.equal(url,'https://www.googleapis.com/calendar/v3/freeBusy');assert.equal(options.method,'POST');return Response.json({calendars:{primary:{busy:[]},'work@example.com':{busy:[{start:'2026-10-26T10:00:00Z',end:'2026-10-26T11:00:00Z'}]}}});});assert.equal(result.length,1);
});
class DB{
 constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);INSERT INTO workspaces VALUES('w1'),('w2');INSERT INTO users VALUES('u1'),('u2');INSERT INTO workspace_members VALUES('w1','u1','owner'),('w1','u2','sales');");this.raw.exec(fs.readFileSync(new URL('../migrations/0050_google_calendar.sql',import.meta.url),'utf8'));}
 prepare(sql){const raw=this.raw;let args=[];return {bind(...v){args=v;return this;},async first(){return raw.prepare(sql).get(...args)||null;},async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}
}
async function fixture(){const db=new DB();for(const [token,user] of [['one','u1'],['two','u2']])db.raw.prepare("INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))").run(await sha256(token),user);return {DB:db,GOOGLE_OAUTH_CLIENT_ID:'test-client',GOOGLE_OAUTH_CLIENT_SECRET:'test-secret',GMAIL_OAUTH_REDIRECT_URI:'https://worker.example/api/integrations/gmail/callback',OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),CUSTOMER_APP_URL:'https://app.example/customer/'};}
const req=(path,token='one',options={})=>new Request('https://worker.example'+path,{...options,headers:{Cookie:'leadintel_session='+token,'x-leadintel-first-party':'1',...options.headers}});
test('calendar connections and status are isolated by user and workspace',async()=>{
 const env=await fixture();env.DB.raw.prepare('INSERT INTO google_calendar_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes) VALUES(?,?,?,?,?)').run('w1','u1','private@example.com','encrypted','scopes');
 const route='/api/integrations/google-calendar/status?workspace_id=';
 const own=await M.handleGoogleCalendarRoute(req(route+'w1'),env);assert.equal((await own.json()).email,'private@example.com');
 const other=await M.handleGoogleCalendarRoute(req(route+'w1','two'),env);const payload=await other.json();assert.equal(payload.connected,false);assert.equal(payload.email,'');
 assert.equal((await M.handleGoogleCalendarRoute(req(route+'w2'),env)).status,403);
 assert.equal((await M.handleGoogleCalendarRoute(req(route+'w1','invalid'),env)).status,401);
 assert.equal(await M.handleGoogleCalendarRoute(req('/api/integrations/gmail/callback?state=normal-gmail'),env),null);
});
test('calendar OAuth uses isolated single-use state, encrypted tokens and the existing callback',async()=>{
 const env=await fixture(),start='/api/integrations/google-calendar/start?workspace_id=w1&return_to='+encodeURIComponent('https://app.example/customer/?step=6');
 const response=await M.handleGoogleCalendarRoute(req(start),env),url=new URL(response.headers.get('location')),state=url.searchParams.get('state');assert.equal(response.status,302);assert.match(state,/^calendar\./);assert.equal(url.searchParams.get('redirect_uri'),env.GMAIL_OAUTH_REDIRECT_URI);assert.match(url.searchParams.get('scope'),/calendar.events.freebusy/);assert.doesNotMatch(url.searchParams.get('scope'),/gmail.send|calendar.events\s/);
 const old=globalThis.fetch;globalThis.fetch=async target=>target==='https://oauth2.googleapis.com/token'?Response.json({access_token:'access',refresh_token:'private-refresh',scope:M.CALENDAR_SCOPES.join(' ')}):Response.json({sub:'google-user',email:'mycalendar@example.com',email_verified:true});
 try{const callback='/api/integrations/gmail/callback?state='+state+'&code=code';assert.match((await M.handleGoogleCalendarRoute(req(callback),env)).headers.get('location'),/calendar=connected/);const row=env.DB.raw.prepare('SELECT * FROM google_calendar_connections').get();assert.notEqual(row.encrypted_refresh_token,'private-refresh');assert.equal(await decryptSecret(row.encrypted_refresh_token,await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)),'private-refresh');assert.equal((await M.handleGoogleCalendarRoute(req(callback),env)).status,400);}finally{globalThis.fetch=old;}
});
test('expired calendar state and removed workspace access cannot install a connection',async()=>{
 const env=await fixture(),raw='calendar.expired';env.DB.raw.prepare("INSERT INTO google_calendar_oauth_states VALUES(?,?,?,?,datetime('now','-1 minute'),NULL)").run(await sha256(raw),'w1','u1','https://app.example/customer/');assert.equal((await M.handleGoogleCalendarRoute(req('/api/integrations/gmail/callback?state='+raw+'&code=x'),env)).status,400);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM google_calendar_connections').get().n,0);
});
test('a calendar grant cannot link to another signed-in LeadIntel user',async()=>{
 const env=await fixture(),start='/api/integrations/google-calendar/start?workspace_id=w1&return_to='+encodeURIComponent('https://app.example/customer/');const opened=await M.handleGoogleCalendarRoute(req(start),env),state=new URL(opened.headers.get('location')).searchParams.get('state');
 const response=await M.handleGoogleCalendarRoute(req('/api/integrations/gmail/callback?state='+state+'&code=code','two'),env);assert.equal(response.status,403);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM google_calendar_connections').get().n,0);
});
