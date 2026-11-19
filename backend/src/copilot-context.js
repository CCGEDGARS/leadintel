import {providerCreditIssue} from './provider-credit-health.js';
import {getCustomerState} from './customer-state.js';
import {assertModelSafe,redactProtectedData,sanitizeClientScreenContext,sanitizeExternalResearchQuery} from './copilot-security.js';
import {savedReferenceScope} from './copilot-research-scope.js';
import {copilotOperationContext} from './copilot-operation-context.js';

const MAX_TEXT=4000;
const MAX_PROFILE_TEXT=8000;
const MAX_ICP=10;
const MAX_SIGNALS=20;
const MAX_RESEARCH=12;
const MAX_TOP_COMPANIES=10;
const MAX_INTAKE_TEXT=600;
const MAX_DOSSIERS=5;
const MAX_DOSSIER_FACTS=5;
const MAX_CRM_ACTIVITIES=15;

function clean(value,max=MAX_TEXT){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function array(value,limit){return Array.isArray(value)?value.slice(0,limit):[];}
function safeNumber(value){const n=Number(value);return Number.isFinite(n)?n:0;}
async function firstSafe(env,sql,...args){try{return await env.DB.prepare(sql).bind(...args).first();}catch{return null;}}
async function allSafe(env,sql,...args){try{const {results=[]}=await env.DB.prepare(sql).bind(...args).all();return Array.isArray(results)?results:[];}catch{return [];}}

function safeProfile(value){
  const source=redactProtectedData(object(value));
  const out={};let count=0;
  for(const [key,item] of Object.entries(source)){
    if(count>=30)break;
    if(typeof item==='string')out[key]=clean(item,MAX_PROFILE_TEXT);
    else if(typeof item==='number'||typeof item==='boolean'||item===null)out[key]=item;
    else if(Array.isArray(item))out[key]=item.slice(0,20).map(entry=>typeof entry==='string'?clean(entry,500):redactProtectedData(entry));
    else if(item&&typeof item==='object')out[key]=redactProtectedData(item);
    count++;
  }
  return out;
}
function safeIcp(item){const value=object(redactProtectedData(item));return {id:clean(value.id,120),name:clean(value.name||value.title,240),criteria:clean(value.criteria||value.description||value.definition,3000),exclusions:clean(value.exclusions,2000),priority:clean(value.priority,80)};}
function safeSignal(item){const value=object(redactProtectedData(item));return {id:clean(value.id,120),name:clean(value.name||value.title,240),description:clean(value.description||value.reason,2400),active:value.active!==false,keywords:array(typeof value.keywords==='string'?value.keywords.split(/[,;\n]+/):value.keywords,12).filter(item=>typeof item==='string').map(item=>clean(item,120)),weight:Math.max(0,Math.min(100,safeNumber(value.weight||value.score)))};}
function safeResearchItem(item){const value=object(redactProtectedData(item));return {name:clean(value.name||value.title,280),summary:clean(value.summary||value.description||value.hypothesis,2400),score:Math.max(0,Math.min(100,safeNumber(value.score?.total??value.score))),sourceUrl:clean(value.sourceUrl||value.source_url||value.url,1200)};}

async function crmSummary(env,workspaceId){
  // Speed burst step 3 (2026-10-26): independent reads run concurrently.
  const [countsRow,pipelineRows,companies]=await Promise.all([
    firstSafe(env,`SELECT COUNT(*) AS total,SUM(CASE WHEN pipeline_stage IS NOT NULL THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN lifecycle_status='customer' THEN 1 ELSE 0 END) AS customers FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL`,workspaceId),
    allSafe(env,`SELECT COALESCE(pipeline_stage,'None') AS pipeline_stage,COUNT(*) AS count FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL GROUP BY pipeline_stage ORDER BY count DESC`,workspaceId),
    allSafe(env,`SELECT id,company_name,website,country,industry,pipeline_stage,opportunity_score,confidence,updated_at FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL ORDER BY COALESCE(opportunity_score,0) DESC,updated_at DESC LIMIT 10`,workspaceId)
  ]);const counts=countsRow||{};
  return {
    total:safeNumber(counts.total),active:safeNumber(counts.active),customers:safeNumber(counts.customers),
    pipeline:pipelineRows.slice(0,12).map(row=>({stage:clean(row.pipeline_stage,80),count:safeNumber(row.count)})),
    topCompanies:companies.slice(0,MAX_TOP_COMPANIES).map(row=>({id:clean(row.id,160),name:clean(row.company_name,240),website:clean(row.website,1000),country:clean(row.country,120),industry:clean(row.industry,180),pipelineStage:clean(row.pipeline_stage,80),score:safeNumber(row.opportunity_score),confidence:clean(row.confidence,40),updatedAt:clean(row.updated_at,80)}))
  };
}

async function integrationStatus(env,workspaceId){
  const [gmail,ai,service]=await Promise.all([
    firstSafe(env,`SELECT 'gmail' AS provider,status,connected_at,updated_at FROM gmail_connections WHERE workspace_id=? LIMIT 1`,workspaceId),
    allSafe(env,`SELECT provider,active,verified_at,last_used_at,updated_at FROM workspace_ai_integrations WHERE workspace_id=? ORDER BY active DESC,updated_at DESC LIMIT 10`,workspaceId),
    allSafe(env,`SELECT provider,verified_at,last_used_at,updated_at FROM workspace_service_integrations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 10`,workspaceId)
  ]);
  const items=[];
  if(gmail)items.push({provider:'gmail',state:clean(gmail.status||'connected',80),connectedAt:clean(gmail.connected_at,80),updatedAt:clean(gmail.updated_at,80)});
  for(const item of ai)items.push({provider:clean(item.provider,80),state:item.active===0?'inactive':item.verified_at?'connected':'configured',verifiedAt:clean(item.verified_at,80),lastUsedAt:clean(item.last_used_at,80),updatedAt:clean(item.updated_at,80)});
  for(const item of service)items.push({provider:clean(item.provider,80),state:item.verified_at?'connected':'configured',verifiedAt:clean(item.verified_at,80),lastUsedAt:clean(item.last_used_at,80),updatedAt:clean(item.updated_at,80)});
  return items;
}

async function supportUsage(env,workspaceId){
 const [consumption,rows,issues]=await Promise.all([
  allSafe(env,`SELECT entity_id AS provider,json_extract(metadata_json,'$.model') AS model,COUNT(*) AS requests,SUM(COALESCE(json_extract(metadata_json,'$.input_tokens'),0)) AS input_tokens,SUM(COALESCE(json_extract(metadata_json,'$.output_tokens'),0)) AS output_tokens FROM audit_events WHERE workspace_id=? AND event_type IN ('ai.generation_completed','ai.web_search_completed') AND created_at>=datetime('now','-30 days') GROUP BY entity_id,json_extract(metadata_json,'$.model') LIMIT 20`,workspaceId),
  allSafe(env,`SELECT provider,json_extract(metadata_json,'$.remaining_credits') AS remaining_credits,verified_at FROM workspace_service_integrations WHERE workspace_id=?`,workspaceId),
  Promise.all(['openai','anthropic','firecrawl','apollo','hunter'].map(async provider=>({provider,issue:await providerCreditIssue(env,workspaceId,provider)})))
 ]);
 return {period:'last 30 days',coverage:'Recorded AI generation/search only; incomplete total spend. Copilot tokens are recorded in message metadata. Subscriptions, enrichment, retries and currency conversion need separate evidence.',consumption:consumption.map(row=>({provider:clean(row.provider,80),model:clean(row.model,120),requests:safeNumber(row.requests),inputTokens:safeNumber(row.input_tokens),outputTokens:safeNumber(row.output_tokens)})),balances:rows.map(row=>({provider:clean(row.provider,80),remainingCredits:row.remaining_credits!=null&&Number.isFinite(Number(row.remaining_credits))?Number(row.remaining_credits):null,verifiedAt:clean(row.verified_at,80),live:false})),creditIssues:issues.filter(row=>row.issue),pricesVerified:false};
}

function scoreValue(value){
  return (typeof value==='number'||typeof value==='string'&&value.trim())&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100?Number(value):null;
}
function publicEvidenceUrl(value){
  try{
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
    return clean(url.origin+url.pathname,500);
  }catch{return '';}
}
function discoverySummary(payload,screen){
  const discovery=object(payload.discovery);
  const candidates=Array.isArray(discovery.candidates)?discovery.candidates:array(discovery.companies);
  const visibleDomains=new Set((screen.companyScores||[]).map(row=>row.domain));
  const seen=new Set();
  const rows=[];
  for(const [source,items] of [['candidate',candidates],['research_review',array(discovery.potentialMatches)],['buyers_selection',array(discovery.selectedProspects)],['saved_pipeline',array(discovery.pipeline)]]){
    for(const item of items){
      const name=clean(item?.company||item?.companyName||item?.name,200);
      const domain=clean(item?.domain||publicEvidenceUrl(item?.website).split('/')[2],160).toLowerCase();
      const key=domain||name.toLowerCase();
      if(!name||seen.has(key))continue;
      seen.add(key);
      rows.push({item,name,domain,source,fit:scoreValue(item.qualification?.score),opportunity:scoreValue(item.score?.total??item.score)});
    }
  }
  rows.sort((a,b)=>Number(visibleDomains.has(b.domain))-Number(visibleDomains.has(a.domain))||(b.fit??b.opportunity??-1)-(a.fit??a.opportunity??-1));
  const companyScores=rows.slice(0,MAX_TOP_COMPANIES).map(({item,name,domain,source,fit,opportunity})=>{
    const qualification=object(item.qualification);
    const breakdown=Object.fromEntries(['fit','signal','evidence','timing','value'].filter(key=>scoreValue(item.score?.[key])!==null).map(key=>[key,scoreValue(item.score[key])]));
    return {
      name,domain,source,savedCompanyFit:fit,retainedBuyerFit:item.buyerFit?.version===2?scoreValue(item.buyerFit.fit):null,savedOpportunityScore:opportunity,opportunityBreakdown:breakdown,
      companyPoints:scoreValue(qualification.companyScore),signalPoints:scoreValue(qualification.signalPoints),confidence:clean(qualification.confidence||item.confidence,40),
      needsRecheck:item.needsRecheck===true,
      gaps:array(qualification.gaps||item.qualificationGaps,5).map(value=>clean(sanitizeExternalResearchQuery(value),220)),
      evidenceCount:array(item.evidence).length,
      evidence:array(item.evidence,3).flatMap(entry=>{
        const url=publicEvidenceUrl(entry?.url);
        return url?[{url,title:clean(sanitizeExternalResearchQuery(entry.title),160),excerpt:clean(sanitizeExternalResearchQuery(entry.description||entry.text),180),publicationDate:clean(entry.publishedDate||entry.publishedAt||entry.date,40),sourceRead:entry.sourceRead===true}]:[];
      }),
      matchedSignals:array(qualification.matchedSignals||item.matchedSignals,5).map(signal=>clean(sanitizeExternalResearchQuery(signal?.name),120)).filter(Boolean)
    };
  });
  const scores=rows.filter(row=>row.source==='candidate').map(row=>row.opportunity).filter(score=>score!==null);
  const failures=array(discovery.searchFailures);
  return {
    companyCount:candidates.length,reviewCount:array(discovery.potentialMatches).length,companyScores,
    highPriorityCount:scores.filter(score=>score>=70).length,averageScore:scores.length?Math.round(scores.reduce((sum,n)=>sum+n,0)/scores.length):null,
    status:['idle','running','complete','no_results','partial','error'].includes(discovery.status)?discovery.status:null,
    lastRunAt:clean(discovery.lastRunAt,40),retainedEarlierResults:discovery.retainedLastSuccessfulResults===true,
    needsRefresh:discovery.needsRefresh===true,sourceResultCount:array(discovery.rawResults).length,
    recordedRequests:Array.isArray(discovery.researchAudit?.entries)?discovery.researchAudit.entries.length:null,
    failureCount:failures.length,
    recentFailures:failures.slice(-12).map(row=>({
      phase:['searching','following','resolving','verifying','extracting','buyer-fit'].includes(row?.phase)?row.phase:'unknown',
      reason:['timeout','rate_limit','quota_exhausted','provider_unavailable','network_error','auth_error','request_rejected'].includes(row?.reason)?row.reason:'unknown_error',
      status:Number.isInteger(row?.status)&&row.status>=100&&row.status<=599?row.status:null,
      ...(/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(row?.domain||'')?{domain:clean(row.domain,160).toLowerCase()}:{}),
      ...(row?.code==='BUYER_FIT_EVIDENCE_REJECTED'?{code:row.code}:{})
    }))
  };
}
function outreachSummary(payload){
  const outreach=object(payload.outreach);const delivery=object(payload.delivery);const metrics=object(delivery.metrics);
  return {mode:clean(outreach.mode||outreach.automationMode||'manual',40),draftCount:Array.isArray(outreach.drafts)?outreach.drafts.length:0,sent:safeNumber(metrics.sent),replies:safeNumber(metrics.replies),meetings:safeNumber(metrics.meetings)};
}
function readiness(main,{icps,signals,markets}){
  const website=clean(main.website||main.profile?.website,1000);
  const checks={website:Boolean(website),market:markets.length>0,icp:icps.length>0,signal:signals.some(item=>item.active)};
  const complete=Object.values(checks).filter(Boolean).length;
  return {checks,completeCount:complete,totalChecks:4,percent:Math.round((complete/4)*100)};
}

// B2 (CTO, 2026-10-25): the assistant knows the person, what they just did and more of the company. Private contact
// data (e-mails, phones, named people from dossiers, message bodies) stays out; everything is bounded.
function safeUser(user){const name=clean(user?.name||user?.display_name,120);if(!name)return undefined;return {name,firstName:name.split(/\s+/)[0]};}
function intakeAnswers(main){const answers=object(main.answers);const out={};for(const [key,value] of Object.entries(answers)){if(Object.keys(out).length>=12)break;const text=clean(value,MAX_INTAKE_TEXT);if(text&&!/(^|_)(email|phone|password|token|secret)/i.test(key))out[key]=text;}return out;}
function brandSummary(main){const brand=object(main.brandIdentity);const out={};for(const key of ['companyDisplayName','senderName','senderTitle','meetingPlatform']){const text=clean(brand[key],160);if(text)out[key]=text;}return out;}
function goalsSummary(main){const goals=object(main.workspaceGoals);const out={};for(const [key,value] of Object.entries(goals)){if(Object.keys(out).length>=6)break;const text=clean(value,400);if(text)out[key]=text;}return out;}
function referencesSummary(main){const refs=object(main.referenceCustomers);const scope=savedReferenceScope(main);return {count:scope.total,companies:scope.targets.map(row=>row.name),targets:scope.targets,omitted:scope.omitted,segments:array(refs.segments,10).map(item=>clean(object(item).name||item,120)).filter(Boolean),activated:refs.activated===true};}
function factText(item){if(typeof item==='string')return clean(item,200);const value=object(item);return clean(value.text||value.claim||value.statement||value.summary||value.fact,200);}
async function dossierSummary(env,workspaceId){
  const rows=await allSafe(env,`SELECT domain,payload_json,updated_at FROM workspace_company_dossiers WHERE workspace_id=? ORDER BY updated_at DESC LIMIT ${MAX_DOSSIERS}`,workspaceId);
  return rows.map(row=>{let payload={};try{payload=object(JSON.parse(row.payload_json||'{}'));}catch{}return {domain:clean(row.domain,160),company:clean(payload.company,200),status:clean(payload.status,40),checkedAt:clean(payload.checkedAt||row.updated_at,40),facts:array(payload.facts,MAX_DOSSIER_FACTS).map(factText).filter(Boolean),gaps:array(payload.gaps,100).length};});
}
async function crmActivities(env,workspaceId){
  const rows=await allSafe(env,`SELECT a.activity_type,a.channel,a.subject,a.occurred_at,c.company_name FROM crm_activities a LEFT JOIN crm_companies c ON c.id=a.company_id WHERE a.workspace_id=? ORDER BY a.occurred_at DESC LIMIT ${MAX_CRM_ACTIVITIES}`,workspaceId);
  return rows.slice(0,MAX_CRM_ACTIVITIES).map(row=>({type:clean(row.activity_type,60),channel:clean(row.channel,40),subject:clean(row.subject,120),company:clean(row.company_name,160),occurredAt:clean(row.occurred_at,40)}));
}
async function deliveryActivity(env,workspaceId){
  const rows=await allSafe(env,`SELECT kind,COUNT(*) AS count FROM email_activity_events WHERE workspace_id=? AND occurred_at>=datetime('now','-30 days') GROUP BY kind`,workspaceId);
  const find=kind=>safeNumber(rows.find(row=>clean(row.kind,40)===kind)?.count);
  return {period:'last 30 days',sent:find('sent'),replies:find('reply')};
}

export async function buildCopilotWorkspaceContext(env,{workspaceId,currentScreen,role,user}={}){
  const id=clean(workspaceId,160);if(!id)throw new Error('workspaceId is required');
  // Speed burst step 3 (2026-10-26): the workspace state and the six summaries do not depend on each other; they load together.
  const [state,crm,integrations,usage,dossiers,activities,delivery,operations]=await Promise.all([getCustomerState(env,id),crmSummary(env,id),integrationStatus(env,id),supportUsage(env,id),dossierSummary(env,id),crmActivities(env,id),deliveryActivity(env,id),copilotOperationContext(env,id)]);
  const payload=object(state.payload);const main=object(payload.main);const market=object(main.market);const profile=safeProfile(main.profile);
  const markets=array(main.targetMarkets||main.profile?.targetMarkets,20).map(item=>clean(item,300)).filter(Boolean);
  const icps=array(market.icps||main.icps,MAX_ICP).map(safeIcp);
  const signals=array(market.signals||main.signals,MAX_SIGNALS).map(safeSignal);
  const researchItems=array(market.opportunities||market.research?.items||main.research?.items,MAX_RESEARCH).map(safeResearchItem);
  const screen=sanitizeClientScreenContext(currentScreen);const activity=Array.isArray(screen.activity)?screen.activity:[];delete screen.activity;
  const person=safeUser(user);
  const context={
    workspace:{id,...(role?{role:clean(role,40)}:{})},
    ...(person?{user:person}:{}),
    screen,
    activity,
    company:{name:clean(profile.company||profile.company_name||main.companyName,240),website:clean(main.website||profile.website,1200),description:clean(profile.description||profile.summary,MAX_PROFILE_TEXT)},
    markets,
    profile,
    icps,
    signals,
    research:{items:researchItems,count:researchItems.length},
    discoverySummary:discoverySummary(payload,screen),
    crmSummary:crm,
    outreachSummary:outreachSummary(payload),
    integrationStatus:integrations,
    supportUsage:usage,
    operations,
    readiness:readiness(main,{icps,signals,markets}),
    intake:intakeAnswers(main),
    brand:brandSummary(main),
    goals:goalsSummary(main),
    references:referencesSummary(main),
    dossiers,
    crmActivities:activities,
    deliveryActivity:delivery
  };
  const sanitized=redactProtectedData(context);
  assertModelSafe(sanitized);
  return sanitized;
}
