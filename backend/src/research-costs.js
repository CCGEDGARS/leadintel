import {cookieValue,sha256} from './security.js';
import './contact-confirmation-policy.js';

const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const count=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
const unavailable=cause=>/no such table|no such column/i.test(String(cause?.message||''));

// Calendar dates keep SQL and customer-visible bounds identical, including UTC.
export function researchCostPeriod(url,now=new Date()){
  const start=url.searchParams.get('start')||now.toISOString().slice(0,7)+'-01';
  const next=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString().slice(0,10);
  const end=url.searchParams.get('end')||next;
  const valid=value=>/^\d{4}-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!valid(start)||!valid(end)||start>=end||Date.parse(end)-Date.parse(start)>366*86400000)throw Object.assign(Error('Use a valid UTC date range of at most 366 days; end is exclusive.'),{status:400});
  return {start:start+'T00:00:00.000Z',end:end+'T00:00:00.000Z',timezone:'UTC',endExclusive:true};
}

// Only this persisted provider receipt is a monetary source. Attempt snapshots,
// activities, subscription allocations and billing invoices are not added to it.
async function tregSpend(db,workspaceId,period){
  try{
    const row=await db.prepare(`WITH receipt_groups AS (
      SELECT CASE WHEN length(trim(COALESCE(call_id,'')))>0 THEN 'call' ELSE 'operation' END AS kind,
        CASE WHEN length(trim(COALESCE(call_id,'')))>0 THEN trim(call_id) ELSE request_key END AS receipt_key,
        CASE WHEN length(trim(COALESCE(call_id,'')))>0 THEN '' ELSE phase END AS receipt_phase,
        MIN(datetime(created_at)) AS first_recorded_at,COUNT(*) AS copies,
        MIN(cost_micro) AS low_cost,MAX(cost_micro) AS high_cost,
        MIN(CASE WHEN typeof(cost_micro)='integer' AND cost_micro>0 AND cost_micro<=9007199254740991 THEN 1 ELSE 0 END) AS valid_amount
      FROM treg_contact_calls WHERE workspace_id=? GROUP BY kind,receipt_key,receipt_phase
    ) SELECT COUNT(*) AS operations,COALESCE(SUM(copies-1),0) AS duplicate_rows,
      COALESCE(SUM(CASE WHEN kind='call' AND valid_amount=1 AND low_cost=high_cost THEN high_cost ELSE 0 END),0) AS confirmed_micro,
      COALESCE(SUM(CASE WHEN kind='call' AND valid_amount=1 AND low_cost=high_cost THEN 1 ELSE 0 END),0) AS confirmed_receipts,
      COALESCE(SUM(CASE WHEN kind!='call' OR valid_amount!=1 OR low_cost!=high_cost THEN 1 ELSE 0 END),0) AS unknown_receipts
      FROM receipt_groups WHERE first_recorded_at>=datetime(?) AND first_recorded_at<datetime(?)`).bind(workspaceId,period.start,period.end).first();
    const amount=Number(row?.confirmed_micro);
    // Integer overflow or precision loss cannot become a displayed cost.
    const safe=Number.isSafeInteger(amount)&&amount>=0;
    const confirmed=count(row?.confirmed_receipts),unknown=count(row?.unknown_receipts);
    return {provider:'treg',currency:'USD',status:!safe||!confirmed?'unknown':unknown?'partial':'recorded',confirmedAmountMicro:safe&&confirmed?amount:null,confirmedReceipts:confirmed,unknownReceipts:unknown,operations:count(row?.operations),duplicateRowsIgnored:count(row?.duplicate_rows),source:'treg_contact_calls',coverage:'Recorded Treg call receipts only; missing or zero amounts and conflicting duplicate call IDs remain unknown.'};
  }catch(cause){if(!unavailable(cause))throw cause;return {provider:'treg',currency:'USD',status:'unavailable',confirmedAmountMicro:null,confirmedReceipts:0,unknownReceipts:null,operations:null,duplicateRowsIgnored:0,source:'treg_contact_calls',coverage:'Treg receipt storage is unavailable.'};}
}

async function usageActivity(db,workspaceId,period){
  try{
    const {results=[]}=await db.prepare(`SELECT entity_id AS provider,COUNT(*) AS recorded_events,
      SUM(CASE WHEN json_type(metadata_json,'$.input_tokens')='integer' AND json_extract(metadata_json,'$.input_tokens')>=0 THEN json_extract(metadata_json,'$.input_tokens') ELSE 0 END) AS input_tokens,
      SUM(CASE WHEN json_type(metadata_json,'$.output_tokens')='integer' AND json_extract(metadata_json,'$.output_tokens')>=0 THEN json_extract(metadata_json,'$.output_tokens') ELSE 0 END) AS output_tokens,
      SUM(CASE WHEN json_type(metadata_json,'$.input_tokens')='integer' AND json_type(metadata_json,'$.output_tokens')='integer' AND json_extract(metadata_json,'$.input_tokens')>=0 AND json_extract(metadata_json,'$.output_tokens')>=0 THEN 1 ELSE 0 END) AS token_events
      FROM audit_events WHERE workspace_id=? AND datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?) AND json_valid(metadata_json)
        AND ((event_type IN ('ai.generation_completed','ai.specialist_completed','ai.web_search_completed','ai.research_verification_completed','ai.contact_evidence_reviewed','ai.grounded_contact_searched') AND entity_id IN ('openai','anthropic','gemini')) OR (event_type IN ('service.firecrawl_search','service.firecrawl_scrape') AND entity_id='firecrawl')) GROUP BY entity_id`).bind(workspaceId,period.start,period.end).all();
    return ['openai','anthropic','gemini','firecrawl'].map(provider=>{const row=results.find(r=>r.provider===provider);return {provider,status:'usage_only',recordedEvents:count(row?.recorded_events),tokenEvents:count(row?.token_events),inputTokens:count(row?.token_events)?count(row.input_tokens):null,outputTokens:count(row?.token_events)?count(row.output_tokens):null,cost:null,currency:null,coverage:provider==='firecrawl'?'Saved direct Firecrawl activity only; credits and monetary spend are not measured.':'Saved AI audit activity only; token coverage is incomplete and monetary spend is not measured.'};});
  }catch(cause){if(!unavailable(cause))throw cause;return ['openai','anthropic','gemini','firecrawl'].map(provider=>({provider,status:'unavailable',cost:null,currency:null,coverage:'Saved usage storage is unavailable.'}));}
}

async function lookupLimits(db,workspaceId,now){
  try{
    const policy=await db.prepare('SELECT enabled,phone_enabled,daily_limit,monthly_limit,max_per_company,provider,updated_at FROM additional_contact_policies WHERE workspace_id=?').bind(workspaceId).first();
    if(!policy)return {status:'not_saved',monetaryBudget:null,coverage:'No saved lookup policy. No monetary budget is enforced by these lookup limits.'};
    const day=now.toISOString().slice(0,10),month=day.slice(0,7);
    const row=await db.prepare(`SELECT SUM(CASE WHEN datetime(created_at)>=datetime(?) AND datetime(created_at)<datetime(?,'+1 day') THEN 1 ELSE 0 END) AS daily,
      SUM(CASE WHEN month=? THEN 1 ELSE 0 END) AS monthly FROM additional_contact_attempts WHERE workspace_id=? AND status!='retryable'`).bind(day,day,month,workspaceId).first();
    return {status:'saved',provider:['treg','apollo','hunter'].includes(policy.provider)?policy.provider:null,enabled:policy.enabled===1,phoneEnabled:policy.phone_enabled===1,dailyLimit:count(policy.daily_limit),monthlyLimit:count(policy.monthly_limit),maxPerCompany:count(policy.max_per_company),dailyUsed:count(row?.daily),monthlyUsed:count(row?.monthly),day,month,timezone:'UTC',updatedAt:policy.updated_at||null,monetaryBudget:null,coverage:'Saved lookup-count caps, not a monetary budget. Usage follows the shared additional-contact policy, including reserved attempts.'};
  }catch(cause){if(!unavailable(cause))throw cause;return {status:'unavailable',monetaryBudget:null,coverage:'Lookup policy storage is unavailable. Monetary budget is not measured.'};}
}

async function usableContacts(db,workspaceId,period,now){
  try{
    // Apply the shared recipient evidence gate; never trust an attempt's status
    // or a copied result_json as proof that a usable recipient was saved.
    const {results=[]}=await db.prepare(`SELECT c.name,c.normalized_email,c.work_email,c.email_status,c.verification_provider,c.source,c.verified_at,c.public_email_url,c.archived_at,co.normalized_domain
      FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id
      WHERE c.workspace_id=? AND c.archived_at IS NULL AND co.deleted_at IS NULL AND co.lifecycle_status NOT IN ('suppressed','archived')
      AND datetime(c.verified_at)>=datetime(?) AND datetime(c.verified_at)<datetime(?)`).bind(workspaceId,period.start,period.end).all();
    const all=new Set(),treg=new Set();
    for(const row of results){if(!globalThis.LeadIntelContactPolicy.accepted(row,row.normalized_domain,'public_confirmed',now.getTime()))continue;const email=String(row.normalized_email||row.work_email).toLowerCase();all.add(email);if([row.source,row.verification_provider].some(value=>String(value||'').toLowerCase()==='treg'))treg.add(email);}
    return {status:'recorded',newlyVerifiedUsable:all.size,newlyVerifiedTregUsable:treg.size,coverage:'Distinct currently usable CRM work-email recipients with verified_at inside the selected period. Archived, suppressed, unconfirmed and personal addresses are excluded. This is not a historical delivery/yield ledger.'};
  }catch(cause){if(!unavailable(cause))throw cause;return {status:'unavailable',newlyVerifiedUsable:null,newlyVerifiedTregUsable:null,coverage:'Usable recipient storage is unavailable.'};}
}

export async function getResearchCosts(db,workspaceId,period,{now=new Date()}={}){
  const [treg,usage,limits,contacts]=await Promise.all([tregSpend(db,workspaceId,period),usageActivity(db,workspaceId,period),lookupLimits(db,workspaceId,now),usableContacts(db,workspaceId,period,now)]);
  const denominator=contacts.newlyVerifiedTregUsable;
  return {workspaceId,period,generatedAt:now.toISOString(),coverage:'incomplete',totalResearchCost:null,monetaryBudget:{status:'not_configured',amount:null,currency:null,coverage:'The saved research policy provides lookup-count limits; no monetary research cap is stored.'},confirmedSpend:treg.confirmedAmountMicro===null?[]:[{currency:treg.currency,amountMicro:treg.confirmedAmountMicro,scope:'Recorded Treg receipts only'}],providers:[treg,...usage,...['apollo','hunter'].map(provider=>({provider,status:'unmeasured',cost:null,currency:null,coverage:'Saved attempts and credits are not an authoritative monetary receipt ledger.'}))],limits,contacts,costPerUsableContact:{currency:'USD',amountMicro:treg.confirmedAmountMicro!==null&&denominator>0?treg.confirmedAmountMicro/denominator:null,denominator,coverage:'Recorded Treg receipt spend divided by newly verified, currently usable Treg recipients in this period. Includes unsuccessful and profile/phone calls; excludes unmeasured provider spend. Not an all-in acquisition cost.'},notes:['Period uses the first local recording time of each Treg call ID, not the provider billing settlement date. Replays and duplicate call IDs count once.','Zero-cost legacy receipts cannot distinguish free calls from missing cost headers and remain unknown.','No subscription allocation, account balance, price estimate or invoice is added to confirmed spend. AI, Firecrawl and other unmeasured costs remain unknown.']};
}

export async function handleResearchCostsRoute(request,env,cors={}){
  const url=new URL(request.url);if(url.pathname!=='/api/research/costs')return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405,{...cors,Allow:'GET'});
  const workspaceId=String(url.searchParams.get('workspace_id')||'').trim();if(!workspaceId||workspaceId.length>160)return json({error:'workspace_id is required'},400,cors);
  try{
    const token=cookieValue(request,'leadintel_session');if(!token)return json({error:'Authentication required'},401,cors);
    const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();
    if(!user)return json({error:'Authentication required'},401,cors);
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();
    if(!member)return json({error:'Workspace access denied'},403,cors);
    const period=researchCostPeriod(url);
    return json(await getResearchCosts(env.DB,workspaceId,period),200,cors);
  }catch(cause){return json({error:cause?.status===400?cause.message:'Research cost records are unavailable'},cause?.status===400?400:503,cors);}
}
