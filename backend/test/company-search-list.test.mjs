import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';
import {handleCompanyListsRoute} from '../src/company-lists.js';
import {sha256} from '../src/security.js';
const M=globalThis.LeadIntelCompanyLists;
async function input(){const snapshot=M.normalizeSearchSnapshot({rows:Array.from({length:31},(_,i)=>({company:'Company '+i,website:'https://company'+i+'.example/',score:i?85-i:null,scoreState:i%2?'current':'previous',reviewStatus:'Needs review',evidence:[{url:'https://company'+i+'.example/news',quote:'Source evidence '+i}]})),context:{markets:['Sweden']}});return {action:'snapshot',name:'Saved companies',snapshot,fingerprint:await sha256(JSON.stringify(snapshot))};}
async function route(f,body,role='owner',params={}){const waits=[];const response=await handleCompanyListsRoute(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users[role].token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{}, {waitUntil:p=>waits.push(p)});assert.equal(waits.length,0,'saving a copy cannot start research');return response;}
test('saved search HTTP/SQL lifecycle: full copy, retry, read, export, isolation, no qualification or CRM side effects, deletion and quota release',async t=>{
 const f=await buyerJobsFixture(t),body=await input();
 for(const role of ['viewer','foreign'])assert.equal((await route(f,body,role)).status,403);
 const response=await route(f,body);assert.equal(response.status,200);const list=(await response.json()).list;assert.equal(list.results.length,31);assert.equal(list.criteria.kind,'search_snapshot');assert.equal(list.saved,false);
 const expectedScores=[...Array.from({length:30},(_,i)=>84-i),null];
 assert.deepEqual(list.results.map(r=>r.score),expectedScores);assert.equal(list.criteria.fingerprint,body.fingerprint);
 assert.equal((await (await route(f,body)).json()).list.id,list.id);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,1);
 const reopened=(await (await route(f,null,'owner',{search_snapshot:body.fingerprint})).json()).list;
 assert.equal(reopened.id,list.id);assert.deepEqual(reopened.results.map(r=>r.score),expectedScores);
 assert.equal((await (await route(f,null,'foreign',{workspace_id:foreignWorkspaceId,id:list.id})).json()).list,null);
 const bytes=f.DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;assert.ok(bytes>JSON.stringify(body.snapshot).length);
 for(const action of ['save','buyer','pause','resume'])assert.equal((await route(f,{action,id:list.id,revision:list.revision})).status,400);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM crm_companies').get().n,0);assert.match(M.csv(list),/Source evidence 30/);
 assert.equal((await route(f,{action:'delete',id:list.id,revision:0})).status,409);
 assert.equal((await route(f,{action:'delete',id:list.id,revision:list.revision})).status,200);
 assert.equal((await (await route(f,null,'owner',{search_snapshot:body.fingerprint})).json()).list,null);
 assert.ok(f.DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes<bytes);
});
test('quota failures, invalid fingerprints and full list library never acknowledge a saved export',async t=>{
 const f=await buyerJobsFixture(t),body=await input();assert.equal((await route(f,{...body,fingerprint:'changed'})).status,409);
 f.DB.raw.exec("CREATE TRIGGER snapshot_full BEFORE INSERT ON company_lists BEGIN SELECT RAISE(ABORT,'WORKSPACE_STORAGE_FULL'); END");
 const response=await route(f,body);assert.ok(response.status>=400);assert.equal((await response.json()).list,undefined);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,0);f.DB.raw.exec('DROP TRIGGER snapshot_full');
 for(let i=0;i<50;i++){const next=await input();next.snapshot.rows[0].company='Batch '+i;next.fingerprint=await sha256(JSON.stringify(next.snapshot));assert.equal((await route(f,next)).status,200);}
 assert.equal((await route(f,body)).status,409);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,50);
});
