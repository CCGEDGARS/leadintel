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
    if(typeof Request!=='undefined'&&input instanceof Request){const target=firstPartyUrl(input.url);return originalFetch(target===input.url?input:new Request(target,input),options);}
    return originalFetch(firstPartyUrl(String(input)),options);
  };
  root.LeadIntelApiTransport={firstPartyUrl};
})(window);
