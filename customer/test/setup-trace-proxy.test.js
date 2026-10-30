const test=require('node:test'),assert=require('node:assert/strict');
test('first-party API forwards the safe Setup operation ID through request and response',async()=>{
 const {proxyRequest}=await import('../api/backend.mjs');
 const incoming=new Request('https://leadintel.ccgroup.lv/api/backend.mjs?route=integrations/services/firecrawl',{method:'PUT',headers:{'X-LeadIntel-Operation-Id':'setup-safe-operation','Content-Type':'application/json'},body:'{}'});
 const response=await proxyRequest(incoming,async(url,options)=>{
  assert.equal(options.headers.get('X-LeadIntel-Operation-Id'),'setup-safe-operation');
  return Response.json({configured:true},{headers:{'X-LeadIntel-Operation-Id':'setup-safe-operation'}});
 });assert.equal(response.headers.get('X-LeadIntel-Operation-Id'),'setup-safe-operation');
});
