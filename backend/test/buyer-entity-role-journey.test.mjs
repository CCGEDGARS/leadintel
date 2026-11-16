import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {step7Fixture,exactDrafts} from './step7-journey-fixture.mjs';
import {loadPlaywright,sessionToken,sourceUrl} from './step5-journey-fixture.mjs';
const require=createRequire(import.meta.url),Dossier=require('../../customer/company-dossier.js');

test('saved entity and named-country evidence filter the shortlist while the exact approved recipient and role survive reopening',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in buyer evidence CI.');return;}
 const f=await step7Fixture({activated:true,connected:false}),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];let page;
 try{
  const saved=await f.getState(),c=saved.payload.discovery.selectedProspects[0],stamp=new Date().toISOString();
  c.market='Sweden';c.buyerRoles=['Head of Procurement','Chief Operating Officer','Operations Director','Executive leadership'];
  c.people.push({id:'regional',name:'Robin West',publicName:'Robin West',title:'Managing Director, Forge Components Inc.',organization:c.company,country:'',publicNameUrl:sourceUrl,identityStatus:'confirmed',nameVerification:'confirmed',publicLinkedinUrl:'https://linkedin.com/in/robin-west',linkedinConfirmedUrl:'https://linkedin.com/in/robin-west',linkedinConfirmationMethod:'manual',linkedinConfirmedAt:stamp});
  c.people.push({id:'foreign',name:'Casey East',publicName:'Casey East',title:'Operations Director',organization:c.company,country:'',publicNameUrl:sourceUrl,identityStatus:'confirmed',nameVerification:'confirmed',publicPhone:'+861234567890',publicPhoneUrl:sourceUrl,publicPhoneEvidence:{version:2,url:sourceUrl,sourceKind:'official',sourceRead:true,checkedAt:stamp,quote:'### China (Regional office)\nOffice address: 1 Export Road\n#### Casey East\nOperations Director\n+861234567890'}});
  const management='https://forge.example/management',role={name:'Alice Berg',title:'COO',status:'current',sourceUrl:management,quote:'Alice Berg COO'};
  c.buyerDiscovery={...c.buyerDiscovery,opportunityRoles:c.buyerRoles,companyDossier:Dossier.reconcile([{provider:'openai',webSearch:true,status:'partial',facts:[],people:[role],channels:[],sources:[management],extractedSources:[management],sourceReads:[{url:management,status:'succeeded',checkedAt:stamp}],gaps:['Independent second-provider checks remain incomplete.']}],{company:c.company,domain:c.domain})};
  saved.payload.main.step=5;saved.payload.meta.discovery.activeJourneyStage=5;saved.payload.meta.discovery.visibleStep=5;saved.payload.meta.discovery.activeBuyerCompanyDomain=c.domain;
  await f.replace(saved.payload,saved.version);
  async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready);await page.locator('[data-workflow-stage="5"] strong').click();await page.locator('#step-5.active').waitFor();return page;}
  const mainCards=page=>page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li');
  async function checkShortlist(page){await page.waitForFunction(()=>document.querySelectorAll('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li').length===2);const text=await mainCards(page).allTextContents();assert.ok(text.some(value=>value.includes('Alice Berg')));assert.ok(text.some(value=>value.includes('Robert Lund')));assert.ok(text.every(value=>!value.includes('Robin West')&&!value.includes('Casey East')));const other=page.locator('.buyer-other-contacts');assert.equal(await other.getAttribute('open'),null);assert.match(await other.textContent(),/Robin West/);assert.match(await other.textContent(),/Casey East/);}
  page=await open();await checkShortlist(page);
  await page.locator('[data-keep-buyer][data-person-id="alice"]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId==='alice');await page.locator('#continue-to-outreach').click();await page.locator('#step-6.active').waitFor();
  await page.waitForFunction(expected=>document.getElementById('outreach-email-body')?.value===expected,exactDrafts.alice.message);
  await page.locator('[data-workflow-stage="5"] strong').click();await page.locator('#step-5.active').waitFor();
  await page.waitForFunction(()=>{const text=document.querySelector('.company-message-brief')?.textContent||'';return text.includes('Alice Berg')&&text.includes('Role source verified');});
  assert.match(await page.locator('.company-message-brief').textContent(),/Independent second-provider checks remain incomplete/);
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);
  await page.context().close();page=await open();await checkShortlist(page);
  await page.waitForFunction(()=>document.querySelector('.company-message-brief')?.textContent.includes('Role source verified'));
  const restored=await f.getState(),company=restored.payload.discovery.selectedProspects[0];assert.equal(company.people.length,4);assert.equal(company.people.find(person=>person.id==='foreign').publicPhone,'+861234567890');
  assert.equal(restored.payload.outreach.items.find(item=>item.selectedPersonId==='alice').drafts.emailBody,exactDrafts.alice.message);
  for(const table of ['gmail_messages','crm_enrichment_requests','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);
  assert.equal(f.providerRequests.length,0);assert.deepEqual(errors,[]);
  t.diagnostic(JSON.stringify({priorityContacts:2,retainedContacts:4,foreignScopeHeld:true,roleSourceVerified:true,partialResearchRetained:true,exactDraftPreserved:true,freshBrowserReopen:true,outboundMessages:0,paidLookups:0}));
 }catch(error){if(page&&!page.isClosed())t.diagnostic(JSON.stringify({active:await page.locator('.step-view.active').getAttribute('id').catch(()=>''),brief:await page.locator('.company-message-brief').textContent().catch(()=>''),toast:await page.locator('#toast').textContent().catch(()=>''),errors,requests:f.calls.slice(-15).map(({path,method,status})=>({path,method,status}))}));throw error;}finally{await browser.close();await f.close();}
});
