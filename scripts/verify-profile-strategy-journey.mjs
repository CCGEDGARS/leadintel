import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step1Fixture} from '../backend/test/step1-journey-fixture.mjs';
import {loadPlaywright,sessionToken,workspaceId} from '../backend/test/step5-journey-fixture.mjs';

export async function verifyProfileStrategyJourney({artifactDir='/tmp/leadintel-profile-strategy',researchHandoff=false,failResearchSave=false,legacyOpportunityContext=false,companyProgress=false,researchMode="quick",marketModeChecks=false,profileRefreshRecovery=false,mainAiProvider="gemini",geminiReviewer=true}={}){
 const f=await step1Fixture({profileResearch:profileRefreshRecovery});await f.connectControlledExtraction();if(mainAiProvider!=="gemini"&&geminiReviewer)await f.connectControlledAi("gemini");await f.connectControlledAi(mainAiProvider);const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const researchRequests=()=>({publicReads:f.externalCalls.filter(c=>{const u=new URL(c.url);return u.hostname==='seller.example'||u.hostname==='api.firecrawl.dev'&&/\/(search|scrape)$/.test(u.pathname);}).length,profileSynthesis:f.calls.filter(c=>c.body?.task==='profile-synthesis').length});
 const errors=[],evidence={};let releaseCompanyResponse;await fs.mkdir(artifactDir,{recursive:true});
 async function approveAndOpenCompanies(page){
  const companyRequests=()=>f.calls.filter(c=>c.path==='/api/ai/web-search'||['company-extraction','buyer-fit'].includes(c.body?.task)).length
    +f.externalCalls.filter(c=>{const url=new URL(c.url);return url.hostname==='api.firecrawl.dev'&&/\/(search|scrape)$/.test(url.pathname);}).length;
  const before=companyRequests();
  const button=page.locator('#confirm-strategy-handoff');
  assert.equal(await button.textContent(),'Approve Strategy and open Companies');
  await button.click();await page.locator('#step-5.active').waitFor();
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>Boolean(activeDiscoveryTaskId||discovery?.status==='running')),false);
  assert.equal(companyRequests(),before,'opening Companies must not issue a company research request');
  await page.locator('#prior-company-search > summary').click();
  await page.locator('#cl-previous-search > summary').click();
 }
 async function open({delayDiscovery=false}={}){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await c.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);if(delayDiscovery)await c.addInitScript(()=>{let engine,held=true;Object.defineProperty(window,'LeadIntelDiscovery',{configurable:true,get:()=>held?undefined:engine,set:value=>{engine=value;}});window.__releaseDiscoveryForTest=()=>{held=false;};});await c.addInitScript(()=>{window.__workflowNavigationTrace=[];for(const name of ['click','leadintel:module-opened','leadintel:open-discovery','leadintel:open-module'])window.addEventListener(name,event=>window.__workflowNavigationTrace.push({event:name,target:event.target?.id,closest:event.target?.closest?.('[id]')?.id,detail:event.detail,stack:new Error().stack}),true);});const p=await c.newPage();if(process.env.LEADINTEL_TEST_CPU_RATE){const debug=await c.newCDPSession(p);await debug.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.LEADINTEL_TEST_CPU_RATE)});}p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));await p.goto(f.origin+'/customer/');await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated&&window.LeadIntelCustomerNavigation&&window.LeadIntelProfileAnswers?.isReady());await p.evaluate(()=>{const original=LeadIntelCustomerNavigation.setStep;LeadIntelCustomerNavigation.setStep=(...args)=>{window.__workflowNavigationTrace.push({event:'navigation-setStep',args,stack:new Error().stack});return original(...args);};});return p;}
 try{
  let p=await open();await p.locator('#company-website').fill('seller.example');await p.locator('#activate-website').click();await p.waitForFunction(()=>document.getElementById('website-activation-status')?.dataset.state==='active');await p.locator('[data-target-market="Sweden"]').click();await p.locator('#to-questionnaire').click();await p.locator('#step-2.active').waitFor();evidence.setupResearchOpenedProfile=true;
  const answers={priority_offers:'Custom machinery manufacturing; Engineering services; On-site installation',ideal_customer:'Manufacturing companies in Sweden planning production equipment upgrades',buyer_roles:'Engineering Director; Production Director; Procurement Manager',exclusions:'Residential customers and work outside confirmed technical scope',buying_outcomes:'Reduce production disruption while installing compliant production equipment',buying_triggers:'Factory expansion; announced production-line upgrades; equipment replacement',value_proposition:'Coordinate engineering, machinery manufacturing and installation within one project scope',differentiation:'Engineering and manufacturing combined with installation services',proof_points:'No approved proof yet',objections:'Technical scope, available capacity, installation timing and delivery risk',delivery_approach:'Review drawings and requirements, manufacture the equipment and coordinate installation',meeting_value:'Review the equipment scope, existing drawings and installation constraints'};
  for(const [id,value] of Object.entries(answers))await p.locator(`[data-question="${id}"]`).fill(value);
  await p.locator('#confirm-targeting').click();await p.waitForFunction(()=>document.getElementById('targeting-confirmation-status')?.textContent.startsWith('Saved.'));if(profileRefreshRecovery){
   await p.locator('[data-reference-customers-manage]:visible').first().click();await p.locator('[data-company-segment="market"]').click();
   assert.match(await p.locator('#profile-market-result-status').textContent(),/No market evidence is saved yet/);
   assert.match(await p.locator('[data-research-reports]:visible').textContent(),/No saved reports/);
   const reads=researchRequests();await p.locator('[data-complete-market-profile]').click();await p.locator('#step-3.active').waitFor();await p.locator('#profile-content').waitFor({state:'visible'});
   assert.deepEqual(researchRequests(),reads,'review reuses saved evidence without another provider request');evidence.directEmptyReview=true;
  }else await p.locator('#analyze-company').click();if(await p.locator('#profile-enrichment-checkpoint').isVisible()){await p.keyboard.press('Escape');assert.equal(await p.locator('#step-2').isVisible(),true);await p.locator('#analyze-company').click();await p.locator('[data-continue-without-enrichment]').click();evidence.optionalEnrichmentControls=true;}await p.locator('#step-3.active').waitFor();await p.locator('#profile-content').waitFor({state:'visible'});await p.locator('#approve-profile').click();await p.waitForFunction(()=>!document.getElementById('continue-market-strategy')?.disabled);evidence.profileReviewedAndApproved=true;
  if(researchHandoff){
   f.setControlledMarketResearch(true,{verification:marketModeChecks&&researchMode==="deep"?"partial":"complete"});if(failResearchSave)f.failSaves(true);
   await p.locator('[data-workflow-stage="2"] strong').click();if(await p.locator('[data-open-profile-market]:visible').count())await p.locator('[data-open-profile-market]:visible').first().click();else {await p.locator('[data-reference-customers-manage]:visible').first().click();await p.locator('[data-company-segment="market"]').click();}
   await p.locator(({quick:'#run-market-research',deep:'#run-detailed-research',intelligence:'#run-market-intelligence'})[researchMode]).click();assert.equal(await p.locator('#research-run-preview').getAttribute('data-research-mode'),researchMode);await p.locator('#confirm-market-research').click();
   await p.waitForFunction(()=>{const m=JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market;return m.researchExecution?.completedAt&&m.researchStatus!=="running";},null,{timeout:120000});
   const sourceCount=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market.researchResults.length);if(researchMode==='quick')assert.equal(sourceCount,20);else assert.ok(sourceCount>20,'broader modes acquire their own evidence set');
   // The optional copy follows the authenticated saving-preference check.
   await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market.researchReports?.length===1);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market.researchReports.length),1,'one run creates one report');
   await p.locator('[data-review-market-strategy]').click();await p.locator('#step-3.active').waitFor();await p.locator('#continue-market-strategy').click();await p.locator('#step-4.active').waitFor();
   if(failResearchSave){
    await p.waitForFunction(()=>/Sync failed/.test(document.getElementById('workspace-save-state')?.textContent));
    assert.equal(((await f.getState()).payload.main.market.researchResults||[]).length,0);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market.researchResults.length),sourceCount);
    evidence.failedSaveRetainedLocalResults=true;f.failSaves(false);await p.locator('#save-workspace').click();
   }
   await p.waitForFunction(()=>document.getElementById('workspace-save-state')?.textContent==='Saved automatically to LeadIntel');
   const saved=(await f.getState()).payload.main;
   assert.equal(saved.market.researchResults.length,sourceCount);assert.equal(saved.market.researchReports.length,1);assert.equal(saved.market.researchProfileLink.sourceCount,sourceCount);assert.equal(saved.market.strategyApproved,false);
   const opportunity=saved.market.icps.find(x=>x.type==='opportunity-led');assert.equal(opportunity.active,true);assert.equal(opportunity.requestedActive,true);assert.equal(saved.market.researchContextStale,false);assert.equal(opportunity.value,'');
   assert.match(await p.locator('#strategy-research-handoff').textContent(),new RegExp(sourceCount+' research sources'));
   evidence.researchHandoff={sources:sourceCount,reports:1,automaticCloudSave:!failResearchSave,opportunityAutoActivated:true,strategyAwaitingReview:true};
   if(profileRefreshRecovery){
    f.setControlledMarketResearch(false);
    await p.evaluate(()=>LeadIntelCustomerNavigation.setStep(2));
    const before=(await f.getState()).payload.main;assert.ok(before.researchMeta.generatedAt,'seller research metadata must be in the cloud payload');
    const previousClock=before.researchMeta.generatedAt;
    await p.locator('.research-more-options summary').click();await p.locator('#rerun-company-research').click();
    await p.waitForFunction(clock=>{const s=JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));return s.researchMeta?.generatedAt!==clock&&s.researchMeta?.mode==='ai'&&document.getElementById('research-summary')?.dataset.researchState!=='running';},previousClock);
    await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());
    const refreshed=(await f.getState()).payload.main;assert.ok(refreshed.profile);assert.equal(refreshed.approved,true,'unchanged confirmed answers keep approval');
    for(const key of ['researchResults','researchReports','signals','icps','deletedSignalIds','researchExecution'])assert.deepEqual(refreshed.market[key],before.market[key],key);
    assert.ok(refreshed.researchMeta.execution.receipts.length>0);assert.match(await p.locator('#research-summary').textContent(),/AI profile drafts ready/);assert.doesNotMatch(await p.locator('#research-summary').textContent(),/Research and AI profile preparation complete/);
    if(await p.locator('[data-open-profile-market]:visible').count())await p.locator('[data-open-profile-market]:visible').first().click();else {await p.locator('[data-reference-customers-manage]:visible').first().click();await p.locator('[data-company-segment="market"]').click();}assert.match(await p.locator('#profile-market-result-status').textContent(),/research sources available/);
    await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({path:artifactDir+'/market-mobile.png',fullPage:true});
    await p.locator('[data-review-market-strategy]').click();await p.locator('#step-3.active').waitFor();await p.screenshot({path:artifactDir+'/profile-mobile.png',fullPage:true});
    evidence.refreshPreservedResearch=true;
   }
   await p.context().close();
   if(legacyOpportunityContext){
    // Reproduce an old saved run whose derived Opportunity-led switch was
    // enabled after completion. Persist through the real authenticated API.
    const current=await f.getState(),legacy=structuredClone(current.payload),material=globalThis.LeadIntelStrategyIntegrity.material(legacy.main);
    material.icps.find(item=>item.type==='opportunity-led').active=false;delete material.evidence;delete material.opportunities;
    legacy.main.market.researchContextFingerprint=globalThis.LeadIntelStrategyIntegrity.VERSION+':research:'+globalThis.LeadIntelStrategyIntegrity.digest(JSON.stringify(material));
    legacy.main.market.researchContextStale=true;legacy.main.market.opportunityAutoActivationRunId='';
    const result=await fetch(f.origin+'/api/customer/state?workspace_id='+workspaceId,{method:'PUT',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({version:current.version,payload:legacy})});assert.equal(result.status,200);
   }
   if(profileRefreshRecovery){
    // Reproduce a workspace saved by the old refresh path with no Profile,
    // while evidence and selections are still recoverable. Use the real API.
    const current=await f.getState(),payload=structuredClone(current.payload);payload.main.profile=null;payload.main.approved=false;payload.main.step=2;
    const result=await fetch(f.origin+'/api/customer/state?workspace_id='+workspaceId,{method:'PUT',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({version:current.version,payload})});assert.equal(result.status,200);
   }
   p=await open();
   if(profileRefreshRecovery){
    await f.settleBackground();await p.waitForLoadState('networkidle');const reads=researchRequests();
    assert.match(await p.locator('#research-summary').textContent(),/AI profile drafts ready/);assert.doesNotMatch(await p.locator('#research-summary').textContent(),/Start company research/);
    await p.locator('[data-reference-customers-manage]:visible').first().click();await p.locator('[data-company-segment="market"]').click();await p.locator('[data-complete-market-profile]').click();await p.locator('#step-3.active').waitFor();await p.locator('#profile-content').waitFor({state:'visible'});assert.deepEqual(researchRequests(),reads,'fresh-browser recovery must not repeat company extraction, search or profile synthesis');
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).approved),false,'review never implies approval');
    await p.locator('#approve-profile').click();await p.waitForFunction(()=>!document.getElementById('continue-market-strategy')?.disabled);await p.locator('#continue-market-strategy').click();await p.locator('#step-4.active').waitFor();await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());
    assert.match(await p.locator('#strategy-research-handoff').textContent(),new RegExp(sourceCount+' research sources'));await p.screenshot({path:artifactDir+'/strategy-recovered.png',fullPage:true});
    assert.equal((await fetch(f.origin+'/api/customer/state?workspace_id=foreign-workspace',{headers:{Cookie:'leadintel_session='+sessionToken}})).status,403);
    evidence.profileRecoveryReusedEvidence=true;evidence.foreignWorkspaceBlocked=true;
    const beforeMarketEdit=(await f.getState()).payload.main;
    await p.evaluate(()=>LeadIntelCustomerNavigation.setStep(1));await p.locator('[data-target-market="Finland"]').click();await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());
    const afterMarketEdit=(await f.getState()).payload.main;assert.ok(afterMarketEdit.targetMarkets.includes('Finland'));assert.equal(afterMarketEdit.approved,false);assert.equal(afterMarketEdit.market.strategyApproved,false);assert.equal(afterMarketEdit.market.researchContextStale,true);
    for(const key of ['researchResults','researchReports','signals','icps','deletedSignalIds'])assert.deepEqual(afterMarketEdit.market[key],beforeMarketEdit.market[key],key+' after target-market edit');
    assert.deepEqual(afterMarketEdit.researchMeta,beforeMarketEdit.researchMeta);evidence.marketEditPreservedEvidence=true;
   }
   const reopened=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market);
   assert.equal(reopened.researchResults.length,sourceCount);assert.equal(reopened.researchReports.length,1);assert.equal(reopened.researchProfileLink.sourceCount,sourceCount);assert.equal(reopened.icps.find(x=>x.type==='opportunity-led').active,true);
   if(mainAiProvider==='anthropic'){
    const searches=f.calls.filter(c=>c.path==='/api/ai/web-search');assert.ok(searches.length>0);
    assert.ok(searches.every(c=>c.status===200&&c.result.provider==='anthropic'&&c.result.web_search===true));
    assert.ok(reopened.researchExecution.receipts.some(r=>r.provider==='anthropic'&&r.attempt>0&&r.status==='complete'));
    assert.ok(reopened.researchExecution.receipts.every(r=>r.provider!=='openai'));
    assert.equal(reopened.researchSourceStatus.anthropic,'complete');assert.equal(reopened.researchSourceStatus.discovery,'complete');
    assert.equal(f.externalCalls.filter(c=>new URL(c.url).hostname==='api.openai.com').length,0);
    evidence.claudeDiscovery=true;
   }
   if(marketModeChecks){
    assert.equal(reopened.researchMode,researchMode);assert.ok(reopened.opportunities.some(o=>o.evidence.length));
    const verificationCalls=f.calls.filter(c=>c.path==='/api/ai/research-verification');assert.equal(verificationCalls.length,researchMode==='quick'?0:1);
    if(researchMode!=='quick'){
     assert.equal(verificationCalls[0].status,200);assert.ok(reopened.researchVerification.coverage.reviewed>0);
     assert.equal(reopened.researchVerification.coverage.supplied,sourceCount);
     assert.equal(reopened.researchSourceStatus.gemini,'partial');
     if(researchMode==='deep'){const rejected=reopened.researchResults.find(r=>r.verification?.relevance==='reject');assert.ok(rejected);assert.ok(reopened.opportunities.every(o=>o.evidence.every(e=>e.url!==rejected.url)));}
    }
    await p.locator('.steps [data-step-marker="4"]').click();await p.locator('#strategy-research-action').click();
    for(const id of ['run-market-research','run-detailed-research','run-market-intelligence'])assert.equal(await p.locator('#'+id).isEnabled(),true);
    await p.screenshot({path:artifactDir+'/research-desktop.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:artifactDir+'/research-mobile.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await p.locator('[data-research-view-report]').click();const report=p.frameLocator('#research-report-dialog iframe');await report.getByRole('heading',{name:'Commercial implications'}).waitFor();assert.ok(await report.locator('a.source-link').count()>0);if(researchMode!=='quick')assert.match(await report.locator('body').textContent(),/evidence sources reviewed/);await p.locator('[data-report-close]').click();
    await p.evaluate(()=>{const original=LeadIntelDiscovery.buildDiscoveryQueries;LeadIntelDiscovery.buildDiscoveryQueries=(...args)=>{window.__marketDiscoveryInput=structuredClone(args[1]);return original(...args);};});
    let held=false;const responseGate=new Promise(resolve=>releaseCompanyResponse=resolve);
    await p.route('**/api/ai/generate?*',async route=>{if(!held&&route.request().postDataJSON()?.task==='company-extraction'){held=true;const response=await route.fetch();await responseGate;await route.fulfill({response}).catch(()=>{});}else await route.continue();});
    await p.setViewportSize({width:1440,height:1000});await p.locator('[data-review-market-strategy]').click();await p.locator('#continue-market-strategy').click();await p.locator('#step-4.active').waitFor();await p.locator('#activate-market-strategy').click();await p.locator('#strategy-handoff-dialog').waitFor({state:'visible'});assert.equal(await p.locator('#confirm-strategy-handoff').isEnabled(),true);await approveAndOpenCompanies(p);
    await p.locator('#run-company-discovery').click();
    await p.waitForFunction(()=>document.querySelector('#company-search-progress h3')?.textContent==='Identifying companies');
    const input=await p.evaluate(()=>window.__marketDiscoveryInput);assert.equal(input.researchResults.length,sourceCount);assert.equal(input.researchMode,researchMode);assert.ok(input.opportunities.some(o=>o.evidence.length));
    await p.locator('[data-cancel-company-search]').click();releaseCompanyResponse();await p.waitForFunction(()=>document.getElementById('company-search-progress')?.dataset.state==='canceled');await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());
    const downstream=(await f.getState()).payload.main.market;assert.equal(downstream.researchResults.length,sourceCount);assert.equal(downstream.researchReports.length,1);assert.ok(downstream.opportunities.some(o=>o.evidence.length));
    evidence.marketMode={mode:researchMode,sourceCount,gemini:reopened.researchSourceStatus.gemini,coverage:reopened.researchVerification.coverage,reportOpened:true,mobile:true,companiesHandoff:true};
   }else if(companyProgress){
    let held=false;const responseGate=new Promise(resolve=>releaseCompanyResponse=resolve);
    await p.route('**/api/ai/generate?*',async route=>{if(!held&&route.request().postDataJSON()?.task==='company-extraction'){held=true;const response=await route.fetch();await responseGate;await route.fulfill({response}).catch(()=>{});}else await route.continue();});
    await p.locator('.steps [data-step-marker="4"]').click();await p.locator('#activate-market-strategy').click();await p.locator('#strategy-handoff-dialog').waitFor({state:'visible'});await approveAndOpenCompanies(p);
    await p.locator('#run-company-discovery').click();
    const panel=p.locator('#company-search-progress');await panel.waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('#company-search-progress h3')?.textContent==='Identifying companies');
    const bar=panel.locator('[role="progressbar"]');assert.equal(await bar.getAttribute('aria-valuenow'),null);assert.equal(await bar.getAttribute('data-indeterminate'),'true');assert.match(await panel.textContent(),/0 of [12] batches checked/);assert.equal(await panel.locator('[aria-current="step"]').textContent(),'2Identify companies');
    const time=await panel.locator('[data-company-search-elapsed]').textContent();await p.waitForFunction(previous=>document.querySelector('[data-company-search-elapsed]')?.textContent!==previous,time);assert.match(await panel.textContent(),/0 of [12] batches checked/,'waiting time cannot advance completed batches');
    await panel.scrollIntoViewIfNeeded();await p.screenshot({path:artifactDir+'/company-progress-desktop.png'});
    await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>parseFloat(document.getElementById('company-search-progress').style.scrollMarginTop)>=(document.querySelector('header')?.getBoundingClientRect().height||0)+16);await panel.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await bar.locator('span').evaluate(e=>getComputedStyle(e).animationName),'none');await p.screenshot({path:artifactDir+'/company-progress-mobile.png'});
    await p.locator('[data-cancel-company-search]').click();await p.waitForFunction(()=>document.getElementById('company-search-progress')?.dataset.state==='canceled');releaseCompanyResponse();assert.equal(await bar.getAttribute('aria-valuenow'),null);const stopped=await panel.locator('[data-company-search-elapsed]').textContent();await p.waitForTimeout(1200);assert.equal(await panel.locator('[data-company-search-elapsed]').textContent(),stopped);
    await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges());await p.context().close();p=await open();assert.equal(await p.locator('#company-search-progress').getAttribute('data-state'),'canceled');const retained=(await f.getState()).payload.main.market;assert.equal(retained.researchResults.length,sourceCount);assert.equal(retained.researchReports.length,1);
    evidence.companyProgress={slowBatchVisible:true,honestCounts:true,elapsedLive:true,mobile:true,reducedMotion:true,cancelSaved:true,freshReopen:true};
   }else if(legacyOpportunityContext){
    // Country language-reference preparation continues under waitUntil after startup.
    // Settle that existing work before measuring requests caused by strategy review.
    await p.locator('.steps [data-step-marker="4"]').click();await p.locator('#step-4.active').waitFor();await p.waitForLoadState('networkidle');await f.settleBackground();const requests=f.externalCalls.length;
    await p.locator('#activate-market-strategy').click();await p.locator('#strategy-handoff-dialog').waitFor({state:'visible'});assert.equal(await p.locator('#strategy-handoff-blockers').isVisible(),false);assert.equal(await p.locator('#confirm-strategy-handoff').isEnabled(),true);assert.equal(f.externalCalls.length,requests,'review must reuse research rather than dispatch another provider scan');
    await approveAndOpenCompanies(p);await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).market.strategyApproved===true);
    const persisted=(await f.getState()).payload.main;assert.equal(persisted.market.researchContextStale,false);assert.equal(persisted.market.researchResults.length,sourceCount);assert.equal(persisted.market.researchReports.length,1);assert.equal(persisted.market.researchExecution.runId,saved.market.researchExecution.runId);
    await p.context().close();p=await open();const restored=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')));assert.equal(globalThis.LeadIntelStrategyIntegrity.status(restored).current,true);assert.equal(restored.market.researchContextStale,false);assert.equal(restored.market.researchResults.length,sourceCount);assert.equal(restored.market.researchReports.length,1);assert.equal(restored.market.researchExecution.runId,saved.market.researchExecution.runId);
    evidence.legacyOpportunityRecovery={reviewOpened:true,approvalSaved:true,sources:sourceCount,reports:1,marketRunReused:true,coldReopen:true};
   }else assert.equal(reopened.opportunityAutoActivationRunId,reopened.researchExecution.runId);
   evidence.researchFreshBrowserReopen=true;evidence.pageErrors=errors;assert.deepEqual(errors,[]);await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));return evidence;
  }

  await p.locator('#continue-market-strategy').click();await p.locator('#step-4.active').waitFor();await p.locator('#activate-market-strategy').click();await p.locator('#strategy-handoff-dialog').waitFor({state:'visible'});await approveAndOpenCompanies(p);await p.waitForFunction(()=>document.getElementById('run-company-discovery')?.offsetParent&&!document.getElementById('run-company-discovery').disabled);evidence.strategySavedBeforeCompanies=true;await p.locator('#run-company-discovery').click();await p.waitForFunction(()=>typeof discovery!=='undefined'&&discovery?.lastRunAt&&discovery.status!=='running'&&!activeDiscoveryTaskId&&!loadMeta().autonomousDiscovery?.active&&!document.getElementById('run-company-discovery')?.disabled);assert.equal(await p.locator('#run-company-discovery').isEnabled(),true);assert.equal(await p.evaluate(()=>discovery.candidates.length),0,'empty controlled search must not invent companies');evidence.companySearchFinishedWithoutInventingResults=true;
  const saved=(await f.getState()).payload.main;assert.equal(saved.approved,true);assert.equal(saved.market.strategyApproved,true);assert.equal(saved.targetingConfirmation.version,1);for(const [id,value] of Object.entries(answers))assert.equal(saved.answers[id],value);
  await p.screenshot({path:artifactDir+'/companies-ready.png'});await p.context().close();p=await open({delayDiscovery:true});await p.evaluate(()=>LeadIntelCustomerNavigation.setStep(3));await p.locator('#step-3.active').waitFor();await p.evaluate(()=>window.__releaseDiscoveryForTest());await p.waitForFunction(()=>Boolean(window.LeadIntelDiscoveryUI?.open));assert.equal(await p.locator('#step-3').isVisible(),true,'late Companies initialization must preserve the user-selected Profile');evidence.lateNavigationPreserved=true;assert.equal(await p.locator('#continue-market-strategy').isEnabled(),true);await p.locator('#continue-market-strategy').click({delay:Number(process.env.LEADINTEL_TEST_CLICK_DELAY)||0});await p.locator('#step-4.active').waitFor();assert.equal((await f.getState()).payload.main.market.strategyApproved,true);evidence.freshBrowserReopen=true;
  await p.screenshot({path:artifactDir+'/strategy-reopened.png'});evidence.pageErrors=errors;assert.deepEqual(errors,[]);await fs.writeFile(artifactDir+'/navigation-trace.json',JSON.stringify(await p.evaluate(()=>window.__workflowNavigationTrace),null,2));await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));return evidence;
 }catch(error){const pages=browser.contexts().flatMap(c=>c.pages()),page=pages.at(-1),runtime=page?await page.evaluate(()=>({navigationTrace:window.__workflowNavigationTrace,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.innerText),step:document.querySelector('.step-view.active')?.id,toast:document.getElementById('toast')?.textContent,error:document.getElementById('step2-error')?.textContent,confirmation:document.getElementById('targeting-confirmation-status')?.textContent,analysis:document.getElementById('analysis-log')?.textContent,profileShell:document.querySelector('.intel-profile-shell')?.textContent?.slice(0,600),state:JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}')})):null;await page?.screenshot({path:artifactDir+'/failure.png',fullPage:true});await fs.writeFile(artifactDir+'/failure.json',JSON.stringify({message:error.message,pageErrors:errors,runtime},null,2));throw error;}finally{releaseCompanyResponse?.();await browser.close();await f.close();}
}
