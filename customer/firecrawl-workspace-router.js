const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const MANAGED_FIRECRAWL_ORIGIN='https://apollo-proxy.edgars-7e7.workers.dev';
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
function retryableStatus(status){return status===408||status===429||status>=500;}
function scraplingTarget(kind){
  if(kind!=='scrape')return '';
  const {authenticated,workspace}=workspaceContext();if(!authenticated)return '';
  return `${API_BASE}/api/integrations/services/scrapling/scrape?workspace_id=${encodeURIComponent(workspace.id)}`;
}
function extractScrapeUrl(options={}){
  try{const body=typeof options.body==='string'?JSON.parse(options.body):options.body;return String(body?.url||'').trim();}catch{return '';}
}
async function routedFetch(input,options={}){
  const target=rewriteTarget(input);if(!target)return originalFetch(input,options);
  const kind=target.includes('/firecrawl/scrape')?'scrape':'search';
  try{
    const response=await originalFetch(target,{...options,credentials:'include',headers:{Accept:'application/json',...(options.headers||{})}});
    if(!retryableStatus(response.status))return response;
    const scrapling=scraplingTarget(kind);const url=extractScrapeUrl(options);
    if(scrapling&&url){
      try{
        const fallback=await originalFetch(scrapling,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({url})});
        if(fallback.ok)return fallback;
      }catch{}
    }
    return originalFetch(input,options);
  }catch(error){
    const scrapling=scraplingTarget(kind);const url=extractScrapeUrl(options);
    if(scrapling&&url){
      try{
        const fallback=await originalFetch(scrapling,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({url})});
        if(fallback.ok)return fallback;
      }catch{}
    }
    return originalFetch(input,options);
  }
}
if(!window.__leadintelFirecrawlWorkspaceRouterInstalled){window.__leadintelFirecrawlWorkspaceRouterInstalled=true;window.fetch=routedFetch;}
window.LeadIntelFirecrawlRouter={rewriteTarget,workspaceContext,retryableStatus,scraplingTarget,extractScrapeUrl};

export {rewriteTarget,workspaceContext,retryableStatus,scraplingTarget,extractScrapeUrl};
