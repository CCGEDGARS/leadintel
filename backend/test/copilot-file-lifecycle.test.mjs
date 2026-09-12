import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {createAnalysis} from '../src/copilot-file-store.js';
import {runtime,uploadRequest,apiRequest} from './helpers/copilot-runtime.mjs';
async function fixture(){const env=runtime();const uploaded=await (await handleCopilotFileRoute(uploadRequest(),env)).json();const analysis=await createAnalysis(env,{workspaceId:'w1',fileId:uploaded.file_id,userId:'u1',request:'Summarize',result:{title:'Review',executive_summary:'Facts'},provider:'test',model:'test'});return {env,id:analysis.id,fileId:uploaded.file_id};}
test('retained history is empty until save, then supports canonical reload',async()=>{
  const {env,id}=await fixture();let response=await handleCopilotFileRoute(apiRequest('file-analyses'),env);assert.ok(response);assert.equal(response.status,200);assert.deepEqual(await response.json(),{analyses:[]});
  response=await handleCopilotFileRoute(apiRequest(`file-analyses/${id}/save`,{method:'POST'}),env);assert.equal(response?.status,200);assert.deepEqual(await response.json(),{id,retained:true});
  response=await handleCopilotFileRoute(apiRequest('file-analyses'),env);const {analyses}=await response.json();assert.equal(analyses.length,1);assert.equal(analyses[0].id,id);assert.doesNotMatch(JSON.stringify(analyses),/r2_key|upload_token|sha256|token_hash/);
  response=await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`),env);const {analysis}=await response.json();assert.equal(analysis.result.executive_summary,'Facts');assert.equal(analysis.retained,true);assert.doesNotMatch(JSON.stringify(analysis),/r2_key|upload_token|token_hash/);
});
for(const [suffix,method] of [['','GET'],['/id','GET'],['/id/save','POST'],['/id','DELETE']])test(`${method} lifecycle ${suffix||'list'} requires authentication and membership`,async()=>{
  const env=runtime();assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses${suffix}`,{method,token:''}),env))?.status,401);
  assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses${suffix}`,{method,workspace:'unknown'}),env))?.status,403);
});
test('cross-workspace IDs cannot be read, saved or deleted',async()=>{
  const {env,id}=await fixture();for(const [suffix,method] of [['','GET'],['/save','POST']])assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses/${id}${suffix}`,{method,workspace:'w2'}),env))?.status,404);
  const deleted=await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`,{method:'DELETE',workspace:'w2'}),env);assert.equal(deleted?.status,200);assert.deepEqual(await deleted.json(),{deleted:false});assert.equal(env.COPILOT_FILES.objects.size,1);
});
test('failed or deleting analyses cannot be retained',async()=>{const {env,id}=await fixture();for(const status of ['failed','pending','running','deleting']){env.DB.sqlite.prepare('UPDATE copilot_file_analyses SET status=? WHERE id=?').run(status,id);assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses/${id}/save`,{method:'POST'}),env))?.status,409);}});
test('delete removes all file-tree data and can be repeated safely',async()=>{
  const {env,id}=await fixture();env.DB.sqlite.prepare("INSERT INTO copilot_file_analysis_messages(id,analysis_id,role,content) VALUES('m',?,'user','hi')").run(id);
  let response=await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`,{method:'DELETE'}),env);assert.equal(response?.status,200);assert.deepEqual(await response.json(),{deleted:true});assert.equal(env.COPILOT_FILES.objects.size,0);
  for(const table of ['copilot_files','copilot_file_extractions','copilot_file_analyses','copilot_file_analysis_messages'])assert.equal(env.DB.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
  response=await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`,{method:'DELETE'}),env);assert.deepEqual(await response.json(),{deleted:false});
});
test('partially failed deletion stays retryable and is not offered in history',async()=>{
  const {env,id}=await fixture();await handleCopilotFileRoute(apiRequest(`file-analyses/${id}/save`,{method:'POST'}),env);env.COPILOT_FILES.failDelete=true;
  assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`,{method:'DELETE'}),env))?.status,503);
  assert.equal(env.DB.sqlite.prepare('SELECT extraction_status FROM copilot_files').get().extraction_status,'deleting');
  const list=await handleCopilotFileRoute(apiRequest('file-analyses'),env);assert.deepEqual(await list.json(),{analyses:[]});
  env.COPILOT_FILES.failDelete=false;assert.equal((await handleCopilotFileRoute(apiRequest(`file-analyses/${id}`,{method:'DELETE'}),env)).status,200);
});
test('unrelated prefixes remain unclaimed',async()=>{const env=runtime();assert.equal(await handleCopilotFileRoute(apiRequest('files-other'),env),null);});
