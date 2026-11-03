import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken,sourceUrl} from '../backend/test/step5-journey-fixture.mjs';
import largeBuyerSnapshot from '../customer/test/fixtures/buyer-large-snapshot.cjs';

const sourceFiles=['customer/index.html','customer/discovery-ui.js','customer/discovery-engine.js','customer/buyer-research-jobs.js','customer/company-dossier.js','customer/company-dossier-ui.js','customer/server-bridge.js','customer/profile-engine.js','customer/market-engine.js','backend/src/buyer-research-store.js','backend/src/buyer-research-runner.js','backend/src/buyer-research-routes.js','backend/src/customer-state.js','backend/src/workspace-record-store.js','backend/test/step5-journey-fixture.mjs','backend/test/step5-journey.test.mjs','scripts/verify-step5-journey.mjs'];
async function sourceHashes(){return Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await fs.readFile(new URL('../'+name,import.meta.url))).digest('hex')])));}

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
 const sourceSha256=await sourceHashes(),f=await journeyFixture({durableJobs:true,roleReviewPending:true,incompleteDossier:true}),{chromium}=await loadPlaywright();
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const contexts=[],errors=[],blocked=[],screenshots=[];let page,gate,putGate,jobEvidence;
 async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():(blocked.push(route.request().url()),route.abort()));await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);return {context,page};}
 async function shot(name){const file=path.join(artifactDir,name);await page.screenshot({path:file,fullPage:true});screenshots.push(file);}
 try{
  await fs.mkdir(artifactDir,{recursive:true});
  ({page}=await open());
  await settleInitialSave(page);
  assert.equal((await channels(page)).email,'');
  assert.equal(await page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li').count(),0,'unconfirmed saved people stay out of the main four');
  assert.equal(await page.locator('.buyer-other-contacts').evaluate(element=>element.open),false);assert.match(await page.locator('.buyer-shortlist-gap').textContent(),/0\/4 confirmed contacts ready/);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});const control=page.locator('.buyer-public-summary [data-find-prospect-buyers]');await control.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await control.click({trial:true});assert.equal(await control.isEnabled(),true);const box=await control.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width);assert.equal(await control.evaluate(element=>{const rect=element.getBoundingClientRect();return element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));}),true,'role recovery remains reachable at '+width);const file=path.join(artifactDir,'00-saved-contacts-'+width+'.png');await page.screenshot({path:file,fullPage:false});screenshots.push(file);}
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('.selected-prospect-company [data-find-prospect-buyers]').click();
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
  assert.equal(await page.evaluate(()=>discovery.selectedProspects[0].buyerRolesChanged),false,'official named role evidence clears the stale hold');
  assert.equal(await page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li').count(),2);assert.match(await page.locator('.buyer-shortlist-gap').textContent(),/2\/4 confirmed contacts ready/);
  const restoreProviderReplays=f.providerCalls.length-providerCount;
  const completedTasks=f.DB.raw.prepare("SELECT task_key,result_json,attempts FROM buyer_research_tasks WHERE job_id=? AND status='complete' ORDER BY task_key").all(job.id);
  await settleInitialSave(page);
  const resumeAck=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/buyers/research'&&response.request().method()==='POST');
  await page.locator('.selected-prospect-company [data-find-prospect-buyers]').click();
  const resumed=await resumeAck;assert.equal(resumed.ok(),true);assert.equal(resumed.request().postDataJSON().action,'resume');assert.equal((await resumed.json()).job.id,job.id);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1,'Refresh resumes the same incomplete job');
  for(let attempt=0;attempt<12;attempt++){const saved=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);if(!['queued','running'].includes(saved.status))break;phaseRuns.push(...await f.runJobs(job.id));}
  await page.waitForFunction(revision=>discovery.selectedProspects[0].buyerResearchJob?.status==='needs_review'&&discovery.selectedProspects[0].buyerResearchJob.revision>revision,terminal.revision,{timeout:15000});
  assert.deepEqual(f.DB.raw.prepare("SELECT task_key,result_json,attempts FROM buyer_research_tasks WHERE job_id=? AND status='complete' ORDER BY task_key").all(job.id),completedTasks,'explicit resume preserves completed receipts');
  assert.equal(f.providerCalls.filter(call=>call.kind==='read').length,readCount,'completed official source reads are not replayed');
  await shot('00-refresh-retains-contacts.png');
  jobEvidence={roleReviewRecovered:true,actualRefreshResumed:true,completedReceiptsPreserved:true,incompleteDossierContactsVisible:true,id:job.id,status:terminal.status,phase:terminal.phase,revision:terminal.revision,phaseRuns,tasks:tasks.map(r=>({kind:r.kind,status:r.status,attempts:r.attempts})),queries:f.providerCalls.filter(c=>c.kind==='search').map(c=>c.query),sourceReads:readCount,restoreProviderReplays,explicitRefreshProviderOperations:f.providerCalls.length-providerCount,broaderQualityComplete:false};
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
  assert.deepEqual(await sourceHashes(),sourceSha256,'browser acceptance must use one frozen source revision');
  const evidence={sourceSha256,verdict:'LOCAL_CONTROLLED_ACCEPTANCE',workspace:workspaceId,browser:'Chromium',authenticatedBrowserContexts:contexts.length,durableJob:jobEvidence,delayedOfficialRead:true,unrelatedRevisionMerged:competingEdit,sameBuyerConflictPaths:conflict.details.paths,exactRecipient:{personId:'robert',name:'Robert Lund',email:'robert@forge.example',phone:'+46 70 123 45 67',contactId:contact.id},crmReopen:true,outboundMessages:0,paidContactRequests:0,sourceReads:f.externalCalls.filter(c=>c.url===sourceUrl).length-sourceReadsBeforeHandoff,blockedBackendRequests:f.externalCalls.filter(c=>new URL(c.url).hostname!=='forge.example').map(c=>new URL(c.url).origin),requests:requestTrace(f.calls),screenshots};
  await fs.writeFile(path.join(artifactDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }catch(error){await fs.mkdir(artifactDir,{recursive:true});if(page)await shot('journey-failure.png').catch(()=>{});console.error('Step 5 browser diagnostics',JSON.stringify({errors,requests:requestTrace(f.calls),page:await page?.evaluate(()=>({ready:window.LeadIntelServerBridge?.ready,conflict:window.LeadIntelServerBridge?.conflict,details:window.LeadIntelServerBridge?.conflictDetails,meta:JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}'),toast:document.getElementById('toast')?.textContent})).catch(()=>null)}));throw error;
 }finally{gate?.release();await putGate?.close();await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();await f.close();}
}

export async function verifyConfirmedFourJourney({artifactDir='/tmp/leadintel-confirmed-four',mixedChannels=false,largeSavedResearch=false,clientSourceOverride}={}){
 const sourceSha256=await sourceHashes(),staff=[{id:'robert',name:'Robert Lund',title:'Head of Procurement',email:'robert@forge.example'},{id:'alice',name:'Alice Berg',title:'Chief Operating Officer',email:'alice@forge.example'},{id:'cecilia',name:'Cecilia Berg',title:'Chief Executive Officer',email:'cecilia@forge.example'},{id:'david',name:'David Lind',title:'Head of Procurement',email:'david@forge.example'},...['Erik Dahl','Frida West','Gustav North','Hanna East','Ingrid South','Johan Lake'].map((name,index)=>({id:'other-'+index,name,title:'Head of Procurement'}))];
 if(mixedChannels){delete staff[1].email;staff[1].phone='+46 70 123 45 67';delete staff[2].email;staff[2].linkedin='https://linkedin.com/in/cecilia-berg';}
 const html='<html><body><h1>Forge Industries team</h1>'+staff.map(person=>'<h3>'+person.name+'</h3><div>'+person.title+'</div>'+(person.phone?'<p>Phone: '+person.phone+'</p>':'')+(person.linkedin?'<a href="'+person.linkedin+'">'+person.name+'</a>':'')+'<div>Forge Industries</div>'+(person.email?'<a href="mailto:'+person.email+'">'+person.email+'</a>':'')).join('')+'</body></html>';
 const f=await journeyFixture({durableJobs:true,roleReviewPending:true,incompleteDossier:true,externalFetch:async input=>new URL(typeof input==='string'?input:input.url).hostname==='forge.example'?new Response(html,{headers:{'Content-Type':'text/html'}}):null});
 const saved=await f.getState(),candidate=saved.payload.discovery.selectedProspects[0];candidate.people=staff.map(person=>({id:person.id,name:person.name,publicName:person.name,title:person.title,organization:candidate.company,publicNameUrl:sourceUrl,identityStatus:'confirmed',nameVerification:'confirmed',...(person.phone?{publicPhone:person.phone,publicPhoneUrl:sourceUrl,publicPhoneSourceCheck:{version:2,status:'attributed',url:sourceUrl,checkedAt:new Date().toISOString()},publicPhoneEvidence:{version:2,url:sourceUrl,quote:person.name+' — '+person.title+'. Phone '+person.phone,sourceKind:'official',sourceRead:true,checkedAt:new Date().toISOString()}}:{}),...(person.linkedin?{publicLinkedinUrl:person.linkedin,linkedinConfirmedUrl:person.linkedin,linkedinConfirmationMethod:'manual',linkedinConfirmedAt:new Date().toISOString()}:{} )}));if(largeSavedResearch)Object.assign(candidate,largeBuyerSnapshot(candidate));const retainedSnapshotBytes=Buffer.byteLength(JSON.stringify(candidate));await f.replace(saved.payload,saved.version);
 const {chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[],errors=[],screenshots=[];let page;
 async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());if(clientSourceOverride)await context.route('**/buyer-research-jobs.js?*',route=>route.fulfill({contentType:'text/javascript',body:clientSourceOverride}));await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(page);await settleInitialSave(page);return page;}
 const mainCards=()=>page.locator('.selected-prospect-buyers > .buyer-shortlist-group > .selected-prospect-people > li');
 async function verifyFour(){assert.equal(await mainCards().count(),4,JSON.stringify(await page.evaluate(()=>{const c=discovery.selectedProspects[0];return c.people.map(p=>({id:p.id,channels:LeadIntelDiscovery.confirmedBuyerContactData(c,p),phone:p.publicPhone,evidence:p.publicPhoneEvidence,check:p.publicPhoneSourceCheck,profile:p.publicLinkedinUrl,confirmed:p.linkedinConfirmedUrl,review:p.linkedinProfileReview}));})));const ids=await mainCards().locator('[data-prospect-enrich-email]').evaluateAll(buttons=>buttons.map(button=>button.dataset.personId));assert.deepEqual(new Set(ids),new Set(staff.slice(0,4).map(person=>person.id)));for(const person of staff.slice(0,4)){if(person.email)assert.equal(await page.locator('[data-prospect-enrich-email][data-person-id="'+person.id+'"]').getAttribute('aria-pressed'),'true');else if(person.phone)assert.equal(await page.locator('[data-prospect-enrich-phone][data-person-id="'+person.id+'"]').getAttribute('aria-pressed'),'true');else assert.match(await mainCards().filter({has:page.locator('[data-person-id="'+person.id+'"]')}).textContent(),/Manually reviewed/);}assert.equal(await page.locator('.buyer-other-contacts').evaluate(element=>element.open),false);assert.equal(await page.locator('.buyer-potential-list > li').count(),6);assert.equal(await page.locator('.buyer-potential-list').isVisible(),false);assert.equal(await page.locator('.buyer-shortlist-gap').count(),0);}
 try{
  await fs.mkdir(artifactDir,{recursive:true});await open();assert.equal(await mainCards().count(),0);assert.match(await page.locator('.buyer-shortlist-gap').textContent(),/0\/4/);assert.equal(await page.locator('.buyer-other-contacts').evaluate(element=>element.open),false);assert.equal(await page.locator('.buyer-potential-list > li').count(),10);
  await page.locator('.selected-prospect-company [data-find-prospect-buyers]').click();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.id||/snapshot is too large/.test(document.getElementById('toast')?.textContent||''));assert.ok(await page.evaluate(()=>discovery.selectedProspects[0].buyerResearchJob?.id),'Refresh must start a durable job without the snapshot-size error');const job=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').get();await f.runJobs(job.id);
  await page.waitForFunction(()=>{const c=discovery.selectedProspects[0];return c.buyerRolesChanged===false&&LeadIntelDiscovery.confirmedBuyerShortlist(c.people,{decisionMakers:c.buyerRoles},c).priorityIds.length===4;},null,{timeout:15000});await verifyFour();
  await page.locator('[data-cancel-buyer-research]').click();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='canceled');await settleInitialSave(page);await verifyFour();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});await mainCards().first().evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));await verifyFour();const file=path.join(artifactDir,'four-confirmed-'+width+'.png');await page.screenshot({path:file,fullPage:false});screenshots.push(file);}
  const providerCalls=f.providerCalls.length,postCount=f.calls.filter(call=>call.path==='/api/buyers/research'&&call.method==='POST').length;await page.context().close();await open();await page.waitForFunction(()=>discovery.selectedProspects[0].buyerResearchJob?.status==='canceled');await verifyFour();assert.equal(f.providerCalls.length,providerCalls);assert.equal(f.calls.filter(call=>call.path==='/api/buyers/research'&&call.method==='POST').length,postCount);
  for(const table of ['gmail_messages','microsoft_mail_messages','gmail_test_messages','outreach_automation_queue','crm_enrichment_requests'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);assert.deepEqual(errors,[]);assert.deepEqual(await sourceHashes(),sourceSha256);
  const evidence={verdict:'LOCAL_CONTROLLED_ACCEPTANCE',mainContacts:4,confirmedWorkEmails:mixedChannels?2:4,confirmedPhones:mixedChannels?1:0,confirmedLinkedin:mixedChannels?1:0,mixedChannels,hiddenOtherContacts:6,unconfirmedPeopleNeverPromoted:true,originalSourceRead:true,freshBrowserReopen:true,readOnlyProviderReplays:f.providerCalls.length-providerCalls,authenticatedBrowserContexts:contexts.length,outboundMessages:0,paidContactRequests:0,wholeResearchComplete:false,largeSavedResearch,retainedSnapshotBytes,researchCommandBytes:f.calls.filter(call=>call.path==='/api/buyers/research'&&call.method==='POST').map(call=>call.payloadBytes),sourceSha256,requests:requestTrace(f.calls),screenshots};await fs.writeFile(path.join(artifactDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }catch(error){await fs.mkdir(artifactDir,{recursive:true});if(page)await page.screenshot({path:path.join(artifactDir,'failure.png'),fullPage:true}).catch(()=>{});console.error('Confirmed-four browser failure',JSON.stringify({error:String(error),errors,requests:requestTrace(f.calls)}));throw error;}
 finally{await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();await f.close();}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))verifyStep5Journey({artifactDir:process.env.LEADINTEL_STEP5_ARTIFACT_DIR}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
