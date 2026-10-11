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

test('research transport parses fragmented progress and Unicode answers and rejects incomplete/error streams',async()=>{
 const api=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);const progress=[];
 const text='event: progress\ndata: {"phase":"researching"}\n\nevent: result\ndata: {"answer":"Sveiki, rūpnīca!"}\n\n',bytes=new TextEncoder().encode(text);const stream=new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}});
 assert.deepEqual(await api.readCopilotStream(new Response(stream),x=>progress.push(x.phase)),{answer:'Sveiki, rūpnīca!'});assert.deepEqual(progress,['researching']);
 await assert.rejects(api.readCopilotStream(new Response('event: progress\ndata: {"phase":"thinking"}\n\n')),/before completion/);
 await assert.rejects(api.readCopilotStream(new Response('event: error\ndata: {"error":"Try again"}\n\n')),/Try again/);
});
