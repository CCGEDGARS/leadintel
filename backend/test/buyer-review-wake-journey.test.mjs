import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken,sourceText,sourceUrl} from './step5-journey-fixture.mjs';
import {ready,settleInitialSave} from '../../scripts/verify-step5-journey.mjs';
import {startBuyerJob} from '../src/buyer-research-store.js';import {sha256} from '../src/security.js';import {importAesKey,encryptSecret} from '../src/oauth.js';
import app from '../src/app.js';import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
test('a resumed final-stage job restores queued coverage and finishes native AI review after browser reopen',{timeout:90000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable; mandatory in Customer CI.');return;}
 const dir='/tmp/leadintel-buyer-review-wake';await fs.mkdir(dir,{recursive:true});let reviews=0;const f=await journeyFixture({durableJobs:true,externalFetch:async(input,options)=>{if(new URL(typeof input==='string'?input:input.url).hostname==='api.openai.com'){if(!String(options?.body).includes('Review only the supplied public evidence for identity'))return Response.json({error:{message:'Unrelated AI request deliberately unavailable in this fixture'}},{status:503});reviews++;return Response.json({output_text:JSON.stringify({reviewed_person_ids:['robert','alice'],findings:[],conflicts:[],summary:'Saved staff source reviewed.'}),usage:{}});}}});
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let context,page;const errors=[];
 const open=async()=>{context=await browser.newContext({viewport:{width:1440,height:1050}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);await page.evaluate(()=>showDiscoveryStep('buyers'));};
 try{
  const job=await startBuyerJob(f.env,workspaceId,{id:'storage-owner',role:'owner',sessionTokenHash:await sha256(sessionToken)},{candidate:f.candidate});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review',status='needs_review',input_json=json_set(input_json,'$.apolloIdentityVersion',1),diagnostic_json='[{\"code\":\"run_window\",\"phase\":\"review\"}]' WHERE id=?").run(job.id);
  const source={url:sourceUrl,markdown:sourceText,sourceRead:true,extractedAt:new Date().toISOString()};f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'retained-source','read','official',?,'complete',1,?)").run(job.id,sourceUrl,JSON.stringify(source));for(let i=0;i<128;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,?,'search','contacts',?,'complete',1,'{\"rows\":[]}')").run(job.id,'retained-'+i,'Retained query '+i);
  const receipts=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id);f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,24).toString('base64');f.DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,'openai',?,'test','gpt-6.1-sol',1)").run(workspaceId,await encryptSecret('controlled-review-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)));
  await open();const button=page.locator('.selected-prospect-company [data-find-prospect-buyers]');await page.waitForFunction(()=>document.querySelector('.selected-prospect-company [data-find-prospect-buyers]')?.textContent==='Resume buyer research');await button.click();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='queued');
  const checkQueued=async()=>{const panel=page.locator('.buyer-research-progress');assert.match(await panel.textContent(),/Research queued/);assert.match(await panel.textContent(),/1 of 5 stages verified/);assert.match(await panel.textContent(),/Next: Review evidence/);assert.match(await panel.textContent(),/Contact checks complete for 0\/2 people/);assert.match(await panel.textContent(),/AI evidence review: queued/);assert.equal(await panel.locator('li.active').count(),0);assert.match(await panel.textContent(),/129 source checks saved/);};
  await checkQueued();await page.screenshot({path:dir+'/queued.png',fullPage:true});await settleInitialSave(page);const posts=f.calls.filter(c=>c.path==='/api/buyers/research'&&c.method==='POST').length;await context.close();await open();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='queued');await checkQueued();assert.equal(f.calls.filter(c=>c.path==='/api/buyers/research'&&c.method==='POST').length,posts);await page.screenshot({path:dir+'/reopened.png',fullPage:true});assert.equal(reviews,0);
  const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:(env,o)=>runBuyerResearchJobs(env,{...o,maxJobs:1,jobId:job.id}),runCopilotResearchJobs:noop,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchProgress?.aiReviewStatus==='complete');assert.equal(reviews,1);assert.equal(f.DB.raw.prepare('SELECT status FROM buyer_research_jobs WHERE id=?').get(job.id).status,'needs_review');assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id),receipts);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);assert.deepEqual(errors,[]);await page.screenshot({path:dir+'/reviewed.png',fullPage:true});await fs.writeFile(dir+'/result.json',JSON.stringify({sameJob:true,savedChecks:129,sourceReplays:0,queuedHasNoExecutingStage:true,freshReopen:true,nativeReviewCalls:reviews,wholeQualityApproved:false,paidContactCalls:0,pageErrors:errors},null,2));
 }catch(e){await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await context?.close();await browser.close();await f.close();}
});

test('reopening a running official-source job shows saved names without completing identity or contact checks',{timeout:90000},async t=>{
 let chromium;
 try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}
 catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await journeyFixture({durableJobs:true,roleReviewPending:true,incompleteDossier:true});
 t.after(()=>f.close());
 const job=await startBuyerJob(f.env,workspaceId,{id:'storage-owner',sessionTokenHash:await sha256(sessionToken)},{candidate:f.candidate});
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='running',lease_token='test-worker',lease_until=? WHERE id=?").run(Date.now()+180000,job.id);
 const insert=f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,?,'search','official',?,'complete',1,'{\"rows\":[]}')");
 for(let i=0;i<42;i++)insert.run(job.id,'receipt-'+i,'Completed source check '+i);
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
 const page=await context.newPage();
 for(let visit=0;visit<2;visit++){
  await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);
  await page.evaluate(()=>showDiscoveryStep('buyers'));
  const panel=page.locator('.buyer-research-progress');
  await panel.getByText('42 source checks saved',{exact:true}).waitFor();
  assert.match(await panel.locator('li.active').textContent(),/Official sources/);
  assert.equal(await panel.locator('li.done').count(),0);
  assert.match(await panel.textContent(),/Contact checks pending · 2 saved people/);
  assert.match(await page.locator('.company-dossier').textContent(),/Company research pending/);
  assert.doesNotMatch(await page.locator('.selected-prospect-row').textContent(),/Refresh to assess the saved contacts/);
 }
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,42);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
});
