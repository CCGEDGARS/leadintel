const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../firecrawl-workspace-router.js'),'utf8').replace(/^export .*;\s*$/gm,'');
function router({authenticated=true,status=409,fail=false}={}){
 const calls=[];const window={location:{href:'https://leadintel.ccgroup.lv/customer/'},LeadIntelServerBridge:{session:{authenticated},workspace:{id:'w1'}},fetch:async(url)=>{calls.push(url);if(fail)throw Error('Offline');return new Response('{}',{status});}};
 vm.runInNewContext(source,{window,URL,Headers,Response,Request});return {window,calls};
}
test('failed research never retries against the owner legacy proxy or hosted Scrapling',async()=>{
 for(const status of [409,402,403,404,429,500]){const {window,calls}=router({status});const r=await window.fetch('https://apollo-proxy.edgars-7e7.workers.dev/firecrawl-search',{method:'POST',body:JSON.stringify({query:'business'})});assert.equal(r.status,status);assert.equal(calls.length,1);assert.match(calls[0],/\/api\/integrations\/services\/firecrawl\/search/);}
});
test('network failure never retries with owner-funded services',async()=>{
 const {window,calls}=router({fail:true});await assert.rejects(()=>window.fetch('https://apollo-proxy.edgars-7e7.workers.dev/firecrawl-scrape',{method:'POST',body:JSON.stringify({url:'https://example.com'})}),/Offline/);assert.equal(calls.length,1);
});
test('signed-out research is blocked before any provider request',async()=>{
 const {window,calls}=router({authenticated:false});const r=await window.fetch('https://apollo-proxy.edgars-7e7.workers.dev/firecrawl-search',{method:'POST'});assert.equal(r.status,401);assert.deepEqual(calls,[]);
});
test('legacy proxy ignores all platform keys even when configured',async()=>{
 const proxySource=fs.readFileSync(path.join(__dirname,'../../proxy.js'),'utf8').replace('export default','globalThis.proxy=');let paidCalls=0;
 const context={Request,Response,URL,Set,fetch:async()=>{paidCalls++;return new Response('{}');}};vm.runInNewContext(proxySource,context);
 for(const route of ['/','/firecrawl-scrape','/firecrawl-search','/firecrawl-map','/firecrawl-crawl']){const r=await context.proxy.fetch(new Request('https://proxy.example'+route,{method:'POST',body:'{}'}),{APOLLO_API_KEY:'owner-secret',FIRECRAWL_API_KEY:'owner-secret'});assert.equal(r.status,401);}
 assert.equal(paidCalls,0);
});
