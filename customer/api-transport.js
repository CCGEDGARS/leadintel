(function(root){
  'use strict';
  if(root.LeadIntelApiTransport||typeof root.fetch!=='function')return;
  const workerOrigin='https://leadintel-api.edgars-7e7.workers.dev';
  const originalFetch=root.fetch.bind(root);
  // Compatibility boundary for existing modules: authentication never depends on
  // third-party cookies. Only this application's fixed Worker API is rewritten.
  function firstPartyUrl(value){
    try{const url=new URL(value,root.location.origin);if(url.origin===workerOrigin&&url.pathname.startsWith('/api/'))return root.location.origin+url.pathname+url.search;}catch{}
    return value;
  }
  root.fetch=function(input,options){
    const initialUrl=typeof Request!=='undefined'&&input instanceof Request?input.url:String(input);
    const target=firstPartyUrl(initialUrl),bridge=root.LeadIntelServerBridge;
    const context=bridge?.session?.authenticated?`${bridge.session.user?.id||''}:${bridge.workspace?.id||''}:${bridge.workspace?.role||''}`:'';
    const outgoing=typeof Request!=='undefined'&&input instanceof Request?(target===input.url?input:new Request(target,input)):target;
    return originalFetch(outgoing,options).then(response=>{
      if(response.status===507&&root.CustomEvent&&root.dispatchEvent){
        try{const url=new URL(target,root.location.origin);if(url.origin===root.location.origin&&url.pathname.startsWith('/api/'))root.dispatchEvent(new root.CustomEvent('leadintel:storage-quota-rejected',{detail:{workspaceId:url.searchParams.get('workspace_id'),context}}));}catch{}
      }
      return response;
    });
  };
  root.LeadIntelApiTransport={firstPartyUrl};
})(window);
