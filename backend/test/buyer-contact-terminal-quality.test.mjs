import test from 'node:test';import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import app from '../src/app.js';

test('a review completion budget yield finalizes a passing job without replaying review',async t=>{
 const f=await buyerJobsFixture(t),D=globalThis.LeadIntelDiscovery,titles=['CEO','COO','Procurement Director','Plant Manager'],names=['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'],stamp=new Date().toISOString();
 const candidate={company:'Forge Industries',domain:'forge.example',buyerRoles:titles,qualification:{eligible:true,companyScore:85,score:85,researchedAt:stamp},people:names.map((name,i)=>({id:'buyer-'+i,name,publicName:name,title:titles[i],organization:'Forge Industries',publicNameUrl:'https://forge.example/team',identityStatus:'confirmed',nameVerification:'confirmed'})),evidence:[{url:'https://forge.example/team',text:'Forge Industries launched the industrial automation programme.',sourceRead:true,extractedAt:stamp}]};
 const text=candidate.people.map(p=>`### ${p.name}\n${p.title}\n[${p.name.toLowerCase().replace(' ','.')}@forge.example](mailto:${p.name.toLowerCase().replace(' ','.')}@forge.example)\nForge Industries\n${p.name} leads the industrial automation programme.`).join('\n\n');
 let reviews=0,runtime;
 const services={search:async()=>[],read:async url=>({url,markdown:text,metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),review:async()=>{reviews++;return {provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:candidate.people.map(p=>p.id),findings:[]},conflicts:[]};}};
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate});
 const tick=async()=>{const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async(env,options)=>{runtime=env;return runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:job.id,services});},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);};
 let row;for(let i=0;i<20;i++){row=await readBuyerJob(f.env,workspaceId,{id:job.id});if(row.phase==='review')break;await tick();}
 assert.equal(row.phase,'review');
 const safe=D.safeBuyerAiReview,mocked=t.mock.method(D,'safeBuyerAiReview',(...args)=>{const value=safe(...args);runtime.bookInvocationBudget.used=600;return value;});
 await tick();mocked.mock.restore();row=await readBuyerJob(f.env,workspaceId,{id:job.id});
 const c=JSON.parse(row.result_json);assert.equal(D.buyerQualityAssessment(c,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(c,p)}).passed,true,'All actual qualification/contact/review gates passed before the checkpoint yield');
 if(row.status==='queued'){await tick();row=await readBuyerJob(f.env,workspaceId,{id:job.id});}
 assert.equal(row.status,'complete','A final checkpoint yield cannot permanently turn a fully passing job into needs_review');assert.equal(row.phase,'done');assert.equal(reviews,1,'Finalization must reuse the completed AI review');
});
