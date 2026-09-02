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
async function routedFetch(input,options={}){
  const target=rewriteTarget(input);if(!target)return originalFetch(input,options);
  return originalFetch(target,{...options,credentials:'include',headers:{Accept:'application/json',...(options.headers||{})}});
}
if(!window.__leadintelFirecrawlWorkspaceRouterInstalled){window.__leadintelFirecrawlWorkspaceRouterInstalled=true;window.fetch=routedFetch;}
window.LeadIntelFirecrawlRouter={rewriteTarget,workspaceContext};

export {rewriteTarget,workspaceContext};
