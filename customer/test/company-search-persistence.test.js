const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');

// Match the browser's Profile pipeline before signing fixture approval. A saved
// targeting edit must be confirmed into canonical Profile context first.
function companyFixtureProfileRuntime(){
 const vm=require('node:vm'),readFileSync=require('node:fs').readFileSync,r={URL,console,Date,TextEncoder};vm.createContext(r);
 for(const file of ['step2-brief-schema.js','profile-engine.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js','step2-readiness-engine.js','monitoring-model.js','market-engine.js','strategy-integrity.js'])vm.runInContext('(function(){'+readFileSync(require.resolve('../'+file),'utf8')+'\n})()',r);
 r.LeadIntelStep2Readiness.patchProfileEngine(r.LeadIntelProfile,r);
 return r;
}


test('authenticated Companies preserves mixed scores, honest shortfall and the pending queue across SQL save and browser reopen',{timeout:90000},async t=>{
 if(!process.execArgv.some(a=>a.includes('register-wasm-loader'))){t.skip('The required Profile/Strategy browser job runs this SQL journey with the WASM loader.');return;}
 const {journeyFixture,loadPlaywright,sessionToken}=await import('../../backend/test/step5-journey-fixture.mjs');
 const {ready,settleInitialSave}=await import('../../scripts/verify-step5-journey.mjs');
 const {chromium}=await loadPlaywright(),f=await journeyFixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let context;
 const dir='/tmp/leadintel-company-search-outcome';await fs.mkdir(dir,{recursive:true});
 async function open(){context=await browser.newContext({viewport:{width:1440,height:1100}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const p=await context.newPage();await p.goto(f.origin+'/customer/');await ready(p);await p.waitForFunction(()=>typeof discovery!=='undefined'&&discovery&&window.LeadIntelDiscoveryUI?.getCompanyOutcome);return p;}
 try{
  const initial=await f.getState();initial.payload.meta.discovery.activeJourneyStage=4;
  const input=initial.payload.main;input.answers.exclusions='companies with less than 30 people';input.profile.exclusions='ISO 9001 certification required';
  assert.equal(input.profile.canonical.fields.exclusions.value,'none','the controlled edit starts with superseded canonical exclusions');
  const r=companyFixtureProfileRuntime(),normalize=saved=>{const restored=r.LeadIntelProfile.normalizeSavedState(JSON.parse(JSON.stringify(saved)));restored.market=r.LeadIntelMarket.recoverInterruptedResearch(saved.market);return restored;};
  const main=normalize(input);assert.equal(main.approved,false,'changing authoritative exclusions requires fresh Profile confirmation');
  assert.equal(main.profile.exclusions,'companies with less than 30 people','confirmed targeting replaces superseded generated exclusions');
  main.profile.companyClassification=r.LeadIntelCompanyBrain.classifyCompany(main);main.profile.customerPainPointsStatus='User confirmed';main.profile.customerPainPointsLanguage='en';
  r.LeadIntelCanonicalIntelligence.confirmProfileContext(main);main.approved=true;
  main.targetingConfirmation=require('../targeting-policy.js').confirm(main);main.market.strategyApproval=r.LeadIntelStrategyIntegrity.approval(main);
  assert.equal(r.LeadIntelStrategyIntegrity.status(main).current,true);
  let reloaded=main;for(let cycle=0;cycle<2;cycle++){reloaded=normalize(reloaded);assert.equal(reloaded.approved,true,'reviewed Profile remains approved on reload '+cycle);assert.equal(r.LeadIntelStrategyIntegrity.status(reloaded).current,true,'Strategy remains current on reload '+cycle);assert.equal(reloaded.profile.exclusions,'companies with less than 30 people');}
  initial.payload.main=main;await f.replace(initial.payload,initial.version);
  let page=await open();await settleInitialSave(page);
  await page.evaluate(()=>{
   const profile=companyQualificationProfile(mainState()),now=new Date().toISOString();
   discovery.candidates=[81,69].map((fit,i)=>{
    const company=i?'Beacon Machinery':'Atlas Machinery',domain=i?'beacon-machinery.example':'atlas-machinery.example';
    const text=`${company} manufactures industrial equipment in Sweden. Our production facilities use industrial automation to coordinate manufacturing operations and improve production flow. Engineering teams plan and operate the machinery used for our industrial customers. We employ 120 people.`;
    const evidence=[{url:`https://${domain}/operations`,title:company+' operations',text,sourceRead:true,verifiedAt:now},{url:`https://industry-journal.example/company-${i}`,title:company+' factory',text:`${company} manufactures industrial equipment in Sweden for business customers.`,sourceRead:true,verifiedAt:now}];
    const c=LeadIntelDiscovery.parseBuyerFit(JSON.stringify({companies:[{domain,fit,relationship:'buyer',offerId:'offer-0',reason:'Production equipment creates a specific inferred application for the approved industrial automation offer.',buyerRole:'industrial manufacturer',evidence:[{sourceId:'source-0',quote:text}]}]}),[{company,domain,website:`https://${domain}/`,market:'Sweden',evidence}],profile)[0];
    if(profile.exclusions!=='companies with less than 30 people')throw new Error('Superseded generated exclusions leaked into current targeting');
    const q=LeadIntelDiscovery.assessCompanyQualification(c,profile,mainState().market,{researchedAt:now});
    return {...c,strategyFingerprint:fingerprint(),searchContextKey:LeadIntelDiscovery.searchContextKey(profile),researchedAt:now,qualification:q,qualified:q.eligible,marketVerified:q.eligible,buyerVerified:q.eligible,score:{total:q.score,fit:q.buyerFitPoints,signal:q.signalPoints},needsRecheck:false,people:[]};
   });
   discovery.potentialMatches=Array.from({length:22},(_,i)=>({company:`Pending Manufacturer ${i}`,domain:`pending-${i}.example`,website:`https://pending-${i}.example/`,market:'Sweden',evidence:[{url:`https://pending-${i}.example/`,title:`Pending Manufacturer ${i}`,text:`Pending Manufacturer ${i} is mentioned as a manufacturer in Sweden; its operating scope still needs verification.`,evidenceKind:'search_excerpt'}],qualificationGaps:['Verify readable operating evidence'],searchContextKey:LeadIntelDiscovery.searchContextKey(profile)}));
   discovery.status='complete';discovery.lastRunAt=now;discovery.needsRefresh=false;discovery.funnel={...discovery.funnel,companiesIdentified:25,companySitesChecked:9,qualifiedCompanies:2};
   saveMeta({...loadMeta(),activeJourneyStage:4,targetCount:5,autonomousDiscovery:{active:false,pass:3,maxPasses:3,exhausted:true,callsUsed:90,callLimit:200},lastCompanyRun:{startedAt:now,completedAt:now,status:'complete'}});saveDiscovery();
  });
  await settleInitialSave(page);await page.locator('.steps [data-workflow-stage="4"] strong').click();
  async function check(){await page.locator('#company-search-progress').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('company-candidates')?.textContent.includes('2 checked companies'));const text=await page.locator('#company-candidates').textContent();assert.match(text,/1 strong fit \(80\+\)/);assert.match(text,/Manual review · below 80/);assert.match(text,/pass limit/);assert.doesNotMatch(text,/2 qualified companies|exhausted the current research budget/);assert.doesNotMatch(await page.locator('#step-5 .discovery-panel').textContent(),/Qualified companies/);assert.match(await page.locator('#company-review-batch').textContent(),/22 companies awaiting review/);assert.match(await page.locator('#company-search-progress').textContent(),/Search paused · 1 of 5 strong fits/);assert.equal(await page.locator('#company-search-progress [aria-valuenow="100"]').count(),0);}
  await check();await page.locator('.company-search-advanced summary').click();await page.locator('#discovery-web-cap').fill('20');await page.locator('#discovery-web-cap').dispatchEvent('change');assert.match(await page.locator('#discovery-cost-estimate').textContent(),/up to 20 Firecrawl calls/);assert.match(await page.locator('#company-research-usage').textContent(),/Detailed usage was not recorded/);await page.locator('.company-search-advanced summary').click();await page.evaluate(()=>{discovery.researchAudit={version:1,requestId:'test-request',startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),goal:'strong_fit',entries:[{id:'op-1',operation:'search',phase:'market-presence',key:'test-key',outcome:'succeeded',resultCount:2,status:200},{id:'op-2',operation:'search',phase:'market-presence',key:'test-key',outcome:'reused',resultCount:2,status:200}]};saveDiscovery();renderAll();});assert.match(await page.locator('#company-research-usage').textContent(),/1 requests · 1 searches · 0 page reads · 1 reused/);await page.screenshot({path:dir+'/desktop.png',fullPage:true});await page.locator('#company-search-progress').screenshot({path:dir+'/desktop-outcome.png'});await page.locator('#company-candidates').screenshot({path:dir+'/desktop-candidates.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:dir+'/mobile.png',fullPage:true});await page.locator('#company-search-progress').screenshot({path:dir+'/mobile-outcome.png'});
  await settleInitialSave(page);await context.close();page=await open();await page.locator('.steps [data-workflow-stage="4"] strong').click();await check();assert.equal(await page.locator('#discovery-web-cap').inputValue(),'20');
  const saved=(await f.getState()).payload;assert.equal(saved.discovery.researchAudit.entries.length,2);assert.match(await page.locator('#company-research-usage').textContent(),/1 reused/);assert.equal(saved.discovery.candidates.length,2);assert.equal(saved.discovery.potentialMatches.length,22);assert.equal(saved.discovery.selectedProspects.length,1);assert.equal(f.providerCalls.length,0,'opening results cannot start paid or public contact research');
  await fs.writeFile(dir+'/evidence.json',JSON.stringify({realAuth:true,realSql:true,checked:2,strongFit:1,pending:22,shortfallVisible:true,passLimitNotBudget:true,reopen:true,mobile:true,selectedCompanyPreserved:true,newResearchCalls:0,outreachSent:0},null,2));
 }catch(error){const p=context?.pages().at(-1);if(p){await p.screenshot({path:dir+'/failure.png',fullPage:true});const diagnostic=await p.evaluate(()=>({cards:document.getElementById('company-candidates')?.textContent,active:document.querySelector('.step-view.active')?.id,status:discovery?.status,context:companyQualificationProfile(mainState()),candidates:(discovery?.candidates||[]).map(c=>({company:c.company,needsRecheck:c.needsRecheck,current:companyStrategyCurrent(c),assessment:qualificationAssessment(c),fitIssue:c.buyerFitIssue,fitContext:c.buyerFit?.context})),outcome:companySearchOutcome()}));await fs.writeFile(dir+'/failure.json',JSON.stringify(diagnostic,null,2));console.error(JSON.stringify({active:diagnostic.active,status:diagnostic.status,candidates:diagnostic.candidates.map(c=>({company:c.company,needsRecheck:c.needsRecheck,current:c.current,gaps:c.assessment.gaps,score:c.assessment.score}))}));}throw error;
 }finally{await context?.close();await browser.close();await f.close();}
});

for(const cap of [20,1])test('the real review button survives a pointer-time refresh and persists its bounded batch · cap '+cap,{timeout:90000},async t=>{
 if(!process.execArgv.some(a=>a.includes('register-wasm-loader'))){t.skip('The mandatory Profile/Strategy browser job executes this SQL journey.');return;}
 const {journeyFixture,loadPlaywright,sessionToken}=await import('../../backend/test/step5-journey-fixture.mjs');
 const {ready,settleInitialSave}=await import('../../scripts/verify-step5-journey.mjs');
 const {chromium}=await loadPlaywright(),f=await journeyFixture(),requests=[];
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let context;
 let expectedMaterial=null;
 const dir='/tmp/leadintel-company-review-button'+(cap===20?'':'/cap-1');await fs.mkdir(dir,{recursive:true});
 async function open(){
  context=await browser.newContext({viewport:{width:1440,height:1100}});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(/firecrawl(?:\/|-)search|firecrawl(?:\/|-)scrape/.test(url.pathname)){
    requests.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})});
   }
   if(url.pathname==='/api/ai/generate')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:'{"companies":[]}'})});
   if(url.pathname==='/api/ai/web-search')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[]})});
   return url.origin===f.origin?route.continue():route.abort();
  });
  await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
  const p=await context.newPage();await p.goto(f.origin+'/customer/');await ready(p);
  await p.waitForFunction(()=>typeof discovery!=='undefined'&&discovery&&window.LeadIntelDiscoveryUI?.getCompanyOutcome);
  await p.locator('.steps [data-workflow-stage="4"] strong').click();return p;
 }
 try{
  const initial=await f.getState(),storedMarket=initial.payload.main.market;
  // Match the app's canonical saved shape before approving this controlled fixture.
  const main=require('../step2-brief-schema.js').migrateState(require('../profile-engine.js').normalizeSavedState(initial.payload.main));
  main.profile.companyClassification=require('../company-brain.js').classifyCompany({...main,profile:main.profile});
  main.profile.customerPainPointsStatus='User confirmed';main.profile.customerPainPointsLanguage='en';
  main.market=require('../market-engine.js').recoverInterruptedResearch(storedMarket||{});
  initial.payload.main=main;
  main.targetingConfirmation=require('../targeting-policy.js').confirm(main);
  main.market.strategyApproval=require('../strategy-integrity.js').approval(main);
  initial.payload.meta.discovery={...initial.payload.meta.discovery,activeJourneyStage:4,targetCount:5,webCallCap:cap};
  initial.payload.discovery={...initial.payload.discovery,status:'complete',lastRunAt:'2026-11-10T10:00:00Z',potentialMatches:Array.from({length:31},(_,i)=>({company:`Pending Manufacturer ${i}`,domain:`pending-${i}.example`,website:`https://pending-${i}.example/`,market:'Sweden',evidence:[{url:`https://pending-${i}.example/`,title:`Pending Manufacturer ${i}`,text:`Pending Manufacturer ${i} is mentioned as a manufacturer in Sweden; its operating scope needs verification.`,evidenceKind:'search_excerpt'}],qualificationGaps:['Verify readable operating evidence']}))};
  await f.replace(initial.payload,initial.version);expectedMaterial=require('../strategy-integrity.js').material((await f.getState()).payload.main);let page=await open();await settleInitialSave(page);
  const button=page.locator('#review-next-companies');await button.waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('review-next-companies')?.disabled);await button.scrollIntoViewIfNeeded();
  assert.equal(requests.length,0,'rendering the saved queue never starts research');
  await button.evaluate(el=>{el.dataset.pressedIdentity='kept';});const box=await button.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(()=>renderCompanyReviewBatch());
  assert.equal(await button.getAttribute('data-pressed-identity'),'kept','the same DOM control must survive between pointer down and up');
  await page.mouse.up();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').companyReviewQueue?.lastBatch?.finishedAt);
  assert.ok(requests.length>0&&requests.length<=cap);assert.match(requests.find(body=>body.query)?.query||'',/Pending Manufacturer|pending-/);
  await settleInitialSave(page);const saved=(await f.getState()).payload,batch=saved.meta.discovery.companyReviewQueue.lastBatch;
  assert.equal(batch.domains.length,5);assert.ok(batch.finishedAt);assert.equal(saved.discovery.potentialMatches.length,31);assert.equal(saved.discovery.selectedProspects.length,1);
  if(cap===1){assert.equal(requests.length,1);assert.equal(saved.discovery.status,'partial');assert.equal(saved.meta.discovery.lastCompanyRun.budgetIncomplete,true);assert.equal(batch.completedCount,0);assert.equal(batch.pendingCount,5);for(const domain of batch.domains){const completedAt=saved.meta.discovery.targetResearchByDomain?.[domain]?.completedAt;assert.notEqual(completedAt,saved.discovery.lastRunAt,'unfinished target must not get a new completion timestamp');if(completedAt)assert.equal(completedAt,'2026-11-10T10:00:00Z','retain the earlier research timestamp');}assert.equal(await page.evaluate(()=>LeadIntelTaskCentre.list().find(task=>task.type==='company-discovery')?.status),'partial');assert.equal(await page.locator('#company-search-progress').getAttribute('data-state'),'partial');assert.equal(await page.locator('#company-search-progress [aria-valuenow=\"100\"]').count(),0);}
  await page.screenshot({path:dir+'/completed.png',fullPage:true});await context.close();page=await open();
  await page.waitForFunction(()=>document.getElementById('company-review-batch')?.textContent.includes('Last batch:'));
  assert.match(await page.locator('#company-review-batch').textContent(),/still need evidence/);
  assert.equal((await f.getState()).payload.meta.discovery.companyReviewQueue.lastBatch.id,batch.id);
  if(cap===1){assert.equal((await f.getState()).payload.discovery.status,'partial');assert.equal(await page.evaluate(()=>LeadIntelDiscoveryUI.getCompanyOutcome().stopReason),'budget_limit');assert.match(await page.locator('#company-search-progress').textContent(),/Search paused|1 of 1 calls/);}
  await fs.writeFile(dir+'/evidence.json',JSON.stringify({realAuth:true,realSql:true,pointerRefresh:true,requests:requests.length,cap,reservedCompanies:5,savedQueue:31,reopen:true,paidContactCalls:0,outreachSent:0},null,2));
 }catch(error){const page=context?.pages().at(-1);if(page){await page.screenshot({path:dir+'/failure.png',fullPage:true});const diagnostic=await page.evaluate(expected=>{const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;const actual=LeadIntelStrategyIntegrity.material(mainState());return {active:document.querySelector('.step-view.active')?.id,status:typeof discovery!=='undefined'?discovery?.status:null,pending:typeof discovery!=='undefined'?discovery?.potentialMatches?.length:null,panel:document.getElementById('company-review-batch')?.textContent,button:document.getElementById('review-next-companies')?.outerHTML,materialChanges:expected?Object.keys(actual).filter(k=>JSON.stringify(stable(actual[k]))!==JSON.stringify(stable(expected[k]))).map(k=>({field:k,before:expected[k],after:actual[k]})):[]};},expectedMaterial);await fs.writeFile(dir+'/failure.json',JSON.stringify(diagnostic,null,2));console.error(JSON.stringify(diagnostic));}throw error;
 }finally{await context?.close();await browser.close();await f.close();}
});
