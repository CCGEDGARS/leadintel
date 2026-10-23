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
  // Startup fires the same first-party GET from several modules within milliseconds (services/status ×3,
  // ai/status ×2, approved-workflow ×2 …). Identical GETs that are still in flight share one request and every
  // caller receives its own clone of the answer. Writes, custom headers, other origins and requests issued after
  // the shared one completed are never merged, so nothing is ever answered with stale data. If the leading
  // request fails (for example its caller aborted), each follower falls back to a request of its own.
  const inflight=new Map();
  function shareKey(target,input,options){
    try{
      const requestMethod=typeof Request!=='undefined'&&input instanceof Request?input.method:'';
      const method=String(options?.method||requestMethod||'GET').toUpperCase();
      if(method!=='GET'||options?.body!=null)return '';
      const url=new URL(target,root.location.origin);
      if(url.origin!==root.location.origin||!url.pathname.startsWith('/api/'))return '';
      const headers=typeof Headers!=='undefined'&&options?.headers instanceof Headers?[...options.headers.entries()]:Object.entries(options?.headers||{});
      if(headers.some(([name])=>String(name).toLowerCase()!=='accept'))return '';
      return url.href+'|'+String(options?.credentials||'');
    }catch{return '';}
  }
  const cloneable=response=>Boolean(response)&&typeof response.clone==='function';
  root.fetch=function(input,options){
    const initialUrl=typeof Request!=='undefined'&&input instanceof Request?input.url:String(input);
    const target=firstPartyUrl(initialUrl),bridge=root.LeadIntelServerBridge;
    const context=bridge?.session?.authenticated?`${bridge.session.user?.id||''}:${bridge.workspace?.id||''}:${bridge.workspace?.role||''}`:'';
    const outgoing=typeof Request!=='undefined'&&input instanceof Request?(target===input.url?input:new Request(target,input)):target;
    const key=shareKey(target,input,options);
    const shared=key?inflight.get(key):null;
    if(shared)return shared.then(response=>response.clone(),()=>originalFetch(outgoing,options));
    const request=originalFetch(outgoing,options).then(response=>{
      if(response.status===507&&root.CustomEvent&&root.dispatchEvent){
        try{const url=new URL(target,root.location.origin);if(url.origin===root.location.origin&&url.pathname.startsWith('/api/'))root.dispatchEvent(new root.CustomEvent('leadintel:storage-quota-rejected',{detail:{workspaceId:url.searchParams.get('workspace_id'),context}}));}catch{}
      }
      return response;
    });
    if(key){
      const tracked=request.then(response=>cloneable(response)?response.clone():Promise.reject(new Error('Response cannot be shared')));
      tracked.catch(()=>{});
      inflight.set(key,tracked);
      request.then(()=>{},()=>{}).then(()=>{if(inflight.get(key)===tracked)inflight.delete(key);});
    }
    return request;
  };
  root.LeadIntelApiTransport={firstPartyUrl,shareKey};
})(window);
