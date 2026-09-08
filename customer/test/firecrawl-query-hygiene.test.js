import test from 'node:test';
import assert from 'node:assert/strict';

function installWindow(){
  const originalFetch=async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
  globalThis.window={
    fetch:originalFetch,
    location:{href:'https://leadintel.ccgroup.lv/'},
    LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'edgars-latvia'}}
  };
}

test('Firecrawl router compacts overlong market search queries before backend validation',async()=>{
  installWindow();
  const mod=await import(`../firecrawl-workspace-router.js?query-hygiene=${Date.now()}`);
  assert.equal(typeof mod.sanitizeSearchRequestOptions,'function');

  const raw='Latvija Korporatīvās pārdošanas apmācības, biznesa koučings un mentorings, pielāgota MI integrācija ' + 'papildu tirgus signāli un uzņēmumu izaugsme '.repeat(30);
  assert.ok(raw.length>600);

  const options={
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:raw,limit:4})
  };
  const sanitized=mod.sanitizeSearchRequestOptions(options);
  const body=JSON.parse(sanitized.body);

  assert.ok(body.query.length>0);
  assert.ok(body.query.length<=600);
  assert.equal(/\s{2,}/.test(body.query),false);
  assert.equal(body.limit,4);
  assert.equal(sanitized.method,'POST');
});
