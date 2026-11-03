import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';

test('the actual HTTP wake yields and checkpoints within the same invocation query budget as cron',async t=>{
 const f=await buyerJobsFixture(t),candidate={...f.candidate,people:['Alex Smith','Bo Svensson','Cecilia Berg','David Lind','Emma Wilson','Felix Turner','Grace Moore','Hugo Allen','Ida Jones','Jan Andersson'].map((name,i)=>({id:'buyer-'+i,name,title:'Head of Procurement',organization:'Forge Industries',identityStatus:'confirmed',publicNameUrl:'https://forge.example/team'}))},job=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate});
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Controlled provider unavailable; no outbound provider is used');});
 const prepare=f.DB.prepare.bind(f.DB);let used=0;f.DB.prepare=sql=>{used++;return prepare(sql);};const waits=[];
 const response=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate})}),f.env,{waitUntil:p=>waits.push(p)});
 assert.equal(response.status,200,await response.clone().text());await Promise.all(waits);
 assert.ok(used<=900,'HTTP wake must preserve database headroom; prepared '+used+' statements');const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.status,'queued');assert.ok(saved.revision>job.revision);assert.equal(saved.phase,'contacts');t.diagnostic('Prepared statements including authenticated start and worker: '+used);
});
