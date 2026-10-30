import {readOwnedPayload} from './workspace-record-store.js';
import {sha256,cookieValue} from './security.js';
import {requireWorkspaceServiceCredential} from './service-integrations.js';
import {creditFailure,recordProviderCredit} from './provider-credit-health.js';
import {normalizeMonitoringConfig,nextMonitoringRun,buildMonitoringQueries,scoreMonitoringEvidence,canonicalMonitoringUrl,isTenderSignal,monitoringTargetingProfile,monitoringEventIdentity} from './market-monitoring-engine.js';
import {buildMandatorySourceQueries} from './intelligence-sources-engine.js';
import '../../customer/strategy-integrity.js';

const integrity=globalThis.LeadIntelStrategyIntegrity;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers)=>json({error:message},status,headers);
const uuid=()=>crypto.randomUUID();
const clean=(value,max=2000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const failure=(code,status=409)=>Object.assign(new Error(code),{code,status});
const changed=result=>Number(result?.meta?.changes||0)>0;
async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const hash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(hash).first();}
async function requireMember(request,env,workspaceId,roles=[]){const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return {error:'Workspace access denied',status:403};if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};return {user,member};}
function parse(value,fallback=[]){try{return JSON.parse(value||'')??fallback;}catch{return fallback;}}
function configFromRow(row){if(!row)return {...normalizeMonitoringConfig({}),revision:0};return {...normalizeMonitoringConfig({enabled:Boolean(row.enabled),frequency:row.frequency,research_depth:row.research_depth,minimum_score:row.minimum_score,source_types:parse(row.source_types_json),signal_ids:parse(row.signal_ids_json),custom_sources:parse(row.custom_sources_json)}),revision:row.revision,nextRunAt:row.next_run_at||'',lastRunAt:row.last_run_at||'',updatedAt:row.updated_at||''};}
async function strategyState(env,workspaceId){const state=await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();const owned=await readOwnedPayload(env,workspaceId,state);const approval=integrity.status(owned.payload?.main||{});return {...owned,approval:{...approval,signature:await sha256(approval.signature||'')}};}
function normalizeResult(item,query){const url=canonicalMonitoringUrl(item?.url||item?.link||'');if(!url)return null;return {url,title:clean(item?.title,300),description:clean(item?.description||item?.snippet,1000),text:clean(item?.markdown||item?.content||item?.text||item?.description,12000),date:clean(item?.publishedDate||item?.date||item?.metadata?.publishedDate,80),sourceType:query.sourceType,sourceId:query.sourceId||'',plannedSignalIds:query.signalIds||[],company:clean(item?.company||item?.companyName||item?.metadata?.company,160)};}
async function boundedProviderOperation(operation,requestSignal,timeoutMs){
 const controller=new AbortController();let timer,onAbort;
 const check=()=>{if(controller.signal.aborted)throw controller.signal.reason;};
 const stopped=new Promise((_,reject)=>{
  onAbort=()=>{const reason=failure('request_canceled',499);controller.abort(reason);reject(reason);};
  timer=setTimeout(()=>{const reason=failure('provider_timeout',504);controller.abort(reason);reject(reason);},timeoutMs);
  if(requestSignal?.aborted)onAbort();else requestSignal?.addEventListener('abort',onAbort,{once:true});
 });
 try{return await Promise.race([stopped,Promise.resolve().then(()=>{check();return operation(controller.signal,check);})]);}
 finally{clearTimeout(timer);requestSignal?.removeEventListener('abort',onAbort);}
}
async function firecrawlSearch(env,workspaceId,query,limit,assertFresh,requestSignal,remainingMs){
 return boundedProviderOperation(async(signal,check)=>{
  const credential=await requireWorkspaceServiceCredential(env,workspaceId,'firecrawl');check();await assertFresh();check();
  const response=await fetch('https://api.firecrawl.dev/v2/search',{method:'POST',signal,headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${credential.apiKey}`},body:JSON.stringify({query:query.query,limit,scrapeOptions:{formats:['markdown']}})});check();
  const payload=await response.json();check();await assertFresh();check();
  if(!response.ok||payload?.success===false){if(creditFailure(response.status,payload?.error||payload?.message))await recordProviderCredit(env,{workspaceId,userId:null,provider:'firecrawl',kind:'failed',source:credential.source});check();throw failure('provider_query_failed',502);}
  await recordProviderCredit(env,{workspaceId,userId:null,provider:'firecrawl',kind:'recovered',source:credential.source});check();
  const raw=Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.data?.web)?payload.data.web:Array.isArray(payload?.web)?payload.web:[];
  return raw.slice(0,limit).map(item=>normalizeResult(item,query)).filter(Boolean);
 },requestSignal,Math.max(1,Math.min(30000,remainingMs)));
}
function activeSignals(payload,config){const signals=payload?.main?.market?.signals||[];const selected=new Set(config.signalIds);return signals.filter(signal=>signal?.active!==false&&(!selected.size||selected.has(clean(signal.id))));}
async function loadMandatorySources(env,workspaceId){const {results=[]}=await env.DB.prepare(`SELECT id,name,canonical_url AS url,host,source_type AS sourceType,access_status AS accessStatus,monitoring_enabled AS monitoringEnabled,mandatory,frequency,trigger_ids_json FROM intelligence_sources WHERE workspace_id=? AND mandatory=1 AND monitoring_enabled=1 AND access_status IN ('full','partial')`).bind(workspaceId).all();return results.filter(row=>canonicalMonitoringUrl(row.url)).map(row=>({...row,host:new URL(row.url).hostname,mandatory:Boolean(row.mandatory),monitoringEnabled:Boolean(row.monitoringEnabled),triggerIds:parse(row.trigger_ids_json)}));}

async function runWorkspaceMonitoring(env,row,triggerType='scheduled',request,dueAt=new Date().toISOString()){
 const workspaceId=row.workspace_id,config=configFromRow(row),runId=`MON-${uuid()}`,start=Date.now(),leaseExpires=new Date(start+600000).toISOString();
 // A delayed due SELECT must not reclaim a lease after another run has finished
 // and advanced this schedule without changing its configuration revision.
 const scheduled=triggerType==='scheduled';
 const claim=await env.DB.prepare(`UPDATE market_monitoring_configs SET lease_id=?,lease_expires_at=? WHERE workspace_id=? AND revision=? AND (lease_id IS NULL OR lease_expires_at<=?) ${scheduled?'AND enabled=1 AND next_run_at IS ? AND (next_run_at IS NULL OR next_run_at<=?)':''}`).bind(runId,leaseExpires,workspaceId,row.revision,new Date(start).toISOString(),...(scheduled?[row.next_run_at??null,dueAt]:[])).run();
 if(!changed(claim))return {workspaceId,status:'skipped',reason:'monitoring_already_running_or_changed'};
 let sources=0,alerts=0,failures=0,queries=[],mandatorySources=[],completed='',status='failed',reason='',currentState;
 const creator=row.created_by,sessionHash=request?await sha256(cookieValue(request,'leadintel_session')):'';
 const assertFresh=async()=>{
  if(request?.signal.aborted)throw failure('request_canceled',499);
  if(Date.now()-start>=300000)throw failure('run_deadline_exceeded');
  const current=await env.DB.prepare('SELECT revision,lease_id,lease_expires_at FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();
  if(current?.lease_id!==runId||current.revision!==row.revision||Date.parse(current.lease_expires_at)<=Date.now())throw failure('monitoring_configuration_changed');
  const member=await env.DB.prepare(`SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?`).bind(workspaceId,creator).first();
  if(!['owner','researcher'].includes(member?.role))throw failure('monitoring_authorization_revoked',403);
  if(request){const access=await requireMember(request,env,workspaceId,['owner','researcher']);if(access.error)throw failure('monitoring_authorization_revoked',access.status);}
  currentState=await strategyState(env,workspaceId);
  if(!currentState.approval.current||currentState.approval.signature!==row.strategy_signature)throw failure('strategy_approval_stale');
 };
 // The guard is part of each SQLite mutation: a pause, revoked member or changed
 // saved Strategy between the await and commit cannot publish old provider data.
 const guard=()=>({sql:`EXISTS (SELECT 1 FROM market_monitoring_configs c JOIN customer_workspace_state s ON s.workspace_id=c.workspace_id JOIN workspace_members m ON m.workspace_id=c.workspace_id AND m.user_id=? WHERE c.workspace_id=? AND c.revision=? AND c.lease_id=? AND c.lease_expires_at>? AND s.version=? AND m.role IN ('owner','researcher') ${request?"AND EXISTS(SELECT 1 FROM sessions ms JOIN workspace_members mm ON mm.user_id=ms.user_id WHERE ms.token_hash=? AND ms.expires_at>datetime('now') AND mm.workspace_id=c.workspace_id AND mm.role IN ('owner','researcher'))":''})`,args:[creator,workspaceId,row.revision,runId,new Date().toISOString(),currentState.row.version,...(request?[sessionHash]:[])]});
 try{
  await env.DB.prepare(`UPDATE market_monitoring_runs SET status='failed',error_message='lease_expired',completed_at=? WHERE workspace_id=? AND status='running' AND id!=COALESCE((SELECT lease_id FROM market_monitoring_configs WHERE workspace_id=?),'')`).bind(new Date(start).toISOString(),workspaceId,workspaceId).run();
  await env.DB.prepare(`INSERT INTO market_monitoring_runs(id,workspace_id,trigger_type,research_depth,status,snapshot_json) VALUES(?,?,?,?,?,?)`).bind(runId,workspaceId,triggerType,config.researchDepth,'running',JSON.stringify({config_revision:row.revision,strategy_signature:row.strategy_signature})).run();
  await assertFresh();const payload=currentState.payload,signals=activeSignals(payload,config),profile=monitoringTargetingProfile(payload?.main||{});
  mandatorySources=await loadMandatorySources(env,workspaceId);
  mandatorySources=mandatorySources.filter(source=>source.sourceType!=='tenders'||(config.sourceTypes.includes('tenders')&&signals.some(isTenderSignal)));
  const limit=config.researchDepth==='deep'?12:4;
  queries=[...buildMandatorySourceQueries(mandatorySources,signals,profile),...buildMonitoringQueries(payload,config)].slice(0,limit);
  await env.DB.prepare('UPDATE market_monitoring_runs SET query_count=?,snapshot_json=? WHERE id=?').bind(queries.length,JSON.stringify({markets:profile.targetMarkets||'',source_types:config.sourceTypes,signal_ids:config.signalIds,config_revision:row.revision,strategy_signature:row.strategy_signature,mandatory_sources:mandatorySources.map(source=>({id:source.id,host:source.host,signal_ids:source.triggerIds}))}),runId).run();
  if(!queries.length)throw failure('no_active_monitoring_queries');
  const seen=new Set(),signalMap=new Map(signals.map(signal=>[clean(signal.id),signal]));
  for(const query of queries){
   await assertFresh();
   try{
    const results=await firecrawlSearch(env,workspaceId,query,config.researchDepth==='deep'?8:5,assertFresh,request?.signal,start+300000-Date.now());
    const scoringSignals=query.signalIds?.length?query.signalIds.map(id=>signalMap.get(id)).filter(Boolean):signals;
    for(const item of results){
     if(isTenderSignal({name:item.title,keywords:item.description})&&!(config.sourceTypes.includes('tenders')&&signals.some(isTenderSignal)))continue;
     const fingerprint=await sha256(item.url);if(seen.has(fingerprint))continue;seen.add(fingerprint);
     const scored=scoreMonitoringEvidence(item,scoringSignals),eventIdentity=monitoringEventIdentity(item),eventFingerprint=eventIdentity?await sha256(eventIdentity):null;await assertFresh();
     const existing=await env.DB.prepare('SELECT id FROM market_monitoring_evidence WHERE workspace_id=? AND fingerprint=?').bind(workspaceId,fingerprint).first(),evidenceId=existing?.id||`ME-${uuid()}`;
     const g=guard();const stored=await env.DB.prepare(`INSERT INTO market_monitoring_evidence(id,workspace_id,run_id,fingerprint,source_url,source_type,title,excerpt,published_at,score,signal_ids_json) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${g.sql} ON CONFLICT(workspace_id,fingerprint) DO UPDATE SET run_id=excluded.run_id,source_type=excluded.source_type,title=excluded.title,excerpt=excluded.excerpt,published_at=excluded.published_at,score=excluded.score,signal_ids_json=excluded.signal_ids_json,last_seen_at=CURRENT_TIMESTAMP`).bind(evidenceId,workspaceId,runId,fingerprint,item.url,item.sourceType,item.title,item.description||item.text,item.date||null,scored.total,JSON.stringify(scored.signalIds),...g.args).run();
     if(!changed(stored))throw failure('monitoring_context_changed');sources++;
     if(!existing&&scored.signalIds.length&&scored.total>=config.minimumScore){const alertGuard=guard();const storedAlert=await env.DB.prepare(`INSERT OR IGNORE INTO market_monitoring_alerts(id,workspace_id,evidence_id,score,title,summary,source_url,event_fingerprint) SELECT ?,?,?,?,?,?,?,? WHERE ${alertGuard.sql}`).bind(`MA-${uuid()}`,workspaceId,evidenceId,scored.total,item.title||'New market signal',clean(item.description||item.text,1200),item.url,eventFingerprint,...alertGuard.args).run();if(changed(storedAlert))alerts++;}
    }
   }catch(cause){if(cause.code&&cause.code!=='provider_query_failed'&&cause.code!=='CUSTOMER_SERVICE_KEY_REQUIRED')throw cause;failures++;}
  }
  await assertFresh();status=failures===0?'completed':sources?'partial':'failed';reason=failures?`${failures} research queries failed`:'';
 }catch(cause){reason=typeof cause.code==='string'?cause.code:cause.name==='TimeoutError'?'provider_timeout':cause.name==='AbortError'?'request_canceled':'monitoring_run_failed';status='failed';}
 finally{
  completed=new Date().toISOString();
  let finalized=false;
  if((status==='completed'||status==='partial')&&currentState){const g=guard();finalized=changed(await env.DB.prepare(`UPDATE market_monitoring_runs SET status=?,source_count=?,alert_count=?,error_message=?,completed_at=? WHERE id=? AND ${g.sql}`).bind(status,sources,alerts,reason||null,completed,runId,...g.args).run());if(!finalized){status='failed';reason='monitoring_context_changed';}}
  if(!finalized)await env.DB.prepare('UPDATE market_monitoring_runs SET status=?,source_count=?,alert_count=?,error_message=?,completed_at=? WHERE id=?').bind(status,sources,alerts,reason||null,completed,runId).run();
  const suspend=['strategy_approval_stale','monitoring_authorization_revoked','no_active_monitoring_queries'].includes(reason);
  await env.DB.prepare(`UPDATE market_monitoring_configs SET last_run_at=?,next_run_at=?,enabled=CASE WHEN ? THEN 0 ELSE enabled END,lease_id=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND lease_id=?`).bind(completed,suspend?null:nextMonitoringRun(completed,config.frequency),suspend?1:0,workspaceId,row.revision,runId).run();
 }
 const savedConfig=await env.DB.prepare('SELECT next_run_at FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();
 return {id:runId,status,reason,nextRunAt:savedConfig?.next_run_at||'',queryCount:queries.length,sourceCount:sources,alertCount:alerts,mandatorySourceCount:mandatorySources.length,completedAt:completed};
}
export async function runDueMarketMonitoring(env,now=new Date()){
 const dueAt=now.toISOString();
 const {results=[]}=await env.DB.prepare(`SELECT * FROM market_monitoring_configs WHERE enabled=1 AND (next_run_at IS NULL OR next_run_at<=?) ORDER BY COALESCE(next_run_at,'') ASC LIMIT 10`).bind(dueAt).all();const runs=[];
 for(const row of results){try{runs.push(await runWorkspaceMonitoring(env,row,'scheduled',undefined,dueAt));}catch{runs.push({workspaceId:row.workspace_id,status:'failed',reason:'monitoring_storage_failed'});}}return runs;
}
export async function handleMarketMonitoringRoute(request,env,cors={}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/market-monitoring/'))return null;const workspaceId=clean(url.searchParams.get('workspace_id'),120);if(!workspaceId)return error('workspace_id is required',400,cors);const write=request.method!=='GET';const access=await requireMember(request,env,workspaceId,write?['owner','researcher']:[]);if(access.error)return error(access.error,access.status,cors);const requestSessionHash=await sha256(cookieValue(request,'leadintel_session'));
 if(url.pathname==='/api/market-monitoring/config'){
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();return json({config:configFromRow(row),role:access.member.role},200,cors);}
  if(request.method==='PUT'){
   const body=await request.json().catch(()=>null);if(!body)return error('Monitoring configuration is required',400,cors);const config=normalizeMonitoringConfig(body);let state;try{state=await strategyState(env,workspaceId);}catch{if(config.enabled)return error('Saved workspace is unreadable. Restore it and approve Strategy before enabling monitoring.',409,cors);state={approval:{current:false,signature:''},row:null};}
   if(config.enabled&&!state.approval.current)return error(state.approval.reason||'Approve the current Profile and Strategy before enabling monitoring',409,cors);
   if(config.enabled&&Object.prototype.hasOwnProperty.call(body,'strategy_signature')&&body.strategy_signature!==state.approval.signature)return error('Strategy changed; review or reload Strategy before enabling monitoring.',409,cors);
   const freshAccess=await requireMember(request,env,workspaceId,['owner','researcher']);if(freshAccess.error)return error(freshAccess.error,freshAccess.status,cors);
   const revision=Number.isSafeInteger(body.revision)?body.revision:0,next=config.enabled?new Date().toISOString():null,signature=state.approval.current?state.approval.signature:'';
   const result=await env.DB.prepare(`INSERT INTO market_monitoring_configs(workspace_id,enabled,frequency,research_depth,minimum_score,source_types_json,signal_ids_json,custom_sources_json,created_by,next_run_at,strategy_signature) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (?=0 OR EXISTS(SELECT 1 FROM market_monitoring_configs WHERE workspace_id=?)) AND (?=0 OR EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=?)) AND EXISTS(SELECT 1 FROM workspace_members m JOIN sessions s ON s.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND m.role IN ('owner','researcher') AND s.token_hash=? AND s.expires_at>datetime('now')) ON CONFLICT(workspace_id) DO UPDATE SET enabled=excluded.enabled,frequency=excluded.frequency,research_depth=excluded.research_depth,minimum_score=excluded.minimum_score,source_types_json=excluded.source_types_json,signal_ids_json=excluded.signal_ids_json,custom_sources_json=excluded.custom_sources_json,created_by=excluded.created_by,strategy_signature=excluded.strategy_signature,next_run_at=CASE WHEN excluded.enabled=0 THEN NULL WHEN market_monitoring_configs.enabled=0 OR market_monitoring_configs.frequency!=excluded.frequency OR market_monitoring_configs.strategy_signature!=excluded.strategy_signature THEN excluded.next_run_at ELSE market_monitoring_configs.next_run_at END,revision=market_monitoring_configs.revision+1,lease_id=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE market_monitoring_configs.revision=?`).bind(workspaceId,config.enabled?1:0,config.frequency,config.researchDepth,config.minimumScore,JSON.stringify(config.sourceTypes),JSON.stringify(config.signalIds),JSON.stringify(config.customSources),freshAccess.user.id,next,signature,revision,workspaceId,config.enabled?1:0,workspaceId,state.row?.version??-1,workspaceId,access.user.id,requestSessionHash,revision).run();
   if(!changed(result))return error('Monitoring configuration changed. Reload settings before saving.',409,cors);
   const saved=await env.DB.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();return json({saved:true,config:configFromRow(saved)},200,cors);
  }
 }
 if(url.pathname==='/api/market-monitoring/run'&&request.method==='POST'){const saved=await env.DB.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();if(!saved)return error('Save monitoring settings before running',409,cors);const run=await runWorkspaceMonitoring(env,saved,'manual',request);return json({run},run.status==='skipped'?409:200,cors);}
 if(url.pathname==='/api/market-monitoring/runs'&&request.method==='GET'){const {results=[]}=await env.DB.prepare('SELECT id,trigger_type,research_depth,status,query_count,source_count,alert_count,started_at,completed_at,error_message FROM market_monitoring_runs WHERE workspace_id=? ORDER BY started_at DESC LIMIT 20').bind(workspaceId).all();return json({runs:results},200,cors);}
 if(url.pathname==='/api/market-monitoring/alerts'&&request.method==='GET'){const {results=[]}=await env.DB.prepare(`SELECT id,status,score,title,summary,source_url,created_at,updated_at FROM market_monitoring_alerts WHERE workspace_id=? AND status!='dismissed' ORDER BY created_at DESC LIMIT 50`).bind(workspaceId).all();return json({alerts:results,unread:results.filter(item=>item.status==='new').length},200,cors);}
 const match=url.pathname.match(/^\/api\/market-monitoring\/alerts\/([^/]+)$/);if(match&&request.method==='PATCH'){const body=await request.json().catch(()=>null);if(!['read','dismissed'].includes(body?.status))return error('Alert status must be read or dismissed',400,cors);const freshAccess=await requireMember(request,env,workspaceId,['owner','researcher']);if(freshAccess.error)return error(freshAccess.error,freshAccess.status,cors);const result=await env.DB.prepare("UPDATE market_monitoring_alerts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND EXISTS(SELECT 1 FROM workspace_members m JOIN sessions s ON s.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND m.role IN ('owner','researcher') AND s.token_hash=? AND s.expires_at>datetime('now'))").bind(body.status,decodeURIComponent(match[1]),workspaceId,workspaceId,access.user.id,requestSessionHash).run();if(!changed(result))return error('Alert not found',404,cors);return json({updated:true,id:decodeURIComponent(match[1]),status:body.status},200,cors);}
 return error('Method not allowed',405,cors);
}
