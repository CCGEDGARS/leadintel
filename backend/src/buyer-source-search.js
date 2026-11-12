import {requireWorkspaceServiceCredential} from './service-integrations.js';
import {searchWorkspaceWeb} from './ai-routes.js';
// Public research only. This boundary never invokes paid contact reveal APIs.
export function createBuyerSourceSearch(env,workspaceId,{guard=async()=>{},observe=()=>{},credential=requireWorkspaceServiceCredential,grounded=searchWorkspaceWeb,fetchImpl=fetch,signal}={}){
 let unavailable=false,connection;
 const rowsWithSource=(rows,provider)=>{const values=rows.map(row=>({...row,buyerSource:provider,searchProvider:provider}));Object.defineProperty(values,'searchProviders',{value:[provider]});return values;};
 return async function search(query,{limit=8,diversify=false,signal:requestSignal}={}){
  const querySignal=requestSignal&&signal?AbortSignal.any([signal,requestSignal]):requestSignal||signal,check=async()=>{if(querySignal?.aborted)throw querySignal.reason||Error('Public source search canceled');await guard();};
  await check();let empty=false,primaryRows=[];
  if(!unavailable){
   if(!connection)try{connection=await credential(env,workspaceId,'firecrawl');}catch{unavailable=true;observe({provider:'firecrawl',operation:'search',status:'skipped',reason:'Workspace Firecrawl credential unavailable'});}
   await check();
   if(connection)try{
    const response=await fetchImpl('https://api.firecrawl.dev/v2/search',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(connection.apiKey?{Authorization:`Bearer ${connection.apiKey}`}:{})},body:JSON.stringify({query,limit,scrapeOptions:{formats:['markdown']}}),signal:querySignal?AbortSignal.any([querySignal,AbortSignal.timeout(diversify?12000:25000)]):AbortSignal.timeout(diversify?12000:25000)});
    await check();
    if(!response.ok){if([401,402,403,409,429].includes(response.status))unavailable=true;throw Error(`Public search HTTP ${response.status}`);}
    const payload=await response.json(),rows=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web;
    if(payload.success===false||!Array.isArray(rows))throw Error('Public search returned an invalid result list');
    await check();observe({provider:'firecrawl',operation:'search',status:'succeeded',results:rows.length});
    if(rows.length&&!diversify)return rowsWithSource(rows,'firecrawl');primaryRows=rowsWithSource(rows,'firecrawl');empty=rows.length===0;
   }catch(error){await check();observe({provider:'firecrawl',operation:'search',status:'failed',reason:String(error.message||'Public search unavailable').slice(0,180)});}
  }
  await check();
  try{
   const result=await grounded(env,workspaceId,query,{signal:querySignal});await check();
   if(result.status!=='complete'||result.web_search===false||!Array.isArray(result.results))throw Error('Grounded public research unavailable');
   observe({provider:'grounded',operation:'search',status:'succeeded',results:result.results.length});
   const secondary=rowsWithSource(result.results,'grounded');if(!primaryRows.length)return secondary;
   const combined=[...new Map([...secondary,...primaryRows].map(row=>[row.url,row])).values()].slice(0,limit);Object.defineProperty(combined,'searchProviders',{value:['firecrawl','grounded']});return combined;
  }catch(error){await check();observe({provider:'grounded',operation:'search',status:'failed',reason:'Grounded public research unavailable'});if(primaryRows.length)return primaryRows;if(empty)return rowsWithSource([],'firecrawl');throw Error('Public contact research unavailable; resume unfinished checks after restoring a search provider.');}
 };
}
