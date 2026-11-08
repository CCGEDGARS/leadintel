import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step1Fixture} from '../backend/test/step1-journey-fixture.mjs';
import {loadPlaywright,sessionToken} from '../backend/test/step5-journey-fixture.mjs';

export async function verifyTargetingConfirmation({artifactDir='/tmp/leadintel-targeting-confirmation'}={}){
 const f=await step1Fixture();await f.connectControlledExtraction();await f.connectControlledAi();
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[],evidence={};await fs.mkdir(artifactDir,{recursive:true});
 const answers={priority_offers:'Drawing development; Custom metal manufacturing; On-site installation',ideal_customer:'Manufacturers in Denmark with installation projects',buyer_roles:'Engineering Director; Procurement Manager',exclusions:'No work outside confirmed technical scope'};
 async function open(width=1440){const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated&&window.LeadIntelCustomerNavigation);return page;}
 try{
  let page=await open();await page.locator('#company-website').fill('seller.example');await page.locator('#activate-website').click();await page.waitForFunction(()=>document.getElementById('website-activation-status')?.dataset.state==='active');await page.locator('[data-target-market="Sweden"]').click();await page.locator('#to-questionnaire').click();await page.locator('#step-2.active').waitFor();
  for(const [id,value] of Object.entries(answers))await page.locator(`[data-question="${id}"]`).fill(value);
  assert.equal(await page.evaluate(()=>Boolean(window.__leadIntelLocalStrategyConflict)),false,'normal answer edits must not create a Strategy conflict');
  await page.locator('#confirm-targeting').click();await page.waitForFunction(()=>document.getElementById('confirm-targeting')?.textContent.includes('confirmed'));
  await page.waitForFunction(()=>!document.getElementById('confirm-targeting')?.disabled);
  const saved=(await f.getState()).payload.main;assert.equal(saved.targetingConfirmation?.version,1);for(const [id,value] of Object.entries(answers))assert.equal(saved.answers[id],value);evidence.confirmedThroughHttp=true;
  await page.context().close();page=await open(390);await page.evaluate(()=>LeadIntelCustomerNavigation.setStep(2));await page.locator('#step-2.active').waitFor();assert.match(await page.locator('#confirm-targeting').textContent(),/confirmed/);for(const [id,value] of Object.entries(answers))assert.equal(await page.locator(`[data-question="${id}"]`).inputValue(),value);evidence.freshBrowserReopen=true;
  await page.waitForFunction(()=>['priority_offers','ideal_customer','buyer_roles','exclusions'].every(id=>document.querySelector(`[data-answer-save="${id}"]`)?.textContent.includes('Saved to LeadIntel')));evidence.savedBadgesAgree=true;
  await page.locator('#confirm-targeting').scrollIntoViewIfNeeded();await page.screenshot({path:artifactDir+'/confirmed-mobile.png'});const bounds=await page.locator('#confirm-targeting').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);evidence.mobileButtonVisible=true;
  f.failSaves();await page.locator('[data-question="buyer_roles"]').fill('Procurement Manager; Operations Director');await page.locator('#confirm-targeting').click();await page.waitForFunction(()=>/retry|could not|not confirmed|failed/i.test(document.getElementById('targeting-confirmation-status')?.textContent||''),null,{timeout:45000});assert.doesNotMatch(await page.locator('#toast').textContent(),/confirmed and saved/i);assert.equal(await page.locator('#confirm-targeting').isEnabled(),true);evidence.failedSaveIsActionable=true;
  f.failSaves(false);await page.locator('#confirm-targeting').click();await page.waitForFunction(()=>/Saved\./.test(document.getElementById('targeting-confirmation-status')?.textContent||''));assert.equal((await f.getState()).payload.main.answers.buyer_roles,'Procurement Manager; Operations Director');evidence.retrySaved=true;
  await page.context().close();evidence.pageErrors=errors;assert.deepEqual(errors,[]);await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));return evidence;
 }finally{await browser.close();await f.close();}
}
