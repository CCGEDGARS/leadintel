const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
function transport(fetch,clock={}){
 const context={fetch,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:15,...clock};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function fetchBuyerResearch('),source.indexOf('async function fetchFirecrawlBuyerResearch('))+'\nthis.request=fetchBuyerResearch;',context);
 return context.request;
}
test('buyer transport bounds a stalled response body after successful headers',async()=>{
 const request=transport(async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}));
 const outcome=await Promise.race([request('https://example.com').then(r=>r.json()).then(()=> 'unexpected',e=>e.code),new Promise(resolve=>setTimeout(()=>resolve('hung'),100))]);
 assert.equal(outcome,'BUYER_REQUEST_TIMEOUT');
});
test('buyer transport preserves response metadata and body methods',async()=>{
 const request=transport(async()=>new Response(JSON.stringify({results:[{name:'Ada Buyer'}]}),{status:201,headers:{'x-provider':'public'}}));
 const response=await request('https://example.com');
 assert.equal(response.status,201);assert.equal(response.headers.get('x-provider'),'public');assert.equal((await response.json()).results[0].name,'Ada Buyer');
});
test('buyer transport cancellation also interrupts a stalled response body',{timeout:2000},async()=>{
 // Hold the deadline clock still while asserting explicit cancellation. CPU scheduling
 // must not turn this cancellation test into an unrelated 15ms timeout test.
 const controller=new AbortController(),timers=new Map();let id=0,bodyStarted;const reading=new Promise(resolve=>bodyStarted=resolve);
 const request=transport(async()=>({ok:true,json:()=>{bodyStarted();return new Promise(()=>{});}}),{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
 const pending=request('https://example.com',{signal:controller.signal}).then(response=>response.json());
 await reading;controller.abort();
 await assert.rejects(pending,error=>error.code==='BUYER_RESEARCH_CANCELED');
});
