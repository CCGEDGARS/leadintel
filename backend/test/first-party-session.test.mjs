import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSaasRoute} from '../src/saas-routes.js';
import {proxyRequest} from '../../api/backend.mjs';
test('Worker callback moves to fixed frontend before touching OAuth state',async()=>{
  const env={CUSTOMER_APP_URL:'https://leadintel.ccgroup.lv/customer/',DB:{prepare(){throw new Error('State must not be consumed before bounce');}}};
  for(const provider of ['google','microsoft']){
    const response=await handleSaasRoute(new Request(`https://worker.test/api/auth/${provider}/callback?code=provider-code&state=state-1&return_to=https://evil.test`),env,{});
    assert.equal(response.status,302);const target=new URL(response.headers.get('location'));
    assert.equal(target.origin,'https://leadintel.ccgroup.lv');assert.equal(target.pathname,`/api/auth/${provider}/callback`);assert.equal(target.searchParams.get('state'),'state-1');assert.equal(response.headers.get('set-cookie'),null);
  }
});
test('first-party proxy forwards cookie, query, raw body, CSRF and idempotency with no redirect following or caching',async()=>{
  const request=new Request('https://leadintel.ccgroup.lv/api/backend.mjs?route=customer/state&workspace_id=one',{method:'PUT',headers:{cookie:'leadintel_session=fixture','content-type':'application/json',origin:'https://leadintel.ccgroup.lv','idempotency-key':'fixture-id','x-csrf-token':'fixture-csrf'},body:'{"version":2}'});
  const response=await proxyRequest(request,async(url,options)=>{
    assert.equal(String(url),'https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=one');assert.equal(options.redirect,'manual');assert.equal(options.headers.get('cookie'),'leadintel_session=fixture');assert.equal(options.headers.get('x-leadintel-first-party'),'1');assert.equal(options.headers.get('idempotency-key'),'fixture-id');assert.equal(options.headers.get('x-csrf-token'),'fixture-csrf');assert.equal(Buffer.from(options.body).toString(),'{"version":2}');
    return new Response('{"ok":true}',{headers:{'Set-Cookie':'leadintel_session=new-fixture; HttpOnly; Secure; SameSite=None; Path=/'}});
  });
  assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.doesNotMatch(response.headers.get('set-cookie'),/Domain=/);
});
test('proxy cannot be turned into an arbitrary upstream or path traversal relay',async()=>{
  for(const route of ['../private','https://evil.test','/api/session']){
    const response=await proxyRequest(new Request('https://leadintel.ccgroup.lv/api/backend.mjs?route='+encodeURIComponent(route)),()=>{throw new Error('Must reject before fetching');});assert.equal(response.status,400);
  }
});
test('proxy passes logout cookie deletion unchanged',async()=>{
  const response=await proxyRequest(new Request('https://leadintel.ccgroup.lv/api/backend.mjs?route=logout',{method:'POST'}),async()=>new Response('{"ok":true}',{headers:{'Set-Cookie':'leadintel_session=; Max-Age=0; HttpOnly; Secure; Path=/'}}));assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
