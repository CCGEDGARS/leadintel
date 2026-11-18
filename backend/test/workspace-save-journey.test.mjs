import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step7Fixture} from './step7-journey-fixture.mjs';
import {loadPlaywright,sessionToken} from './step5-journey-fixture.mjs';

test('one trusted input is saved after its target handler writes storage without a dirty notification',{timeout:30000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in customer journey CI.');return;}
 const f=await step7Fixture({connected:false}),{chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext();await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();
  await page.route('**/controller-input',route=>route.fulfill({contentType:'text/html',body:'<div class="workspace"><input id="manual-note"></div><button id="save-workspace"></button><span id="workspace-save-state"></span>'}));
  await page.goto(f.origin+'/controller-input');const baseline=await f.getState();let puts=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/customer/state'&&r.method()==='PUT')puts++;});
  await page.evaluate(({baseline})=>{
   const keys={main:'leadintel_customer_v2_state',discovery:'leadintel_customer_v2_discovery',outreach:'leadintel_customer_v2_outreach',delivery:'leadintel_customer_v2_delivery'},data={};for(const [section,key]of Object.entries(keys)){data[key]=JSON.stringify(baseline.payload[section]||{});localStorage.setItem(key,data[key]);}data.leadintel_customer_v2_discovery_meta=JSON.stringify(baseline.payload.meta.discovery||{});localStorage.setItem('leadintel_customer_v2_discovery_meta',data.leadintel_customer_v2_discovery_meta);
   localStorage.setItem('leadintel_customer_v2_workspace','storage-w1');localStorage.setItem('leadintel_customer_v2_workspace_explicit_save_v1','1');localStorage.setItem('leadintel_customer_v2_workspace_saved_snapshot_v1',JSON.stringify({schema_version:1,server_synced:true,workspace_id:'storage-w1',server_version:baseline.version,saved_at:'2026-11-16T10:00:00.000Z',server_payload:baseline.payload,data}));
   window.LeadIntelServerBridge={ready:true,session:{authenticated:true},workspace:{id:'storage-w1'},stateVersion:baseline.version,conflict:false,async saveNow(){const payload=Object.fromEntries(Object.entries(keys).map(([section,key])=>[section,JSON.parse(localStorage.getItem(key))]));payload.meta={discovery:JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta'))};const response=await fetch('/api/customer/state?workspace_id=storage-w1',{method:'PUT',leadintelSaveIntent:true,leadintelExplicitSave:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({version:this.stateVersion,payload})});const result=await response.json();this.stateVersion=result.version;return {saved:response.ok&&result.saved!==false,version:result.version};}};
  },{baseline});
  await page.addScriptTag({content:await fs.readFile(new URL('../../customer/workspace-sync.js',import.meta.url),'utf8')});
  await page.addScriptTag({content:await fs.readFile(new URL('../../customer/workspace-persistence.js',import.meta.url),'utf8')});
  await page.evaluate(()=>document.getElementById('manual-note').addEventListener('input',event=>{window.trustedInput=event.isTrusted;const state=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach'));state.items[0].drafts.emailBody=event.target.value;localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify(state));}));
  await page.locator('#manual-note').pressSequentially('a');await page.waitForTimeout(2700);
  assert.equal(await page.evaluate(()=>window.trustedInput),true);assert.equal(puts,1,'first real input must schedule exactly one acknowledged write');
  assert.equal((await f.getState()).payload.outreach.items[0].drafts.emailBody,'a');
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.hasUnsavedChanges()),false);assert.match(await page.locator('#workspace-save-state').textContent(),/Saved automatically/);
 }finally{await browser.close();await f.close();}
});

test('authenticated navigation reuses the saved revision while genuine edits, late edits and retries survive reopening',{timeout:150000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in customer journey CI.');return;}
 const f=await step7Fixture({activated:true,connected:false}),{chromium}=await loadPlaywright();
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[],requests=[];let releaseHeld;
 const clean=page=>page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&document.getElementById('save-workspace')?.disabled&&!LeadIntelWorkspacePersistence.hasUnsavedChanges(),null,{timeout:20000});
 async function open(){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
  await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(new URL(req.url()).pathname==='/api/customer/state'&&req.method()==='PUT')requests.push(req);});
  await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await clean(page);return page;
 }
 async function stage(page,id){
  await page.locator('[data-workflow-stage="'+id+'"] strong').click();
  const view=id===3?4:id===4||id===5?5:id;
  await page.waitForFunction(({id,view})=>document.querySelector('[data-workflow-stage].active')?.dataset.workflowStage===String(id)&&document.getElementById('step-'+view)?.classList.contains('active'),{id,view});
 }
 async function proposal(page,url){
  await stage(page,1);
  await page.locator('#company-website').fill(url);await page.locator('#company-website').press('Tab');
 }
 try{
  let page=await open();
  // Exercise initial and repeated viewing. A clean workspace keeps Save disabled.
  for(const id of [1,2,3,4,5,6,7]){await stage(page,id);await clean(page);}
  await page.waitForTimeout(2400);await clean(page);
  const before=await f.getState(),requestCount=requests.length;
  for(const id of [1,2,3,4,5,6,7]){await stage(page,id);await page.waitForTimeout(2300);assert.equal(await page.locator('#save-workspace').isDisabled(),true);}
  await page.locator('#delivery-company-select').click();await page.keyboard.press('Escape');
  await page.locator('#save-workspace').evaluate(button=>button.click());
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);
  await page.waitForTimeout(2400);
  assert.equal(requests.length,requestCount,'navigation and unchanged Save must not issue a PUT');
  assert.equal((await f.getState()).version,before.version,'read-only navigation cannot create a server revision');
  assert.deepEqual((await f.getState()).payload,before.payload,'viewing prepared screens preserves the complete saved payload');

  let started;const began=new Promise(r=>started=r),gate=new Promise(r=>releaseHeld=r);let hold=true;
  await page.route('**/api/customer/state?*',async route=>{if(hold&&route.request().method()==='PUT'){hold=false;started();await gate;}await route.continue();});
  await proposal(page,'https://seller.example/proposal-one');await began;
  await stage(page,1);releaseHeld();releaseHeld=null;await clean(page);
  await page.waitForFunction(()=>LeadIntelServerBridge.status==='synced'&&!localStorage.getItem('leadintel_customer_v2_server_dirty'),null,{timeout:5000});
  if(requests.length!==requestCount+1){
   const payloads=requests.slice(requestCount).map(request=>JSON.parse(request.postData()).payload);
   const diff=(a,b,path='')=>{if(JSON.stringify(a)===JSON.stringify(b))return [];if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>diff(a[key],b[key],path?path+'.'+key:key));return [{path,before:a,after:b}];};
   t.diagnostic(JSON.stringify({unexpectedWriteChanges:payloads.slice(1).map((payload,index)=>diff(payloads[index],payload))}));
  }
  assert.equal(requests.length,requestCount+1,'navigation during a real write must not queue a second upload');
  assert.equal((await f.getState()).payload.main.setupWebsiteDraft,'https://seller.example/proposal-one');

  let startedLate;const beganLate=new Promise(r=>startedLate=r),gateLate=new Promise(r=>releaseHeld=r);let holdLate=true;
  await page.route('**/api/customer/state?*',async route=>{if(holdLate&&route.request().method()==='PUT'){holdLate=false;startedLate();await gateLate;}await route.continue();});
  await proposal(page,'https://seller.example/proposal-intermediate');await beganLate;
  await page.locator('#company-website').fill('https://seller.example/proposal-later');await page.locator('#company-website').press('Tab');
  releaseHeld();releaseHeld=null;await clean(page);
  assert.equal((await f.getState()).payload.main.setupWebsiteDraft,'https://seller.example/proposal-later');

  let fail=true;await page.route('**/api/customer/state?*',route=>fail&&route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Controlled workspace outage"}'}):route.continue());
  await proposal(page,'https://seller.example/proposal-retry');
  await page.waitForFunction(()=>/Sync failed/.test(document.getElementById('workspace-save-state')?.textContent||''));
  assert.notEqual((await f.getState()).payload.main.setupWebsiteDraft,'https://seller.example/proposal-retry');
  fail=false;await page.locator('#save-workspace').evaluate(button=>button.click());await clean(page);
  assert.equal((await f.getState()).payload.main.setupWebsiteDraft,'https://seller.example/proposal-retry');
  assert.equal((await f.getState()).payload.main.website,before.payload.main.website,'optional sources never replace the active company');
  await page.context().close();page=await open();await stage(page,1);
  assert.equal(await page.locator('#company-website').inputValue(),'seller.example/proposal-retry');
  assert.equal(f.providerRequests.length,0);assert.deepEqual(errors,[]);
  t.diagnostic(JSON.stringify({navigationPuts:0,retainedRevision:before.version,genuineEditSaved:true,lateEditSaved:true,failedSaveRetried:true,freshBrowserReopen:true,providerRequests:0}));
 }finally{releaseHeld?.();await browser.close();await f.close();}
});
