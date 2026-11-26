import {requestFirecrawl} from './firecrawl-request.js';
import {requestPerplexitySearch,PERPLEXITY_MAX_RESULTS} from './perplexity-request.js';
import {requireWorkspaceServiceCredential} from './service-integrations.js';
import {searchWorkspaceWeb} from './ai-routes.js';
const LINKEDIN_PROFILE_SEARCH=/\bsite:\s*(?:[a-z]{2,3}\.)?linkedin\.com\b/i;
// Public research only. This boundary never invokes paid contact reveal APIs.
// Owner decision, 26 Nov 2026: Perplexity searches, Firecrawl reads pages, the AI engine reasons. A workspace that
// connected its own Perplexity key is answered by Perplexity first; Firecrawl search and then grounded search stay the
// fallbacks as before, and a workspace without that key sends exactly what it sent before, with nothing reported about
// Perplexity. A Perplexity row carries the page's query-relevant text as a search excerpt. It is never a source read,
// so first-party contact evidence still requires reading the page itself.
const rowsWithSource=(rows,provider)=>{const values=rows.map(row=>({...row,buyerSource:provider,searchProvider:provider}));Object.defineProperty(values,'searchProviders',{value:[provider]});return values;};
// The short description keeps the length of an ordinary search snippet (readers check it for former/supplier
// wording near the company); the whole extract is the row's page text.
const perplexityRows=results=>results.filter(row=>/^https?:\/\//i.test(String(row?.url||''))).map(row=>{const text=String(row.snippet||'');return {url:row.url,title:String(row.title||''),description:text.slice(0,300),markdown:text,...(row.date?{publishedDate:row.date}:{}),...(row.last_updated?{lastUpdated:row.last_updated}:{}),evidenceKind:'search_excerpt'};});
export function createBuyerSourceSearch(env,workspaceId,{guard=async()=>{},observe=()=>{},credential=requireWorkspaceServiceCredential,perplexityCredential=requireWorkspaceServiceCredential,grounded=searchWorkspaceWeb,fetchImpl=fetch,signal,scrapeResults=true,primaryTimeoutMs=25000,purpose='buyer_research',meter,beforeGrounded,preferGrounded=false}={}){
 let unavailable=false,connection,perplexityUnavailable=false,perplexity;
 return async function search(query,{limit=8,diversify=false,signal:requestSignal}={}){
  const querySignal=requestSignal&&signal?AbortSignal.any([signal,requestSignal]):requestSignal||signal,check=async()=>{if(querySignal?.aborted)throw querySignal.reason||Error('Public source search canceled');await guard();};
  await check();let empty=false,primaryRows=[],primaryProvider='firecrawl',perplexityEmpty=false;
  // Answers with rows to return at once, or nothing when the search goes on (rows kept for a diversified merge, an
  // empty answer, a failure, or no key).
  const askPerplexity=async()=>{
   if(perplexityUnavailable)return;
   if(!perplexity)try{perplexity=await perplexityCredential(env,workspaceId,'perplexity');}catch{perplexityUnavailable=true;}
   await check();
   if(!perplexity)return;
   let httpStatus;
   try{
    const timeout=Math.min(10000,Math.max(1000,primaryTimeoutMs));
    const response=await requestPerplexitySearch(env,workspaceId,{credential:perplexity,query,maxResults:Math.min(limit,PERPLEXITY_MAX_RESULTS),signal:querySignal?AbortSignal.any([querySignal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),fetchImpl,purpose});
    await check();
    // A rejected or exhausted key is not asked again by this search owner; other failures fall back per query.
    if(!response.ok){httpStatus=response.status;if([401,402,403].includes(response.status))perplexityUnavailable=true;throw Error(`Perplexity search HTTP ${response.status}`);}
    const payload=await response.json();
    if(!Array.isArray(payload?.results))throw Error('Perplexity search returned an invalid result list');
    const rows=perplexityRows(payload.results);
    await check();observe({provider:'perplexity',operation:'search',status:'succeeded',results:rows.length});
    if(rows.length&&!diversify)return rowsWithSource(rows,'perplexity');
    if(rows.length){primaryRows=rowsWithSource(rows,'perplexity');primaryProvider='perplexity';}else perplexityEmpty=true;
   }catch(error){await check();observe({provider:'perplexity',operation:'search',status:'failed',reason:String(error.message||'Perplexity search unavailable').slice(0,180),...(httpStatus?{httpStatus}:{})});}
  };
  let groundedEmpty;
  const observeGrounded=attempts=>{
   if(purpose!=='company_list')return;
   for(const a of attempts||[])observe({provider:a.provider,operation:'search',status:a.status==='failed'?'failed':'succeeded',results:a.resultCount,reason:a.reason});
  };
  const askGrounded=async()=>{
   try{
    const result=await grounded(env,workspaceId,query,{signal:querySignal,skipPerplexity:true,guard:check});await check();
    if(result.status!=='complete'||result.web_search===false||!Array.isArray(result.results))throw Error('Grounded public research unavailable');
    observeGrounded(result.attempts);
    if(purpose!=='company_list'||!result.attempts?.length)observe({provider:purpose==='company_list'&&result.provider?result.provider:'grounded',operation:'search',status:'succeeded',results:result.results.length});
    return rowsWithSource(result.results,purpose==='company_list'&&result.provider?result.provider:'grounded');
   }catch(error){
    await check();observeGrounded(error.researchAttempts);
    if(purpose!=='company_list'||!error.researchAttempts?.length)observe({provider:'grounded',operation:'search',status:'failed',reason:'Grounded public research unavailable'});
   }
  };
  if(preferGrounded){
   if(beforeGrounded)await beforeGrounded();
   const answer=await askGrounded();
   if(answer?.length)return answer;
   if(answer)groundedEmpty=answer;
  }
  // LinkedIn profile searches keep Firecrawl first. Perplexity titles a profile "<name> | LinkedIn" without the role
  // and company that the headline reader needs (live run 26 Nov 2026: 40 such rows, none with a role or company;
  // Firecrawl titles carry "Name - Role - Company"). Perplexity answers them only when Firecrawl cannot.
  const linkedInProfiles=LINKEDIN_PROFILE_SEARCH.test(String(query||''));
  if(!linkedInProfiles){const answer=await askPerplexity();if(answer)return answer;}
  if(!unavailable&&!primaryRows.length){
   if(!connection)try{connection=await credential(env,workspaceId,'firecrawl');}catch{unavailable=true;observe({provider:'firecrawl',operation:'search',status:'skipped',reason:'Workspace Firecrawl credential unavailable'});}
   await check();
   if(connection)try{
    const timeout=Math.min(diversify?12000:25000,Math.max(1000,primaryTimeoutMs));
    const response=await requestFirecrawl(env,workspaceId,'search',{credential:connection,payload:{query,limit,...(scrapeResults?{scrapeOptions:{formats:['markdown']}}:{})},signal:querySignal?AbortSignal.any([querySignal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),fetchImpl,purpose,meter});
    await check();
    if(!response.ok){if([401,402,403,409,429].includes(response.status))unavailable=true;throw Error(`Public search HTTP ${response.status}`);}
    const payload=await response.json(),rows=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web;
    if(payload.success===false||!Array.isArray(rows))throw Error('Public search returned an invalid result list');
    await check();observe({provider:'firecrawl',operation:'search',status:'succeeded',results:rows.length});
    if(rows.length&&!diversify)return rowsWithSource(rows,'firecrawl');primaryRows=rowsWithSource(rows,'firecrawl');empty=rows.length===0;
   }catch(error){if(error?.code==='CREDIT_LIMIT')throw error;await check();observe({provider:'firecrawl',operation:'search',status:'failed',reason:String(error.message||'Public search unavailable').slice(0,180)});}
  }
  if(linkedInProfiles&&!primaryRows.length){const answer=await askPerplexity();if(answer)return answer;}
  await check();
  if(!preferGrounded){
   if(beforeGrounded){
    try{await beforeGrounded();}catch(error){if(primaryRows.length)return primaryRows;throw error;}
    await check();
   }
   const secondary=await askGrounded();
   if(secondary){
    if(!primaryRows.length)return secondary;
    const combined=[...new Map([...secondary,...primaryRows].map(row=>[row.url,row])).values()].slice(0,limit);Object.defineProperty(combined,'searchProviders',{value:[primaryProvider,...secondary.searchProviders]});return combined;
   }
  }
  if(primaryRows.length)return primaryRows;
  if(empty)return rowsWithSource([],'firecrawl');
  if(perplexityEmpty)return rowsWithSource([],'perplexity');
  if(groundedEmpty)return groundedEmpty;
  throw Error('Public source search unavailable; resume unfinished checks after restoring a search provider.');
 };
}
// B3, 26 Nov 2026 (owner gate: LeadIntel itself must find the current people that a manual Perplexity search found):
// one request carrying the company's public people queries, answered with the workspace's own Perplexity key only.
// There is no fallback provider: this pass runs beside the shared search, it does not replace it. Rows are search
// excerpts, never source reads, so contact evidence still requires reading the page itself.
export async function searchPublicPeople(env,workspaceId,queries,{credential,observe=()=>{},signal,fetchImpl=fetch,timeoutMs=15000}={}){
 const timeout=AbortSignal.timeout(timeoutMs),failed=reason=>observe({provider:'perplexity',operation:'search',status:'failed',reason:String(reason).slice(0,180)});
 let response;
 try{response=await requestPerplexitySearch(env,workspaceId,{credential,query:queries,maxResults:PERPLEXITY_MAX_RESULTS,signal:signal?AbortSignal.any([signal,timeout]):timeout,fetchImpl,purpose:'buyer_research'});}
 catch(error){if(signal?.aborted)throw signal.reason||error;failed(error.message||'Perplexity people search unavailable');throw error;}
 if(!response.ok){observe({provider:'perplexity',operation:'search',status:'failed',reason:`Perplexity people search HTTP ${response.status}`,httpStatus:response.status});throw Error(`Perplexity people search HTTP ${response.status}`);}
 const payload=await response.json().catch(()=>null);
 if(!Array.isArray(payload?.results)){failed('Perplexity people search returned an invalid result list');throw Error('Perplexity people search returned an invalid result list');}
 const rows=rowsWithSource(perplexityRows(payload.results),'perplexity');
 observe({provider:'perplexity',operation:'search',status:'succeeded',results:rows.length});
 return rows;
}
