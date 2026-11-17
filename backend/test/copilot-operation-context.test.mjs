import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';
import {buildCopilotWorkspaceContext} from '../src/copilot-context.js';
import {copilotOperationContext} from '../src/copilot-operation-context.js';
import {runDeterministicDiagnostics} from '../src/copilot-diagnostics.js';
import {sanitizeClientScreenContext} from '../src/copilot-security.js';
import {runCopilotTurn} from '../src/copilot-service.js';

test('scoped operational outcomes reach the adviser without raw errors or foreign records',async t=>{
 const f=await buyerJobsFixture(t),id=crypto.randomUUID();
 const insert=(workspace,entity,meta)=>f.DB.raw.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),workspace,'operations.stage','journey',entity,JSON.stringify(meta));
 insert(workspaceId,id,{action:'buyers',stage:5,outcome:'failed',counts:{failed:1,raw:'PRIVATE_COUNTER'},error:'PRIVATE_PROVIDER_BODY',access_token:'NEVER_INCLUDE'});
 insert(foreignWorkspaceId,crypto.randomUUID(),{action:'delivery',stage:7,outcome:'failed',raw:'FOREIGN_RECORD'});
 const context=await buildCopilotWorkspaceContext(f.env,{workspaceId,currentScreen:{step:5,label:'Buyers',operations:[{action:'buyer_research',stage:5,phase:'provider',outcome:'timeout',operationId:'buyers-local',raw:'PRIVATE_BROWSER_ERROR'}]}});
 assert.equal(context.operations.stages.records.length,1);assert.equal(context.operations.stages.records[0].reference,id);assert.equal(context.screen.operations[0].outcome,'timeout');assert.doesNotMatch(JSON.stringify(context),/PRIVATE_|NEVER_INCLUDE|FOREIGN_RECORD/);
 const checks=runDeterministicDiagnostics(context);assert.ok(checks.some(d=>d.category==='execution'&&d.details.reference===id));
 let prompt,system;await runCopilotTurn({COPILOT_TEST_CONTEXT:context,COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{generate:async options=>{prompt=JSON.parse(options.prompt);system=options.system;return {text:JSON.stringify({answer:'The buyer operation failed; the cause is not established.'})};},search:async()=>({results:[]})}},{workspaceId,question:'Why did buyer research fail?'});
 assert.equal(prompt.workspace_context.operations.stages.records[0].reference,id);assert.match(system,/never infer a root cause from a failed phase alone/);
});
test('missing operational tables are unavailable rather than healthy; stale failure superseded by a completed outcome',async()=>{
 const context=await copilotOperationContext({DB:{prepare(){throw Error('No table with private details');}}},workspaceId);assert.equal(context.stages.available,false);assert.equal(context.research.available,false);assert.doesNotMatch(JSON.stringify(context),/private details/);
 const checks=runDeterministicDiagnostics({operations:{stages:{records:[{action:'buyers',outcome:'completed',reference:'new'},{action:'buyers',outcome:'failed',reference:'old'}]}}});assert.ok(!checks.some(d=>d.category==='execution'));
});
test('client controls and traces are bounded, redacted and never accept raw errors as diagnostics',()=>{
 const screen=sanitizeClientScreenContext({step:5,controls:{items:Array.from({length:50},()=>({label:'Send user@example.com password=hunter2',id:'send',disabled:true,body:'PRIVATE_BODY'})),omitted:4},operations:[{action:'buyer_research',phase:'provider',outcome:'timeout',operationId:'buyers-123',error:'PRIVATE_ERROR',token:'SECRET'},{action:'invented_action',phase:'provider'}]});
 assert.equal(screen.controls.items.length,40);assert.equal(screen.controls.omitted,4);assert.equal(screen.operations.length,1);assert.doesNotMatch(JSON.stringify(screen),/user@example|hunter2|PRIVATE_|SECRET/);assert.match(screen.controls.coverage,/Untrusted/);
});
