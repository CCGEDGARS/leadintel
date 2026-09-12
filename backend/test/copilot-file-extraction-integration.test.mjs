import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCopilotFile} from '../../customer/copilot-file-extractors.js';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {runtime,uploadRequest,extraction} from './helpers/copilot-runtime.mjs';
test('real CSV adapter output including filename title uploads unchanged',async()=>{
  const bytes=Buffer.from('name,revenue\nAcme,12\n'),name='accounts.csv',type='text/csv';
  const document=await extractCopilotFile(new File([bytes],name,{type}));
  assert.equal(document.title,'accounts.csv');
  const env=runtime(),response=await handleCopilotFileRoute(uploadRequest({bytes,name,type,document}),env);
  assert.equal(response.status,201,await response.text());
  // Header includes the adapter's tab separator: 4 + 1 + 7 + 4 + 2 = 18.
  assert.equal(env.DB.sqlite.prepare('SELECT character_count FROM copilot_file_extractions').get().character_count,18);
});
test('title does not inflate source character count',async()=>assert.equal((await handleCopilotFileRoute(uploadRequest(),runtime())).status,201));
for(const [name,change] of [
  ['evidence aggregate',d=>{d.title='';d.evidenceIndex['page:1']='x'.repeat(250001);}],
  ['warning aggregate',d=>{d.title='';d.warnings=['x'.repeat(250001)];}],
  ['omission aggregate',d=>{d.title='';d.coverage.omitted=['x'.repeat(250001)];}],
  ['coverage boolean',d=>{d.title='';d.coverage.complete='true';}],
  ['coverage omission type',d=>{d.title='';d.coverage.omitted={a:'x'};}],
  ['missing evidence',d=>{d.title='';d.evidenceIndex={};}],
  ['excessive blocks',d=>{d.title='';d.blocks=Array.from({length:1001},(_,i)=>({locator:`p:${i}`,text:''}));d.evidenceIndex=Object.fromEntries(d.blocks.map(b=>[b.locator,'']));d.counts.characters=0;}],
  ['excessive empty cells',d=>{d.title='';d.blocks[0].table=[Array(100001).fill('')];}],
  ['excessive empty rows',d=>{d.title='';d.blocks[0].table=Array.from({length:20001},()=>[]);}],
  ['long locator',d=>{d.title='';d.blocks[0].locator='p'.repeat(501);d.evidenceIndex={[d.blocks[0].locator]:''};}],
])test(`rejects extraction ${name} before persistence`,async()=>{const env=runtime(),document=extraction();change(document);const response=await handleCopilotFileRoute(uploadRequest({document}),env);assert.equal(response.status,422);assert.equal(env.COPILOT_FILES.objects.size,0);});
test('rejects oversized serialized extraction before JSON processing',async()=>{const document=extraction();document.title='';document.blocks[0].table=Array.from({length:1000},()=>Array(1000).fill(''));const response=await handleCopilotFileRoute(uploadRequest({document}),runtime());assert.equal(response.status,413);});
test('rejects declared oversized multipart before reading body',async()=>{let read=false;const request=new Request('https://leadintel.test/api/copilot/files?workspace_id=w1',{method:'POST',headers:{Cookie:'leadintel_session=good','Content-Length':String(18*1024*1024+1)},body:'small'});request.formData=async()=>{read=true;throw new Error();};const response=await handleCopilotFileRoute(request,runtime());assert.equal(response.status,413);assert.equal(read,false);});
test('caps streamed multipart without trusting Content-Length',async()=>{const request=new Request('https://leadintel.test/api/copilot/files?workspace_id=w1',{method:'POST',headers:{Cookie:'leadintel_session=good','Content-Type':'multipart/form-data; boundary=a'},body:new ReadableStream({start(c){for(let i=0;i<19;i++)c.enqueue(new Uint8Array(1024*1024));c.close();}}),duplex:'half'});assert.equal((await handleCopilotFileRoute(request,runtime())).status,413);});
