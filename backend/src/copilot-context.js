import {getCustomerState} from './customer-state.js';
import {assertModelSafe,redactProtectedData,sanitizeClientScreenContext} from './copilot-security.js';

const MAX_TEXT=4000;
const MAX_PROFILE_TEXT=8000;
const MAX_ICP=10;
const MAX_SIGNALS=20;
const MAX_RESEARCH=12;
const MAX_TOP_COMPANIES=10;

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
function safeSignal(item){const value=object(redactProtectedData(item));return {id:clean(value.id,120),name:clean(value.name||value.title,240),description:clean(value.description||value.reason,2400),active:value.active!==false,weight:Math.max(0,Math.min(100,safeNumber(value.weight||value.score)))};}
function safeResearchItem(item){const value=object(redactProtectedData(item));return {name:clean(value.name||value.title,280),summary:clean(value.summary||value.description||value.hypothesis,2400),score:Math.max(0,Math.min(100,safeNumber(value.score?.total??value.score))),sourceUrl:clean(value.sourceUrl||value.source_url||value.url,1200)};}

async function crmSummary(env,workspaceId){
  const counts=await firstSafe(env,`SELECT COUNT(*) AS total,SUM(CASE WHEN pipeline_stage IS NOT NULL THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN lifecycle_status='customer' THEN 1 ELSE 0 END) AS customers FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL`,workspaceId)||{};
  const pipelineRows=await allSafe(env,`SELECT COALESCE(pipeline_stage,'None') AS pipeline_stage,COUNT(*) AS count FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL GROUP BY pipeline_stage ORDER BY count DESC`,workspaceId);
  const companies=await allSafe(env,`SELECT id,company_name,website,country,industry,pipeline_stage,opportunity_score,confidence,updated_at FROM crm_companies WHERE workspace_id=? AND deleted_at IS NULL ORDER BY COALESCE(opportunity_score,0) DESC,updated_at DESC LIMIT 10`,workspaceId);
  return {
    total:safeNumber(counts.total),active:safeNumber(counts.active),customers:safeNumber(counts.customers),
    pipeline:pipelineRows.slice(0,12).map(row=>({stage:clean(row.pipeline_stage,80),count:safeNumber(row.count)})),
    topCompanies:companies.slice(0,MAX_TOP_COMPANIES).map(row=>({id:clean(row.id,160),name:clean(row.company_name,240),website:clean(row.website,1000),country:clean(row.country,120),industry:clean(row.industry,180),pipelineStage:clean(row.pipeline_stage,80),score:safeNumber(row.opportunity_score),confidence:clean(row.confidence,40),updatedAt:clean(row.updated_at,80)}))
  };
}

async function integrationStatus(env,workspaceId){
  const gmail=await firstSafe(env,`SELECT 'gmail' AS provider,status,connected_at,updated_at FROM gmail_connections WHERE workspace_id=? LIMIT 1`,workspaceId);
  const ai=await firstSafe(env,`SELECT provider,active,verified_at,last_used_at,updated_at FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1`,workspaceId);
  const service=await firstSafe(env,`SELECT provider,verified_at,last_used_at,updated_at FROM workspace_service_integrations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 1`,workspaceId);
  const items=[];
  if(gmail)items.push({provider:'gmail',state:clean(gmail.status||'connected',80),connectedAt:clean(gmail.connected_at,80),updatedAt:clean(gmail.updated_at,80)});
  if(ai)items.push({provider:clean(ai.provider,80),state:ai.active===0?'inactive':'connected',verifiedAt:clean(ai.verified_at,80),lastUsedAt:clean(ai.last_used_at,80),updatedAt:clean(ai.updated_at,80)});
  if(service)items.push({provider:clean(service.provider,80),state:'connected',verifiedAt:clean(service.verified_at,80),lastUsedAt:clean(service.last_used_at,80),updatedAt:clean(service.updated_at,80)});
  return items;
}

function discoverySummary(payload){
  const discovery=object(payload.discovery);const companies=Array.isArray(discovery.companies)?discovery.companies:[];
  const scores=companies.map(item=>safeNumber(item?.score?.total??item?.score)).filter(n=>n>0);
  return {companyCount:companies.length,highPriorityCount:scores.filter(score=>score>=70).length,averageScore:scores.length?Math.round(scores.reduce((sum,n)=>sum+n,0)/scores.length):0};
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

export async function buildCopilotWorkspaceContext(env,{workspaceId,currentScreen,role}={}){
  const id=clean(workspaceId,160);if(!id)throw new Error('workspaceId is required');
  const state=await getCustomerState(env,id);const payload=object(state.payload);const main=object(payload.main);const market=object(main.market);const profile=safeProfile(main.profile);
  const markets=array(main.targetMarkets||main.profile?.targetMarkets,20).map(item=>clean(item,300)).filter(Boolean);
  const icps=array(market.icps||main.icps,MAX_ICP).map(safeIcp);
  const signals=array(market.signals||main.signals,MAX_SIGNALS).map(safeSignal);
  const researchItems=array(market.opportunities||market.research?.items||main.research?.items,MAX_RESEARCH).map(safeResearchItem);
  const context={
    workspace:{id,...(role?{role:clean(role,40)}:{})},
    screen:sanitizeClientScreenContext(currentScreen),
    company:{name:clean(profile.company||profile.company_name||main.companyName,240),website:clean(main.website||profile.website,1200),description:clean(profile.description||profile.summary,MAX_PROFILE_TEXT)},
    markets,
    profile,
    icps,
    signals,
    research:{items:researchItems,count:researchItems.length},
    discoverySummary:discoverySummary(payload),
    crmSummary:await crmSummary(env,id),
    outreachSummary:outreachSummary(payload),
    integrationStatus:await integrationStatus(env,id),
    readiness:readiness(main,{icps,signals,markets})
  };
  const sanitized=redactProtectedData(context);
  assertModelSafe(sanitized);
  return sanitized;
}
