import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const pdf=()=>new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x37]);

import {runtime as sqliteRuntime} from './helpers/copilot-runtime.mjs';
const runtime=()=>{const env=sqliteRuntime();env.DB.sqlite.exec("DELETE FROM workspace_members WHERE workspace_id='w2'");return env;};
function request({workspace='w1',token='good',file=pdf(),name='report.pdf',type='application/pdf',sha=hash(pdf()),extraction={format:'pdf',blocks:[{locator:'page:1',text:'A safe summary'}],evidenceIndex:{'page:1':'Page 1'},warnings:[],coverage:{complete:true},counts:{characters:14,nonEmptyCells:0,csvRows:0}},extractorVersion='web-1'}={}){
  const form=new FormData();form.set('file',new File([file],name,{type}));form.set('extraction_json',JSON.stringify(extraction));form.set('sha256',sha);form.set('extractor_version',extractorVersion);
  return new Request(`https://leadintel.test/api/copilot/files?workspace_id=${workspace}`,{method:'POST',headers:{Cookie:`leadintel_session=${token}`},body:form});
}

test('requires an authenticated workspace member before parsing an upload',async()=>{
  const unauthenticated=await handleCopilotFileRoute(request({token:''}),runtime());
  assert.equal(unauthenticated.status,401);
  const nonMember=await handleCopilotFileRoute(request({workspace:'w2'}),runtime());
  assert.equal(nonMember.status,403);
});

test('rejects cross-workspace upload access and unsafe file inputs',async()=>{
  const env=runtime();env.DB.sqlite.exec("INSERT INTO workspace_members VALUES('w2','u1','viewer')");
  assert.equal((await handleCopilotFileRoute(request({workspace:'w2'}),env)).status,403);
  assert.equal((await handleCopilotFileRoute(request({name:'unsafe.exe',type:'application/octet-stream'}),env)).status,415);
  assert.equal((await handleCopilotFileRoute(request({type:'text/csv'}),env)).status,422);
});

test('persists the original, normalized extraction, digest and extractor version once',async()=>{
  const env=runtime();const response=await handleCopilotFileRoute(request(),env);const body=await response.json();
  assert.equal(response.status,201);assert.equal(body.reused,false);assert.match(body.file_id,/^[0-9a-f-]{36}$/i);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM copilot_files').get().n,1);assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM copilot_file_extractions').get().n,1);assert.equal(env.DB.sqlite.prepare('SELECT extractor_version FROM copilot_file_extractions').get().extractor_version,'web-1');assert.equal(env.R2?false:env.COPILOT_FILES.objects.size,1);
  assert.doesNotMatch(JSON.stringify(body),/safe summary|leadintel_session/);
});

test('reuses an existing workspace digest without another original write',async()=>{
  const env=runtime();const first=await handleCopilotFileRoute(request(),env);const firstBody=await first.json();const second=await handleCopilotFileRoute(request(),env);const secondBody=await second.json();
  assert.equal(second.status,200);assert.equal(secondBody.reused,true);assert.equal(secondBody.file_id,firstBody.file_id);assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM copilot_files').get().n,1);assert.equal(env.COPILOT_FILES.objects.size,1);
});

test('rejects mismatched multipart digest and extraction over aggregate limits',async()=>{
  const badDigest=await handleCopilotFileRoute(request({sha:'0'.repeat(64)}),runtime());assert.equal(badDigest.status,422);
  const extraction={format:'pdf',blocks:[{locator:'page:1',text:'x'.repeat(250001)}],evidenceIndex:{'page:1':'Page 1'},warnings:[],coverage:{},counts:{characters:250001,nonEmptyCells:0,csvRows:0}};
  const tooLarge=await handleCopilotFileRoute(request({extraction}),runtime());assert.equal(tooLarge.status,422);
});
