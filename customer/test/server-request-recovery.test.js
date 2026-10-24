const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');
function runtime(fetch){
 const timers=new Map();let next=0;
 const ctx={fetch,AbortController,DOMException,FormData,API_REQUEST_TIMEOUT_MS:15000,endpoint:path=>path,setTimeout(fn){const id=++next;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function api('),source.indexOf('function returnTo(')),ctx);
 return {api:ctx.api,expire(){for(const fn of timers.values())fn();},timers};
}
test('request deadline settles even when a transport ignores abort and cannot return its late success',async()=>{
 let release;const r=runtime(()=>new Promise(resolve=>{release=resolve;}));
 let settled=false;const request=r.api('/api/crm/companies').then(()=>{settled='success';},error=>{settled=error.code;});
 r.expire();await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,'request_timeout');
 release({ok:true,status:200,json:async()=>({companies:[{id:'stale'}]})});await request;assert.equal(settled,'request_timeout');assert.equal(r.timers.size,0);
});
test('request deadline bounds stalled response parsing as well as fetch',async()=>{
 const r=runtime(async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}));
 let settled=false;const request=r.api('/api/crm/companies').catch(error=>{settled=error.code;});
 await Promise.resolve();r.expire();await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,'request_timeout');await request;
});
test('external cancellation wins over a transport ignoring abort and never returns success',async()=>{
 let release;const r=runtime(()=>new Promise(resolve=>{release=resolve;})),controller=new AbortController();
 let settled=false;const request=r.api('/api/crm/companies',{signal:controller.signal}).then(()=>{settled='success';},error=>{settled=error.name;});
 controller.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,'AbortError');
 release({ok:true,status:200,json:async()=>({})});await request;assert.equal(r.timers.size,0);
});
test('a pre-canceled request never reaches the transport',async()=>{
 let calls=0;const r=runtime(async()=>{calls++;return {ok:true,status:204};}),controller=new AbortController();controller.abort();
 await assert.rejects(r.api('/api/crm/companies',{signal:controller.signal}),error=>error.name==='AbortError');assert.equal(calls,0);
});
