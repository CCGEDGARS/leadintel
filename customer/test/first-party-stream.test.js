import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';

// Speed burst step 3 (2026-10-26): the Worker streams the assistant's answer, but the first-party proxy used to buffer the whole upstream body
// (res.end(await response.arrayBuffer())), so the browser saw everything at once at the end (measured: 1 chunk after 7.3 s through the proxy,
// 71 chunks with the first delta at 2.0 s from the Worker directly). The proxy now forwards each chunk as it arrives.
const mod=await import('../api/backend.mjs');
const encode=text=>new TextEncoder().encode(text);
test('the first-party proxy forwards upstream chunks as they arrive instead of buffering the whole body',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const upstream=new Response(new ReadableStream({async start(controller){controller.enqueue(encode('event: delta\ndata: {"text":"a"}\n\n'));await gate;controller.enqueue(encode('event: result\ndata: {"answer":"a"}\n\n'));controller.close();}}),{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8'}});
  let upstreamRequest;const handler=mod.createHandler(async(target,init)=>{upstreamRequest={target:String(target),init};return upstream;});
  const req=Object.assign(new EventEmitter(),{method:'POST',url:'/api/backend?route=copilot/chat&workspace_id=w1',headers:{accept:'text/event-stream','content-type':'application/json',cookie:'leadintel_session=x'},query:{route:'copilot/chat'},body:'{"message":"hi"}'});
  const res={statusCode:0,headers:{},chunks:[],ended:false,headersSent:false,setHeader(name,value){this.headers[name.toLowerCase()]=value;},write(chunk){this.headersSent=true;this.chunks.push(Buffer.from(chunk).toString());return true;},end(chunk){if(chunk)this.chunks.push(Buffer.from(chunk).toString());this.ended=true;}};
  const finished=handler(req,res);
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(res.chunks.join(''),'event: delta\ndata: {"text":"a"}\n\n','the first chunk reached the client while the upstream was still open');
  assert.equal(res.ended,false);assert.equal(res.statusCode,200);assert.match(String(res.headers['content-type']),/text\/event-stream/);assert.equal(res.headers['cache-control'],'no-store');
  assert.equal(upstreamRequest.init.headers.get('accept'),'text/event-stream');assert.match(upstreamRequest.target,/\/api\/copilot\/chat\?workspace_id=w1$/);
  release();await finished;
  assert.equal(res.ended,true);assert.match(res.chunks.join(''),/event: result/);
});
test('the proxy declares response streaming to the platform',()=>{
  assert.equal(mod.config?.supportsResponseStreaming,true);
});
