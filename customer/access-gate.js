// Signed-out visitors do not get the local workspace any more (CTO decision, 2026-10-25): /customer/ is for
// signed-in members, the public sign-in page is at the app origin root. Only a definite 401 redirects;
// a backend outage or a slow network leaves the page alone so nobody is bounced for the wrong reason.
(function(root){
  'use strict';
  const gate={
    decide(status,search){
      if(/(?:^|[?&])auth=/.test(String(search||'')))return 'stay'; // fresh OAuth return carries its own result
      return Number(status)===401?'sign-in':'stay';
    },
    signInUrl(reason){return '/'+(reason?'?access='+encodeURIComponent(reason):'');}
  };
  root.LeadIntelAccessGate=gate;
  if(typeof root.fetch!=='function'||!root.location||root.LeadIntelAccessGate.disabled)return;
  if(gate.decide(null,root.location.search)==='stay'&&/(?:^|[?&])auth=/.test(root.location.search))return;
  root.fetch('/api/session',{credentials:'include',cache:'no-store'})
    .then(response=>{if(gate.decide(response.status,root.location.search)==='sign-in')root.location.replace(gate.signInUrl(''));})
    .catch(()=>{});
})(typeof window==='object'?window:globalThis);
