import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step7Fixture} from './step7-journey-fixture.mjs';
import {loadPlaywright,sessionToken} from './step5-journey-fixture.mjs';
test('sidebar viewing stays clean without workspace writes; real edits save and survive reload',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable');return;}
 const f=await step7Fixture({activated:true}),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(async()=>{await browser.close();await f.close();});
 const c=await browser.newContext();await c.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);await c.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 await p.goto(f.origin+'/customer/');await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelCustomerNavigation&&window.LeadIntelJourney);await p.waitForLoadState('networkidle');assert.equal(await p.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace()),true);
 const before=await f.getState(),writes=()=>f.calls.filter(x=>x.path==='/api/customer/state'&&x.method==='PUT').length,initialWrites=writes();
 for(const stage of [1,2,3,4,5,6,7,1,2,3]){
  await p.locator('[data-workflow-stage="'+stage+'"] strong').click();
  await p.waitForFunction(n=>document.querySelector('[data-workflow-stage="'+n+'"]')?.classList.contains('active'),stage);
  await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>LeadIntelWorkspacePersistence.hasUnsavedChanges()),false,'stage '+stage+' must stay clean');assert.equal(await p.locator('#save-workspace').isDisabled(),true,'Save is disabled after stage '+stage);assert.equal(await p.locator('#topbar-save').isVisible(),false,'toolbar stays saved after stage '+stage);
 }
 await p.locator('[data-workflow-stage="3"] [data-sidebar-expand]').click();await p.locator('[data-workflow-stage="3"] [data-sidebar-expand]').click();
 await p.locator('[data-workflow-stage="4"] strong').click();await p.locator('[data-cl="new"]').click();await p.waitForSelector('#company-list-form');await p.locator('#company-list-form [name="name"]').fill('Unsaved list setup');await p.locator('#company-list-form [name="preset"]').selectOption('50');assert.equal(await p.evaluate(()=>LeadIntelWorkspacePersistence.hasUnsavedChanges()),false,'list setup controls do not change workspace data');
 await p.waitForTimeout(2600);assert.equal(writes(),initialWrites,'navigation must not upload a workspace');const after=await f.getState();assert.equal(after.version,before.version);assert.deepEqual(after.payload.main.market,before.payload.main.market,'navigation preserves approved Strategy');assert.deepEqual(after.payload.outreach,before.payload.outreach,'navigation preserves message drafts');
 await p.locator('[data-workflow-stage="1"] strong').click();await p.locator('#company-website').fill('https://proposed.example/');await p.waitForFunction(()=>window.LeadIntelWorkspacePersistence.hasUnsavedChanges());assert.equal(await p.locator('#save-workspace').isDisabled(),false);await p.locator('#topbar-save').click();await p.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges()&&!LeadIntelServerBridge.isWorkspaceSaving());assert.ok(writes()>initialWrites);assert.equal((await f.getState()).payload.main.setupWebsiteDraft,'https://proposed.example/');
 await p.reload();await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelCustomerNavigation);await p.waitForLoadState('networkidle');assert.match(await p.locator('#company-website').inputValue(),/^(https:\/\/)?proposed\.example\/?$/);assert.deepEqual(errors,[]);
});
