import {sha256,cookieValue} from './security.js';
import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {creditFailure,recordProviderCredit} from './provider-credit-health.js';
import {normalizeSourceInput,validateSourceUrl,gradeAccessAudit,inferExtractableData} from './intelligence-sources-engine.js';

const MANAGED_FIRECRAWL='https://apollo-proxy.edgars-7e7.workers.dev';
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers)=>json({error:message},status,headers);
const clean=(value,max=2000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const parse=(value,fallback=[])=>{try{return JSON.parse(value||'')??fallback;}catch{return fallback;}};
const uuid=()=>crypto.randomUUID();

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const hash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(hash).first();}
async function requireMember(request,env,workspaceId,roles=[]){const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return {error:'Workspace access denied',status:403};if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};return {user,member};}
function bool(value){return Boolean(Number(value)||value===true);}
function sourceFromRow(row){if(!row)return null;return {id:row.id,name:row.name,url:row.canonical_url,host:row.host,sourceType:row.source_type,geography:parse(row.geography_json,[]),accessStatus:row.access_status,anonymousAccessStatus:row.anonymous_access_status,authenticatedAccessStatus:row.authenticated_access_status,accessMethod:row.access_method||'',authMode:row.auth_mode,authRequired:bool(row.auth_required),extractableFields:parse(row.extractable_fields_json,[]),coverage:parse(row.coverage_json,{}),reliability:row.reliability,monitoringEnabled:bool(row.monitoring_enabled),mandatory:bool(row.mandatory),frequency:row.frequency,triggerIds:parse(row.trigger_ids_json,[]),lastAccessTestAt:row.last_access_test_at||'',lastSuccessfulExtractionAt:row.last_successful_extraction_at||'',lastStatusChangeAt:row.last_status_change_at||'',consecutiveFailures:Number(row.consecutive_failures)||0,healthStatus:row.health_status,lastError:row.last_error||'',nextHealthCheckAt:row.next_health_check_at||'',createdAt:row.created_at||'',updatedAt:row.updated_at||''};}
function auditFromRow(row){return {id:row.id,sourceId:row.source_id,accessStatus:row.access_status,provider:row.provider,method:row.method,contentChars:Number(row.content_chars)||0,extractableFields:parse(row.extractable_fields_json,[]),coverage:parse(row.coverage_json,{}),restrictionReason:row.restriction_reason||'',errorMessage:row.error_message||'',attemptedAt:row.attempted_at||''};}
function nextCheck(from=new Date(),frequency='daily'){const d=new Date(from);if(frequency==='monthly')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+(frequency==='weekly'?7:1));return d.toISOString();}

async function publicScrape(env,workspaceId,url){
  const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl');
  const customer=credential.source==='customer';const target=customer?'https://api.firecrawl.dev/v2/scrape':`${clean(env.FIRECRAWL_PROXY_URL||MANAGED_FIRECRAWL,500)}/firecrawl-scrape`;
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(customer)headers.Authorization=`Bearer ${credential.apiKey}`;
  const response=await fetch(target,{method:'POST',headers,body:JSON.stringify({url,formats:['markdown'],onlyMainContent:true,timeout:25000})});
  const payload=await response.json().catch(()=>({}));if(!response.ok){if(creditFailure(response.status,payload?.error||payload?.message))await recordProviderCredit(env,{workspaceId,userId:null,provider:'firecrawl',kind:'failed',source:credential.source});throw Object.assign(new Error(clean(payload?.error||`Firecrawl scrape returned ${response.status}`,500)),{provider:customer?'firecrawl_customer':'firecrawl_managed'});}
  await recordProviderCredit(env,{workspaceId,userId:null,provider:'firecrawl',kind:'recovered',source:credential.source});
  const data=payload?.data||payload;const text=String(data?.markdown||data?.content||'').trim();return {ok:Boolean(text),text,title:clean(data?.metadata?.title||data?.title,300),provider:customer?'firecrawl_customer':'firecrawl_managed',method:'public_scrape'};
}

async function auditSource(env,row){
  const attemptedAt=new Date().toISOString();let result;
  try{result=await publicScrape(env,row.workspace_id,row.canonical_url);}catch(cause){result={ok:false,text:'',provider:cause?.provider||'firecrawl',method:'public_scrape',error:clean(cause?.message||cause,500)};}
  const grade=gradeAccessAudit(result);const fields=inferExtractableData(result.text||'');const coverage={contentChars:grade.contentChars,title:clean(result.title,300),dataTypeCount:fields.length};const previous=row.access_status||'not_tested';const useful=['full','partial'].includes(grade.status);const failures=useful?0:Number(row.consecutive_failures||0)+1;const health=useful?(grade.status==='full'?'healthy':'degraded'):(failures>=3?'failing':'degraded');
  const auditId=`ISA-${uuid()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO intelligence_source_audits(id,workspace_id,source_id,access_status,provider,method,content_chars,extractable_fields_json,coverage_json,restriction_reason,error_message,attempted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(auditId,row.workspace_id,row.id,grade.status,clean(result.provider,80)||'unknown',clean(result.method,80)||'public_scrape',grade.contentChars,JSON.stringify(fields),JSON.stringify(coverage),grade.restrictionReason||'',result.ok?'':clean(result.error,500),attemptedAt),
    env.DB.prepare(`UPDATE intelligence_sources SET access_status=?,anonymous_access_status=?,access_method=?,extractable_fields_json=?,coverage_json=?,reliability=?,last_access_test_at=?,last_successful_extraction_at=CASE WHEN ?=1 THEN ? ELSE last_successful_extraction_at END,last_status_change_at=CASE WHEN access_status!=? THEN ? ELSE last_status_change_at END,consecutive_failures=?,health_status=?,last_error=?,next_health_check_at=?,mandatory=CASE WHEN ?=1 THEN mandatory ELSE 0 END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(grade.status,grade.status,clean(`${result.provider||'unknown'}:${result.method||'public_scrape'}`,160),JSON.stringify(fields),JSON.stringify(coverage),grade.status==='full'?'high':grade.status==='partial'?'medium':'low',attemptedAt,useful?1:0,attemptedAt,grade.status,attemptedAt,failures,health,result.ok?'':clean(result.error,500),nextCheck(attemptedAt,row.frequency),useful?1:0,row.id,row.workspace_id)
  ]);
  return {id:auditId,sourceId:row.id,accessStatus:grade.status,previousAccessStatus:previous,provider:result.provider||'unknown',method:result.method||'public_scrape',contentChars:grade.contentChars,extractableFields:fields,coverage,restrictionReason:grade.restrictionReason||'',errorMessage:result.ok?'':clean(result.error,500),attemptedAt};
}

export async function runDueSourceHealthChecks(env,now=new Date()){
  const {results=[]}=await env.DB.prepare(`SELECT * FROM intelligence_sources WHERE monitoring_enabled=1 AND (next_health_check_at IS NULL OR next_health_check_at<=?) ORDER BY COALESCE(next_health_check_at,'') ASC LIMIT 10`).bind(now.toISOString()).all();
  const audits=[];for(const row of results){try{audits.push(await auditSource(env,row));}catch(cause){audits.push({sourceId:row.id,accessStatus:'no_access',errorMessage:clean(cause?.message||cause,300)});}}return audits;
}

async function getOwnedSource(env,workspaceId,id){return env.DB.prepare('SELECT * FROM intelligence_sources WHERE id=? AND workspace_id=?').bind(id,workspaceId).first();}
export async function handleIntelligenceSourceRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/intelligence-sources'))return null;
  const workspaceId=clean(url.searchParams.get('workspace_id'),120);if(!workspaceId)return error('workspace_id is required',400,cors);const write=request.method!=='GET';const access=await requireMember(request,env,workspaceId,write?['owner','researcher']:[]);if(access.error)return error(access.error,access.status,cors);
  if(url.pathname==='/api/intelligence-sources'){
    if(request.method==='GET'){const {results=[]}=await env.DB.prepare('SELECT * FROM intelligence_sources WHERE workspace_id=? ORDER BY mandatory DESC,monitoring_enabled DESC,updated_at DESC').bind(workspaceId).all();return json({sources:results.map(sourceFromRow),role:access.member.role},200,cors);}
    if(request.method==='POST'){
      const body=await request.json().catch(()=>null);const normalized=normalizeSourceInput(body||{});if(!normalized.valid)return error(normalized.error||'Valid source URL is required',400,cors);const id=`IS-${uuid()}`;
      try{await env.DB.prepare(`INSERT INTO intelligence_sources(id,workspace_id,name,canonical_url,host,source_type,geography_json,auth_mode,auth_required,monitoring_enabled,mandatory,frequency,trigger_ids_json,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,workspaceId,normalized.name,normalized.url,normalized.host,normalized.sourceType,JSON.stringify(normalized.geography),normalized.authMode,normalized.authRequired?1:0,normalized.monitoringEnabled?1:0,0,normalized.frequency,JSON.stringify(normalized.triggerIds),access.user.id).run();}catch(cause){if(/unique/i.test(String(cause)))return error('This source is already saved in the workspace',409,cors);throw cause;}
      return json({source:sourceFromRow(await getOwnedSource(env,workspaceId,id))},201,cors);
    }
  }
  const auditMatch=url.pathname.match(/^\/api\/intelligence-sources\/([^/]+)\/audit$/);if(auditMatch){const id=decodeURIComponent(auditMatch[1]);const row=await getOwnedSource(env,workspaceId,id);if(!row)return error('Source not found',404,cors);if(request.method==='POST'){const audit=await auditSource(env,row);return json({audit,source:sourceFromRow(await getOwnedSource(env,workspaceId,id))},200,cors);}return error('Method not allowed',405,cors);}
  const auditsMatch=url.pathname.match(/^\/api\/intelligence-sources\/([^/]+)\/audits$/);if(auditsMatch&&request.method==='GET'){const id=decodeURIComponent(auditsMatch[1]);if(!await getOwnedSource(env,workspaceId,id))return error('Source not found',404,cors);const {results=[]}=await env.DB.prepare('SELECT * FROM intelligence_source_audits WHERE source_id=? AND workspace_id=? ORDER BY attempted_at DESC LIMIT 25').bind(id,workspaceId).all();return json({audits:results.map(auditFromRow)},200,cors);}
  const match=url.pathname.match(/^\/api\/intelligence-sources\/([^/]+)$/);if(match){const id=decodeURIComponent(match[1]),row=await getOwnedSource(env,workspaceId,id);if(!row)return error('Source not found',404,cors);
    if(request.method==='PATCH'){
      const body=await request.json().catch(()=>({}));const normalized=normalizeSourceInput({...sourceFromRow(row),...body,url:body.url||row.canonical_url,access_status:row.access_status});if(!normalized.valid)return error(normalized.error,400,cors);const mandatory=Boolean(body.mandatory??row.mandatory)&&['full','partial'].includes(row.access_status);
      await env.DB.prepare(`UPDATE intelligence_sources SET name=?,canonical_url=?,host=?,source_type=?,geography_json=?,auth_mode=?,auth_required=?,monitoring_enabled=?,mandatory=?,frequency=?,trigger_ids_json=?,authenticated_access_status='not_connected',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(normalized.name,normalized.url,normalized.host,normalized.sourceType,JSON.stringify(normalized.geography),normalized.authMode,normalized.authRequired?1:0,Boolean(body.monitoring_enabled??body.monitoringEnabled??row.monitoring_enabled)?1:0,mandatory?1:0,normalized.frequency,JSON.stringify(normalized.triggerIds),id,workspaceId).run();return json({source:sourceFromRow(await getOwnedSource(env,workspaceId,id))},200,cors);
    }
    if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM intelligence_sources WHERE id=? AND workspace_id=?').bind(id,workspaceId).run();return json({deleted:true,id},200,cors);}
  }
  return error('Method not allowed',405,cors);
}
