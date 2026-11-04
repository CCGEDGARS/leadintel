import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from '../backend/test/step5-journey-fixture.mjs';
import {importAesKey,encryptSecret} from '../backend/src/oauth.js';
import {upsertCrmIntelligence,getCrmCompany} from '../backend/src/crm.js';
import fixture from '../customer/test/fixtures/manual-paid-company.cjs';
import {ready,settleInitialSave} from './verify-step5-journey.mjs';
import '../customer/crm-engine.js';
export async function verifyManualPaidJourney(){
 const {candidate}=fixture(),providerCalls=[],f=await journeyFixture({initialCandidate:candidate,externalFetch:async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);if(url.hostname!=='treg.to')return;
  const body=JSON.parse(options.body||'{}');if(url.pathname.startsWith('/call/'))providerCalls.push({path:url.pathname,body});
  const output=url.pathname.includes('email.find')?{email:'anna@nordic.se',full_name:'Anna Buyer'}:url.pathname.includes('email.verify')?{email:'anna@nordic.se',status:'valid'}:{full_name:'Anna Buyer',title:'Procurement Director',company_name:'Nordic'};
  return Response.json({output,raw:url.pathname.includes('email.verify')?{email:'anna@nordic.se',result:'deliverable',is_accept_all:false}:{}},{headers:{'X-Treg-Call-Id':'controlled-'+providerCalls.length,'X-Treg-Cost-Micro':'1000'}});
 }});
 const context={workspaceId,userId:'storage-owner',role:'owner'};
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');const encrypted=await encryptSecret('controlled-test-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at) VALUES(?,'treg',?,'test','{}',datetime('now'))").run(workspaceId,encrypted);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,1,0,'treg',3,30,2,'storage-owner')").run(workspaceId);
 await upsertCrmIntelligence(f.env.DB,context,f.candidate.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(f.candidate).intelligence);
 const request=body=>fetch(f.origin+'/api/additional-contact-services/email?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({company_id:f.candidate.crmId,person_id:'buyer-anna',provider:'treg',email_lookup:true,...body})});
 const automated=await request({automatic:true});assert.equal(automated.status,409);assert.equal((await automated.json()).code,'ADDITIONAL_CONTACT_COMPANY_REQUIRED');
 const wrongPerson=await request({approved:true,person_id:'other-buyer'});assert.equal(wrongPerson.status,409);
 f.DB.raw.prepare('UPDATE additional_contact_policies SET enabled=0 WHERE workspace_id=?').run(workspaceId);
 assert.equal((await request({approved:true,data_lookup:true})).status,403);
 f.DB.raw.prepare('UPDATE additional_contact_policies SET enabled=1 WHERE workspace_id=?').run(workspaceId);
 assert.equal(providerCalls.length,0,'blocked requests cannot reach paid providers');
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let ctx;
 try{
  async function open(){ctx=await browser.newContext({viewport:{width:1440,height:1100}});await ctx.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await ctx.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await ctx.newPage();await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);return page;}
  let page=await open();
  // Bind the controlled company evidence to the active strategy before the test action.
  f.candidate.strategyFingerprint=await page.evaluate(()=>fingerprint());f.candidate.needsRecheck=false;
  await upsertCrmIntelligence(f.env.DB,context,f.candidate.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(f.candidate).intelligence);
  const state=await f.getState();state.payload.discovery.selectedProspects=[f.candidate];await f.replace(state.payload,state.version);await ctx.close();page=await open();
  const email='[data-prospect-enrich-email][data-person-id="buyer-anna"]',proceed='[data-keep-buyer][data-person-id="buyer-anna"]';
  const assessment=await page.evaluate(()=>qualificationAssessment(discovery.selectedProspects[0]));assert.deepEqual(assessment.gaps,['Verify a specific purchasing application for a confirmed offer']);
  await page.locator('details.buyer-other-contacts').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  assert.equal(await page.locator(proceed).isDisabled(),true);await page.locator(email).click();
  const dialog=page.getByRole('dialog');try{await dialog.waitFor({timeout:5000});}catch(error){throw Error('Paid dialog did not open: '+JSON.stringify(await page.evaluate(()=>{const c=discovery.selectedProspects[0],p=c.people[0];return {needsRecheck:c.needsRecheck,assessment:qualificationAssessment(c),readiness:LeadIntelAdditionalContacts.readiness(c,p),verification:p.contactVerification,policy:LeadIntelAdditionalContacts.policy()};})));}assert.match(await dialog.textContent(),/Purchasing-fit review is still pending/);await dialog.getByRole('button',{name:'Confirm email',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-prospect-enrich-email][data-person-id="buyer-anna"]')?.getAttribute('aria-pressed')==='true',null,{timeout:20000});
  assert.equal(await page.locator(proceed).isDisabled(),false);
  const detail=await getCrmCompany(f.env.DB,context,f.candidate.crmId);assert.equal(detail.contacts.find(c=>c.external_person_id==='buyer-anna')?.work_email,'anna@nordic.se');assert.equal(detail.intelligence.research_snapshot.qualification.eligible,false);
  assert.equal(providerCalls.filter(c=>c.path.includes('email.find')).length,1);assert.equal(providerCalls.filter(c=>c.path.includes('phone')).length,0);
  await settleInitialSave(page);const calls=providerCalls.length;await ctx.close();page=await open();assert.equal(await page.locator(email).getAttribute('aria-pressed'),'true');assert.equal(await page.locator(proceed).isDisabled(),false);await page.locator(email).click();assert.equal(providerCalls.length,calls,'confirmed data must not be repurchased: '+JSON.stringify(providerCalls.map(c=>c.path)));
  assert.equal(f.calls.filter(c=>/send|enqueue|sequence/.test(c.path)).length,0);
  const evidence={realHttp:true,realCrmSave:true,controlledProvider:true,emailFindCalls:1,phoneCalls:0,reopenConfirmed:true,repeatClickPaidCalls:0,companyFitStillPending:true,outboundMessages:0,privateCustomerAcceptance:false};
  await fs.writeFile('/tmp/manual-paid-browser-evidence.json',JSON.stringify(evidence,null,2));return evidence;
 }finally{await ctx?.close();await browser.close();await f.close();}
}
