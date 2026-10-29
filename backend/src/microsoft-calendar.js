import {cookieValue,sha256,randomToken} from './security.js';
import {safeReturnUrl,buildMicrosoftAuthorizationUrl,exchangeMicrosoftCode,fetchMicrosoftIdentity,createPkcePair,importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {refreshMicrosoftAccessToken} from './microsoft-mail.js';
import {availableSlots} from './google-calendar.js';

export const MICROSOFT_CALENDAR_SCOPES=['openid','profile','email','offline_access','https://graph.microsoft.com/User.Read','https://graph.microsoft.com/Calendars.ReadBasic'];
const PREFIX='/api/integrations/microsoft-calendar';
const json=(value,status=200,cors={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
const redirect=(location,cors={})=>new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function dateValue(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Choose a valid date');return Date.parse(date);}
function zoneFormatter(timeZone){try{if(typeof timeZone!=='string'||!timeZone)throw Error();return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{fail('Choose a valid IANA timezone');}}
async function graphPages(token,path,fetchImpl=fetch,deadline=Date.now()+25000){
 const first=new URL('https://graph.microsoft.com/v1.0/'+path),rows=[];let target=first.href,pages=0;
 do{
  if(Date.now()>=deadline)fail('Microsoft calendar availability check timed out. Choose fewer calendars and retry.',502);
  const url=new URL(target);
  if(url.origin!==first.origin||url.pathname!==first.pathname||url.username||url.password)fail('Invalid Microsoft calendar pagination',502);
  const response=await fetchImpl(url.href,{headers:{Authorization:'Bearer '+token,Accept:'application/json',Prefer:'outlook.timezone="UTC"'},signal:AbortSignal.timeout(Math.max(1,Math.min(15000,deadline-Date.now())))}),data=await response.json().catch(()=>null);
  if(!response.ok)fail([401,403].includes(response.status)?'Microsoft calendar access needs attention. Reconnect and approve calendar permission; your organization may require administrator approval.':'Microsoft calendar availability could not be verified. Try again.',502);
  if(!Array.isArray(data?.value))fail('Microsoft calendar availability could not be verified',502);
  rows.push(...data.value);target=data['@odata.nextLink']||'';
  if(++pages>10||rows.length>2000)fail('Microsoft calendar availability exceeds the safe read limit. Choose fewer calendars.',502);
 }while(target);
 return rows;
}
export async function listMicrosoftCalendars(token,fetchImpl=fetch){
 const rows=await graphPages(token,'me/calendars?$select=id,name,isDefaultCalendar&$top=100',fetchImpl);
 if(rows.some(row=>typeof row.id!=='string'||!row.id))fail('Microsoft calendar list could not be verified',502);
 return rows.map(row=>({id:row.id,name:row.name||'Calendar',primary:row.isDefaultCalendar===true,selected:row.isDefaultCalendar===true}));
}
function utcTime(value){
 if(!value||!['UTC','Etc/UTC'].includes(value.timeZone))fail('Microsoft calendar availability timezone could not be verified',502);
 const raw=value.dateTime;
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(raw))fail('Microsoft calendar availability is invalid',502);
 const n=Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');if(!Number.isFinite(n))fail('Microsoft calendar availability is invalid',502);return n;
}
export async function queryMicrosoftBusy(token,{ids,timeMin,timeMax},fetchImpl=fetch){
 if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string'||!id||id.length>1024))fail('Choose between 1 and 20 calendars');
 const busy=[],deadline=Date.now()+25000;
 for(const id of ids){
  const query=new URLSearchParams({startDateTime:timeMin,endDateTime:timeMax});
  const rows=await graphPages(token,'me/calendars/'+encodeURIComponent(id)+'/calendarView?'+query+'&$select=start,end,showAs,isCancelled&$top=100',fetchImpl,deadline);
  for(const row of rows){
   if(row.isCancelled===true||row.showAs==='free')continue;
   if(!['busy','tentative','oof','workingElsewhere'].includes(row.showAs))fail('Microsoft calendar availability status could not be verified',502);
   const start=utcTime(row.start),end=utcTime(row.end);if(end<=start)fail('Microsoft calendar availability interval is invalid',502);
   busy.push({start:new Date(start).toISOString(),end:new Date(end).toISOString()});
  }
 }
 return busy;
}
async function access(request,env,workspaceId){
 const cookie=cookieValue(request,'leadintel_session');if(!cookie)fail('Sign in to connect your calendar',401);
 const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(cookie)).first();if(!user)fail('Authentication required',401);
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)fail('Workspace access denied',403);return user;
}
const config=env=>({clientId:env.MICROSOFT_OAUTH_CLIENT_ID,clientSecret:env.MICROSOFT_OAUTH_CLIENT_SECRET,redirectUri:env.MICROSOFT_MAIL_OAUTH_REDIRECT_URI});
const configured=env=>['MICROSOFT_OAUTH_CLIENT_ID','MICROSOFT_OAUTH_CLIENT_SECRET','MICROSOFT_MAIL_OAUTH_REDIRECT_URI','OAUTH_TOKEN_ENCRYPTION_KEY','CUSTOMER_APP_URL'].every(k=>String(env[k]||'').trim());
async function connection(env,workspace,user){return env.DB.prepare('SELECT * FROM microsoft_calendar_connections WHERE workspace_id=? AND user_id=?').bind(workspace,user).first();}
async function tokenFor(env,row){const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),refresh=await decryptSecret(row.encrypted_refresh_token,key);const result=await refreshMicrosoftAccessToken(refresh,{...config(env),scopes:MICROSOFT_CALENDAR_SCOPES});if(result.refreshToken!==refresh){const encrypted=await encryptSecret(result.refreshToken,key);const saved=await env.DB.prepare('UPDATE microsoft_calendar_connections SET encrypted_refresh_token=? WHERE workspace_id=? AND user_id=? AND encrypted_refresh_token=?').bind(encrypted,row.workspace_id,row.user_id,row.encrypted_refresh_token).run();if(Number(saved.meta?.changes)!==1)fail('Calendar connection changed. Retry.',409);}return result.accessToken;}
export async function handleMicrosoftCalendarRoute(request,env,cors={}){
 const url=new URL(request.url),path=url.pathname,rawState=url.searchParams.get('state')||'';
 const callback=path==='/api/integrations/microsoft-mail/callback'&&rawState.startsWith('mscalendar.');
 if(!path.startsWith(PREFIX+'/')&&!callback)return null;
 try{
  if(callback&&request.method==='GET'){
   const hash=await sha256(rawState),state=await env.DB.prepare("SELECT * FROM microsoft_calendar_oauth_states WHERE id_hash=? AND consumed_at IS NULL AND expires_at>datetime('now')").bind(hash).first();if(!state)fail('Calendar connection expired. Please reconnect.',400);
   // The registered Microsoft redirect lands on the Worker; the user's session cookie
   // belongs to the app. Return through its fixed first-party proxy before linking.
   if(request.headers.get('x-leadintel-first-party')!=='1'){
    const safe=safeReturnUrl(state.return_to,env.CUSTOMER_APP_URL);if(!safe)fail('Invalid calendar return URL');
    const firstParty=new URL('/api/integrations/microsoft-mail/callback',new URL(safe).origin);firstParty.search=url.search;return redirect(firstParty.toString(),cors);
   }
   const signedIn=await access(request,env,state.workspace_id);if(signedIn.id!==state.user_id)fail('Use the same LeadIntel account that started this calendar connection.',403);
   const consumed=await env.DB.prepare('UPDATE microsoft_calendar_oauth_states SET consumed_at=CURRENT_TIMESTAMP WHERE id_hash=? AND consumed_at IS NULL').bind(hash).run();if(Number(consumed.meta?.changes)!==1)fail('Calendar connection already used',400);
   const returnTo=new URL(state.return_to);returnTo.searchParams.set('calendar_provider','microsoft');
   try{
    if(url.searchParams.has('error'))throw Error('Permission denied');
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(state.workspace_id,state.user_id).first();if(!member)throw Error('Workspace access removed');
    const token=await exchangeMicrosoftCode(url.searchParams.get('code'),{...config(env),scopes:MICROSOFT_CALENDAR_SCOPES,codeVerifier:state.code_verifier});
    if(!token.refreshToken||!token.scope.split(' ').some(scope=>scope==='Calendars.ReadBasic'||scope==='https://graph.microsoft.com/Calendars.ReadBasic'))throw Error('Missing calendar permission');
    const identity=await fetchMicrosoftIdentity(token.accessToken);if(!identity.sub)throw Error('Missing Microsoft identity');const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),encrypted=await encryptSecret(token.refreshToken,key);
    await env.DB.prepare('INSERT INTO microsoft_calendar_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes) VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET microsoft_email=excluded.microsoft_email,encrypted_refresh_token=excluded.encrypted_refresh_token,scopes=excluded.scopes,connected_at=CURRENT_TIMESTAMP').bind(state.workspace_id,state.user_id,identity.email,encrypted,token.scope).run();returnTo.searchParams.set('calendar','connected');
   }catch{returnTo.searchParams.set('calendar','error');}
   return redirect(returnTo.toString(),cors);
  }
  const workspace=url.searchParams.get('workspace_id')||'',user=await access(request,env,workspace);
  if(path===PREFIX+'/status'&&request.method==='GET'){const row=await connection(env,workspace,user.id);return json({configured:configured(env),connected:Boolean(row),email:row?.microsoft_email||'',readOnly:true},200,cors);}
  if(path===PREFIX+'/start'&&request.method==='GET'){
   if(!configured(env))fail('Microsoft Calendar connection is not configured',503);
   const returnTo=safeReturnUrl(url.searchParams.get('return_to'),env.CUSTOMER_APP_URL);if(!returnTo)fail('Invalid return URL');
   const state='mscalendar.'+randomToken(32),pkce=await createPkcePair();await env.DB.prepare("DELETE FROM microsoft_calendar_oauth_states WHERE expires_at<=datetime('now')").run();await env.DB.prepare("INSERT INTO microsoft_calendar_oauth_states(id_hash,workspace_id,user_id,return_to,code_verifier,expires_at) VALUES(?,?,?,?,?,datetime('now','+10 minutes'))").bind(await sha256(state),workspace,user.id,returnTo,pkce.verifier).run();
   return redirect(buildMicrosoftAuthorizationUrl({...config(env),state,scopes:MICROSOFT_CALENDAR_SCOPES,codeChallenge:pkce.challenge,prompt:'consent'}),cors);
  }
  if(path===PREFIX+'/disconnect'&&request.method==='DELETE'){await env.DB.prepare('DELETE FROM microsoft_calendar_connections WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).run();return json({ok:true},200,cors);}
  const row=await connection(env,workspace,user.id);if(!row)fail('Connect your Microsoft Calendar first',409);
  if(path===PREFIX+'/calendars'&&request.method==='GET')return json({calendars:await listMicrosoftCalendars(await tokenFor(env,row))},200,cors);
  if(path===PREFIX+'/availability'&&request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>12000)fail('Calendar request is too large',413);
   const raw=await request.text();if(raw.length>12000)fail('Calendar request is too large',413);let body;try{body=JSON.parse(raw);}catch{fail('Invalid calendar request');}
   const date=body?.date,timeZone=body?.timeZone,day=dateValue(date),now=Date.now();zoneFormatter(timeZone);
   if(day<now-2*86400000||day>now+90*86400000)fail('Choose a date within the next 90 days');
   const token=await tokenFor(env,row),calendars=await listMicrosoftCalendars(token),ids=body.calendarIds;
   if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>!calendars.some(row=>row.id===id)))fail('Choose calendars from your connected account');
   const busy=await queryMicrosoftBusy(token,{ids,timeMin:new Date(day-14*3600000).toISOString(),timeMax:new Date(day+38*3600000).toISOString(),timeZone});
   return json({date,timeZone,duration:20,checkedAt:new Date().toISOString(),calendarCount:ids.length,busy,slots:availableSlots({date,timeZone,duration:20,busy,now})},200,cors);
  }
  return json({error:'Calendar route not found'},404,cors);
 }catch(error){return json({error:error.status?error.message:'Calendar connection could not be checked. Please retry.'},error.status||502,cors);}
}
