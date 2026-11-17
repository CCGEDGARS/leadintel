import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
import {controlledLookup} from './paid-lookup-fixture.mjs';
import {journeyFixture,loadPlaywright,sessionToken,workspaceId,sourceUrl} from './step5-journey-fixture.mjs';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js');
const completedChecks=p=>Object.fromEntries(Object.entries(p.contactResearch.checks).filter(([,check])=>check.status==='complete'));

test('HTTP and registered scheduler complete the visible four before hidden work and retain every receipt after browser reopen',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required by buyer evidence CI.');return;}
 const names=['Alex Smith','Blair Jones','Cameron West','Drew North','Evan Green','Frank White','Grace Hall','Harper South'],titles=['Chief Executive Officer','Chief Operating Officer','Head of Procurement','Operations Director','Procurement Manager','Global Project Manager','Planning Supervisor','Engineering Manager'],stamp=new Date().toISOString();
 const candidate={company:'Forge Industries',domain:'forge.example',buyerSearchMode:'user_selected_target',buyerRoles:titles,people:names.map((name,i)=>({id:'p'+i,name,publicName:name,title:titles[i],organization:'Forge Industries',publicNameUrl:sourceUrl,identityStatus:'confirmed',nameVerification:'confirmed',...(i>=4?{publicLinkedinUrl:'https://linkedin.com/in/person-'+i,linkedinConfirmedUrl:'https://linkedin.com/in/person-'+i,linkedinConfirmedAt:stamp,linkedinConfirmationMethod:'manual'}:{})}))};
 const body=candidate.people.map(p=>'### '+p.name+'\n'+p.title+'\nForge Industries').join('\n\n');
 const f=await journeyFixture({initialCandidate:candidate,externalFetch:async input=>new URL(typeof input==='string'?input:input.url).hostname==='forge.example'?new Response('<html><body>'+candidate.people.map(p=>'<h3>'+p.name+'</h3><p>'+p.title+'</p><p>Forge Industries</p>').join('')+'</body></html>',{headers:{'Content-Type':'text/html'}}):undefined});
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{
  const start=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate:f.candidate,force:true,paidResearch:false})});
  assert.equal(start.status,200,await start.clone().text());const id=(await start.json()).job.id;
  const row=()=>f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(id);
  const waiting=Date.now();while(row().lease_token){if(Date.now()-waiting>25000)throw Error('HTTP wake did not yield its processing lease');await new Promise(resolve=>setTimeout(resolve,30));}
  let now=Date.now(),blocked=false;const queries=[],noop=async()=>({completed:0});
  const services={search:async query=>{queries.push(query);if(!blocked&&query==='site:forge.example "Alex Smith"'){blocked=true;now+=50001;throw Object.assign(Error('Controlled hidden-source slice interruption'),{code:'TIME_BUDGET'});}return [];},read:async url=>({url,markdown:body,sourceRead:true,extractedAt:stamp,metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),review:async(_env,_workspace,input)=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:input.people.map(p=>p.id),findings:[]},conflicts:[]})};
  async function tick(){const pending=[];await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,jobId:id,maxJobs:1,windowMs:50000,clock:()=>now,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);}
  for(let i=0;i<10&&!blocked;i++)await tick();assert.equal(blocked,true,'The actual hidden-source interruption must occur');
  assert.equal(row().phase,'contacts');assert.equal(row().status,'queued');
  const partial=JSON.parse(row().result_json),receipts=new Map();
  assert.equal(partial.publicResearch.accountability.status,'partial');
  for(const id of ['p4','p5','p6','p7']){const p=partial.people.find(p=>p.id===id);for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(partial,p,key),true,id+' '+key);assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);assert.equal(p.contactResearch.checks.deep.status,'complete');receipts.set(id,completedChecks(p));}
  for(let i=0;i<10&&['queued','running'].includes(row().status);i++)await tick();assert.equal(row().phase,'done');
  const reopened=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId+'&job_id='+id,{headers:{Cookie:'leadintel_session='+sessionToken}});assert.equal(reopened.status,200);const job=(await reopened.json()).job;
  for(const [id,checks]of receipts)assert.deepEqual(completedChecks(job.candidate.people.find(p=>p.id===id)),checks,'scheduler continuation preserves original completed receipts');
  assert.equal(D.buyerResearchCoveragePassed(job.candidate),true);
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
   const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready);await page.locator('[data-workflow-stage="5"] strong').click();await page.locator('#step-5.active').waitFor();
   await page.waitForFunction(()=>{const c=discovery.selectedProspects.find(c=>c.domain==='forge.example');return ['p4','p5','p6','p7'].every(id=>c?.people.find(p=>p.id===id)?.contactResearch?.checks?.gmail?.status==='complete');});
   const cards=page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li');assert.equal(await cards.count(),4);
   for(const id of ['p4','p5','p6','p7']){const card=cards.filter({has:page.locator('[data-recheck-buyer][data-person-id="'+id+'"]')});for(const channel of ['company','phone','gmail'])assert.equal(await card.locator('[data-contact-channel="'+channel+'"]').getAttribute('data-contact-status'),'not_found',id+' '+channel+' reflects completed no-match checks');assert.equal(await card.locator('[data-keep-buyer]').isDisabled(),true,'completed research does not invent an email recipient');}
   assert.equal(await page.locator('.buyer-other-contacts').getAttribute('open'),null);assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);await context.close();
  }
  const saved=(await f.getState()).payload.discovery.selectedProspects.find(c=>c.domain==='forge.example');for(const [id,checks]of receipts)assert.deepEqual(completedChecks(saved.people.find(p=>p.id===id)),checks);
  for(const table of ['gmail_messages','crm_enrichment_requests','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);assert.deepEqual(errors,[]);assert.ok(f.DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='buyer_research'").get().n>=3);
  t.diagnostic(JSON.stringify({httpStart:true,registeredScheduler:true,visibleFourBeforeHiddenWork:true,threeGmailQueriesEach:true,receiptsPreserved:true,desktopAndMobileReopen:true,paidLookups:0,outboundMessages:0}));
 }finally{await browser.close();await f.close();}
});

function publicRoster({sameRole=false}={}){
 const names=['Alex Smith','Blair Jones','Cameron West','Drew North','Evan Green','Frank White','Grace Hall','Harper South'],roles=['Chief Executive Officer','Chief Operating Officer','Head of Procurement','Operations Director','Procurement Manager','Global Project Manager','Planning Supervisor','Engineering Manager'];
 return {company:'Forge Industries',domain:'forge.example',buyerSearchMode:'user_selected_target',buyerRoles:sameRole?['Procurement Director']:roles,people:names.map((name,i)=>({id:'p'+i,name,publicName:name,title:sameRole?'Procurement Director':roles[i],organization:'Forge Industries',publicNameUrl:sourceUrl,identityStatus:'confirmed',nameVerification:'confirmed'}))};
}
async function rosterJourney(candidate){
 const stamp=new Date().toISOString(),body=candidate.people.map(p=>'### '+p.name+'\n'+p.title+'\nForge Industries').join('\n\n');
 const f=await journeyFixture({initialCandidate:candidate,externalFetch:async input=>new URL(typeof input==='string'?input:input.url).hostname==='forge.example'?new Response('<html><body>'+candidate.people.map(p=>'<h3>'+p.name+'</h3><p>'+p.title+'</p><p>Forge Industries</p>').join('')+'</body></html>',{headers:{'Content-Type':'text/html'}}):undefined});
 const services={search:async()=>[],read:async url=>({url,markdown:body,sourceRead:true,extractedAt:stamp,metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),review:async(_env,_workspace,input)=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:input.people.map(p=>p.id),findings:[]},conflicts:[]})};
 const start=async()=>{const response=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate:f.candidate,force:true,paidResearch:false})});assert.equal(response.status,200,await response.clone().text());return (await response.json()).job.id;};
 const tick=async(id,options={})=>{const pending=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:options.clock?.()??Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,settings)=>runBuyerResearchJobs(env,{...settings,jobId:id,maxJobs:1,windowMs:50000,services,...options}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);};
 return {...f,services,stamp,start,tick,row:id=>f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(id)};
}

test('saved provider-only contacts retain free priority through authenticated force refresh and scheduler continuation',{timeout:120000},async t=>{
 const candidate=publicRoster({sameRole:true}),stamp=new Date().toISOString(),Crm=require('../../customer/crm-engine.js'),receipts=require('../../customer/test/helpers/buyer-research-receipts.cjs');
 Object.assign(candidate,{qualification:{eligible:true,companyScore:85,score:85,researchedAt:stamp},buyerDiscovery:{},publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',checkedPeople:8,totalPeople:8,completedAt:stamp}}});
 for(const p of candidate.people)p.emailResearch={status:'complete',checkedAt:stamp,searches:9,failed:0};receipts(candidate);
 const f=await rosterJourney(candidate);
 try{
  const context={workspaceId,userId:'storage-owner',role:'owner'},companyId=f.candidate.crmId;
  await upsertCrmIntelligence(f.env.DB,context,companyId,Crm.mapDiscoveryCandidateToCrm(f.candidate).intelligence);
  f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by,automatic_buyer_limit) VALUES(?,1,1,'treg',10,100,10,?,1)").run(workspaceId,'storage-owner');
  const calls=[],lookup=await controlledLookup(f,calls);
  for(const p of f.candidate.people.slice(4))await lookup(f.env,context,companyId,{person_id:p.id,provider:'treg',approved:true,email_lookup:true,data_lookup:true,phone_approved:true});
  const detail=await getCrmCompany(f.env.DB,context,companyId);assert.equal(detail.contacts.filter(p=>globalThis.LeadIntelContactPolicy.accepted(p,candidate.domain,'provider_verified')).length,4);
  const unchecked=structuredClone(f.candidate);unchecked.people[4].contactResearch.checks.gmail.status='partial';unchecked.people[4].emailResearch.status='partial';
  await upsertCrmIntelligence(f.env.DB,context,companyId,Crm.mapDiscoveryCandidateToCrm(unchecked).intelligence);
  await assert.rejects(lookup(f.env,context,companyId,{person_id:'p0',provider:'treg',automatic:true,email_lookup:true}),error=>error.code==='ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED','automatic paid dispatch must use the displayed CRM cohort');
  const id=await f.start();let now=Date.now(),blocked=false;
  f.services.search=async query=>{if(!blocked&&query==='site:forge.example "Alex Smith"'){blocked=true;now+=50001;throw Object.assign(Error('Controlled hidden-source interruption'),{code:'TIME_BUDGET'});}return [];};
  for(let i=0;i<10&&!blocked;i++)await f.tick(id,{clock:()=>now});assert.equal(blocked,true);
  const partial=JSON.parse(f.row(id).result_json),before=new Map();assert.equal(f.row(id).phase,'contacts');
  for(const id of ['p4','p5','p6','p7']){const p=partial.people.find(p=>p.id===id);assert.equal(p.contactResearch?.checks.gmail?.status,'complete',id+' gets actual free Gmail checks before hidden work');assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);assert.equal(p.contactResearch.checks.deep.status,'complete');before.set(id,completedChecks(p));}
  const response=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId+'&job_id='+id,{headers:{Cookie:'leadintel_session='+sessionToken}}),job=(await response.json()).job;
  assert.equal(job.quality.confirmedPriorityContacts,4);assert.equal(job.resumePhase,'contacts');assert.equal(job.crm.contacts.length,4,'free-only job observation carries the actual accepted CRM records');
  for(let i=0;i<10&&['queued','running'].includes(f.row(id).status);i++)await f.tick(id,{clock:()=>now});
  assert.equal(f.row(id).phase,'done','the injected scheduler clock must let hidden continuation settle before browser reopen');
  const final=JSON.parse(f.row(id).result_json);for(const [id,checks]of before)assert.deepEqual(completedChecks(final.people.find(p=>p.id===id)),checks);
  let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.diagnostic('Provider-only browser reopen unavailable; required in buyer evidence CI.');}
  if(chromium){
   const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
   try{
    const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
    const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready);await page.locator('[data-workflow-stage="5"] strong').click();await page.locator('#step-5.active').waitFor();
    await page.waitForFunction(()=>{const c=discovery.selectedProspects.find(c=>c.domain==='forge.example');return ['p4','p5','p6','p7'].every(id=>c?.people.find(p=>p.id===id)?.contactResearch?.checks?.gmail?.status==='complete');});
    const cards=page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li');await page.waitForFunction(()=>document.querySelectorAll('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li').length===4);
    for(const id of ['p4','p5','p6','p7']){const card=cards.filter({has:page.locator('[data-recheck-buyer][data-person-id="'+id+'"]')});assert.equal(await card.count(),1,id+' stays in the actual displayed CRM cohort');await page.waitForFunction(id=>{const b=document.querySelector('[data-keep-buyer][data-person-id=\"'+id+'\"]');return b&&!b.disabled;},id).catch(error=>{throw Error(id+' Proceed did not settle: '+error.message);});assert.equal(await card.locator('[data-keep-buyer]').isDisabled(),false);}
    await context.close();
   }finally{await browser.close();}
  }
  // Reproduce a retained pre-fix completed job whose CRM-only visible cohort
  // lacks deeper receipts. Observation and explicit Resume must agree.
  for(const p of final.people.filter(p=>before.has(p.id)))p.contactResearch.checks.deep={status:'not_needed',checkedAt:stamp};
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',result_json=? WHERE id=?").run(JSON.stringify(final),id);
  const observed=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId+'&job_id='+id,{headers:{Cookie:'leadintel_session='+sessionToken}}),retained=(await observed.json()).job;
  assert.equal(retained.progress.stages.contacts,false);assert.equal(retained.quality.researchPassed,false);assert.equal(retained.resumePhase,'contacts');
  const resume=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({action:'resume',jobId:id,expectedRevision:retained.revision})});assert.equal(resume.status,200);assert.equal((await resume.json()).job.phase,'contacts');
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,4,'free refresh adds no paid dispatch');
 }finally{await f.close();}
});

test('scheduler continues final visible-cohort deep checks discovered during core source research',{timeout:120000},async()=>{
 const f=await rosterJourney(publicRoster()),phoneUrl='https://forge.example/contact-staff';
 try{
  const phoneBody=f.candidate.people.slice(4).map(p=>'### '+p.name+'\n'+p.title+'\nPhone: +46 70 123 45 67\nForge Industries').join('\n\n'),baseRead=f.services.read;
  f.services.search=async query=>query==='site:forge.example "Evan Green"'?[{url:phoneUrl,title:'Named staff contacts',description:'Evan Green Frank White Grace Hall Harper South'}]:[];
  f.services.read=async url=>url===phoneUrl?{url,markdown:phoneBody,sourceRead:true,extractedAt:f.stamp,metadata:{sourceURL:url}}:baseRead(url);
  const id=await f.start();for(let i=0;i<10&&['queued','running'].includes(f.row(id).status);i++)await f.tick(id);
  const final=JSON.parse(f.row(id).result_json);assert.equal(f.row(id).phase,'done');
  assert.deepEqual(D.confirmedBuyerShortlist(final.people,{decisionMakers:final.buyerRoles},final).priorityIds,['p4','p5','p7','p6']);
  assert.equal(D.buyerResearchCoveragePassed(final),true,'the worker cannot settle with complete accountability and missing final-cohort deep receipts');
  for(const id of ['p4','p5','p6','p7'])assert.equal(final.people.find(p=>p.id===id).contactResearch.checks.deep.status,'complete');
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);
 }finally{await f.close();}
});
