import {sha256} from './security.js';
import {FIRECRAWL_PURPOSES} from './firecrawl-request.js';
import {creditFailure,recordProviderCredit} from './provider-credit-health.js';

// Perplexity Search API transport (owner decision, 26 Nov 2026: Perplexity searches, Firecrawl reads pages, the AI
// engine reasons). Every workspace uses its own key. One request carries one query; Perplexity answers with ranked
// results that hold the page's query-relevant text (`snippet`), not the whole page. List price 0.005 USD per answered
// request, failed requests are not billed, 50 query units per second per key (Perplexity pricing and rate-limit pages,
// read 26 Nov 2026, dossier Izpete/perplexity-search-api). There is no balance endpoint, so the receipts below are the
// only usage record: one per request sent, with the list price only for an answered request.
export const PERPLEXITY_RECEIPT_EVENT='service.perplexity_search';
export const PERPLEXITY_SEARCH_PRICE_USD_MICROS=5000;
export const PERPLEXITY_MAX_RESULTS=20;
const RETRY_WAIT_MAX_MS=2000;
async function receipt(env,workspaceId,value){
  try{
    await env.DB.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(value.id,workspaceId,PERPLEXITY_RECEIPT_EVENT,'provider_usage','perplexity',JSON.stringify(value),value.at).run();
    // The same bound as the Firecrawl receipts: 30 days and 10,000 rows per workspace, pruned once a minute.
    if(value.prune)await env.DB.prepare("DELETE FROM audit_events WHERE workspace_id=? AND event_type=? AND (created_at<? OR id IN (SELECT id FROM audit_events WHERE workspace_id=? AND event_type=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 10000))").bind(workspaceId,PERPLEXITY_RECEIPT_EVENT,new Date(Date.now()-30*86400000).toISOString(),workspaceId,PERPLEXITY_RECEIPT_EVENT).run();
  }catch{ /* A missing receipt must never be represented as zero billed usage. */ }
}
const lastPruned=new Map();
// Retry-After in seconds or as an HTTP date; without one, wait a second. Never longer than two seconds: a search
// step must not hold a research slice, and a second rate limit is returned to the caller.
function retryWaitMs(response){
  const value=String(response.headers.get('retry-after')||'').trim();
  const ms=/^\d+(?:\.\d+)?$/.test(value)?Number(value)*1000:Number.isFinite(Date.parse(value))?Date.parse(value)-Date.now():1000;
  return Math.max(0,Math.min(RETRY_WAIT_MAX_MS,ms));
}
const pause=(ms,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
export async function requestPerplexitySearch(env,workspaceId,{credential,query,maxResults=10,signal,fetchImpl=fetch,purpose='interactive_research',sleep=pause}={}){
  if(!workspaceId||!credential?.apiKey||!String(query||'').trim())throw Error('A workspace Perplexity connection is required');
  const payload={query:String(query),max_results:Math.max(1,Math.min(PERPLEXITY_MAX_RESULTS,Math.floor(Number(maxResults)||10)))};
  const requestSignal=signal||AbortSignal.timeout(20000);requestSignal.throwIfAborted();
  const fingerprint=await sha256(JSON.stringify([workspaceId,'search',payload.max_results,payload.query]));
  for(let attempt=1;;attempt++){
    const started=Date.now(),at=new Date(started).toISOString(),minute=Math.floor(started/60000),prune=lastPruned.get(workspaceId)!==minute;
    if(prune){if(lastPruned.size>=1000)lastPruned.clear();lastPruned.set(workspaceId,minute);}
    const save=values=>receipt(env,workspaceId,{version:1,id:crypto.randomUUID(),at,purpose:FIRECRAWL_PURPOSES.includes(purpose)?purpose:'interactive_research',fingerprint,requestedResults:payload.max_results,attempt,sent:true,...values,elapsedMs:Math.max(0,Date.now()-started),priceBasis:'perplexity-search-20261126; list price per answered request, not a provider invoice',prune});
    let response;
    try{response=await fetchImpl('https://api.perplexity.ai/search',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:`Bearer ${credential.apiKey}`},body:JSON.stringify(payload),signal:requestSignal});}
    catch(cause){await save({outcome:requestSignal.aborted?'interrupted':'network_error',httpStatus:null,results:0,listPriceUsdMicros:0});throw cause;}
    let result;try{result=await response.clone().json();}catch{}
    const answered=response.ok&&Array.isArray(result?.results),exhausted=creditFailure(response.status,result?.error?.message||result?.error||result?.message);
    if(exhausted||answered)await recordProviderCredit(env,{workspaceId,provider:'perplexity',kind:exhausted?'failed':'recovered',source:'customer'});
    await save({outcome:answered?'succeeded':exhausted?'credits_exhausted':response.status===429?'rate_limited_upstream':[401,403].includes(response.status)?'rejected_key':'failed',httpStatus:response.status,results:answered?result.results.length:0,listPriceUsdMicros:answered?PERPLEXITY_SEARCH_PRICE_USD_MICROS:0});
    if(response.status!==429||attempt>1)return response;
    await sleep(retryWaitMs(response),requestSignal);requestSignal.throwIfAborted();
  }
}
