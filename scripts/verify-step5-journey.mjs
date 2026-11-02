import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken,sourceUrl} from '../backend/test/step5-journey-fixture.mjs';

const stateKey='leadintel_customer_v2_state',discoveryKey='leadintel_customer_v2_discovery',metaKey='leadintel_customer_v2_discovery_meta',outreachKey='leadintel_customer_v2_outreach';
const statePath='/api/customer/state?workspace_id='+workspaceId;
const requestTrace=calls=>calls.filter(c=>c.path==='/api/customer/state'||c.path==='/api/buyers/research'||c.path.includes('/crm/')).map(c=>({method:c.method,path:c.path,status:c.status,action:c.action,baseVersion:c.version,version:c.result?.version,conflictVersion:c.result?.current?.version}));
async function ready(page){await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelServerBridge.session?.authenticated&&window.LeadIntelDiscoveryUI&&typeof discovery!=='undefined'&&discovery?.selectedProspects?.length,null,{timeout:20000});await page.waitForLoadState('networkidle');}
const navigationInterrupted=error=>/Execution context was destroyed|Cannot find context with specified id|Frame was detached/i.test(String(error?.message||''));
async function settleInitialSave(page){
 for(let attempt=0;attempt<3;attempt++){
  await ready(page);
  try{
   const result=await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));
   if(!result.saved&&!result.conflict&&attempt<2&&(result.retryable||result.reason==='workspace_changed'))continue;
   assert.equal(result.saved,true,'the browser baseline must be acknowledged by the actual save endpoint: '+JSON.stringify(result));
   await ready(page);
   await page.waitForFunction(()=>LeadIntelServerBridge.ready&&!LeadIntelServerBridge.conflict&&!LeadIntelWorkspacePersistence.hasUnsavedChanges(),null,{timeout:10000});
   return;
  }catch(error){if(!navigationInterrupted(error)||attempt===2)throw error;}
 }
}
async function remoteEdit(page,edit){
 for(let attempt=0;attempt<3;attempt++){
  await ready(page);
  try{
   const result=await page.evaluate(async({statePath,edit})=>{
    const response=await fetch(statePath),state=await response.json();
    if(!response.ok)return {status:response.status};
    const record=edit==='unrelated'?state.payload.main.answers:state.payload.discovery.selectedProspects[0].people.find(p=>p.id==='robert'),field=edit==='unrelated'?'meeting_value':'title',value=edit==='unrelated'?'Remote reviewed meeting value':'Head of Purchasing';
    // A reload can discard the acknowledgement after the real PUT committed.
    // Its read-back makes this same-field edit safe to retry without replaying
    // a stale whole-workspace payload or reporting a fabricated save success.
    if(record[field]===value)return {status:response.status,version:state.version,readBack:true};
    record[field]=value;
    const saved=await fetch(statePath,{method:'PUT',leadintelSaveIntent:true,leadintelExplicitSave:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({version:state.version,payload:state.payload})});
    return {status:saved.status,...await saved.json()};
   },{statePath,edit});
   if(result.status===409&&attempt<2)continue;
   assert.notEqual(result.saved,false,'the competitor edit must reach production persistence');return result;
  }catch(error){if(!navigationInterrupted(error)||attempt===2)throw error;}
 }
}
async function holdWorkspacePut(page){
 let release,started;const wait=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
 const pattern='**/api/customer/state?*',handler=async route=>{if(route.request().method()==='PUT'){started();await wait;}await route.continue();};
 await page.route(pattern,handler);
 return {began,release,async close(){release();await page.unroute(pattern,handler);}};
}
async function channels(page){return page.evaluate(()=>{const c=discovery.selectedProspects.find(c=>c.domain==='forge.example'),p=c.people.find(p=>p.id==='robert');return {email:LeadIntelDiscovery.acceptedOfficialBuyerEmail(c,p),phone:LeadIntelDiscovery.confirmedBuyerPhone(c,p),sourceRead:p.publicEmailEvidence?.sourceRead,phoneRead:p.publicPhoneEvidence?.sourceRead};});}

export async function verifyStep5Journey({artifactDir='/tmp/leadintel-step5-journey',competingEdit=true}={}){
 const f=await journeyFixture({durableJobs:true}),{chromium}=await loadPlaywright();
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const contexts=[],errors=[],blocked=[],screenshots=[];let page,gate,putGate,jobEvidence;
 async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():(blocked.push(route.request().url()),route.abort()));await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);return {context,page};}
 async function shot(name){const file=path.join(artifactDir,name);await page.screenshot({path:file,fullPage:true});screenshots.push(file);}
 try{
  await fs.mkdir(artifactDir,{recursive:true});
  ({page}=await open());
  assert.equal((await channels(page)).email,'');
  await page.evaluate(()=>{window.__research=runDurableBuyerResearch(discovery.selectedProspects[0]);});
  await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.id,null,{timeout:10000});
  const job=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').get();assert.equal(job.status,'queued');
  const phaseRuns=[...await f.runJobs(job.id)];
  assert.ok(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND status='complete'").get(job.id).n>0);
  await page.close();
  const workspaceVersionAfterClose=(await f.getState()).version;
  for(let attempt=0;attempt<12;attempt++){const saved=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);if(!['queued','running'].includes(saved.status))break;phaseRuns.push(...await f.runJobs(job.id));}
  const terminal=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);assert.equal(terminal.status,'needs_review');
  assert.equal((await f.getState()).version,workspaceVersionAfterClose,'background worker cannot write the broad workspace snapshot');
  const tasks=f.DB.raw.prepare('SELECT kind,status,attempts FROM buyer_research_tasks WHERE job_id=?').all(job.id),readCount=f.providerCalls.filter(c=>c.kind==='read').length;
  const providerCount=f.providerCalls.length,postCount=f.calls.filter(c=>c.path==='/api/buyers/research'&&c.method==='POST').length;
  // Finish the other tab's initial normalization/restore save before opening
  // the tab that will own the deliberately staged handoff. This avoids an
  // accidental second startup writer masquerading as the intended test edit.
  const competitor=await open();await settleInitialSave(competitor.page);
  ({page}=await open());
  await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='needs_review'&&Boolean(LeadIntelDiscovery.acceptedOfficialBuyerEmail(discovery.selectedProspects[0],discovery.selectedProspects[0].people.find(p=>p.id==='robert'))),null,{timeout:15000});
  assert.equal(f.calls.filter(c=>c.path==='/api/buyers/research'&&c.method==='POST').length,postCount,'reopen reads progress without starting or resuming provider work');
  assert.equal(f.providerCalls.length,providerCount,'read-only restore cannot replay provider requests');
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1);
  jobEvidence={id:job.id,status:terminal.status,phase:terminal.phase,revision:terminal.revision,phaseRuns,tasks:tasks.map(r=>({kind:r.kind,status:r.status,attempts:r.attempts})),queries:f.providerCalls.filter(c=>c.kind==='search').map(c=>c.query),sourceReads:readCount,restoreProviderReplays:f.providerCalls.length-providerCount,broaderQualityComplete:false};
  const sourceReadsBeforeHandoff=f.externalCalls.filter(c=>c.url===sourceUrl).length;
  await settleInitialSave(page);
  assert.equal(await page.evaluate(()=>LeadIntelServerBridge.workspace.id),workspaceId);
  assert.deepEqual(await channels(page),{email:'robert@forge.example',phone:'+46 70 123 45 67',sourceRead:true,phoneRead:true});
  const emailControl=page.locator('[data-prospect-enrich-email][data-person-id="robert"]').first(),phoneControl=page.locator('[data-prospect-enrich-phone][data-person-id="robert"]').first();
  assert.equal(await emailControl.getAttribute('aria-pressed'),'true');assert.equal(await phoneControl.getAttribute('aria-pressed'),'true');
  await emailControl.scrollIntoViewIfNeeded();
  await shot('01-buyers-official-accepted.png');
  gate=f.holdOfficialRead();
  await page.evaluate(()=>{const c=discovery.selectedProspects[0];window.__handoff=addBuyerToFlow(c.domain,0,{personId:'robert'}).then(value=>window.__handoffResult=value);});
  let timeout;await Promise.race([gate.began,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Expected official-source confirmation was not dispatched')),5000);})]).finally(()=>clearTimeout(timeout));
  if(competingEdit)assert.equal((await remoteEdit(competitor.page,'unrelated')).status,200);
  gate.release();gate=null;
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}').items?.some(i=>i.selectedPersonId==='robert'),null,{timeout:15000});
  await ready(page);
  const selected=await page.evaluate(()=>({choice:loadMeta().scriptBuyer,item:JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items[0],main:JSON.parse(localStorage.getItem('leadintel_customer_v2_state'))}));
  assert.equal(selected.choice.email,'robert@forge.example');assert.equal(selected.choice.personId,'robert');assert.equal(selected.choice.recipientIdentity.name,'Robert Lund');assert.equal(selected.item.selectedPersonId,'robert');
  assert.equal(selected.item.dossier.people.find(p=>p.id==='robert').email,'robert@forge.example');assert.equal(selected.item.approved,false);
  if(competingEdit)assert.equal(selected.main.answers.meeting_value,'Remote reviewed meeting value');
  assert.deepEqual(await channels(page),{email:'robert@forge.example',phone:'+46 70 123 45 67',sourceRead:true,phoneRead:true});
  await shot('02-messages-exact-recipient.png');
  // The empty first Messages item is saved through the actual draft button. No
  // generation, approval, contact purchase or delivery action is authorized.
  assert.equal(await page.evaluate(()=>{const button=document.getElementById('message-save-draft');if(button.disabled)return false;button.click();return true;}),true);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}').items?.[0]?.messageStudioDraft?.scriptSavedAt,null,{timeout:10000});
  assert.equal((await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}))).saved,true);
  const crmRows=f.DB.raw.prepare("SELECT metadata_json FROM crm_activities WHERE activity_type='dossier.built'").all();assert.equal(crmRows.length,1);
  const snapshot=JSON.parse(crmRows[0].metadata_json).script_package.item;assert.equal(snapshot.selectedPersonId,'robert');assert.equal(snapshot.messageStudioDraft.recipientIdentity.name,'Robert Lund');
  const snapshotPerson=snapshot.dossier.people.find(p=>p.id==='robert');assert.equal(snapshotPerson.email,'robert@forge.example');assert.equal(snapshotPerson.publicPhoneEvidence.sourceRead,true);
  const contact=f.DB.raw.prepare("SELECT * FROM crm_contacts WHERE external_person_id='robert'").get();assert.equal(contact.work_email,'robert@forge.example');assert.equal(contact.email_status,'public_confirmed');assert.equal(contact.public_email_url,sourceUrl);
  // Fresh browser storage proves hydration from actual SQL, separately from a
  // same-page object or an unconditional bridge.saveNow success stub.
  await settleInitialSave(page);await page.close();
  ({page}=await open());
  const reopened=await page.evaluate(async()=>({choice:loadMeta().scriptBuyer,outreach:JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')),crm:await LeadIntelServerBridge.getCrmCompany(loadMeta().scriptBuyer.recipientIdentity.companyId)}));
  assert.equal(reopened.choice.email,'robert@forge.example');assert.equal(reopened.outreach.items[0].selectedPersonId,'robert');assert.equal(reopened.crm.contacts.find(c=>c.id===reopened.choice.contactId).work_email,'robert@forge.example');
  assert.deepEqual(await channels(page),{email:'robert@forge.example',phone:'+46 70 123 45 67',sourceRead:true,phoneRead:true});
  await shot('03-reopened-saved-recipient.png');
  // Both sides now deliberately edit the same buyer identity. The genuine CAS
  // conflict must stay visible and must not replace the reviewed recipient.
  await settleInitialSave(page);
  putGate=await holdWorkspacePut(page);
  const saving=page.evaluate(async()=>{const p=discovery.selectedProspects[0].people.find(p=>p.id==='robert');p.title='Head of Strategic Procurement';saveDiscovery();const result=await LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});return {result,details:LeadIntelServerBridge.conflictDetails,localTitle:JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery')).selectedProspects[0].people.find(p=>p.id==='robert').title,selected:selectedEmailBuyer(),recovery:JSON.parse(localStorage.getItem('leadintel_customer_v2_sync_recovery_v1')||'null')};});
  saving.catch(()=>{});
  await putGate.began;
  assert.equal((await remoteEdit(competitor.page,'identity')).status,200);
  putGate.release();const conflict=await saving;await putGate.close();putGate=null;
  assert.equal(conflict.result.conflict,true);assert.equal(conflict.localTitle,'Head of Strategic Procurement');assert.equal(conflict.selected,null);assert.ok(conflict.details.paths.some(p=>p.includes('people')&&p.includes('identity')),JSON.stringify(conflict.details));assert.ok(conflict.recovery);
  assert.equal((await f.getState()).payload.discovery.selectedProspects[0].people.find(p=>p.id==='robert').title,'Head of Purchasing');
  await shot('04-same-buyer-conflict-preserved.png');
  const stateWrites=f.calls.filter(c=>c.path==='/api/customer/state'&&c.method==='PUT');if(competingEdit)assert.ok(stateWrites.filter(c=>c.status===409).length>=2);else assert.ok(stateWrites.some(c=>c.status===409));
  for(const table of ['gmail_messages','microsoft_mail_messages','gmail_test_messages','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0,'no outbound or queued contact in '+table);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
  assert.deepEqual(errors,[]);
  const evidence={verdict:'LOCAL_CONTROLLED_ACCEPTANCE',workspace:workspaceId,browser:'Chromium',authenticatedBrowserContexts:contexts.length,durableJob:jobEvidence,delayedOfficialRead:true,unrelatedRevisionMerged:competingEdit,sameBuyerConflictPaths:conflict.details.paths,exactRecipient:{personId:'robert',name:'Robert Lund',email:'robert@forge.example',phone:'+46 70 123 45 67',contactId:contact.id},crmReopen:true,outboundMessages:0,paidContactRequests:0,sourceReads:f.externalCalls.filter(c=>c.url===sourceUrl).length-sourceReadsBeforeHandoff,blockedBackendRequests:f.externalCalls.filter(c=>new URL(c.url).hostname!=='forge.example').map(c=>new URL(c.url).origin),requests:requestTrace(f.calls),screenshots};
  await fs.writeFile(path.join(artifactDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }catch(error){await fs.mkdir(artifactDir,{recursive:true});if(page)await shot('journey-failure.png').catch(()=>{});console.error('Step 5 browser diagnostics',JSON.stringify({errors,requests:requestTrace(f.calls),page:await page?.evaluate(()=>({ready:window.LeadIntelServerBridge?.ready,conflict:window.LeadIntelServerBridge?.conflict,details:window.LeadIntelServerBridge?.conflictDetails,meta:JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}'),toast:document.getElementById('toast')?.textContent})).catch(()=>null)}));throw error;
 }finally{gate?.release();await putGate?.close();await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();await f.close();}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))verifyStep5Journey({artifactDir:process.env.LEADINTEL_STEP5_ARTIFACT_DIR}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
