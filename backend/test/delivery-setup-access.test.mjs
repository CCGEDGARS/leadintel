import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step7Fixture} from './step7-journey-fixture.mjs';
import {loadPlaywright,sessionToken,workspaceId} from './step5-journey-fixture.mjs';

test('empty Delivery opens from Setup, saves a non-activated plan through real HTTP/SQL and reopens on mobile',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await step7Fixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{
  const saved=await f.getState(),payload=structuredClone(saved.payload);
  payload.main={...payload.main,step:1,website:'',targetMarkets:[],profile:null,approved:false,market:{}};payload.outreach={items:[],buyerDrafts:{},messageStudio:{}};payload.discovery={pipeline:[],selectedProspects:[],candidates:[]};payload.delivery={};payload.meta={};
  await f.replace(payload,saved.version);
  const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
  await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelJourney);
  await page.locator('.steps [data-workflow-stage="7"] > div').click();
  await page.waitForSelector('#step-7.active #delivery-empty-state:not([hidden])').catch(async error=>{t.diagnostic(JSON.stringify({errors,view:await page.evaluate(()=>({active:document.querySelector('.step-view.active')?.id,toast:document.getElementById('toast')?.textContent,delivery:!!document.getElementById('step-7'),loader:!!window.LeadIntelCampaignModuleLoader,outreach:!!window.LeadIntelOutreachUI,empty:document.getElementById('delivery-empty-state')?.outerHTML,nav:document.querySelector('.steps [data-workflow-stage="7"]')?.outerHTML}))}));await page.screenshot({path:'/tmp/leadintel-delivery-setup-failure.png',fullPage:true});throw error;});await page.waitForFunction(()=>document.getElementById('oa-save')&&!document.getElementById('oa-save').disabled);
  assert.equal(await page.locator('#send-with-gmail').isDisabled(),true);assert.equal(await page.locator('#open-gmail-draft').isDisabled(),true);assert.equal(await page.locator('#oa-activate').isDisabled(),true);
  await page.locator('#oa-mode').selectOption('automatic');await page.locator('#oa-timezone').fill('Europe/Stockholm');await page.locator('#oa-window-start').fill('10:00');await page.locator('#oa-followups').fill('0');await page.locator('[data-oa-day="7"]').check();
  await page.locator('#oa-save').click();await page.waitForFunction(()=>/settings saved/i.test(document.getElementById('oa-message')?.textContent||''));
  const row=f.DB.raw.prepare('SELECT * FROM outreach_automation_policies WHERE workspace_id=?').get(workspaceId);assert.equal(row.enabled,0);assert.equal(row.mode,'automatic');assert.equal(row.timezone,'Europe/Stockholm');assert.equal(row.send_window_start,'10:00');assert.equal(row.max_followups,0);assert.ok(JSON.parse(row.working_days_json).includes(7));
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const id of ['oa-save','oa-timezone','delivery-go-messages']){const el=page.locator('#'+id);await el.scrollIntoViewIfNeeded();const bounds=await el.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,id+' fits '+width);}}
  await page.screenshot({path:'/tmp/leadintel-delivery-setup-mobile.png',fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelJourney);await page.evaluate(()=>LeadIntelJourney.openWorkflowStage(7));
  await page.waitForSelector('#step-7.active #oa-timezone');await page.waitForFunction(()=>document.getElementById('oa-timezone')?.value==='Europe/Stockholm');assert.equal(await page.locator('#oa-mode').inputValue(),'automatic');assert.equal(await page.locator('#oa-followups').inputValue(),'0');
  assert.equal(f.providerRequests.length,0);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM outreach_automation_queue').get().n,0);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM gmail_messages').get().n,0);assert.deepEqual(errors,[]);
  // A prepared workspace with a company but no message still reaches the normal Messages editor.
  const latest=await f.getState();await f.replace({...saved.payload,outreach:payload.outreach,delivery:{},main:{...saved.payload.main,step:7}},latest.version);
  const reopened=await browser.newContext({viewport:{width:1440,height:1100}});await reopened.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);await reopened.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  const prepared=await reopened.newPage();prepared.on('pageerror',e=>errors.push(e.message));await prepared.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await prepared.waitForSelector('#step-7.active #delivery-go-messages');await prepared.locator('#delivery-go-messages').click();await prepared.waitForSelector('#step-6.active');assert.equal(f.providerRequests.length,0);assert.deepEqual(errors,[]);
  t.diagnostic('Controlled browser and real HTTP/SQLite: empty Delivery, desktop/mobile, preferences saved/reloaded; zero sends or queued messages.');
 }finally{await browser.close();await f.close();}
});
