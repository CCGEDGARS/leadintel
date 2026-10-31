importScripts('./evidence-policy.js?operating-evidence=20261020-v5&companies-audit=20261031-v1','./market-engine.js?search-relevance=20261020-v1&strategy-audit=20261030-v1','./discovery-engine.js?operating-evidence=20261020-v5&strategy-audit=20261030-v1&companies-audit=20261031-v1');
self.onmessage=event=>{
  const {profile,market,rows}=event.data;
  const results=rows.map(row=>({id:row.id,result:LeadIntelDiscovery.assessCompanyQualification(row.candidate,profile,market,row.settings)}));
  self.postMessage({results});
};
