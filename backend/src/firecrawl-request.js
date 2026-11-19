import {sha256} from './security.js';
import {acquireFirecrawlSlot,firecrawlPlanFromRow,parseRetryAfterMs,recordFirecrawlRateLimit} from './firecrawl-rate-gate.js';
import {creditFailure,recordProviderCredit} from './provider-credit-health.js';

export const FIRECRAWL_RECEIPT_EVENT='service.firecrawl_request';
export const FIRECRAWL_PURPOSES=Object.freeze(['interactive_research','buyer_research','company_list','company_dossier','website_contacts','assistant_research','market_monitoring','approved_workflow','source_health','email_source_check']);
const number=value=>value!=null&&typeof value!=='boolean'&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
export function reportedFirecrawlCredits(payload){
  for(const value of [payload?.creditsUsed,payload?.metadata?.creditsUsed,payload?.data?.creditsUsed,payload?.data?.metadata?.creditsUsed]){const n=number(value);if(n!==null)return n;}
  return null;
}
function ordered(value){if(Array.isArray(value))return value.map(ordered);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])]));return value;}
export function firecrawlRequestEstimate(kind,payload={}){
  if(kind==='scrape')return 1;
  const limit=Math.max(1,Math.min(100,Math.floor(Number(payload.limit)||4)));
  return 2*Math.ceil(limit/10)+(payload.scrapeOptions?limit:0);
}
async function receipt(env,workspaceId,value){
  // Only this new diagnostic namespace is bounded; existing audit evidence is untouched.
  try{
    await env.DB.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(value.id,workspaceId,FIRECRAWL_RECEIPT_EVENT,'provider_usage','firecrawl',JSON.stringify(value),value.at).run();
    // One pruning operation per minute, after the first retained receipt in that minute.
    if(value.prune)await env.DB.prepare("DELETE FROM audit_events WHERE workspace_id=? AND event_type=? AND (created_at<? OR id IN (SELECT id FROM audit_events WHERE workspace_id=? AND event_type=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 10000))").bind(workspaceId,FIRECRAWL_RECEIPT_EVENT,new Date(Date.now()-30*86400000).toISOString(),workspaceId,FIRECRAWL_RECEIPT_EVENT).run();
  }catch{ /* A missing receipt must never be represented as zero billed usage. */ }
}
const lastPruned=new Map();
// The only metered Firecrawl transport. No automatic provider retries or inferred charges.
export async function requestFirecrawl(env,workspaceId,kind,{credential,payload={},signal,fetchImpl=fetch,purpose='interactive_research',waitBudgetMs=0}={}){
  if(!['search','scrape'].includes(kind)||!workspaceId||!credential?.apiKey)throw Error('A workspace Firecrawl connection is required');
  const requestSignal=signal||AbortSignal.timeout(45000);requestSignal.throwIfAborted();
  const started=Date.now(),id=crypto.randomUUID(),at=new Date(started).toISOString();
  const fingerprint=await sha256(JSON.stringify([workspaceId,kind,ordered(payload)]));
  const base={version:1,id,at,kind,purpose:FIRECRAWL_PURPOSES.includes(purpose)?purpose:'interactive_research',fingerprint,requestedResults:kind==='search'?Math.max(1,Math.min(100,Math.floor(Number(payload.limit)||4))):null,scrapeResults:kind==='search'&&Boolean(payload.scrapeOptions),estimateBasis:'standard-search-and-scrape-20261023; estimate only, not a provider invoice'};
  const save=async values=>{const minute=Math.floor(started/60000),prune=lastPruned.get(workspaceId)!==minute;if(prune){if(lastPruned.size>=1000)lastPruned.clear();lastPruned.set(workspaceId,minute);}await receipt(env,workspaceId,{...base,...values,elapsedMs:Math.max(0,Date.now()-started),prune});};
  {
    const plan=firecrawlPlanFromRow(credential.row),gate=await acquireFirecrawlSlot(env,workspaceId,kind,{limit:plan?.[kind]??null,signal:requestSignal,deadlineMs:waitBudgetMs});
    requestSignal.throwIfAborted();
    if(!gate.allowed){
      await save({sent:false,outcome:'rate_limited_locally',httpStatus:429,reportedCredits:null,estimatedCredits:0,results:0});
      const seconds=Math.max(1,Math.ceil(gate.retryAfterMs/1000));
      return Response.json({success:false,error:gate.reason==='upstream_429'?`Firecrawl reported a rate limit on this plan; the next ${kind} can start in ${seconds} s.`:`Firecrawl ${kind} limit on the ${plan?.name||'current'} plan is ${plan?.[kind]??'a fixed number of'} requests per minute; the next slot opens in ${seconds} s.`,code:'FIRECRAWL_RATE_LIMIT',retry_after:seconds,plan:plan?.name||null,limit_per_minute:plan?.[kind]??null,kind},{status:429,headers:{'Retry-After':String(seconds)}});
    }
  }
  requestSignal.throwIfAborted();
  let response;
  try{response=await fetchImpl('https://api.firecrawl.dev/v2/'+kind,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${credential.apiKey}`},body:JSON.stringify(payload),signal:requestSignal});}
  catch(cause){await save({sent:true,outcome:requestSignal.aborted?'interrupted':'network_error',httpStatus:null,reportedCredits:null,estimatedCredits:firecrawlRequestEstimate(kind,payload),results:0});throw cause;}
  let result;try{result=await response.clone().json();}catch{}
  const exhausted=creditFailure(response.status,result?.error||result?.message),succeeded=response.ok&&result?.success!==false&&Boolean(result);
  if(response.status===429)await recordFirecrawlRateLimit(env,workspaceId,kind,parseRetryAfterMs(response,result));
  if(exhausted||succeeded)await recordProviderCredit(env,{workspaceId,provider:'firecrawl',kind:exhausted?'failed':'recovered',source:'customer'});
  const rows=Array.isArray(result?.data)?result.data:Array.isArray(result?.data?.web)?result.data.web:Array.isArray(result?.web)?result.web:[];
  await save({sent:true,outcome:exhausted?'credits_exhausted':response.status===429?'rate_limited_upstream':succeeded?'succeeded':'failed',httpStatus:response.status,reportedCredits:reportedFirecrawlCredits(result),estimatedCredits:firecrawlRequestEstimate(kind,payload),results:kind==='search'?rows.length:succeeded?1:0});
  return response;
}
