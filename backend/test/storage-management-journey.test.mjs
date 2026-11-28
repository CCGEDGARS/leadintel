import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,sessionToken,workspaceId} from './step5-journey-fixture.mjs';
import {withWorkspaceStorage} from '../src/workspace-storage-objects.js';

test('storage settings through authenticated browser HTTP persist preferences and release deleted file bytes',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await journeyFixture(),objects=new Map(),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',prefix=`materials/${workspaceId}/${id}/`;
 f.env.WORKSPACE_STORAGE_ENABLED='true';f.env.WRITING_REFERENCES_BUCKET={head:async key=>objects.has(key)?{size:objects.get(key).length}:null,get:async key=>objects.has(key)?{body:objects.get(key)}:null,put:async(key,value)=>objects.set(key,value),delete:async key=>objects.delete(key)};
 await f.DB.prepare("INSERT INTO company_materials(id,workspace_id,filename,mime,kind,byte_size,digest,original_key,text_key,status) VALUES(?,?,'Storage acceptance.pdf','application/pdf','pdf',20,'storage-digest',?,?,'Ready')").bind(id,workspaceId,prefix+'original',prefix+'text.json').run();
 const metered=withWorkspaceStorage(f.env);await metered.WRITING_REFERENCES_BUCKET.put(prefix+'original','x'.repeat(20));await metered.WRITING_REFERENCES_BUCKET.put(prefix+'text.json','y'.repeat(10));
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(async()=>{await browser.close();await f.close();});
 const c=await browser.newContext();await c.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);await c.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 const p=await c.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message));p.setDefaultTimeout(15000);
 await p.goto(f.origin+'/customer/');await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelStorageManagement);await p.locator('#topbar-account-btn').click();await p.locator('[data-topbar-action="settings"]').click();await p.getByRole('tab',{name:'Storage',exact:true}).click();await p.locator('[data-storage-action="manage"]').click();
 await p.locator('.storage-management-dialog').getByText('Storage acceptance.pdf',{exact:true}).waitFor();await p.locator('[data-auto-reports]').uncheck();await p.getByText('Saving preference updated. Existing content is preserved.').waitFor();
 assert.equal(f.DB.raw.prepare('SELECT auto_report_copies FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).auto_report_copies,0);
 const downloadPromise=p.waitForEvent('download');await p.locator('.storage-management-dialog').getByRole('link',{name:'Download',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'Storage acceptance.pdf');assert.equal(await download.failure(),null);
 await p.locator('[data-delete-file]').click();await p.locator('[data-li-cancel]').click();assert.equal(objects.size,2);
 await p.locator('[data-storage-close]').click();await p.reload();await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelStorageManagement);await p.locator('#topbar-account-btn').click();await p.locator('[data-topbar-action="settings"]').click();await p.getByRole('tab',{name:'Storage',exact:true}).click();await p.locator('[data-storage-action="manage"]').click();await p.locator('.storage-management-dialog').getByText('Storage acceptance.pdf',{exact:true}).waitFor();assert.equal(await p.locator('[data-auto-reports]').isChecked(),false);
 assert.equal(await p.evaluate(()=>LeadIntelStorageManagement.reportCopiesAllowed()),false);
 await p.setViewportSize({width:390,height:844});assert.equal(await p.locator('.storage-management-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
 // One unavailable section must leave the other usable; retry reads both again.
 const policyRequest='**/api/storage/preferences?*',inventoryRequest='**/api/storage/files?*';
 const unavailable=route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Unavailable"}'});
 await p.route(policyRequest,unavailable);await p.locator('[data-storage-reload]').click();
 await p.getByText('Saving preferences could not be loaded.',{exact:true}).waitFor();
 assert.ok(await p.locator('[data-auto-reports]').evaluate(node=>node.disabled&&node.indeterminate));
 assert.ok(await p.locator('[data-delete-file]').isEnabled());
 await p.unroute(policyRequest);await p.route(inventoryRequest,unavailable);await p.locator('[data-storage-reload]').click();
 await p.locator('[data-storage-message]').filter({hasText:'File list unavailable.'}).waitFor();
 assert.ok(await p.locator('[data-auto-reports]').isEnabled());
 assert.equal(await p.getByText('No uploaded company files or books.').count(),0);
 await p.unroute(inventoryRequest);await p.locator('[data-storage-reload]').click();
 await p.locator('.storage-management-dialog').getByText('Storage acceptance.pdf',{exact:true}).waitFor();
 await p.locator('[data-delete-file]').click();await p.locator('[data-li-accept]').click();await p.getByText('No uploaded company files or books.').waitFor();assert.equal(objects.size,0);
 assert.equal(f.DB.raw.prepare('SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).files_bytes,0);
 assert.ok(f.calls.some(call=>call.method==='DELETE'&&call.path.includes(id)&&call.status===200));assert.deepEqual(errors,[]);
});
