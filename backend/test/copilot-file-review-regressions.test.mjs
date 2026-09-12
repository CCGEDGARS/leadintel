import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,canonical,analysisRequest} from './helpers/copilot-file-ai.mjs';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';

const reload=(env,id)=>handleCopilotFileRoute(new Request(`https://test/api/copilot/file-analyses/${id}?workspace_id=w1`,{headers:{Cookie:'leadintel_session=good'}}),env);
const resultFor=(title,locator='page:1')=>{const result=canonical();result.title=title;result.sections[0].evidence=[{locator,label:locator}];return result;};
const responseFor=result=>new Response(JSON.stringify({output_text:JSON.stringify(result),usage:{input_tokens:10,output_tokens:20}}),{headers:{'Content-Type':'application/json'}});
function manyBlocks(count=1000,textLength=190){
  const blocks=Array.from({length:count},(_,index)=>({locator:`page:${index+1}`,text:'Useful '+ 'x'.repeat(textLength-7)}));
  return {format:'pdf',title:'Report',blocks,evidenceIndex:Object.fromEntries(blocks.map(block=>[block.locator,'Source'])),warnings:[],coverage:{complete:true,omitted:[]},counts:{characters:count*textLength,nonEmptyCells:0,csvRows:0}};
}

test('supported 196k extraction completes with bounded warnings and exact source coverage survives reload separately',async()=>{
  const document=manyBlocks();const {env,file,calls}=await fixture({document});
  assert.ok(file,'fixture upload must satisfy the real upload contract');
  const response=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);
  assert.equal(response.status,201);const {analysis}=await response.json();
  assert.equal(calls.length,1);assert.ok(JSON.stringify(analysis.result).length<=30000);
  assert.ok(analysis.result.warnings.join('').length<=2048);
  assert.ok(analysis.result.warnings.some(warning=>/omitt|coverage/i.test(warning)));
  const sent=JSON.parse(calls[0].body.input).untrusted_document_data;
  assert.ok(sent.coverage.omitted.length>500);
  assert.deepEqual(analysis.source_coverage,{warnings:sent.warnings,coverage:sent.coverage});
  assert.equal(Object.hasOwn(analysis.result,'source_coverage'),false);
  assert.deepEqual(JSON.parse(env.DB.sqlite.prepare('SELECT source_coverage_json FROM copilot_file_analyses').get().source_coverage_json),analysis.source_coverage);
  assert.deepEqual((await (await reload(env,analysis.id)).json()).analysis.source_coverage,analysis.source_coverage);
});

test('make that shorter retains prior cited ZEBRA page 100 under bounded follow-up selection',async()=>{
  const document=manyBlocks(100,1800);document.blocks[99].text='ZEBRA revenue '+ 'z'.repeat(1786);document.counts.characters=document.blocks.reduce((sum,block)=>sum+block.text.length,0);
  const {env,file,calls}=await fixture({document,outputs:[resultFor('ZEBRA report','page:100'),resultFor('Short ZEBRA report','page:100')]});
  const initial=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Analyze ZEBRA revenue'}}),env);assert.equal(initial.status,201);const {analysis}=await initial.json();
  const followup=await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'make that shorter'}}),env);
  assert.equal(followup.status,200);assert.equal(calls.length,2);
  const prompt=JSON.parse(calls[1].body.input);assert.equal(prompt.user_request,'make that shorter');
  assert.equal(prompt.original_request,'Analyze ZEBRA revenue');
  assert.equal(prompt.untrusted_document_data.blocks[0].locator,'page:100');
  assert.match(prompt.untrusted_document_data.blocks[0].text,/ZEBRA/);
  assert.ok(JSON.stringify(prompt.untrusted_document_data.blocks).length<=60000);
  assert.equal((await followup.json()).analysis.result.sections[0].evidence[0].locator,'page:100');
});

test('overlapping follow-ups reject stale completion without losing the newer result or storing a stale message pair',async()=>{
  let enterSlow,releaseSlow;const slowStarted=new Promise(resolve=>enterSlow=resolve);
  const {env,file}=await fixture({outputs:[canonical(),()=>{enterSlow();return new Promise(resolve=>releaseSlow=()=>resolve(responseFor(resultFor('Stale result'))));},resultFor('Newer result')]});
  const initial=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);const {analysis}=await initial.json();
  const slow=handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Slow request'}}),env);await slowStarted;
  const fast=await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Newer request'}}),env);assert.equal(fast.status,200);
  releaseSlow();const stale=await slow;assert.equal(stale.status,409);assert.match((await stale.json()).error,/changed|retry|stale/i);
  const loaded=(await (await reload(env,analysis.id)).json()).analysis;
  assert.equal(loaded.result.title,'Newer result');assert.equal(loaded.messages.length,2);
  assert.equal(loaded.messages[0].content,'Newer request');assert.equal(JSON.parse(loaded.messages[1].content).title,'Newer result');
});

test('a same-result concurrent follow-up still advances the revision and fences an earlier stale generation',async()=>{
  let enterSlow,releaseSlow;const slowStarted=new Promise(resolve=>enterSlow=resolve);
  const {env,file}=await fixture({outputs:[canonical(),()=>{enterSlow();return new Promise(resolve=>releaseSlow=()=>resolve(responseFor(resultFor('Stale result'))));},canonical()]});
  const initial=await handleCopilotFileRoute(analysisRequest('file-analyses',{body:{file_id:file.id,request:'Summarize'}}),env);const {analysis}=await initial.json();
  const slow=handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Slow request'}}),env);await slowStarted;
  assert.equal((await handleCopilotFileRoute(analysisRequest(`file-analyses/${analysis.id}/messages`,{body:{message:'Repeat unchanged'}}),env)).status,200);
  releaseSlow();assert.equal((await slow).status,409);
  const loaded=(await (await reload(env,analysis.id)).json()).analysis;assert.equal(loaded.result.title,'Review');assert.equal(loaded.messages.length,2);
});
