import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
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
