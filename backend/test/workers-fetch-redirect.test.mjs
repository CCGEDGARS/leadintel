import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithScrapling} from '../src/scrapling.js';
import {translateGoogle} from '../src/google-translation.js';

// 22 Nov 2026. In the reports of every Buyers job since at least 5 Nov, in three workspaces, the Scrapling fallback
// had 0 successes: each call failed at once with SCRAPLING_NETWORK_ERROR, while the service itself answered from
// outside. Cloudflare Workers reject fetch(…, {redirect:'error'}) with a TypeError before anything is sent
// (checked in the local Workers runtime: 'Invalid redirect value, must be one of "follow" or "manual" ("error"
// won't be implemented …; use "manual" and check the response status code)'). Node accepts that value, so the
// tests passed. This fetch behaves like the Workers one in that respect.
const workersFetch=answer=>async(url,init={})=>{
  if(init.redirect!==undefined&&!['follow','manual'].includes(init.redirect))throw new TypeError('Invalid redirect value, must be one of "follow" or "manual" ("error" won\'t be implemented since it does not make sense at the edge; use "manual" and check the response status code).');
  return answer(url,init);
};
const env={SCRAPLING_SERVICE_URL:'https://scrapling.example/api/scrapling',SCRAPLING_SERVICE_TOKEN:'private-scrapling-key'};
const extracted=()=>Response.json({success:true,data:{markdown:'Source-backed company management contact details. '.repeat(5),metadata:{source:'scrapling-fallback',sourceURL:'https://company.example/team'}}});
async function withFetch(fetchImpl,run){const old=globalThis.fetch;globalThis.fetch=fetchImpl;try{return await run();}finally{globalThis.fetch=old;}}

test('the Scrapling fallback reaches its service on the Workers runtime',async()=>{
  let calls=0;
  const result=await withFetch(workersFetch(()=>{calls++;return extracted();}),()=>fetchWithScrapling(env,'https://company.example/team',{timeoutMs:1200}));
  assert.equal(calls,1);assert.match(JSON.stringify(result),/Source-backed company management contact details/);
});

test('a redirect answered by the Scrapling service is still refused, not followed',async()=>{
  const seen=[];
  await withFetch(workersFetch((url,init)=>{seen.push([String(url),init.redirect]);return new Response(null,{status:302,headers:{Location:'https://elsewhere.example/collect'}});}),
    ()=>assert.rejects(fetchWithScrapling(env,'https://company.example/team',{timeoutMs:1200}),error=>{assert.equal(error.code,'SCRAPLING_HTTP_ERROR');assert.equal(error.httpStatus,302);return true;}));
  assert.deepEqual(seen,[['https://scrapling.example/api/scrapling','manual']]);
});

test('Google Cloud Translation reaches its service on the Workers runtime, and a redirect answer is refused',async()=>{
  const provider=async(url,init)=>{const body=JSON.parse(init.body);return Response.json({data:{translations:body.q.map(text=>({translatedText:text.replace(/Hello/g,'Hej'),model:'nmt'}))}});};
  const source={subject:'Hello from Acme',message:'Hello Alice,\n\nRegards\nAlice'};
  const translated=await translateGoogle({apiKey:'AIza-translation-only-secret',source,language:'sv',fetchImpl:workersFetch(provider)});
  assert.match(JSON.stringify(translated),/Hej/);
  const seen=[];
  await assert.rejects(translateGoogle({apiKey:'AIza-translation-only-secret',source,language:'sv',fetchImpl:workersFetch((url,init)=>{seen.push(init.redirect);return new Response(null,{status:302,headers:{Location:'https://elsewhere.example/'}});})}),/rejected the request/);
  assert.deepEqual(seen,['manual']);
});
