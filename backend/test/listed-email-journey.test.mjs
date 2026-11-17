import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {step7Fixture} from './step7-journey-fixture.mjs';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import {loadPlaywright,sessionToken} from './step5-journey-fixture.mjs';
const require=createRequire(import.meta.url),Market={...require('../../customer/market-engine.js')},Lookalike=require('../../customer/lookalike-discovery.js'),Profile=require('../../customer/profile-engine.js'),Strategy=require('../../customer/strategy-integrity.js');
const reviewedDraft={subject:'Robert — listed company email review',message:'Hello Robert,\n\nThis is our reviewed message for your team.\n\nWould you be open to a 20-minute Zoom call?\nhttps://calendly.com/fixture/intro\n\nBest regards,\nRobin Lane'};

test('listed named work email travels through real Buyers, CRM, approval and unsent Delivery after a fresh browser reopen',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required in buyer evidence CI.');return;}
 const f=await step7Fixture({activated:true,connected:false,additionalFetch:async(input,options={})=>{if(new URL(typeof input==='string'?input:input.url).hostname!=='api.openai.com')return;const body=JSON.parse(options.body),data=JSON.parse(body.input||'{}');return Response.json({output_text:JSON.stringify(body.tools?{results:[]}:data.sources||data),...(body.tools?{output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]}:{}),usage:{input_tokens:10,output_tokens:20}});}}),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];let page;
 try{
  const callsBefore=f.calls.length;
  f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,1)').run(f.candidate.workspace_id||'storage-w1','openai',await encryptSecret('listing-fixture-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY)),'fixture','gpt-6.1-sol');
  const saved=await f.getState(),candidate=saved.payload.discovery.selectedProspects[0],person=candidate.people.find(p=>p.id==='robert'),url='https://directory.example/robert-lund';
  // Review the fixture's fully seeded Strategy, including the same optional ICPs
  // and localized model shapes that a fresh production browser restores.
  require('../../customer/opportunity-led-icp.js').install(Market);
  const main=saved.payload.main,generated=main.profile.recommendedSignals?.length?main.profile.recommendedSignals:globalThis.LeadIntelCompanyBrain?.recommendSignals?.({profile:main.profile,answers:main.answers})||Profile.recommendedSignalsForProfile(main.profile)||[];
  main.profile.recommendedSignals=generated;main.market.signals=Market.normalizeSignals(generated,main.market.signals,main.market.deletedSignalIds);
  if(!main.market.opportunities.length)main.market.opportunities=Market.buildMarketOpportunities(main.profile,main.market.icps,main.market.signals,[],'en');
  main.market=Market.localizeGeneratedState(main.market,main.profile,'en');main.market.icps=Lookalike.syncReferenceLookalikeIcp(main.market.icps,main.profile,null,'en');main.market.strategyApproved=true;main.market.strategyApproval=Strategy.approval(main);
  Object.assign(person,{publicEmailUrl:url,publicEmailEvidence:null,publicEmailSourceCheck:null,emailResearch:{status:'partial',searches:4,failed:1}});
  f.DB.raw.prepare("UPDATE crm_contacts SET email_status='public_unverified',verification_provider=NULL,verified_at=NULL,public_email_url=?,source='public_research' WHERE external_person_id='robert'").run(url);
  saved.payload.main.step=5;Object.assign(saved.payload.meta.discovery,{activeJourneyStage:5,visibleStep:5,activeBuyerCompanyDomain:candidate.domain});delete saved.payload.meta.discovery.scriptBuyer;
  await f.replace(saved.payload,saved.version);
  async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready);return page;}
  page=await open();await page.locator('[data-workflow-stage="5"] strong').click();await page.locator('#step-5.active').waitFor();
  const proceed=page.locator('[data-keep-buyer][data-person-id="robert"]');await proceed.waitFor();assert.equal(await proceed.isEnabled(),true);
  assert.match(await proceed.locator('..').locator('..').textContent(),/Listed company email accepted/);
  await proceed.click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId==='robert');
  const contact=f.DB.raw.prepare("SELECT * FROM crm_contacts WHERE external_person_id='robert' AND archived_at IS NULL").get();assert.equal(contact.email_status,'public_listed');assert.equal(contact.public_email_url,url);assert.equal(contact.verification_provider,null);assert.equal(contact.verified_at,null);
  await page.locator('#step-6.active').waitFor();
  await page.waitForFunction(()=>document.getElementById('message-recipient')?.textContent==='Robert Lund');
  assert.equal(await page.locator('.step-view.active').count(),1);
  await page.screenshot({path:'/tmp/proceed-messages-desktop.png',fullPage:true});
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);
  await page.context().close();page=await open();await page.locator('#step-6.active').waitFor();
  await page.waitForFunction(()=>document.getElementById('message-recipient')?.textContent==='Robert Lund');
  await page.setViewportSize({width:390,height:844});await page.locator('#back-to-discovery').click();await page.locator('#step-5.active').waitFor();
  const selected=page.locator('[data-keep-buyer][data-person-id="robert"]');assert.equal(await selected.getAttribute('aria-pressed'),'true');await selected.click();await page.locator('#step-6.active').waitFor();
  await page.waitForFunction(()=>document.getElementById('message-recipient')?.textContent==='Robert Lund');
  await page.screenshot({path:'/tmp/proceed-messages-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('[data-writing-style="professional"]').click();
  await page.waitForFunction(()=>document.getElementById('outreach-email-body')?.value?.trim()&&document.getElementById('mw-edit-message')?.disabled===false&&document.getElementById('mw-preparing-editor')?.hidden,null,{timeout:25000});
  await page.locator('#mw-edit-message').click();await page.locator('#outreach-email-subject').fill(reviewedDraft.subject);await page.locator('#outreach-email-body-rich').fill(reviewedDraft.message);await page.locator('#mw-save-message').click();await page.waitForFunction(()=>document.getElementById('mw-draft-badge')?.textContent==='Saved');
  assert.equal(await page.evaluate(()=>{const item=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}').items.find(i=>i.selectedPersonId==='robert');return item.approved===false&&LeadIntelOutreach.buildApprovedSendPayload(item)===null;}),true,'a saved listing and working draft still need message approval');
  await page.locator('#mw-add-flow').click();await page.locator('#step-7.active').waitFor();await page.waitForFunction(()=>document.getElementById('delivery-recipient')?.value==='robert@forge.example');
  assert.equal(await page.locator('#delivery-preview-subject').textContent(),reviewedDraft.subject);assert.equal(await page.evaluate(()=>LeadIntelRichText.toText(document.getElementById('delivery-preview-body').innerHTML)),reviewedDraft.message);
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);await page.context().close();page=await open();await page.locator('[data-workflow-stage="7"] strong').click();await page.locator('#step-7.active').waitFor();await page.waitForFunction(()=>document.getElementById('delivery-recipient')?.value==='robert@forge.example');
  assert.equal(await page.locator('#delivery-preview-subject').textContent(),reviewedDraft.subject);
  const restored=await f.getState(),buyer=restored.payload.discovery.selectedProspects[0].people.find(p=>p.id==='robert');assert.equal(buyer.publicEmailUrl,url);assert.equal(buyer.emailResearch.status,'partial');
  for(const table of ['gmail_messages','crm_enrichment_requests','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);assert.equal(f.providerRequests.length,0);assert.deepEqual(errors,[]);
  assert.ok(!f.calls.slice(callsBefore).some(call=>call.path.includes('/confirm-public-email')),'no source reread or paid confirmation is needed during the handoff');
  t.diagnostic(JSON.stringify({listedEmailAccepted:true,oneClickProceed:true,repeatedSelectedProceed:true,messagesFreshReopen:true,mailboxVerificationClaim:false,crmAcknowledged:true,messageApprovalRequired:true,exactRecipientAndDraft:true,unsentDelivery:true,freshBrowserReopen:true,partialResearchRetained:true,paidLookups:0,outboundMessages:0}));
 }catch(error){if(page&&!page.isClosed())t.diagnostic(JSON.stringify({active:await page.locator('.step-view.active').getAttribute('id').catch(()=>''),toast:await page.locator('#toast').textContent().catch(()=>''),approval:await page.evaluate(()=>{const main=JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}'),outreach=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}'),item=outreach.items?.find(i=>i.selectedPersonId==='robert');return {approved:item?.approved,packages:window.LeadIntelDelivery?.approvedDeliveryPackages?.(outreach,main)?.length,source:item&&LeadIntelOutreach.sourceAuthorityCurrent(item,main,outreach.messageStudio),currentSource:LeadIntelOutreach.messageSourceAuthority(main,outreach.messageStudio),authority:item?.approvalAuthority};}).catch(()=>null),errors,requests:f.calls.slice(-12).map(({path,method,status})=>({path,method,status}))}));throw error;}finally{await browser.close();await f.close();}
});
