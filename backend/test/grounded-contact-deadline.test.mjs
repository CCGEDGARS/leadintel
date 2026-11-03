import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedContactSearch} from '../src/grounded-contact-search.js';
import {searchGeminiWeb} from '../src/ai-task-routing.js';
const base={apiKey:'fixture',model:'fixture',company:'Acme Labs',domain:'acme.example',person:{name:'Anna Berg',title:'Operations Director'}};
test('a supplied parent signal cannot disable the native grounded-call deadline',{timeout:1000},async()=>{
 let supplied;const call=groundedContactSearch({...base,signal:new AbortController().signal,timeoutMs:20,fetchImpl:async(_url,options)=>{supplied=options.signal;return new Promise(()=>{});}});
 const outcome=await Promise.race([call.then(()=> 'unexpected',()=> 'bounded'),new Promise(resolve=>setTimeout(()=>resolve('stalled'),150))]);
 assert.equal(outcome,'bounded');assert.equal(supplied.aborted,true);
});
test('the dossier Gemini adapter also owns its deadline when the caller supplies a signal',{timeout:1000},async()=>{
 const call=searchGeminiWeb({apiKey:'fixture',model:'fixture',query:'Acme Labs leadership',signal:new AbortController().signal,timeoutMs:20,fetchImpl:()=>new Promise(()=>{})});
 assert.equal(await Promise.race([call.then(()=> 'unexpected',()=> 'bounded'),new Promise(resolve=>setTimeout(()=>resolve('stalled'),150))]),'bounded');
});
test('an already canceled caller cannot dispatch either grounded provider adapter',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;const fetchImpl=async()=>{calls++;throw Error('Must not dispatch');};
 await assert.rejects(groundedContactSearch({...base,signal:controller.signal,fetchImpl}));
 await assert.rejects(searchGeminiWeb({apiKey:'fixture',model:'fixture',query:'Acme Labs',signal:controller.signal,fetchImpl}));assert.equal(calls,0);
});
test('a stalled grounding redirect cannot discard independent healthy citations',{timeout:1000},async()=>{
 let concurrent=0,max=0;const result=await groundedContactSearch({...base,timeoutMs:500,redirectTimeoutMs:15,fetchImpl:async(url,options)=>{
  if(!url.includes('grounding-api-redirect'))return Response.json({candidates:[{groundingMetadata:{webSearchQueries:['Anna Berg Acme Labs'],groundingChunks:[{web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/stalled'}},{web:{uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/good'}},{web:{uri:'https://acme.example/team'}}]}}]});
  concurrent++;max=Math.max(max,concurrent);
  if(url.endsWith('stalled'))return new Promise(()=>{});
  concurrent--;return {status:302,headers:new Headers({location:'https://linkedin.com/in/anna-berg'})};
 }});
 assert.ok(max>=2);assert.deepEqual(result.results.map(r=>r.url),['https://linkedin.com/in/anna-berg','https://acme.example/team']);assert.equal(result.web_search,true);
});
