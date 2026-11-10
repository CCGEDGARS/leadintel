import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
async function ready(page){await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated&&window.LeadIntelCustomerNavigation&&window.LeadIntelProfileAnswers?.isReady());await page.waitForLoadState('networkidle');}
async function settleInitialSave(page){const result=await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(result.saved,true);await page.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());}
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {runDueMarketMonitoring} from '../src/market-monitoring.js';
import app from '../src/app.js';

for(const profileApproved of [true,false])test('monitoring saves before activation, returns without company research and retains scheduled alerts after reopening: '+(profileApproved?'approved Profile':'Profile approval required'),{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable; mandatory in Customer CI.');return;}
 const dir='/tmp/leadintel-monitoring'+(profileApproved?'':'-profile-review');await fs.mkdir(dir,{recursive:true});const queries=[],errors=[];
 const f=await journeyFixture({externalFetch:async(input,options)=>{
  if(new URL(typeof input==='string'?input:input.url).hostname==='api.firecrawl.dev'){
   const body=JSON.parse(options.body);queries.push(body.query);
   return Response.json({success:true,data:body.query.includes('site:www.jobindex.dk')?[{url:'https://www.jobindex.dk/job/controlled-factory',title:'Facility expansion and new site in Sweden',description:'A manufacturer announces facility expansion, a new site and engineering recruitment.',markdown:'The company announces facility expansion and a new site.',date:new Date().toISOString()}]:[]});
  }
 }});
 const saved=await f.getState();if(!profileApproved){Object.assign(saved.payload.main.answers,{buying_outcomes:'Reduce production equipment downtime',value_proposition:'Engineering and manufacturing of custom machinery',differentiation:'Custom machinery for supplied project requirements',proof_points:'No approved proof yet',objections:'Confirm technical scope, capacity and installation timing',delivery_approach:'Review drawings and project requirements before manufacture',meeting_value:'Review the production equipment scope and drawings'});saved.payload.main.answerStatus=Object.fromEntries(Object.keys(saved.payload.main.answers).map(id=>[id,'user']));}saved.payload.main.approved=profileApproved;saved.payload.main.market.strategyApproved=false;delete saved.payload.main.market.strategyApproval;
 await f.replace(saved.payload,saved.version);f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,24).toString('base64');
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES(?,'firecrawl',?,'fixture')").run(workspaceId,await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)));
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let page,context;
 const open=async()=>{
  context=await browser.newContext({viewport:{width:1440,height:1050}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);assert.equal(await page.evaluate(()=>LeadIntelCustomerNavigation.setStep(2)),true);await page.locator('#step-2.active').waitFor();await page.locator('#website-scanning-open').click();await page.locator('[data-scan-mode=monitor]').click();await page.locator('#monitoring-custom-sources').waitFor();await page.waitForLoadState('networkidle');
 };
 const config=()=>f.DB.raw.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').get(workspaceId);
 const saveResponse=()=>page.waitForResponse(r=>r.url().includes('/market-monitoring/config')&&r.request().method()==='PUT'&&r.status()===200);
 const noop=async()=>[];
 const hourly=async()=>{const waits=[];await app.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runDueMarketMonitoring,runDueSourceHealthChecks:noop,runSavedFlows:noop,runApprovedWorkflows:noop,pollConversations:noop,enrollConversationWorkflows:noop,runConversationPlans:noop,pollOutreachReplies:noop,runOutreachAutomation:noop});await Promise.all(waits);};
 try{
  await open();assert.equal(await page.locator('#monitoring-enabled').isDisabled(),true);assert.equal(await page.locator('#save-monitoring').isEnabled(),true);
  await page.locator('#monitoring-custom-sources').fill('https://www.jobindex.dk/');await page.locator('#monitoring-frequency').selectOption('daily');await page.locator('#monitoring-depth').selectOption('quick');await page.locator('#monitoring-minimum-score').fill('80');
  assert.match(await page.locator('#monitoring-status').textContent(),/Unsaved changes/);const save=saveResponse();await page.locator('#save-monitoring').click();await save;await page.locator('#monitoring-settings').waitFor({state:'hidden'});
  assert.equal(config().enabled,0);assert.equal(config().frequency,'daily');assert.equal(config().research_depth,'quick');assert.equal(queries.length,0);await hourly();assert.equal(queries.length,0);
  await settleInitialSave(page);await context.close();await open();assert.equal(await page.locator('#monitoring-frequency').inputValue(),'daily');assert.match(await page.locator('#monitoring-saved-summary').textContent(),/Saved:.*Daily.*Quick/);
  const queriesBeforeApproval=queries.length;
  await page.locator('#monitoring-review-strategy').click();if(!profileApproved){await page.locator('#step-3.active').waitFor();assert.equal(await page.locator('#monitoring-approval-guide').isVisible(),true);assert.equal((await f.getState()).payload.main.approved,false);
   await page.locator('#approve-profile').click();}await page.locator('#strategy-handoff-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('#strategy-handoff-title').textContent(),/monitoring/i);assert.match(await page.locator('#confirm-strategy-handoff').textContent(),/return to monitoring/i);
  await page.locator('#confirm-strategy-handoff').click();await page.locator('#step-2.active').waitFor();await page.locator('#monitoring-settings').waitFor({state:'visible'});
  assert.equal(queries.length,queriesBeforeApproval,'Strategy approval for monitoring must not start company research');
  await page.waitForFunction(()=>window.LeadIntelCustomerState?.market?.strategyApproved||JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}').market?.strategyApproved);
  // Monitoring activation uses the actual saved Strategy and retains the draft.
  await settleInitialSave(page);assert.equal(await page.locator('#website-scanning-workspace').isVisible(),true);
  await page.waitForFunction(()=>!document.getElementById('monitoring-enabled').disabled);if(await page.locator('#monitoring-signals input:checked').count()===0){assert.match(await page.locator('#monitoring-status').textContent(),/saved buying signals have changed/);await page.locator('#monitoring-signals input').first().check();const mapped=saveResponse();await page.locator('#save-monitoring').click();await mapped;await page.locator('#monitoring-settings').waitFor({state:'hidden'});await page.locator('#website-scanning-open').click();await page.locator('[data-scan-mode=monitor]').click();}const enable=saveResponse();await page.locator('#monitoring-enabled').check();await enable;await page.waitForFunction(()=>!document.getElementById('run-monitoring-now').disabled);
  const before=queries.length;const runResponse=page.waitForResponse(r=>r.url().includes('/market-monitoring/run')&&r.request().method()==='POST');await page.locator('#run-monitoring-now').click();assert.equal((await (await runResponse).json()).run.status,'completed');
  await page.waitForFunction(()=>document.querySelector('#monitoring-alerts .monitor-alert'));assert.ok(queries.slice(before).some(q=>q.includes('site:www.jobindex.dk')));assert.equal(queries.length-before,4);
  await page.locator('#monitoring-alerts [data-monitor-alert-read]').click();await page.waitForFunction(()=>!document.querySelector('#monitoring-alerts [data-monitor-alert-read]'));
  await page.screenshot({path:dir+'/desktop.png',fullPage:true});await settleInitialSave(page);await context.close();
  // No browser exists when the registered hourly scheduler executes.
  f.DB.raw.prepare("UPDATE market_monitoring_configs SET next_run_at='2020-01-01T00:00:00.000Z' WHERE workspace_id=?").run(workspaceId);const count=queries.length;await hourly();assert.equal(queries.length-count,4);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM market_monitoring_alerts').get().n,1);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM market_monitoring_runs WHERE trigger_type='scheduled' AND status='completed'").get().n,1);
  assert.ok(f.DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='market_monitoring' AND metadata_json LIKE '%completed%'").get().n>0);
  assert.equal(Date.parse(config().next_run_at)-Date.parse(config().last_run_at),86400000);await hourly();assert.equal(queries.length-count,4);
  await open();assert.equal(await page.locator('#monitoring-enabled').isChecked(),true);assert.match(await page.locator('#monitoring-history').textContent(),/scheduled.*completed/);assert.equal(await page.locator('#monitoring-alerts .monitor-alert').count(),1);assert.equal(await page.locator('#monitoring-alerts [data-monitor-alert-read]').count(),0);
  await page.setViewportSize({width:390,height:844});await page.locator('#monitoring-settings').scrollIntoViewIfNeeded();const box=await page.locator('#monitoring-settings').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);await page.screenshot({path:dir+'/mobile.png',fullPage:true});await page.locator('#website-scanning-monitor').screenshot({path:dir+'/mobile-monitoring.png'});
  const pause=saveResponse();await page.locator('#monitoring-enabled').uncheck();await pause;assert.equal(config().enabled,0);const paused=queries.length;await hourly();assert.equal(queries.length,paused);assert.deepEqual(errors,[]);
  await fs.writeFile(dir+'/result.json',JSON.stringify({draftSavedBeforeActivation:true,realStrategyActivation:true,profileReviewContinuation:!profileApproved,noCompanyResearchOnApproval:true,enteredWebsiteSearched:true,queriesPerRun:4,hourlyRunsWithoutBrowser:true,duplicateAlerts:0,alertReadStateRestored:true,dailySchedule:true,pauseStopsSchedule:true,freshBrowserReopen:true,mobile:true,pageErrors:errors},null,2));
 }catch(e){await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});await fs.writeFile(dir+'/failure.json',JSON.stringify({message:e.message,errors,monitoring:config(),calls:f.calls.filter(c=>c.path.includes('monitoring')),runtime:await page?.evaluate(()=>({step:document.querySelector('.step-view.active')?.id,notice:document.getElementById('required-action-notice')?.textContent,toast:document.getElementById('toast')?.textContent,blockers:document.getElementById('strategy-handoff-blockers')?.textContent})),queries},null,2));throw e;}
 finally{await context?.close();await browser.close();await f.close();}
});
