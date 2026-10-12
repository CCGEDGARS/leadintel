const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const MANAGED_FIRECRAWL_ORIGIN='https://apollo-proxy.edgars-7e7.workers.dev';
const FIRECRAWL_SEARCH_QUERY_MAX_CHARS=600;
const originalFetch=window.fetch.bind(window);

function workspaceContext(){
  const bridge=window.LeadIntelServerBridge||null;const workspace=bridge?.workspace;
  return {authenticated:Boolean(bridge?.session?.authenticated&&workspace?.id),workspace};
}
function rewriteTarget(input){
  const raw=typeof input==='string'?input:input?.url;if(!raw)return null;
  let url;try{url=new URL(raw,window.location.href);}catch{return null;}
  if(url.origin!==MANAGED_FIRECRAWL_ORIGIN)return null;
  const kind=url.pathname==='/firecrawl-scrape'?'scrape':url.pathname==='/firecrawl-search'?'search':'';if(!kind)return null;
  const {authenticated,workspace}=workspaceContext();if(!authenticated)return null;
  return `${API_BASE}/api/integrations/services/firecrawl/${kind}?workspace_id=${encodeURIComponent(workspace.id)}`;
}
function compactSearchQuery(value,max=FIRECRAWL_SEARCH_QUERY_MAX_CHARS){
  const normalized=String(value??'').replace(/\s+/g,' ').trim();
  if(!normalized||normalized.length<=max)return normalized;
  const clipped=normalized.slice(0,max+1);const boundary=clipped.lastIndexOf(' ');
  return (boundary>=Math.floor(max*0.7)?clipped.slice(0,boundary):normalized.slice(0,max)).trim();
}
function sanitizeSearchRequestOptions(options={}){
  let body;try{body=typeof options.body==='string'?JSON.parse(options.body):options.body;}catch{return options;}
  if(!body||typeof body!=='object'||Array.isArray(body)||!Object.prototype.hasOwnProperty.call(body,'query'))return options;
  const query=compactSearchQuery(body.query);
  const mode=options.headers instanceof Headers?options.headers.get('X-LeadIntel-Research-Mode'):options.headers?.['X-LeadIntel-Research-Mode'];
  const limit=Math.min(mode==='saving'?4:10,Math.max(1,Math.floor(Number(body.limit)||4)));
  if(query===String(body.query??'').trim()&&limit===body.limit)return options;
  return {...options,body:JSON.stringify({...body,query,limit})};
}
async function weakScrapeResponse(response,kind){
  if(kind!=='scrape'||!response.ok)return false;
  try{const payload=await response.clone().json();const data=payload.data||payload;const text=String(data.markdown||data.content||'').replace(/\s+/g,' ').trim();return text.length<120||(/captcha|verify you are human|cloudflare ray id|access denied/i.test(text)&&text.length<1000);}catch{return true;}
}
function retryableStatus(status){return status===402||status===404||status===408||status===429||status>=500;}
function scraplingTarget(kind){
  if(kind!=='scrape')return '';
  const {authenticated,workspace}=workspaceContext();if(!authenticated)return '';
  return `${API_BASE}/api/integrations/services/scrapling/scrape?workspace_id=${encodeURIComponent(workspace.id)}`;
}
function extractScrapeUrl(options={}){
  try{const body=typeof options.body==='string'?JSON.parse(options.body):options.body;return String(body?.url||'').trim();}catch{return '';}
}
function tagExtractor(response,extractor){
  try{const headers=new Headers(response.headers);headers.set('X-LeadIntel-Extractor',extractor);return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
  catch{return response;}
}
async function routedFetch(input,options={}){
  const raw=typeof input==='string'?input:input?.url;
  let legacy=false;try{legacy=new URL(raw,window.location.href).origin===MANAGED_FIRECRAWL_ORIGIN;}catch{}
  const target=rewriteTarget(input);
  if(legacy&&!target)return new Response(JSON.stringify({error:'Sign in and connect your own provider API key in Settings.',code:'CUSTOMER_SERVICE_KEY_REQUIRED'}),{status:401,headers:{'Content-Type':'application/json'}});
  if(!target)return originalFetch(input,options);
  const kind=target.includes('/firecrawl/scrape')?'scrape':'search';
  if(kind==='search')options=sanitizeSearchRequestOptions(options);
  try{return await originalFetch(target,{...options,credentials:'include',headers:{Accept:'application/json',...(options.headers||{})},signal:options?.signal});}
  catch(error){if(error?.name==="AbortError"||options?.signal?.aborted)throw error;throw error;} // CUSTOMER_ONLY_BILLING: never retry owner-funded services.
}
if(!window.__leadintelFirecrawlWorkspaceRouterInstalled){window.__leadintelFirecrawlWorkspaceRouterInstalled=true;window.fetch=routedFetch;}
window.LeadIntelFirecrawlRouter={rewriteTarget,workspaceContext,retryableStatus,scraplingTarget,extractScrapeUrl,compactSearchQuery,sanitizeSearchRequestOptions};

export {FIRECRAWL_SEARCH_QUERY_MAX_CHARS,rewriteTarget,workspaceContext,retryableStatus,scraplingTarget,extractScrapeUrl,compactSearchQuery,sanitizeSearchRequestOptions};
