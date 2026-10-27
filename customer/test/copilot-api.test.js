import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-api.js',import.meta.url),'utf8');

test('copilot transport is bounded authenticated and workspace-derived',()=>{
  assert.match(source,/AbortController/);
  assert.match(source,/credentials\s*:\s*['"]include['"]/);
  assert.match(source,/LeadIntelServerBridge/);
  assert.match(source,/workspace\.id/);
  assert.match(source,/workspace_id/);
  assert.match(source,/125000/);
  assert.match(source,/12000/);
});

test('callers cannot override authoritative workspace id and signed-out state makes no request',()=>{
  assert.doesNotMatch(source,/workspaceId\s*[,}]/);
  assert.match(source,/if\s*\(\s*!workspaceId\s*\)/);
  assert.match(source,/return\s+null|return\s+\{[^}]*available\s*:\s*false/);
});

test('copilot API exposes only the planned bounded operations',()=>{
  for(const name of ['requestCopilot','bootstrapCopilot','sendCopilotMessage','confirmCopilotAction','rejectCopilotAction'])assert.match(source,new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}|export\\s+const\\s+${name}`));
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('deletion transport uses authenticated DELETE calls scoped to the active workspace',async()=>{
 const prior={window:globalThis.window,fetch:globalThis.fetch};const calls=[];
 globalThis.window={LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'}}};
 globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url),options});return new Response(JSON.stringify({deleted:1}),{headers:{'Content-Type':'application/json'}});};
 try{const api=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//delete-transport').toString('base64')}`);await api.deleteCopilotConversation('chat/id');await api.clearCopilotHistory();assert.equal(calls.length,2);assert.equal(calls[0].url.pathname,'/api/copilot/conversations/chat%2Fid');assert.equal(calls[1].url.pathname,'/api/copilot/conversations');for(const call of calls){assert.equal(call.url.searchParams.get('workspace_id'),'w1');assert.equal(call.options.method,'DELETE');assert.equal(call.options.credentials,'include');}}
 finally{Object.assign(globalThis,prior);}
});

test('research transport parses fragmented progress and Unicode answers and rejects incomplete/error streams',async()=>{
 const api=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);const progress=[];
 const text='event: progress\ndata: {"phase":"researching"}\n\nevent: result\ndata: {"answer":"Sveiki, rūpnīca!"}\n\n',bytes=new TextEncoder().encode(text);const stream=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}});
 assert.deepEqual(await api.readCopilotStream(new Response(stream),x=>progress.push(x.phase)),{answer:'Sveiki, rūpnīca!'});assert.deepEqual(progress,['researching']);
 await assert.rejects(api.readCopilotStream(new Response('event: progress\ndata: {"phase":"thinking"}\n\n')),/before completion/);
 await assert.rejects(api.readCopilotStream(new Response('event: error\ndata: {"error":"Try again"}\n\n')),/Try again/);
});

// Speed burst step 2 (2026-10-26): answer text streams as delta events; a rewrite event replaces everything shown so far.
test('the transport delivers delta and rewrite events to onDelta before the result',async()=>{
 const api=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);const deltas=[],progress=[];
 const text='event: progress\ndata: {"phase":"answering"}\n\nevent: delta\ndata: {"text":"Sveiki, "}\n\nevent: delta\ndata: {"text":"Jonathan."}\n\nevent: rewrite\ndata: {"text":"Sveiki, [redacted]."}\n\nevent: result\ndata: {"answer":"Sveiki, [redacted]."}\n\n';
 const result=await api.readCopilotStream(new Response(text),x=>progress.push(x.phase),x=>deltas.push(x));
 assert.deepEqual(result,{answer:'Sveiki, [redacted].'});assert.deepEqual(progress,['answering']);assert.deepEqual(deltas,[{text:'Sveiki, '},{text:'Jonathan.'},{text:'Sveiki, [redacted].',replace:true}]);
 assert.match(source,/sendCopilotMessage\(payload,\{onProgress,onDelta\}/);
});
