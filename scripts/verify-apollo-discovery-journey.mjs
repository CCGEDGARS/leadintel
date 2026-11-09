import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from '../backend/test/step5-journey-fixture.mjs';
import {ready,settleInitialSave} from './verify-step5-journey.mjs';
import {searchWorkspaceApolloPeople} from '../backend/src/service-integrations.js';
import {encryptSecret,importAesKey} from '../backend/src/oauth.js';

export async function verifyApolloDiscoveryJourney({artifactDir='/tmp/leadintel-apollo-journey'}={}){
 let f,apiCalls=0;const errors=[],evidence={};
 f=await journeyFixture({durableJobs:true,externalFetch:async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);if(url.hostname!=='api.apollo.io')return null;
  assert.match(url.pathname,/\/mixed_people\/api_search$/);assert.equal(JSON.parse(options.body).reveal_phone_number,undefined);apiCalls++;
  return Response.json({people:[{id:'apollo-robert',name:'Robert Lund',title:'Head of Procurement',organization:{name:'Forge Industries'},email:'not-revealed@forge.example',phone_number:'+46999999999'},{id:'apollo-alice',name:'Alice Berg',title:'Chief Operating Officer',organization:{name:'Forge Industries'}}]});
 },researchServices:{apollo:(payload,signal,context)=>searchWorkspaceApolloPeople(f.env,context.workspaceId,payload,{...context,signal})}});
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,23).toString('base64');const encrypted=await encryptSecret('controlled-apollo-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'apollo',?,'test',?)").run(workspaceId,encrypted,JSON.stringify({discovery_enabled:true,email_enrichment_enabled:false,phone_enrichment_enabled:false}));
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 await fs.mkdir(artifactDir,{recursive:true});let page;
 const open=async()=>{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await ready(page);return page;};
 try{
  await open();await settleInitialSave(page);await page.locator('#topbar-account-btn').click();await page.locator('[data-topbar-action="settings"]').click();await page.locator('.settings-tabs button[data-settings-tab="data"]').click();
  const card=page.locator('[data-integration="apollo"]');await card.waitFor();await page.waitForFunction(()=>{const e=document.querySelector('[data-apollo-discovery]');return e&&!e.disabled;});
  assert.equal(await card.locator('[data-apollo-discovery]').isChecked(),true);assert.equal(await card.locator('[data-apollo-email]').isChecked(),false);assert.equal(await card.locator('[data-apollo-phone]').isChecked(),false);assert.equal(await card.locator('[data-service-key="apollo"]').inputValue(),'');
  assert.equal(apiCalls,0,'opening settings cannot start Apollo searches');
  for(const enabled of [false,true]){
   await card.locator('[data-apollo-discovery]').setChecked(enabled);
   const saved=page.waitForResponse(r=>r.url().includes('/services/apollo/settings')&&r.request().method()==='PUT'&&r.status()===200);
   await card.locator('[data-service-action="apollo-policy"]').click();await saved;await page.waitForFunction(()=>!document.querySelector('[data-service-action="apollo-policy"]')?.disabled);
   const meta=JSON.parse(f.DB.raw.prepare("SELECT metadata_json FROM workspace_service_integrations WHERE provider='apollo'").get().metadata_json);assert.equal(meta.discovery_enabled,enabled);assert.equal(meta.email_enrichment_enabled,false);assert.equal(meta.phone_enrichment_enabled,false);
  }
  evidence.settingsSaveAndRestore=true;await page.setViewportSize({width:390,height:844});await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await page.screenshot({path:artifactDir+'/apollo-settings-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.locator('#close-settings').click();
  await page.locator('.selected-prospect-company [data-find-prospect-buyers]').click();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.id);
  const job=f.DB.raw.prepare('SELECT id FROM buyer_research_jobs ORDER BY rowid DESC LIMIT 1').get();
  for(let i=0;i<8&&!apiCalls;i++)await f.runJobs(job.id);
  assert.equal(apiCalls,1);await page.waitForFunction(()=>discovery.selectedProspects[0].publicResearch?.accountability?.tools?.find(x=>x.provider==='apollo')?.succeeded===1);
  assert.equal(await page.evaluate(()=>discovery.selectedProspects[0].people.some(p=>p.id==='robert')),true,'Apollo aliases cannot replace the saved official buyer identity');
  await f.runJobs(job.id);assert.equal(apiCalls,1,'continuation must reuse the free discovery receipt');
  await page.locator('[data-stop-buyer-job]').click();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='canceled');await settleInitialSave(page);
  await page.context().close();await open();await page.waitForFunction(()=>discovery.selectedProspects[0].publicResearch?.accountability?.tools?.find(x=>x.provider==='apollo')?.succeeded===1);assert.equal(apiCalls,1);
  const stored=f.DB.raw.prepare("SELECT result_json FROM buyer_research_tasks WHERE request_value LIKE 'Apollo people search%'").all();assert.doesNotMatch(JSON.stringify(stored),/not-revealed|46999999999|controlled-apollo-key/);
  evidence.freeSearchCalls=apiCalls;evidence.executedReceiptsRestored=true;evidence.paidContactCalls=0;evidence.pageErrors=errors;assert.deepEqual(errors,[]);await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));return evidence;
 }catch(error){await page?.screenshot({path:artifactDir+'/failure.png',fullPage:true});await fs.writeFile(artifactDir+'/failure.json',JSON.stringify({message:error.message,errors,apiCalls},null,2));throw error;}
 finally{await browser.close();await f.close();}
}
