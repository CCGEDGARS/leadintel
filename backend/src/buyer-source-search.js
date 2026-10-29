import {requireWorkspaceServiceCredential} from './service-integrations.js';
import {searchWorkspaceWeb} from './ai-routes.js';
// Public research only. This boundary never invokes paid contact reveal APIs.
export function createBuyerSourceSearch(env,workspaceId,{guard=async()=>{},observe=()=>{},credential=requireWorkspaceServiceCredential,grounded=searchWorkspaceWeb,fetchImpl=fetch}={}){
 let unavailable=false,connection;
 const rowsWithSource=(rows,provider)=>{const values=rows.map(row=>({...row,buyerSource:provider,searchProvider:provider}));Object.defineProperty(values,'searchProviders',{value:[provider]});return values;};
 return async function search(query,{limit=8}={}){
  await guard();let empty=false;
  if(!unavailable){
   if(!connection)try{connection=await credential(env,workspaceId,'firecrawl');}catch{unavailable=true;observe({provider:'firecrawl',operation:'search',status:'skipped',reason:'Workspace Firecrawl credential unavailable'});}
   await guard();
   if(connection)try{
    const response=await fetchImpl('https://api.firecrawl.dev/v2/search',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(connection.apiKey?{Authorization:`Bearer ${connection.apiKey}`}:{})},body:JSON.stringify({query,limit,scrapeOptions:{formats:['markdown']}}),signal:AbortSignal.timeout(25000)});
    if(!response.ok){if([401,402,403,409,429].includes(response.status))unavailable=true;throw Error(`Public search HTTP ${response.status}`);}
    const payload=await response.json(),rows=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web;
    if(payload.success===false||!Array.isArray(rows))throw Error('Public search returned an invalid result list');
    observe({provider:'firecrawl',operation:'search',status:'succeeded',results:rows.length});await guard();
    if(rows.length)return rowsWithSource(rows,'firecrawl');empty=true;
   }catch(error){await guard();observe({provider:'firecrawl',operation:'search',status:'failed',reason:String(error.message||'Public search unavailable').slice(0,180)});}
  }
  await guard();
  try{
   const result=await grounded(env,workspaceId,query);await guard();
   if(result.status!=='complete'||result.web_search===false||!Array.isArray(result.results))throw Error('Grounded public research unavailable');
   observe({provider:'grounded',operation:'search',status:'succeeded',results:result.results.length});
   return rowsWithSource(result.results,'grounded');
  }catch(error){await guard();observe({provider:'grounded',operation:'search',status:'failed',reason:'Grounded public research unavailable'});if(empty)return rowsWithSource([],'firecrawl');throw Error('Public contact research unavailable; resume unfinished checks after restoring a search provider.');}
 };
}
