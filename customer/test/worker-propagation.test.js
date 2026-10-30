const test=require('node:test'),assert=require('node:assert/strict');
const sha='a'.repeat(40),old='b'.repeat(40);
const load=()=>import('../../scripts/verify-worker-propagation.mjs');
test('production deployment uses the bounded verifier with the intended SHA',()=>{
 const workflow=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../.github/workflows/backend-deploy.yml'),'utf8');
 const step=workflow.split('name: Verify legacy proxy customer-only billing')[1].split('name: Verify production health')[0];
 assert.match(step,/node \.\.\/scripts\/verify-worker-propagation\.mjs .*"\$EXPECTED_SHA"/);
 assert.doesNotMatch(step,/curl --fail/);
});
test('deployment verification waits for the exact SHA and customer-only billing',async()=>{
 const {verifyWorkerPropagation}=await load();let calls=0,waits=0;
 const result=await verifyWorkerPropagation({url:'https://worker.example/api/health',expectedSha:sha,waitImpl:async()=>waits++,fetchImpl:async url=>{assert.match(String(url),/release_check=/);calls++;return Response.json({status:'ok',billing:'customer_only',release_sha:calls===1?old:sha});}});
 assert.equal(result.passed,true);assert.equal(result.sha,sha);assert.equal(calls,2);assert.equal(waits,1);
});
test('propagation retries cannot accept paid billing or another release',async()=>{
 const {verifyWorkerPropagation}=await load();
 for(const body of [{status:'ok',billing:'customer_only',release_sha:old},{status:'ok',billing:'shared',release_sha:sha}]){
  let calls=0;await assert.rejects(verifyWorkerPropagation({url:'https://worker.example/api/health',expectedSha:sha,attempts:3,waitImpl:async()=>{},fetchImpl:async()=>{calls++;return Response.json(body);}}),/failed after 3 attempts/);assert.equal(calls,3);
 }
});
test('verification retries temporary health failures and rejects missing provenance',async()=>{
 const {verifyWorkerPropagation}=await load();let calls=0;
 const result=await verifyWorkerPropagation({url:'https://worker.example/api/health',expectedSha:sha,waitImpl:async()=>{},fetchImpl:async()=>++calls===1?new Response('',{status:503}):Response.json({status:'ok',billing:'customer_only',release_sha:sha})});assert.equal(result.attempts,2);
 await assert.rejects(verifyWorkerPropagation({url:'https://worker.example/api/health',expectedSha:'main'}),/exact release SHA/);
});
test('main backend propagation requires its service identity and exact release revision',async()=>{
 const {verifyWorkerPropagation}=await load();let calls=0;
 const result=await verifyWorkerPropagation({url:'https://backend.example/api/health',expectedSha:sha,requireCustomerOnly:false,expectedService:'leadintel-api',waitImpl:async()=>{},fetchImpl:async()=>Response.json({status:'ok',service:'leadintel-api',release_sha:++calls===1?old:sha})});assert.equal(result.attempts,2);
 await assert.rejects(verifyWorkerPropagation({url:'https://backend.example/api/health',expectedSha:sha,requireCustomerOnly:false,expectedService:'leadintel-api',attempts:1,fetchImpl:async()=>Response.json({status:'ok',service:'other',release_sha:sha})}),/failed/);
});
