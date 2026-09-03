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
async function routedFetch(input,options={}){
  const target=rewriteTarget(input);if(!target)return originalFetch(input,options);
  try{
    const response=await originalFetch(target,{...options,credentials:'include',headers:{Accept:'application/json',...(options.headers||{})}});
    if(retryableStatus(response.status))return originalFetch(input,options);
    return response;
  }catch(error){
    return originalFetch(input,options);
  }
}
if(!window.__leadintelFirecrawlWorkspaceRouterInstalled){window.__leadintelFirecrawlWorkspaceRouterInstalled=true;window.fetch=routedFetch;}
window.LeadIntelFirecrawlRouter={rewriteTarget,workspaceContext,retryableStatus};

export {rewriteTarget,workspaceContext,retryableStatus};
