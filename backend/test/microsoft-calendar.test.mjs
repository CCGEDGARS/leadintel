import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../src/security.js';
import {decryptSecret,encryptSecret,importAesKey} from '../src/oauth.js';
const M=await import('../src/microsoft-calendar.js').catch(()=>({}));
class DB{
 constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);INSERT INTO workspaces VALUES('w1'),('w2');INSERT INTO users VALUES('u1'),('u2');INSERT INTO workspace_members VALUES('w1','u1','owner'),('w1','u2','sales');");const p=new URL('../migrations/0064_microsoft_calendar.sql',import.meta.url);if(fs.existsSync(p))this.raw.exec(fs.readFileSync(p,'utf8'));}
 prepare(sql){const raw=this.raw;let args=[];return {bind(...v){args=v;return this;},async first(){return raw.prepare(sql).get(...args)||null;},async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}
}
async function fixture(){const db=new DB();for(const [token,user] of [['one','u1'],['two','u2']])db.raw.prepare("INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))").run(await sha256(token),user);return {DB:db,MICROSOFT_OAUTH_CLIENT_ID:'client',MICROSOFT_OAUTH_CLIENT_SECRET:'secret',MICROSOFT_MAIL_OAUTH_REDIRECT_URI:'https://worker.example/api/integrations/microsoft-mail/callback',OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),CUSTOMER_APP_URL:'https://app.example/customer/'};}
const req=(path,token='one',options={})=>new Request('https://worker.example'+path,{...options,headers:{Cookie:'leadintel_session='+token,'x-leadintel-first-party':'1',...options.headers}});
const start='/api/integrations/microsoft-calendar/start?workspace_id=w1&return_to='+encodeURIComponent('https://app.example/customer/?step=6');
test('Microsoft calendar supports private per-user connections without borrowing mail credentials',async()=>{
 assert.equal(typeof M.handleMicrosoftCalendarRoute,'function');const env=await fixture(),route='/api/integrations/microsoft-calendar/status?workspace_id=';
 env.DB.raw.prepare('INSERT INTO microsoft_calendar_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes) VALUES(?,?,?,?,?)').run('w1','u1','private@example.com','encrypted','scope');
 assert.equal((await (await M.handleMicrosoftCalendarRoute(req(route+'w1'),env)).json()).email,'private@example.com');
 assert.equal((await (await M.handleMicrosoftCalendarRoute(req(route+'w1','two'),env)).json()).connected,false);
 assert.equal((await M.handleMicrosoftCalendarRoute(req(route+'w2'),env)).status,403);assert.equal((await M.handleMicrosoftCalendarRoute(req(route+'w1','bad'),env)).status,401);
 assert.equal(await M.handleMicrosoftCalendarRoute(req('/api/integrations/microsoft-mail/callback?state=mail'),env),null);
 await M.handleMicrosoftCalendarRoute(req('/api/integrations/microsoft-calendar/disconnect?workspace_id=w1','two',{method:'DELETE'}),env);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM microsoft_calendar_connections').get().n,1);
});
test('Microsoft calendar consent uses PKCE, basic read-only scope and the registered mail callback',async()=>{
 assert.equal(typeof M.handleMicrosoftCalendarRoute,'function');const env=await fixture(),response=await M.handleMicrosoftCalendarRoute(req(start),env),url=new URL(response.headers.get('location')),state=url.searchParams.get('state');
 assert.match(state,/^mscalendar\./);assert.equal(url.searchParams.get('redirect_uri'),env.MICROSOFT_MAIL_OAUTH_REDIRECT_URI);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.match(url.searchParams.get('scope'),/Calendars.ReadBasic/);assert.doesNotMatch(url.searchParams.get('scope'),/Mail.Send|ReadWrite/);
 const callback='/api/integrations/microsoft-mail/callback?state='+state+'&code=code';assert.equal((await M.handleMicrosoftCalendarRoute(req(callback,'two'),env)).status,403);
 const old=globalThis.fetch;globalThis.fetch=async(target,options)=>{if(String(target).includes('/token')){assert.ok(new URLSearchParams(options.body).get('code_verifier'));return Response.json({access_token:'access',refresh_token:'private-refresh',scope:M.MICROSOFT_CALENDAR_SCOPES.join(' ')});}return Response.json({id:'ms-user',mail:'me@example.com'});};
 try{const result=await M.handleMicrosoftCalendarRoute(req(callback),env);assert.match(result.headers.get('location'),/calendar=connected/);assert.match(result.headers.get('location'),/calendar_provider=microsoft/);const row=env.DB.raw.prepare('SELECT * FROM microsoft_calendar_connections').get();assert.notEqual(row.encrypted_refresh_token,'private-refresh');assert.equal(await decryptSecret(row.encrypted_refresh_token,await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)),'private-refresh');assert.equal((await M.handleMicrosoftCalendarRoute(req(callback),env)).status,400);}finally{globalThis.fetch=old;}
});
test('calendar callback returns through first-party session; denied and expired grants install nothing',async()=>{
 assert.equal(typeof M.handleMicrosoftCalendarRoute,'function');const env=await fixture(),opened=await M.handleMicrosoftCalendarRoute(req(start),env),state=new URL(opened.headers.get('location')).searchParams.get('state');
 const callback='/api/integrations/microsoft-mail/callback?state='+state+'&error=access_denied';const bounced=await M.handleMicrosoftCalendarRoute(new Request('https://worker.example'+callback),env);assert.equal(new URL(bounced.headers.get('location')).origin,'https://app.example');
 assert.match((await M.handleMicrosoftCalendarRoute(req(callback),env)).headers.get('location'),/calendar=error/);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM microsoft_calendar_connections').get().n,0);
 const second=await M.handleMicrosoftCalendarRoute(req(start),env),expired=new URL(second.headers.get('location')).searchParams.get('state');env.DB.raw.exec("UPDATE microsoft_calendar_oauth_states SET expires_at=datetime('now','-1 minute')");assert.equal((await M.handleMicrosoftCalendarRoute(req('/api/integrations/microsoft-mail/callback?state='+expired),env)).status,400);
});
test('calendar list follows bounded same-endpoint pagination and excludes event content',async()=>{
 assert.equal(typeof M.listMicrosoftCalendars,'function');let count=0;
 const rows=await M.listMicrosoftCalendars('token',async(url,options)=>{count++;assert.match(url,/\$select=id/);assert.equal(options.headers.Authorization,'Bearer token');return Response.json(count===1?{value:[{id:'a',name:'Work',isDefaultCalendar:true}],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar&$skiptoken=next'}:{value:[{id:'b',name:'Other'}]});});assert.equal(rows.length,2);assert.equal(rows[0].primary,true);
 for(const next of ['https://evil.example/steal','https://graph.microsoft.com/v1.0/me/messages'])await assert.rejects(M.listMicrosoftCalendars('token',async()=>Response.json({value:[],'@odata.nextLink':next})),/pagination/i);
});
test('Microsoft availability reads recurring instances as intervals, treating incomplete results as unavailable',async()=>{
 assert.equal(typeof M.queryMicrosoftBusy,'function');const input={ids:['a'],timeMin:'2026-10-29T00:00:00Z',timeMax:'2026-10-30T00:00:00Z'};
 const busy=await M.queryMicrosoftBusy('token',input,async(url,options)=>{assert.match(url,/calendarView/);assert.match(url,/\$select=start,end,showAs,isCancelled/);assert.doesNotMatch(url,/subject|body|attendees/);assert.equal(options.headers.Prefer,'outlook.timezone="UTC"');return Response.json({value:[{showAs:'busy',start:{dateTime:'2026-10-29T09:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-29T10:00:00',timeZone:'UTC'}},{showAs:'free'},{isCancelled:true}]});});assert.deepEqual(busy,[{start:'2026-10-29T09:00:00.000Z',end:'2026-10-29T10:00:00.000Z'}]);
 for(const data of [{},{value:[{showAs:'unknown'}]},{value:[{showAs:'busy',start:{dateTime:'bad'},end:{dateTime:'bad'}}]}])await assert.rejects(M.queryMicrosoftBusy('token',input,async()=>Response.json(data)),/availability/i);
 await assert.rejects(M.queryMicrosoftBusy('token',input,async()=>Response.json({error:{code:'ErrorAccessDenied'}},{status:403})),/permission|access/i);
});

test('missing calendar consent cannot install a Microsoft calendar connection',async()=>{
 const env=await fixture(),response=await M.handleMicrosoftCalendarRoute(req(start),env),state=new URL(response.headers.get('location')).searchParams.get('state'),old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({access_token:'token',refresh_token:'refresh',scope:'User.Read Mail.Send'});
 try{const result=await M.handleMicrosoftCalendarRoute(req('/api/integrations/microsoft-mail/callback?state='+state+'&code=code'),env);assert.match(result.headers.get('location'),/calendar=error/);assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM microsoft_calendar_connections').get().n,0);}finally{globalThis.fetch=old;}
});
test('availability verifies selected calendar ownership and persists refreshed credentials privately',async()=>{
 const env=await fixture(),key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),encrypted=await encryptSecret('old-refresh',key);env.DB.raw.prepare('INSERT INTO microsoft_calendar_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes) VALUES(?,?,?,?,?)').run('w1','u1','me@example.com',encrypted,M.MICROSOFT_CALENDAR_SCOPES.join(' '));
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push(String(url));if(String(url).includes('/token'))return Response.json({access_token:'token',refresh_token:'rotated-refresh',scope:'Calendars.ReadBasic User.Read'});if(String(url).includes('/calendarView'))return Response.json({value:[]});return Response.json({value:[{id:'mine',name:'Work',isDefaultCalendar:true}]});};
 try{const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),path='/api/integrations/microsoft-calendar/availability?workspace_id=w1';
 const invalid=await M.handleMicrosoftCalendarRoute(req(path,'one',{method:'POST',body:JSON.stringify({date,timeZone:'Europe/Riga',calendarIds:['someone-else']})}),env);assert.equal(invalid.status,400);assert.ok(!calls.some(u=>u.includes('calendarView')));
 const valid=await M.handleMicrosoftCalendarRoute(req(path,'one',{method:'POST',body:JSON.stringify({date,timeZone:'Europe/Riga',calendarIds:['mine']})}),env),body=await valid.json();assert.equal(valid.status,200);assert.equal(body.calendarCount,1);assert.ok(body.slots.length>0);assert.doesNotMatch(JSON.stringify(body),/rotated-refresh|Bearer|subject|attendees/);
 const row=env.DB.raw.prepare('SELECT * FROM microsoft_calendar_connections').get();assert.equal(await decryptSecret(row.encrypted_refresh_token,key),'rotated-refresh');
 const other=await M.handleMicrosoftCalendarRoute(req(path,'two',{method:'POST',body:JSON.stringify({date,timeZone:'Europe/Riga',calendarIds:['mine']})}),env);assert.equal(other.status,409);
 }finally{globalThis.fetch=old;}
});
