import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from '../backend/test/step5-journey-fixture.mjs';
import {paidCandidate} from '../backend/test/paid-candidate-fixture.mjs';
import {controlledLookup} from '../backend/test/paid-lookup-fixture.mjs';
import {upsertCrmIntelligence,getCrmCompany} from '../backend/src/crm.js';
import {ready,settleInitialSave} from './verify-step5-journey.mjs';
import '../customer/crm-engine.js';
const files=['customer/index.html','customer/discovery-ui.js','customer/discovery-engine.js','customer/buyer-research-jobs.js','customer/additional-contact-services.js','customer/additional-contact-policy.js','backend/src/buyer-paid-research.js','backend/src/buyer-research-store.js','backend/src/buyer-research-runner.js','backend/src/additional-contact-services.js','backend/src/treg-contact-research.js','scripts/verify-step5-paid-journey.mjs'];
async function hashes(){return Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex')])));}
export async function verifyPaidBuyerJourney({artifactDir='/tmp/leadintel-paid-browser',automaticLimit=1}={}){
 const before=await hashes(),candidate=paidCandidate(),calls=[],researchServices={},f=await journeyFixture({durableJobs:true,initialCandidate:candidate,researchServices});
 const context={workspaceId,userId:'storage-owner',role:'owner'},c=f.candidate;
 await upsertCrmIntelligence(f.env.DB,context,c.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by,automatic_buyer_limit) VALUES(?,1,1,'treg',10,100,4,'storage-owner',?)").run(workspaceId,automaticLimit);
 researchServices.paidLookup=await controlledLookup(f,calls);
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[],errors=[];let page;
 async function open(){const ctx=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(ctx);await ctx.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await ctx.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);return page;}
 try{
  await fs.mkdir(artifactDir,{recursive:true});await open();
  // Seed a server-owned, source-receipted free checkpoint. The existing free
  // research browser journey covers its construction; this journey exercises
  // the real Refresh command, paid continuation, close/reopen and CRM hydration.
  const response=await fetch(f.origin+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate:c,paidResearch:false})});assert.equal(response.status,200,await response.clone().text());const first=(await response.json()).job;
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='done',status='needs_review',result_json=? WHERE id=?").run(JSON.stringify(c),first.id);
  await page.locator('.selected-prospect-company [data-find-prospect-buyers]').click();
  await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='queued');
  const job=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs ORDER BY rowid DESC LIMIT 1').get();assert.equal(job.phase,'paid');assert.equal(JSON.parse(job.input_json).paidResearch.email,true);assert.equal(JSON.parse(job.input_json).paidResearch.phone,true);
  await contexts[0].close();
  // A buyer's enabled channels can span multiple query-budgeted invocations.
  // Drive the actual scheduler to its terminal checkpoint within the bounded
  // paid-phase allowance; a fixed number of ticks is not completion evidence.
  const slices=[];
  for(let pass=0;pass<18;pass++){
   const row=f.DB.raw.prepare('SELECT status,phase,revision FROM buyer_research_jobs WHERE id=?').get(job.id);
   if(!['queued','running'].includes(row.status))break;
   slices.push(...await f.runJobs(job.id));
  }
  const final=f.DB.raw.prepare('SELECT status,phase,result_json FROM buyer_research_jobs WHERE id=?').get(job.id),paid=JSON.parse(final.result_json).publicResearch?.paidResearch;
  assert.equal(final.phase,'done',JSON.stringify({status:final.status,phase:final.phase,paid}));assert.equal(paid?.status,'complete',JSON.stringify(paid));
  const detail=await getCrmCompany(f.env.DB,context,c.crmId);assert.equal(detail.contacts.filter(row=>row.email_status==='verified').length,automaticLimit);assert.equal(calls.filter(c=>c.url.includes('email.find')).length,automaticLimit);assert.equal(calls.filter(c=>c.url.includes('phone.find')).length,automaticLimit);
  assert.equal(new Set(calls.map(c=>c.key)).size,calls.length,'Settled provider phases are reused across saved slices');
  const charged=calls.length;await open();
  await page.waitForFunction(limit=>document.querySelectorAll('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li').length===limit,automaticLimit);
  for(const [i,p] of c.people.entries())assert.equal(await page.locator('[data-prospect-enrich-email][data-person-id="'+p.id+'"]').getAttribute('aria-pressed'),String(i<automaticLimit));
  assert.equal(calls.length,charged,'Read-only reopen must not run paid providers');
  await page.screenshot({path:path.join(artifactDir,'paid-primary-reopened.png'),fullPage:true});
  const outbound=f.calls.filter(c=>/send|enqueue|sequence/.test(c.path));assert.equal(outbound.length,0);assert.deepEqual(errors,[]);assert.deepEqual(await hashes(),before,'Source must remain frozen during browser acceptance');
  const evidence={controlledProviders:true,sourceSha256:before,confirmedEmails:automaticLimit,emailLookups:automaticLimit,phoneLookups:automaticLimit,manualOnlyBuyers:4-automaticLimit,scheduledSlices:slices.length,browserClosedDuringWork:true,freshReopen:true,readOnlyPaidReplays:calls.length-charged,outboundMessages:0,privateCustomerAcceptance:false};await fs.writeFile(path.join(artifactDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }finally{await Promise.allSettled(contexts.map(ctx=>ctx.close()));await browser.close();await f.close();}
}
