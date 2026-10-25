import {cookieValue,sha256,randomToken} from './security.js';
import {safeReturnUrl,buildGoogleAuthorizationUrl,exchangeGoogleCode,fetchGoogleIdentity,importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {refreshGoogleAccessToken} from './gmail.js';

export const CALENDAR_SCOPES=['openid','email','https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.freebusy'];
const PREFIX='/api/integrations/google-calendar';
const json=(value,status=200,cors={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
const redirect=(location,cors={})=>new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function dateValue(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Choose a valid date');return Date.parse(date);}
function zoneFormatter(timeZone){try{if(typeof timeZone!=='string'||!timeZone)throw Error();return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{fail('Choose a valid IANA timezone');}}
function localParts(formatter,time){return Object.fromEntries(formatter.formatToParts(time).map(p=>[p.type,p.value]));}
export function availableSlots({date,timeZone,duration=20,busy,now=Date.now()}){
 const midnight=dateValue(date),formatter=zoneFormatter(timeZone);
 if(![20,30,45,60].includes(duration)||!Array.isArray(busy))fail('Invalid availability request');
 const intervals=busy.map(row=>{const start=Date.parse(row.start),end=Date.parse(row.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail('Calendar availability could not be verified',502);return {start,end};});
 const slots=[];
 // Filter real UTC instants by local wall time; no guessed DST offsets.
 for(let start=midnight-14*3600000;start<midnight+38*3600000;start+=5*60000){
  if(start<now)continue;const p=localParts(formatter,start),minutes=Number(p.hour)*60+Number(p.minute);
  if(`${p.year}-${p.month}-${p.day}`!==date||minutes<540||minutes+duration>1020||(minutes-540)%duration!==0)continue;
  const end=start+duration*60000,ep=localParts(formatter,end-1);
  if(`${ep.year}-${ep.month}-${ep.day}`!==date||intervals.some(row=>start<row.end&&end>row.start))continue;
  slots.push({start:new Date(start).toISOString(),end:new Date(end).toISOString()});
 }
 return slots;
}
async function google(token,path,options={},fetchImpl=fetch){
 const response=await fetchImpl('https://www.googleapis.com/calendar/v3/'+path,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);if(!response.ok||!data)fail(response.status===401||response.status===403?'Calendar access needs attention. Reconnect Google Calendar and check that the Calendar API is enabled.':'Calendar availability could not be verified. Try again.',502);return data;
}
export async function listCalendars(token,fetchImpl=fetch){
 const rows=[];let page='',pages=0;
 do{const data=await google(token,'users/me/calendarList?maxResults=250'+(page?'&pageToken='+encodeURIComponent(page):''),{},fetchImpl);if(!Array.isArray(data.items))fail('Calendar list could not be verified',502);rows.push(...data.items.filter(c=>c.id&&!c.deleted&&!c.hidden).map(c=>({id:c.id,name:c.summary||c.id,timeZone:c.timeZone||'UTC',primary:Boolean(c.primary),selected:Boolean(c.selected||c.primary)})));page=data.nextPageToken||'';if(rows.length>500||++pages>5)fail('Too many calendars. Narrow your Google calendar list.',502);}while(page);
 return rows;
}
export async function queryFreeBusy(token,{ids,timeMin,timeMax,timeZone},fetchImpl=fetch){
 if(!Array.isArray(ids)||!ids.length||ids.length>50||ids.some(id=>typeof id!=='string'||!id||id.length>1024))fail('Choose between 1 and 50 calendars');
 const data=await google(token,'freeBusy',{method:'POST',body:JSON.stringify({timeMin,timeMax,timeZone,items:ids.map(id=>({id}))})},fetchImpl),busy=[];
 for(const id of ids){const row=data.calendars?.[id];if(!row||row.errors?.length||!Array.isArray(row.busy))fail('Calendar availability could not be verified for every selected calendar',502);for(const item of row.busy){if(!Number.isFinite(Date.parse(item.start))||!Number.isFinite(Date.parse(item.end))||Date.parse(item.end)<=Date.parse(item.start))fail('Calendar availability response is invalid',502);busy.push({start:item.start,end:item.end});}}
 return busy;
}
async function access(request,env,workspaceId){
 const cookie=cookieValue(request,'leadintel_session');if(!cookie)fail('Sign in to connect your calendar',401);
 const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(cookie)).first();if(!user)fail('Authentication required',401);
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)fail('Workspace access denied',403);return user;
}
const config=env=>({clientId:env.GOOGLE_OAUTH_CLIENT_ID,clientSecret:env.GOOGLE_OAUTH_CLIENT_SECRET,redirectUri:env.GMAIL_OAUTH_REDIRECT_URI});
const configured=env=>['GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GMAIL_OAUTH_REDIRECT_URI','OAUTH_TOKEN_ENCRYPTION_KEY','CUSTOMER_APP_URL'].every(k=>String(env[k]||'').trim());
async function connection(env,workspace,user){return env.DB.prepare('SELECT * FROM google_calendar_connections WHERE workspace_id=? AND user_id=?').bind(workspace,user).first();}
async function tokenFor(env,row){const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),refresh=await decryptSecret(row.encrypted_refresh_token,key);return (await refreshGoogleAccessToken(refresh,config(env))).accessToken;}
export async function handleGoogleCalendarRoute(request,env,cors={}){
 const url=new URL(request.url),path=url.pathname,rawState=url.searchParams.get('state')||'';
 const callback=path==='/api/integrations/gmail/callback'&&rawState.startsWith('calendar.');
 if(!path.startsWith(PREFIX+'/')&&!callback)return null;
 try{
  if(callback&&request.method==='GET'){
   const hash=await sha256(rawState),state=await env.DB.prepare("SELECT * FROM google_calendar_oauth_states WHERE id_hash=? AND consumed_at IS NULL AND expires_at>datetime('now')").bind(hash).first();if(!state)fail('Calendar connection expired. Please reconnect.',400);
   // The registered Google redirect lands on the Worker; the user's session cookie
   // belongs to the app. Return through its fixed first-party proxy before linking.
   if(request.headers.get('x-leadintel-first-party')!=='1'){
    const safe=safeReturnUrl(state.return_to,env.CUSTOMER_APP_URL);if(!safe)fail('Invalid calendar return URL');
    const firstParty=new URL('/api/integrations/gmail/callback',new URL(safe).origin);firstParty.search=url.search;return redirect(firstParty.toString(),cors);
   }
   const signedIn=await access(request,env,state.workspace_id);if(signedIn.id!==state.user_id)fail('Use the same LeadIntel account that started this calendar connection.',403);
   const consumed=await env.DB.prepare('UPDATE google_calendar_oauth_states SET consumed_at=CURRENT_TIMESTAMP WHERE id_hash=? AND consumed_at IS NULL').bind(hash).run();if(Number(consumed.meta?.changes)!==1)fail('Calendar connection already used',400);
   const returnTo=new URL(state.return_to);
   try{
    if(url.searchParams.has('error'))throw Error('Permission denied');
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(state.workspace_id,state.user_id).first();if(!member)throw Error('Workspace access removed');
    const token=await exchangeGoogleCode(url.searchParams.get('code'),config(env));
    if(!token.refreshToken||CALENDAR_SCOPES.slice(2).some(scope=>!token.scope.split(' ').includes(scope)))throw Error('Missing calendar permission');
    const identity=await fetchGoogleIdentity(token.accessToken),key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),encrypted=await encryptSecret(token.refreshToken,key);
    await env.DB.prepare('INSERT INTO google_calendar_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes) VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET google_email=excluded.google_email,encrypted_refresh_token=excluded.encrypted_refresh_token,scopes=excluded.scopes,connected_at=CURRENT_TIMESTAMP').bind(state.workspace_id,state.user_id,identity.email,encrypted,token.scope).run();returnTo.searchParams.set('calendar','connected');
   }catch{returnTo.searchParams.set('calendar','error');}
   return redirect(returnTo.toString(),cors);
  }
  const workspace=url.searchParams.get('workspace_id')||'',user=await access(request,env,workspace);
  if(path===PREFIX+'/status'&&request.method==='GET'){const row=await connection(env,workspace,user.id);return json({configured:configured(env),connected:Boolean(row),email:row?.google_email||'',readOnly:true},200,cors);}
  if(path===PREFIX+'/start'&&request.method==='GET'){
   if(!configured(env))fail('Google Calendar connection is not configured',503);
   const returnTo=safeReturnUrl(url.searchParams.get('return_to'),env.CUSTOMER_APP_URL);if(!returnTo)fail('Invalid return URL');
   const state='calendar.'+randomToken(32);await env.DB.prepare("DELETE FROM google_calendar_oauth_states WHERE expires_at<=datetime('now')").run();await env.DB.prepare("INSERT INTO google_calendar_oauth_states(id_hash,workspace_id,user_id,return_to,expires_at) VALUES(?,?,?,?,datetime('now','+10 minutes'))").bind(await sha256(state),workspace,user.id,returnTo).run();
   return redirect(buildGoogleAuthorizationUrl({...config(env),state,scopes:CALENDAR_SCOPES,accessType:'offline',prompt:'select_account consent'}),cors);
  }
  if(path===PREFIX+'/disconnect'&&request.method==='DELETE'){await env.DB.prepare('DELETE FROM google_calendar_connections WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).run();return json({ok:true},200,cors);}
  const row=await connection(env,workspace,user.id);if(!row)fail('Connect your Google Calendar first',409);
  if(path===PREFIX+'/calendars'&&request.method==='GET')return json({calendars:await listCalendars(await tokenFor(env,row))},200,cors);
  if(path===PREFIX+'/availability'&&request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>12000)fail('Calendar request is too large',413);
   const raw=await request.text();if(raw.length>12000)fail('Calendar request is too large',413);let body;try{body=JSON.parse(raw);}catch{fail('Invalid calendar request');}
   const date=body?.date,timeZone=body?.timeZone,day=dateValue(date),now=Date.now();zoneFormatter(timeZone);
   if(day<now-2*86400000||day>now+90*86400000)fail('Choose a date within the next 90 days');
   const token=await tokenFor(env,row),calendars=await listCalendars(token),ids=body.calendarIds;
   if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>!calendars.some(row=>row.id===id)))fail('Choose calendars from your connected account');
   const busy=await queryFreeBusy(token,{ids,timeMin:new Date(day-14*3600000).toISOString(),timeMax:new Date(day+38*3600000).toISOString(),timeZone});
   return json({date,timeZone,duration:20,checkedAt:new Date().toISOString(),calendarCount:ids.length,busy,slots:availableSlots({date,timeZone,duration:20,busy,now})},200,cors);
  }
  return json({error:'Calendar route not found'},404,cors);
 }catch(error){return json({error:error.status?error.message:'Calendar connection could not be checked. Please retry.'},error.status||502,cors);}
}
