import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('Treg verification executes native Worker fetch and never follows credential-bearing redirects',async()=>{
 const code=`import {verifyTreg} from './src/service-integrations.js';export default {async fetch(){try{return Response.json(await verifyTreg('fixture-secret'));}catch(e){return Response.json({code:e.code,message:e.message},{status:422});}}};`;
 const compiled=await build({stdin:{contents:code,resolveDir:fileURLToPath(new URL('..',import.meta.url)),sourcefile:'treg-worker.js'},bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],logLevel:'silent'});
 let redirect=false;const calls=[];
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-07-20',outboundService:async request=>{
  calls.push(request.url);assert.equal(request.url,'https://treg.to/home');assert.equal(request.method,'GET');assert.equal(request.headers.get('X-Treg-Token'),'fixture-secret');assert.equal(request.headers.get('Authorization'),null);
  return redirect?new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}}):Response.json({team:'fixture-team',balance_micro:921026});
 }}));
 try{
  const ok=await mf.dispatchFetch('https://worker.test/');assert.equal(ok.status,200,await ok.clone().text());assert.deepEqual(await ok.json(),{team:'fixture-team',balance_usd:.921026,authentication_surface:'rest'});assert.equal(calls.length,1);
  redirect=true;const blocked=await mf.dispatchFetch('https://worker.test/');assert.equal(blocked.status,422);assert.equal((await blocked.json()).code,'TREG_REDIRECT_BLOCKED');assert.equal(calls.length,2,'redirect must not create another outbound request');
 }finally{await mf.dispose();}
});
