import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob,publicBuyerJob} from '../src/buyer-research-store.js';

// 22 Nov live: a person saved before f5036bf8 with the description of a publication as the job title stayed on
// the Buyers step, because the saved result of the job still held the person and the page takes people from the
// job view. The view no longer hands such a person out; the saved result itself is not rewritten.
test('the job view leaves out a saved person whose job title is the description of a publication',async t=>{
  const f=await buyerJobsFixture(t),row=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),input=JSON.parse(row.input_json);
  const real=input.candidate.people[0],junk={...real,id:'public-x',name:'Mette Krog',publicName:'Mette Krog',title:'LinkedIn post about production leadership',publicNameUrl:'https://dk.linkedin.com/posts/mette-krog-1a2b3c_x-activity-1'};
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',result_json=? WHERE id=?").run(JSON.stringify({...input.candidate,people:[junk,real]}),row.id);
  const saved=await readBuyerJob(f.env,workspaceId,{id:row.id}),view=await publicBuyerJob(f.env,saved);
  assert.deepEqual(view.candidate.people.map(person=>person.title),[real.title]);
  assert.equal(JSON.parse(saved.result_json).people.length,2,'The saved result is not rewritten by reading it');
});
