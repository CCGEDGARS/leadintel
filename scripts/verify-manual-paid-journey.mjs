import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from '../backend/test/step5-journey-fixture.mjs';
import {importAesKey,encryptSecret} from '../backend/src/oauth.js';
import {handleApolloCrmWebhook} from '../backend/src/crm-routes.js';
import {upsertCrmIntelligence,getCrmCompany} from '../backend/src/crm.js';
import fixture from '../customer/test/fixtures/manual-paid-company.cjs';
import {ready,settleInitialSave} from './verify-step5-journey.mjs';
import '../customer/crm-engine.js';
export async function verifyManualPaidJourney(){
 let callback;
 const {candidate}=fixture(),providerCalls=[],pageErrors=[],f=await journeyFixture({initialCandidate:candidate,profileExclusions:'companies with fewer than 20 employees',externalFetch:async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);if(url.hostname==='api.apollo.io'){
   assert.equal(url.searchParams.get('reveal_phone_number'),'true');
   callback=url.searchParams.get('webhook_url');providerCalls.push({path:url.pathname});
   return Response.json({request_id:'controlled-anna',person:{id:'buyer-anna',name:'Anna Buyer',title:'Procurement Director',organization:{name:'Nordic',primary_domain:'nordic.se'},linkedin_url:'https://linkedin.com/in/anna-buyer'}});
  }
  if(url.hostname!=='treg.to')return;
  const body=JSON.parse(options.body||'{}');if(url.pathname.startsWith('/call/'))providerCalls.push({path:url.pathname,body});
  const output=url.pathname.includes('email.find')?{email:'anna@nordic.se',full_name:'Anna Buyer'}:url.pathname.includes('email.verify')?{email:'anna@nordic.se',status:'valid'}:url.pathname.includes('phone.find')?{full_name:'Anna Buyer',phone:'+46701234567'}:{full_name:'Anna Buyer',title:'Procurement Director',company_name:'Nordic'};
  return Response.json({output,raw:url.pathname.includes('email.verify')?{email:'anna@nordic.se',result:'deliverable',is_accept_all:false}:{}},{headers:{'X-Treg-Call-Id':'controlled-'+providerCalls.length,'X-Treg-Cost-Micro':'1000'}});
 }});
 Object.assign(f.env,{APOLLO_API_KEY:'controlled-test-key',APOLLO_WEBHOOK_URL:'https://fixture.example/api/webhooks/apollo/crm-contact',APOLLO_WEBHOOK_SECRET:'controlled-signing-secret'});
 const context={workspaceId,userId:'storage-owner',role:'owner'};
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');const encrypted=await encryptSecret('controlled-test-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at) VALUES(?,'treg',?,'test','{}',datetime('now'))").run(workspaceId,encrypted);
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json,verified_at) VALUES(?,'apollo',?,'test',?,datetime('now'))").run(workspaceId,encrypted,JSON.stringify({discovery_enabled:true,phone_enrichment_enabled:true}));
 f.DB.raw.prepare("INSERT INTO enrichment_policies(workspace_id,daily_credit_limit,monthly_credit_limit,phone_lookup_mode) VALUES(?,20,100,'on_request')").run(workspaceId);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,1,1,'treg',3,30,2,'storage-owner')").run(workspaceId);
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
  async function open(){ctx=await browser.newContext({viewport:{width:1440,height:1100}});await ctx.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await ctx.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await ctx.newPage();page.on('pageerror',error=>pageErrors.push(error.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);
   // Wait for the actual Profile owner and readiness adapter. Opening Messages
   // no longer saves derived defaults, so optional status fields need not exist
   // in storage before the user edits or saves Profile.
   await page.waitForFunction(()=>LeadIntelProfile.__step2ReadinessPatched&&window.LeadIntelProfileAnswers?.isReady?.(),null,{timeout:20000});
   await settleInitialSave(page);return page;}
  let page=await open();
  // Bind the controlled company evidence to the active strategy before the test action.
  f.candidate.strategyFingerprint=await page.evaluate(()=>fingerprint());f.candidate.needsRecheck=false;
  await upsertCrmIntelligence(f.env.DB,context,f.candidate.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(f.candidate).intelligence);
  const state=await f.getState();state.payload.discovery.selectedProspects=[f.candidate];await f.replace(state.payload,state.version);await ctx.close();page=await open();
  const email='[data-prospect-enrich-email][data-person-id="buyer-anna"]',proceed='[data-keep-buyer][data-person-id="buyer-anna"]';
  assert.equal(await page.evaluate(()=>discovery.selectedProspects[0].needsRecheck),false,'the controlled research must still belong to the initialized Profile after reopen');
  const assessment=await page.evaluate(()=>qualificationAssessment(discovery.selectedProspects[0]));assert.deepEqual(assessment.gaps,['Resolve exclusion checks','Verify a specific purchasing application for a confirmed offer']);
  await page.locator('details.buyer-other-contacts').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  assert.equal(await page.locator(proceed).isDisabled(),true);await page.locator(email).click();
  assert.equal(await page.getByRole('dialog').count(),0,'the explicit paid button must not ask again');
  await page.waitForFunction(()=>document.querySelector('[data-prospect-enrich-email][data-person-id="buyer-anna"]')?.getAttribute('aria-pressed')==='true',null,{timeout:20000});
  assert.equal(await page.locator(proceed).isDisabled(),false);
  const detail=await getCrmCompany(f.env.DB,context,f.candidate.crmId);assert.equal(detail.contacts.find(c=>c.external_person_id==='buyer-anna')?.work_email,'anna@nordic.se');assert.equal(detail.intelligence.research_snapshot.qualification.eligible,false);
  assert.equal(providerCalls.filter(c=>c.path.includes('email.find')).length,1);assert.equal(providerCalls.filter(c=>c.path.includes('phone')).length,0);
  const phone='[data-prospect-enrich-phone][data-person-id="buyer-anna"]';
  await page.locator(phone).click();
  const phoneResponse=page.waitForResponse(response=>response.url().includes('/api/additional-contact-services/email')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Find work phone'}).click();
  const response=await phoneResponse;assert.equal(response.status(),200,await response.text());
  const accepted=await handleApolloCrmWebhook(new Request(callback,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'success',credits_consumed:8,people:[{id:'buyer-anna',phone_numbers:[{sanitized_number:'+46701234567',status_cd:'valid_number',type_cd:'work_direct'}]}]})}),f.env,{});
  const settled=await accepted.json();assert.equal(accepted.status,200,JSON.stringify(settled));assert.equal(settled.contact?.phone_number,'+46701234567',JSON.stringify(settled));
  await settleInitialSave(page);await ctx.close();page=await open();
  await page.waitForFunction(()=>document.querySelector('[data-contact-channel=phone]')?.textContent.includes('+46701234567'),null,{timeout:20000});
  assert.equal(await page.getByRole('dialog').count(),0,'One phone approval authorizes the lookup for this buyer');
  assert.equal(providerCalls.filter(c=>c.path.endsWith('/people/match')).length,1);assert.equal(providerCalls.filter(c=>c.path.includes('phone.find')).length,0);
  assert.equal(providerCalls.filter(c=>c.path.includes('email.find')).length,1,'Phone must not buy email again');
  const withPhone=await getCrmCompany(f.env.DB,context,f.candidate.crmId);
  assert.equal(withPhone.contacts.find(c=>c.external_person_id==='buyer-anna'&&c.source==='apollo')?.phone_number,'+46701234567');
  assert.match(await page.locator('[data-contact-channel=phone]').first().textContent(),/verified|provider/i);
  await page.screenshot({path:'/tmp/manual-paid-browser-desktop.png',fullPage:true});
  await settleInitialSave(page);const calls=providerCalls.length;await ctx.close();page=await open();assert.equal(await page.locator(email).getAttribute('aria-pressed'),'true');assert.equal(await page.locator(proceed).isDisabled(),false);await page.locator(email).click();assert.equal(providerCalls.length,calls,'confirmed data must not be repurchased: '+JSON.stringify(providerCalls.map(c=>c.path)));
  assert.match(await page.locator('[data-contact-channel=phone]').first().textContent(),/\+46701234567/);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/manual-paid-browser-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,'mobile page must not overflow horizontally');
  assert.equal(f.calls.filter(c=>/send|enqueue|sequence/.test(c.path)).length,0);
  assert.deepEqual(pageErrors,[],'no browser runtime exceptions during paid lookup and reopening');
  assert.equal(f.calls.filter(c=>c.path==='/api/additional-contact-services/email'&&c.status===200).length,2,'both independent browser requests succeed');
  const evidence={realHttp:true,realCrmSave:true,controlledProvider:true,emailFindCalls:1,phoneCalls:1,noRepeatConfirmation:true,browserRuntimeErrors:0,phoneReopen:true,reopenConfirmed:true,repeatClickPaidCalls:0,companyFitStillPending:true,companyExclusionsStillPending:true,outboundMessages:0,privateCustomerAcceptance:false};
  await fs.writeFile('/tmp/manual-paid-browser-evidence.json',JSON.stringify(evidence,null,2));return evidence;
 }catch(error){
  const page=ctx?.pages().find(page=>!page.isClosed());
  const ui=page?await page.evaluate(()=>({profileReady:window.LeadIntelProfileAnswers?.isReady?.()===true,readinessReady:window.LeadIntelProfile?.__step2ReadinessPatched===true,buttons:[...document.querySelectorAll('[data-prospect-enrich-email],[data-prospect-enrich-phone],[data-keep-buyer]')].map(button=>({text:button.textContent.trim(),disabled:button.disabled,pressed:button.getAttribute('aria-pressed')})),notice:document.getElementById('toast')?.textContent})).catch(()=>null):null;
  const failure={error:error.message,pageErrors,providerPaths:providerCalls.map(call=>call.path),ui};
  await fs.writeFile('/tmp/manual-paid-browser-failure.json',JSON.stringify(failure,null,2));console.error('[manual-paid-journey] '+JSON.stringify(failure));throw error;
 }finally{await ctx?.close();await browser.close();await f.close();}
}
