import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob,publicBuyerJob} from '../src/buyer-research-store.js';
import {putCustomerState} from '../src/customer-state.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import '../../customer/discovery-engine.js';
import '../../customer/company-dossier.js';
const D=globalThis.LeadIntelDiscovery,C=globalThis.LeadIntelCompanyDossier;
const variants=[
 {company:'Forge Industries',domain:'forge.example',offer:'industrial automation',industry:'manufacturing',programme:'supplier automation programme',supportedOpportunity:true,names:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind']},
 {company:'Harbor Clinics',domain:'harbor.example',offer:'clinical staff training',industry:'healthcare',programme:'clinical training programme',supportedOpportunity:false,names:['Emma Wilson','Felix Turner','Grace Moore','Hugo Allen']}
];
const now=()=>new Date().toISOString();
function scenario(config){
 const titles=['CEO','COO','Procurement Director',config.industry==='healthcare'?'Operations Director':'Plant Manager'],url=`https://${config.domain}/team`;
 const people=config.names.map((name,i)=>({id:'buyer-'+i,name,publicName:name,title:titles[i],organization:config.company,publicNameUrl:url,identitySource:'public',identityStatus:'confirmed'}));
 const email=i=>config.names[i].toLowerCase().replace(' ','.')+'@'+config.domain;
 const blocks=people.map((p,i)=>`### ${p.name}\n${p.title}\nPhone: +46 70 123 45 ${60+i}\n${[0,2].includes(i)?email(i)+'\n':''}${config.supportedOpportunity?p.name+' leads the '+config.programme+'.\n':''}`);
 const text=`# ${config.company}\n${config.company} operates in ${config.industry}.\n${config.company} launched the ${config.programme}.\n\n${blocks.join('\n')}`;
 const candidate={company:config.company,domain:config.domain,website:`https://${config.domain}/`,buyerRoles:titles,buyerSearchMode:'user_selected_target',market:'Sweden',people};
 const profile={priorityOffers:config.offer,idealCustomer:config.industry,targetMarkets:'Sweden',decisionMakers:titles.join('; '),website:'https://seller.example/'};
 const counters={queries:[],reads:[],dossier:0,review:0,independent:0};
 const search=async query=>{counters.queries.push(query);return Object.assign([{url,title:config.company+' leadership and contacts',description:blocks.join('\n'),buyerSource:'official'}],{searchProviders:['controlled-grounded'],researchTrace:[{provider:'grounded',status:'succeeded',operation:'search',results:1}]});};
 const read=async target=>{counters.reads.push(target);return {url:target,markdown:text,links:[],metadata:{sourceURL:target,source:'direct-fallback'},researchTrace:[{provider:'direct',status:'succeeded',operation:'extract',results:1}]};};
 const dossier=async(_env,_workspace,body)=>{
  counters.dossier++;const plan=C.researchPlan(body),stamp=now();
  const validated=provider=>C.validatePass({provider,webSearch:true,people:people.map((p,i)=>({name:p.name,title:p.title,sourceUrl:url,quote:`${p.name} ${p.title}`,status:'current'})),facts:[{kind:'project',text:config.company+' launched the '+config.programme+'.',sourceUrl:url,quote:config.company+' launched the '+config.programme+'.'}],channels:[],gaps:[]},[{url,text}],body);
  // The controlled providers return actual source passages, and every family
  // bears its own executed query receipt under the real dossier plan.
  const passes=['openai','gemini'].map(provider=>({...validated(provider),planSignature:plan.signature,searchFamilies:plan.families.map(f=>({name:f.name,kind:f.kind,query:f.kind==='formula'?`Controlled independent search\nSearch formula: ${f.formula}\nReturn sources`:f.kind==='contacts'?'CONTACT ROUTES '+config.company:'CURRENT LEADERSHIP AND PROJECT DOSSIER '+config.company,status:'complete',attempts:1,completedAt:stamp,results:[{url}]})),sourceReads:[{url,status:'succeeded',checkedAt:stamp,researchTrace:[{provider:'direct',status:'succeeded',operation:'extract',results:1}]}],extractedSources:[url]}));
  const result=C.reconcile(passes,body);assert.equal(result.status,'complete',JSON.stringify(result));assert.equal(C.coverageComplete(result,body),true);assert.equal(result.people.length,4);return result;
 };
 const services={search,read,dossier,independent:async()=>{counters.independent++;return {status:'complete',results:[{url,title:config.company,description:text}],web_search:true};},review:async(_env,_workspace,body)=>{counters.review++;return {provider:'controlled-supervisor',supervisor:{status:'complete',reviewedPersonIds:body.people.map(p=>p.id),findings:[]},summary:'Reviewed supplied source evidence',conflicts:[]};}};
 return {candidate,profile,counters,services,email,url};
}
async function startScenario(f,s,options={}){
 const version=f.DB.raw.prepare('SELECT version FROM customer_workspace_state WHERE workspace_id=?').get(workspaceId).version;
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:version,payload:{...f.payload,main:{...f.payload.main,profile:{...s.profile,exclusions:''},website:s.profile.website,answers:{...(f.payload.main.answers||{}),priority_offers:s.profile.priorityOffers,ideal_customer:s.profile.idealCustomer,buyer_roles:s.profile.decisionMakers,exclusions:s.profile.exclusions||''}},discovery:{selectedProspects:[s.candidate]}}});
 return startBuyerJob(f.env,workspaceId,f.users.owner,{action:'start',candidate:s.candidate,profile:s.profile,...options});
}
async function phase(f,job,services,options={}){
 const result=await runBuyerResearchJobs(f.env,{jobId:job.id,maxJobs:1,windowMs:2000,services,...options});
 assert.equal(result.length,1);return readBuyerJob(f.env,workspaceId,{id:job.id});
}
async function terminal(f,job,services){
 const phases=[];for(let pass=0;pass<30;pass++){
  const row=await readBuyerJob(f.env,workspaceId,{id:job.id});if(!['queued','running'].includes(row.status))return {row,phases};
  phases.push(row.phase);await phase(f,job,services);
 }
 assert.fail('Durable research did not reach a terminal state within 30 bounded slices');
}
for(const config of variants)test(`durable phase journey uses real source and qualification policies for ${config.industry}`,async t=>{
 const f=await buyerJobsFixture(t),s=scenario(config),job=await startScenario(f,s);
 const {row,phases}=await terminal(f,job,s.services),candidate=JSON.parse(row.result_json),quality=D.buyerQualityAssessment(candidate,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)});
 assert.deepEqual([...new Set(phases)],['official','dossier','identities','contacts','review']);assert.equal(row.phase,'done');assert.ok(['complete','needs_review'].includes(row.status));
 t.diagnostic(JSON.stringify({industry:config.industry,status:row.status,researchPassed:quality.researchPassed,aiReviewStatus:quality.aiReviewStatus,priorityCount:quality.priorityCount,confirmedPriorityEmails:quality.confirmedPriorityEmails,gaps:quality.gaps,agentStatus:candidate.publicResearch.buyerAgent?.status}));
 assert.equal(s.counters.dossier,1);assert.equal(s.counters.review,1);assert.equal(quality.priorityCount,4,JSON.stringify({quality,people:candidate.people}));assert.equal(quality.confirmedPriorityEmails,2,JSON.stringify({quality,people:candidate.people}));
 assert.equal(candidate.people.filter(p=>D.qualifyBuyer(p,{decisionMakers:s.candidate.buyerRoles},candidate).eligible).length,4);
 assert.equal(quality.researchPassed,true);assert.equal(quality.aiReviewStatus,'complete');assert.equal(row.status,config.supportedOpportunity?'complete':'needs_review',JSON.stringify(quality));assert.equal(quality.passed,config.supportedOpportunity);if(!config.supportedOpportunity)assert.ok(quality.gaps.some(gap=>/Buyer Agent: needs review/.test(gap)));assert.ok(!quality.gaps.some(gap=>/evidence changed/.test(gap)));for(const person of candidate.people)for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(candidate,person,key),true,person.name+' '+key);assert.ok(candidate.people.every(p=>p.contactResearch?.checks?.gmail?.queryLog?.length===3));
 const byId=new Map(candidate.people.map(p=>[p.name,p]));assert.equal(D.acceptedOfficialBuyerEmail(candidate,byId.get(config.names[0])),s.email(0));assert.equal(D.acceptedOfficialBuyerEmail(candidate,byId.get(config.names[2])),s.email(2));
 assert.ok(candidate.people.some(p=>D.confirmedBuyerPhone(candidate,p)),JSON.stringify(candidate.people.map(p=>({name:p.name,phone:p.publicPhone,url:p.publicPhoneUrl,evidence:p.publicPhoneEvidence,check:p.publicPhoneSourceCheck}))));assert.ok(s.counters.queries.length>=36);assert.ok(s.counters.reads.length>=1);assert.ok(s.counters.independent>=2);
 for(const provider of ['apollo','hunter'])assert.equal(candidate.publicResearch.accountability.tools.find(row=>row.provider===provider)?.attempted,0,'Public job cannot execute '+provider+' contact actions');
 const before=f.DB.raw.prepare('SELECT total_changes() n').get().n,view=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{domain:config.domain}));assert.equal(view.status,row.status);assert.equal(view.candidate.people.length,4);assert.equal(view.quality.confirmedPriorityEmails,2);assert.equal(view.quality.passed,config.supportedOpportunity);if(!config.supportedOpportunity)assert.match(view.progress.label,/Buyer Agent: needs review/);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);
 assert.equal(await runBuyerResearchJobs(f.env,{jobId:job.id,maxJobs:1,windowMs:100,services:{search:()=>assert.fail('Terminal jobs cannot start another query')}}).then(rows=>rows.length),0);
});

test('official accepted named channels survive a later dossier failure and reopening uses saved task receipts',async t=>{
 const f=await buyerJobsFixture(t),s=scenario(variants[0]),job=await startScenario(f,s);
 let row=await phase(f,job,s.services),official=JSON.parse(row.result_json);assert.equal(row.phase,'dossier');assert.equal(official.people.filter(p=>D.acceptedOfficialBuyerEmail(official,p)).length,2);assert.ok(official.people.some(p=>D.confirmedBuyerPhone(official,p)),JSON.stringify(official.people.map(p=>({name:p.name,phone:p.publicPhone,url:p.publicPhoneUrl,evidence:p.publicPhoneEvidence,check:p.publicPhoneSourceCheck}))));
 const savedTasks=f.DB.raw.prepare("SELECT task_key,result_json,attempts FROM buyer_research_tasks WHERE job_id=? AND status='complete' ORDER BY task_key").all(job.id),queries=s.counters.queries.slice(),reads=s.counters.reads.slice();
 assert.ok(savedTasks.length>=7);const services={...s.services,dossier:async()=>{throw Error('Controlled independent dossier outage');}};
 row=await phase(f,job,services);assert.equal(row.phase,'identities');assert.equal(row.status,'queued');assert.equal(JSON.parse(row.result_json).people.filter(p=>D.acceptedOfficialBuyerEmail(JSON.parse(row.result_json),p)).length,2);
 const reopened=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{domain:s.candidate.domain}));assert.equal(reopened.id,job.id);assert.equal(reopened.candidate.people.length,4);
 const end=await terminal(f,job,services),candidate=JSON.parse(end.row.result_json);assert.equal(end.row.status,'needs_review');assert.equal(end.row.phase,'done');assert.equal(D.buyerQualityAssessment(candidate,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)}).confirmedPriorityEmails,2);
 for(const task of savedTasks){const after=f.DB.raw.prepare('SELECT result_json,attempts FROM buyer_research_tasks WHERE job_id=? AND task_key=?').get(job.id,task.task_key);assert.equal(after.result_json,task.result_json);assert.equal(after.attempts,task.attempts);}
 for(const query of queries)assert.equal(s.counters.queries.filter(q=>q===query).length,1);for(const url of reads)assert.equal(s.counters.reads.filter(u=>u===url).length,1);
 assert.ok(JSON.parse(end.row.diagnostic_json).some(d=>d.phase==='dossier'));
});

test('a selected buyer job keeps broad company inventory while executing only the selected person checks',async t=>{
 const f=await buyerJobsFixture(t),s=scenario(variants[0]),selected=s.candidate.people[2],job=await startScenario(f,s,{personIds:[selected.id]});
 assert.deepEqual(JSON.parse(job.result_json).people.map(p=>p.id),[selected.id]);
 let finished,contactsQueries=[];
 for(let pass=0;pass<30;pass++){
  const before=await readBuyerJob(f.env,workspaceId,{id:job.id});
  if(!['queued','running'].includes(before.status)){finished=before;break;}
  const queryCount=s.counters.queries.length,taskCount=f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n;
  const after=await phase(f,job,s.services),candidate=JSON.parse(after.result_json);
  assert.deepEqual(candidate.people.map(p=>p.id),[selected.id],before.phase+' must preserve the selected identity scope');
  if(before.phase==='identities'){
   assert.equal(s.counters.queries.length,queryCount,'A person Recheck cannot run broad identity queries');
   assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n,taskCount);
  }
  if(before.phase==='contacts')contactsQueries.push(...s.counters.queries.slice(queryCount));
 }
 assert.ok(finished,'Selected research must reach a terminal state within its bounded slices');assert.equal(finished.status,'complete');assert.equal(finished.phase,'done');
 const candidate=JSON.parse(finished.result_json),person=candidate.people[0],quality=D.buyerQualityAssessment(candidate,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)});
 assert.equal(quality.researchPassed,true);assert.equal(quality.aiReviewStatus,'complete');assert.equal(quality.passed,false);assert.equal(quality.requirements.find(r=>r.id==='four_buyers').passed,false);
 assert.equal(candidate.publicResearch.researchScope,'selected_buyers');assert.deepEqual(candidate.publicResearch.researchedPersonIds,[selected.id]);assert.deepEqual(candidate.publicResearch.aiReview.reviewedPersonIds,[selected.id]);assert.deepEqual(candidate.publicResearch.buyerAgent.people.map(p=>p.personId),[selected.id]);
 const inventoryNames=new Set(candidate.buyerDiscovery.companyContacts.map(p=>p.name));assert.ok(inventoryNames.size>=4,'Read company contact inventory can retain other source-backed staff');for(const sourcePerson of s.candidate.people)assert.ok(inventoryNames.has(sourcePerson.name));
 for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(candidate,person,key),true,key+' must have real successful selected-person receipts');
 const gmail=person.contactResearch.checks.gmail.queryLog;assert.equal(gmail.length,3);assert.ok(gmail.every(receipt=>receipt.status==='complete'&&contactsQueries.includes(receipt.query)));
 assert.ok(contactsQueries.length>=9);assert.ok(contactsQueries.every(query=>query.includes(selected.name)));for(const other of s.candidate.people.filter(p=>p.id!==selected.id))assert.ok(contactsQueries.every(query=>!query.includes(other.name)),'No mandatory contact query belongs to '+other.name);
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,person),s.email(2));assert.ok(D.confirmedBuyerPhone(candidate,person));
 const view=await publicBuyerJob(f.env,finished);assert.equal(view.status,'complete');assert.equal(view.input.scope,'selected_buyers');assert.deepEqual(view.input.personIds,[selected.id]);assert.equal(view.quality.passed,false);assert.equal(view.quality.requirements.find(r=>r.id==='four_buyers').passed,false);
});
