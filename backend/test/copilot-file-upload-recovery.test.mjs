import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {createFileRecord,saveExtraction} from '../src/copilot-file-store.js';
import {runtime,uploadRequest,hash} from './helpers/copilot-runtime.mjs';
const count=(env,table)=>env.DB.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
test('an obsolete upload owner cannot complete a recovered file',async()=>{const env=runtime();const record=await createFileRecord(env,{workspaceId:'w1',userId:'u1',originalName:'report.pdf',extension:'pdf',mimeType:'application/pdf',byteSize:8,sha256:hash('%PDF-1.7'),uploadToken:'current'});await assert.rejects(()=>saveExtraction(env,{workspaceId:'w1',fileId:record.id,blocks:[],evidenceIndex:{},characterCount:0,cellCount:0,extractorVersion:'test',uploadToken:'obsolete'}));assert.equal(count(env,'copilot_file_extractions'),0);});
test('real SQLite enforces live digest uniqueness within a workspace, not across workspaces',async()=>{
  const env=runtime(),input={workspaceId:'w1',userId:'u1',originalName:'report.pdf',extension:'pdf',mimeType:'application/pdf',byteSize:8,sha256:hash('%PDF-1.7')};
  await createFileRecord(env,input);await assert.rejects(()=>createFileRecord(env,input),/UNIQUE/);await createFileRecord(env,{...input,workspaceId:'w2'});assert.equal(count(env,'copilot_files'),2);
});
test('concurrent real SQLite uploads reserve one digest and one original',async()=>{
  const env=runtime();const prepare=env.DB.prepare.bind(env.DB);let arrivals=0,release;const gate=new Promise(resolve=>{release=resolve;});
  env.DB.prepare=sql=>{const statement=prepare(sql);if(/sha256=/.test(sql)&&/SELECT/.test(sql)){const first=statement.first.bind(statement);statement.first=async()=>{const snapshot=await first();if(++arrivals<=8){if(arrivals===8)release();await gate;}return snapshot;};}return statement;};
  const responses=await Promise.all(Array.from({length:8},()=>handleCopilotFileRoute(uploadRequest(),env)));
  assert.equal(count(env,'copilot_files'),1);assert.equal(env.COPILOT_FILES.objects.size,1);assert.equal(count(env,'copilot_file_extractions'),1);
  assert.equal(responses.filter(r=>r.status===201).length,1);assert.ok(responses.every(r=>[200,201,409].includes(r.status)));
  const retry=await handleCopilotFileRoute(uploadRequest(),env);assert.equal(retry.status,200);assert.equal((await retry.json()).reused,true);
});
for(const stage of ['R2','D1'])test(`retry repairs ${stage} failure without false reuse or duplicate objects`,async()=>{
  const env=runtime();if(stage==='R2')env.COPILOT_FILES.failPut=true;else env.DB.failBatch=true;
  assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,500);
  env.COPILOT_FILES.failPut=false;env.DB.failBatch=false;
  const response=await handleCopilotFileRoute(uploadRequest(),env);assert.equal(response.status,201);assert.equal((await response.json()).reused,false);
  assert.equal(count(env,'copilot_files'),1);assert.equal(count(env,'copilot_file_extractions'),1);assert.equal(env.COPILOT_FILES.objects.size,1);
  assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,200);
});
test('completed metadata missing extraction is repaired, never reused',async()=>{
  const env=runtime();await handleCopilotFileRoute(uploadRequest(),env);env.DB.sqlite.exec('DELETE FROM copilot_file_extractions');
  const response=await handleCopilotFileRoute(uploadRequest(),env);assert.equal(response.status,201);assert.equal(count(env,'copilot_file_extractions'),1);assert.equal(env.COPILOT_FILES.objects.size,1);
});
test('completed metadata missing original is repaired, never reused',async()=>{
  const env=runtime();await handleCopilotFileRoute(uploadRequest(),env);env.COPILOT_FILES.objects.clear();
  assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,201);assert.equal(env.COPILOT_FILES.objects.size,1);
});
test('fresh pending upload reports conflict and abandoned pending upload can be retried',async()=>{
  const env=runtime(),input={workspaceId:'w1',userId:'u1',originalName:'report.pdf',extension:'pdf',mimeType:'application/pdf',byteSize:8,sha256:hash('%PDF-1.7')};await createFileRecord(env,input);
  assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,409);
  env.DB.sqlite.exec("UPDATE copilot_files SET updated_at='2000-01-01'");
  assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,201);assert.equal(count(env,'copilot_files'),1);assert.equal(env.COPILOT_FILES.objects.size,1);
});
test('failed upload retry claim is atomic for overlapping retries',async()=>{
  const env=runtime();env.COPILOT_FILES.failPut=true;await handleCopilotFileRoute(uploadRequest(),env);env.COPILOT_FILES.failPut=false;
  const responses=await Promise.all([handleCopilotFileRoute(uploadRequest(),env),handleCopilotFileRoute(uploadRequest(),env)]);
  assert.equal(responses.filter(r=>r.status===201).length,1);assert.equal(count(env,'copilot_files'),1);assert.equal(count(env,'copilot_file_extractions'),1);assert.equal(env.COPILOT_FILES.objects.size,1);
});
