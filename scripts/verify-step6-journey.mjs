import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {step6Fixture,reviewedLinkedInUrl} from '../backend/test/step6-journey-fixture.mjs';
import {loadPlaywright,sessionToken,workspaceId} from '../backend/test/step5-journey-fixture.mjs';

const outreachKey='leadintel_customer_v2_outreach';
const labels={professional:'Professional',curiosity:'NLP',friendly:'Friendly',brutal:'Brutal Honesty'};
const manual={subject:'Robert — exact review subject',message:'Hello Robert,\n\nThis is the exact manually reviewed draft.\nThe second line stays on its own line.\n\nBest regards,\nRobin Lane'};
const recovered={subject:'Robert — recovered after failed save',message:'Hello Robert,\n\nThis working draft survives a failed CRM save.\n\nBest regards,\nRobin Lane'};
const newerCrm={subject:'Robert — newer CRM acknowledgement',message:'Hello Robert,\n\nThis exact CRM copy is newer than the saved workspace.\n\nBest regards,\nRobin Lane'};
const linkedDraft='Hello Robert,\n\nThis is Robert’s separate manually reviewed LinkedIn draft.\n\nRobin Lane';
const requestTrace=calls=>calls.filter(row=>row.path==='/api/ai/generate'||row.path==='/api/customer/state'&&row.method==='PUT'||row.path.includes('/crm/')&&row.method!=='GET').slice(-100).map(row=>({method:row.method,path:row.path,status:row.status,version:row.version,resultVersion:row.result?.version}));

async function ready(page){await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelServerBridge.session?.authenticated&&window.LeadIntelDiscoveryUI&&typeof discovery!=='undefined'&&discovery.selectedProspects?.length,null,{timeout:20000});await page.waitForLoadState('networkidle');}
async function current(page){return page.evaluate(key=>{const store=JSON.parse(localStorage.getItem(key)||'{}'),choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').scriptBuyer;return store.items?.find(item=>item.selectedPersonId===choice?.personId&&item.channel===(choice.channel||'email'))||store.items?.find(item=>item.selectedPersonId===choice?.personId);},outreachKey);}
async function expandBuyer(control){const details=control.locator('xpath=ancestor::details');for(let index=0;index<await details.count();index++){const detail=details.nth(index);if(!await detail.evaluate(node=>node.open))await detail.locator(':scope > summary').click();}}
async function handoff(page,personId){
 if(await page.locator('#back-to-discovery').isVisible())await page.locator('#back-to-discovery').click();
 const button=page.locator('[data-keep-buyer][data-person-id="'+personId+'"]').first();await expandBuyer(button);await button.click();
 await page.waitForFunction(personId=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId===personId,personId,{timeout:10000});
 await page.locator('#continue-to-outreach').click();
 await page.waitForFunction(personId=>{const choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').scriptBuyer;return choice?.personId===personId&&document.querySelector('#step-6.active #message-studio')&&document.getElementById('message-recipient')?.textContent.includes(personId==='robert'?'Robert':'Alice');},personId,{timeout:20000});
}
async function settled(page,style){await page.waitForFunction(({key,style})=>{const choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').scriptBuyer,item=JSON.parse(localStorage.getItem(key)||'{}').items?.find(item=>item.selectedPersonId===choice?.personId&&item.channel==='email');return item?.messageStudioDraft?.mode===style&&item.drafts?.emailBody?.trim()&&document.querySelector('#mw-preparing-editor')?.hidden&&document.querySelector('#mw-edit-message')?.disabled===false&&document.querySelector('#mw-updating-notice')?.dataset.state!=='busy';},{key:outreachKey,style},{timeout:20000});}
async function visible(page,id){const control=page.locator('#'+id);assert.equal(await control.isVisible(),true,id+' must be visible without opening Tools');await control.scrollIntoViewIfNeeded();const box=await control.boundingBox(),viewport=page.viewportSize();assert.ok(box&&box.width>0&&box.x>=-1&&box.x+box.width<=viewport.width+1,id+' must fit the viewport');return control;}
async function edit(page,draft){await (await visible(page,'mw-edit-message')).click();await visible(page,'mw-cancel-edit');await page.locator('#outreach-email-subject').fill(draft.subject);await page.locator('#outreach-email-body-rich').fill(draft.message);assert.deepEqual(await fields(page),draft);}
async function fields(page){return {subject:await page.locator('#outreach-email-subject').inputValue(),message:await page.locator('#outreach-email-body').inputValue()};}
async function save(page,draft){await (await visible(page,'mw-save-message')).click();await page.waitForFunction(()=>document.getElementById('mw-draft-badge')?.textContent==='Saved',null,{timeout:15000});assert.deepEqual(await fields(page),draft);}
async function persist(page){const result=await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(result.saved,true,'actual workspace save acknowledgement: '+JSON.stringify(result));await page.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges(),null,{timeout:10000});}
async function linkedReady(page){await page.waitForFunction(()=>document.getElementById('mw-channel')?.textContent==='LinkedIn · manual'&&document.getElementById('outreach-linkedin')?.value?.trim()&&document.getElementById('mw-edit-message')?.disabled===false,null,{timeout:20000});}
function crmSnapshots(f){return f.DB.raw.prepare("SELECT metadata_json FROM crm_activities WHERE activity_type='dossier.built' ORDER BY rowid").all().map(row=>JSON.parse(row.metadata_json).script_package?.item).filter(Boolean);}
function assertSnapshot(item,draft,personId='robert'){assert.equal(item.selectedPersonId,personId);assert.equal(item.channel,'email');assert.equal(item.messageStudioDraft.recipientIdentity.personId,personId);assert.equal(item.messageStudioDraft.recipientIdentity.name,personId==='robert'?'Robert Lund':'Alice Berg');assert.equal(item.dossier.people.find(person=>person.id===personId).email,personId+'@forge.example');assert.equal(item.drafts.emailSubject,draft.subject);assert.equal(item.drafts.emailBody,draft.message);assert.equal(item.messageStudioDraft.savedDraft.subject,draft.subject);assert.equal(item.messageStudioDraft.savedDraft.message,draft.message);assert.equal(item.approved,false);}

export async function verifyStep6Journey({artifactDir='/tmp/leadintel-step6-journey'}={}){
 const {chromium}=await loadPlaywright();
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let f;try{f=await step6Fixture();}catch(error){await browser.close();throw error;}
 const contexts=[],errors=[],screenshots=[],blocked=[];let page,providerGate;
 async function open(){const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():(blocked.push(new URL(route.request().url()).origin),route.abort()));await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const next=await context.newPage();next.setDefaultTimeout(10000);next.on('pageerror',error=>errors.push(error.message));await next.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});await ready(next);return next;}
 async function shot(name){const file=path.join(artifactDir,name);await page.screenshot({path:file,fullPage:true});screenshots.push(file);}
 try{
  await fs.mkdir(artifactDir,{recursive:true});page=await open();await handoff(page,'robert');
  // Settings are an explicit, visible disclosure. Primary draft controls are not.
  await expandBuyer(page.locator('#message-calendly'));await page.locator('#message-calendly').fill('https://calendly.com/fixture/intro');await page.locator('#message-save-core').click();await page.locator('#mw-meeting-options > summary').click();
  await page.locator('[data-writing-style="professional"]').click();await settled(page,'professional');
  const beforeInvalid=await fields(page);f.failNextPreparation('invalid');await page.locator('[data-writing-style="curiosity"]').click();
  await page.waitForFunction(()=>document.getElementById('mw-retry-message')?.hidden===false&&document.getElementById('mw-retry-message')?.disabled===false,null,{timeout:15000});assert.deepEqual(await fields(page),beforeInvalid,'invalid provider fields preserve exact previous draft');
  await page.setViewportSize({width:390,height:844});await visible(page,'mw-retry-message');await shot('00-invalid-fields-visible-retry.png');await page.setViewportSize({width:1440,height:1100});await page.locator('#mw-retry-message').click();await settled(page,'curiosity');
  const styleEvidence=[];
  for(const style of Object.keys(labels)){
   await page.locator('[data-writing-style="'+style+'"]').click();await settled(page,style);
   const result=await page.evaluate(style=>{const body=document.getElementById('outreach-email-body').value;LeadIntelMessageEditor.validateFrame(body,style);return {style,words:body.trim().split(/\s+/).length,subjectCount:[...document.querySelectorAll('#message-subject-choice option')].filter(option=>option.value!=='custom').length,availableSubjects:[...document.querySelectorAll('#message-subject-choice option')].filter(option=>option.value!=='custom'&&!option.disabled).length,missingFacts:LeadIntelMessageEditor.draftFactGaps({message:body}),status:document.getElementById('mw-updating-notice').textContent};},style);
   assert.equal(result.subjectCount,5);if(['curiosity','friendly'].includes(style))assert.equal(result.availableSubjects,5,'five subject choices are available when their fixture facts are supported');const applied=await current(page),draft=await fields(page);assert.equal(applied.messageStudioDraft.editorOrigin,'tailored');assert.equal(applied.messageStudioDraft.tailoringVersion,7);assert.equal(applied.messageStudioDraft.tailoredOriginal.style,style);assert.equal(applied.messageStudioDraft.tailoredOriginal.draft.message,draft.message,'visible core body must equal its validated deterministic original');assert.ok(draft.message.includes('Robin Lane'));assert.equal(draft.message,draft.message.trim());assert.doesNotMatch(draft.message,/\n\n\n/);styleEvidence.push({...result,validatedDeterministicOriginal:true});
  }
  await shot('01-all-core-styles-visible.png');
  const protectedOriginal=(await current(page)).messageStudioDraft.tailoredOriginal;
  await edit(page,manual);await save(page,manual);assertSnapshot(crmSnapshots(f).at(-1),manual);await persist(page);
  const saved=await current(page);assert.equal(saved.messageStudioDraft.mode,'brutal');assert.deepEqual(saved.messageStudioDraft.tailoredOriginal,protectedOriginal,'manual save preserves the deterministic original');assert.ok(saved.dossier.messageBrief||saved.dossier.researchBrief||saved.dossier.evidence?.length,'source evidence is retained with saved draft');
  await shot('02-exact-manual-crm-save.png');
  await page.locator('#back-to-discovery').click();
  await page.locator('[data-workflow-stage="6"] > div > strong').click();
  await settled(page,'brutal');assert.deepEqual(await fields(page),manual,'sidebar reopening preserves the saved recipient draft');
  assert.equal(await page.evaluate(()=>LeadIntelPageQuality.getReport('messages').checks.find(row=>row.id==='recipient-confirmed')?.status),'pass','sidebar reopening revalidates the saved recipient');

  const providerBeforeReopen=f.providerRequests.length,readsBeforeReopen=f.externalCalls.filter(row=>new URL(row.url).hostname==='forge.example').length;
  await page.context().close();page=await open();await settled(page,'brutal');assert.deepEqual(await fields(page),manual);assert.equal((await current(page)).selectedPersonId,'robert');assert.deepEqual((await current(page)).messageStudioDraft.tailoredOriginal,protectedOriginal);assert.equal(await page.locator('#mw-draft-badge').textContent(),'Saved');
  assert.equal(f.providerRequests.length,providerBeforeReopen,'fresh reopen does not repeat provider work');assert.equal(f.externalCalls.filter(row=>new URL(row.url).hostname==='forge.example').length,readsBeforeReopen,'fresh reopen does not repeat official reads');
  await shot('03-fresh-browser-exact-reopen.png');
  // Reproduce a validation cancelled by synchronization using the actual
  // module, authenticated CRM API and saved draft, then finish synchronization.
  const interrupted=await page.evaluate(async()=>{
   const b=LeadIntelServerBridge,choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).scriptBuyer;
   b.resolvingSync=true;
   const opened=await LeadIntelOutreachUI.openBuyerScripts(choice);
   b.resolvingSync=false;
   window.dispatchEvent(new CustomEvent('leadintel:sync-settled'));
   return opened;
  });
  assert.equal(interrupted,false);
  await settled(page,'brutal');assert.deepEqual(await fields(page),manual,'sync recovery preserves exact saved draft');
  assert.equal(await page.evaluate(()=>LeadIntelPageQuality.getReport('messages').checks.find(row=>row.id==='recipient-confirmed')?.status),'pass');

  // A CRM records notification invalidates a pending validation. The old
  // response must not commit, and the saved buyer must recover automatically.
  await page.evaluate(async()=>{
   const b=LeadIntelServerBridge,choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).scriptBuyer;
   const get=b.getCrmCompany.bind(b);let release,entered;
   const waiting=new Promise(r=>entered=r);
   b.getCrmCompany=async id=>{entered();await new Promise(r=>release=r);return get(id);};
   const pending=LeadIntelOutreachUI.openBuyerScripts(choice);await waiting;
   b.getCrmCompany=get;
   dispatchEvent(new CustomEvent('leadintel:company-records-changed',{detail:{workspaceId:b.workspace.id,domain:choice.domain}}));
   release();await pending;
  });
  await settled(page,'brutal');assert.deepEqual(await fields(page),manual,'CRM refresh recovery preserves exact saved draft');
  assert.equal(await page.evaluate(()=>LeadIntelPageQuality.getReport('messages').checks.find(row=>row.id==='recipient-confirmed')?.status),'pass');



  await page.setViewportSize({width:390,height:844});await visible(page,'mw-edit-message');await edit(page,{subject:'Cancelled change',message:'This must be cancelled.'});await (await visible(page,'mw-cancel-edit')).click();assert.deepEqual(await fields(page),manual);await visible(page,'mw-save-message');await visible(page,'mw-restore-original');await shot('04-narrow-primary-controls.png');await page.setViewportSize({width:1440,height:1100});
  let failedSaves=0;
  const failureRoute=async route=>{if(route.request().method()==='POST'){failedSaves++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Controlled CRM save failure'})});}else await route.continue();};
  await page.route('**/api/crm/companies/*/activities?*',failureRoute);
  await edit(page,recovered);await (await visible(page,'mw-save-message')).click();await page.waitForFunction(()=>/CRM save failed|retry Save|Not saved/i.test(document.getElementById('mw-editor-status')?.textContent||''),null,{timeout:10000});
  assert.equal(failedSaves,1);assert.deepEqual(await fields(page),recovered);assert.equal(await page.locator('#mw-draft-badge').textContent(),'Unsaved changes');assertSnapshot(crmSnapshots(f).at(-1),manual);await visible(page,'mw-save-message');await shot('05-failed-save-working-text-preserved.png');
  await page.unroute('**/api/crm/companies/*/activities?*',failureRoute);await save(page,recovered);assertSnapshot(crmSnapshots(f).at(-1),recovered);await persist(page);
  // CRM acknowledges Save independently of broad workspace autosave. Losing
  // that later PUT must not make a fresh browser present an old Saved copy.
  const priorState=await f.getState();let failedWorkspacePuts=0;
  await page.route('**/api/customer/state?*',async route=>{if(route.request().method()==='PUT'){failedWorkspacePuts++;await route.abort('failed');}else await route.continue();});
  await edit(page,newerCrm);await save(page,newerCrm);assertSnapshot(crmSnapshots(f).at(-1),newerCrm);
  const unsynced=await page.evaluate(async()=>{try{return await LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});}catch(error){return {saved:false,error:error.message};}});assert.equal(unsynced.saved,false);assert.ok(failedWorkspacePuts>0);assert.equal((await f.getState()).version,priorState.version);
  const storedRobert=(await f.getState()).payload.outreach.items.find(item=>item.selectedPersonId==='robert'&&item.channel==='email');assert.equal(storedRobert.drafts.emailBody,recovered.message);
  const beforeLostPutReopen=f.providerRequests.length;await page.context().close();page=await open();await settled(page,'brutal');await page.waitForFunction(expected=>document.getElementById('outreach-email-body')?.value===expected,newerCrm.message,{timeout:10000});assert.deepEqual(await fields(page),newerCrm);assert.equal(await page.locator('#mw-draft-badge').textContent(),'Saved');assert.equal(f.providerRequests.length,beforeLostPutReopen);await shot('06-newer-crm-survives-lost-workspace-save.png');await persist(page);
  // A second recipient uses the same real contact verification + CRM handoff.
  await handoff(page,'alice');providerGate=f.holdNextPreparation();await page.locator('[data-writing-style="friendly"]').click();
  let deadline;await Promise.race([providerGate.began,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Alice factual preparation was not dispatched')),10000);})]).finally(()=>clearTimeout(deadline));
  assert.equal(await page.locator('#mw-edit-message').isDisabled(),true,'editing is guarded while factual preparation is pending');
  await handoff(page,'robert');providerGate.release();providerGate=null;await settled(page,'brutal');assert.deepEqual(await fields(page),newerCrm,'late Alice preparation must preserve the current Robert draft');
  await handoff(page,'alice');await page.locator('[data-writing-style="friendly"]').click();await settled(page,'friendly');const alice={subject:'Alice — separate exact draft',message:'Hello Alice,\n\nThis is Alice’s separate draft.\n\nBest regards,\nRobin Lane'};await edit(page,alice);await save(page,alice);assertSnapshot(crmSnapshots(f).at(-1),alice,'alice');await persist(page);
  await handoff(page,'robert');await settled(page,'brutal');assert.deepEqual(await fields(page),newerCrm);await handoff(page,'alice');await settled(page,'friendly');assert.deepEqual(await fields(page),alice);await shot('07-second-buyer-isolated.png');
  await persist(page);const beforeFinalOpen=f.providerRequests.length;await page.context().close();page=await open();await settled(page,'friendly');assert.deepEqual(await fields(page),alice);assert.equal(f.providerRequests.length,beforeFinalOpen);await handoff(page,'robert');await settled(page,'brutal');assert.deepEqual(await fields(page),newerCrm);
  // Review the synthetic profile through the real visible dialog. Its exact
  // recipient/profile guards and CRM/workspace acknowledgement remain real.
  await page.locator('#back-to-discovery').click();const reviewProfile=page.locator('[data-review-linkedin][data-person-id="robert"]').first();await expandBuyer(reviewProfile);await reviewProfile.click();
  assert.equal(await page.locator('#buyer-review-dialog a').first().getAttribute('href'),reviewedLinkedInUrl);await page.locator('#buyer-review-dialog [data-review-message]').click();await linkedReady(page);
  assert.equal(await page.evaluate(()=>{const c=discovery.selectedProspects[0],p=c.people.find(person=>person.id==='robert'),choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).selectedLinkedInBuyer;return LeadIntelDiscovery.confirmedLinkedInBuyer(p,c,choice,LeadIntelServerBridge.workspace.id);}),true);
  assert.equal(await page.locator('#linkedin-open-profile').getAttribute('href'),reviewedLinkedInUrl);const reviewActivity=f.DB.raw.prepare("SELECT metadata_json FROM crm_activities WHERE activity_type='contact.linkedin_confirmed'").get();assert.equal(JSON.parse(reviewActivity.metadata_json).verification_method,'manual');assert.equal(JSON.parse(reviewActivity.metadata_json).person_id,'robert');
  await (await visible(page,'mw-edit-message')).click();await page.locator('#outreach-linkedin').fill(linkedDraft);await (await visible(page,'mw-save-message')).click();await page.waitForFunction(()=>document.getElementById('mw-draft-badge')?.textContent==='Saved',null,{timeout:15000});assert.equal(await page.locator('#outreach-linkedin').inputValue(),linkedDraft);
  const linkedSnapshot=crmSnapshots(f).at(-1);assert.equal(linkedSnapshot.channel,'linkedin');assert.equal(linkedSnapshot.selectedPersonId,'robert');assert.equal(linkedSnapshot.messageStudioDraft.recipientIdentity.linkedinUrl,reviewedLinkedInUrl);assert.equal(linkedSnapshot.drafts.linkedinMessage,linkedDraft);assert.equal(linkedSnapshot.messageStudioDraft.savedDraft.message,linkedDraft);assert.equal(linkedSnapshot.messageStudioDraft.savedDraft.subject,'');assert.equal(linkedSnapshot.approved,false);await persist(page);await shot('08-linkedin-exact-save.png');
  await page.locator('#sc-channel-picker').getByRole('button',{name:'Email',exact:true}).click();await settled(page,'brutal');assert.deepEqual(await fields(page),newerCrm);await page.locator('#sc-channel-picker').getByRole('button',{name:'LinkedIn',exact:true}).click();await linkedReady(page);assert.equal(await page.locator('#outreach-linkedin').inputValue(),linkedDraft);await persist(page);
  const beforeLinkedReopen=f.providerRequests.length;await page.context().close();page=await open();await linkedReady(page);assert.equal(await page.locator('#outreach-linkedin').inputValue(),linkedDraft);assert.equal(await page.locator('#mw-draft-badge').textContent(),'Saved');assert.equal(f.providerRequests.length,beforeLinkedReopen,'LinkedIn saved reopen does not regenerate');await page.locator('#sc-channel-picker').getByRole('button',{name:'Email',exact:true}).click();await settled(page,'brutal');assert.deepEqual(await fields(page),newerCrm);await shot('09-email-after-linkedin-fresh-reopen.png');
  // Owner-authored readable slots must work through the real library API,
  // style control, CRM save and fresh authenticated browser reopen.
  await persist(page);await page.context().close();const documentState=await f.getState();documentState.payload.main.documents=[{id:'seller-pdf',name:'Seller profile.pdf',status:'ready',text:'We have 30 years of experience in the automation industry. We are ISO 45001:2018 certified.'}];const researchItem=documentState.payload.outreach.items.find(row=>row.selectedPersonId==='robert'&&row.channel==='email');researchItem.dossier.evidence=[...(researchItem.dossier.evidence||[]),{url:'https://forge.example/expansion',text:'Forge Industries is expanding its production facility.',sourceRead:true,extractedAt:new Date().toISOString()}];researchItem.dossier.selectedTrigger={url:'https://forge.example/expansion',companyDomain:'forge.example',verification:'source_verified',excerpt:'Forge Industries is expanding its production facility.'};await f.replace(documentState.payload,documentState.version);page=await open();await settled(page,'brutal');
  const ownerStory={id:'email:storyselling',channel:'email',style:'storyselling',name:'Storyselling',subject:'[First name]. [Company]',body:'Hi [First name],\n\n[Your full name] from [Company]. [result]\n\nProject location: [project location].\n\n[verified years of experience]. [certifications].\n\n[Your booking URL]\n[Your LinkedIn profile URL]',builtin:false,creatorSource:{id:'fixture-readable',revision:1}};
  f.DB.raw.prepare('INSERT OR REPLACE INTO core_script_registry(id,payload_json,revision,updated_by) VALUES(?,?,?,?)').run(ownerStory.id,JSON.stringify(ownerStory),1,f.DB.raw.prepare('SELECT id FROM users LIMIT 1').get().id);
  await page.locator('[data-writing-style="storyselling"]').click();
  await page.waitForFunction(()=>document.getElementById('outreach-email-body').value.startsWith('Hi Robert,'),null,{timeout:10000});
  const personalized=await fields(page);assert.equal(personalized.subject,'Robert. Fixture Industrial');assert.ok(personalized.message.includes('Robin Lane from Fixture Industrial. [result]'));assert.ok(personalized.message.includes('30 years. ISO 45001:2018.'));assert.ok(personalized.message.includes('Project location: Northport.'),JSON.stringify(await page.evaluate(()=>({research:JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items[0]?.messageStudioDraft?.libraryResearch,trigger:JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items[0]?.dossier?.selectedTrigger,status:document.getElementById('sc-status')?.textContent}))));assert.ok(f.researchReads.includes('https://forge.example/expansion'));assert.ok(await page.locator('#sc-research-details').isVisible());assert.equal(await page.locator('#outreach-email-body-rich [data-missing-field]').first().evaluate(el=>getComputedStyle(el).fontWeight),'700');assert.ok(personalized.message.includes('https://calendly.com/fixture/intro'));assert.ok(personalized.message.includes('https://www.linkedin.com/in/robin-lane'));assert.doesNotMatch(personalized.message,/\[Your full name\]|\[Your LinkedIn profile URL\]/);
  assert.match(await page.locator('#mw-updating-notice').textContent(),/Needs information: result/);assert.equal(await page.locator('#mw-add-flow').isDisabled(),true);
  if(await page.locator('#wa-writing-dialog').isVisible())await page.keyboard.press('Escape');
  const characterAudit=await page.evaluate(()=>LeadIntelChannelWorkspace.lengthAudit());assert.ok(characterAudit.maximumCharacters>0);assert.equal(characterAudit.characters,[...personalized.message.normalize('NFC')].length);assert.ok(await page.locator('#sc-character-count').isVisible());
  await save(page,personalized);assert.ok(crmSnapshots(f).at(-1).messageStudioDraft.libraryResearch.receipts.some(row=>row.kind==='read'&&row.url==='https://forge.example/expansion'&&row.ok));await persist(page);await page.context().close();page=await open();await settled(page,'storyselling');assert.deepEqual(await fields(page),personalized);assert.equal((await page.evaluate(()=>LeadIntelChannelWorkspace.lengthAudit())).maximumCharacters,characterAudit.maximumCharacters);
  assert.equal(JSON.parse(f.DB.raw.prepare('SELECT payload_json FROM core_script_registry WHERE id=?').get(ownerStory.id).payload_json).body,ownerStory.body);
  // Reopen the historical partial-personalization shape seen in production:
  // recipient/company already filled, sender still bracketed, unsaved copy.
  await persist(page);await page.context().close();
  const partialState=await f.getState(),partialItem=partialState.payload.outreach.items.find(row=>row.selectedPersonId==='robert'&&row.channel==='email');
  partialItem.drafts.emailBody=personalized.message.replace('Robin Lane','[Your full name]');partialItem.messageStudioDraft.scriptSavedAt=null;delete partialItem.messageStudioDraft.savedDraft;
  await f.replace(partialState.payload,partialState.version);page=await open();await settled(page,'storyselling');
  await page.waitForFunction(()=>!document.getElementById('outreach-email-body').value.includes('[Your full name]'));
  assert.deepEqual(await fields(page),personalized);assert.equal(await page.locator('#mw-edit-message').isEnabled(),true);assert.equal(await page.locator('#mw-save-message').isEnabled(),true);await save(page,personalized);
  const phoneMaster={id:'phone:professional',channel:'phone',style:'professional',name:'Professional',subject:'',body:'Hello [First name], [Your name] from [Company].\nThem: [Answers]\nYou: [their words]. [certifications]. [result]',builtin:false,creatorSource:{id:'fixture-call',revision:1}};
  f.DB.raw.prepare('INSERT OR REPLACE INTO core_script_registry(id,payload_json,revision,updated_by) VALUES(?,?,?,?)').run(phoneMaster.id,JSON.stringify(phoneMaster),1,f.DB.raw.prepare('SELECT id FROM users LIMIT 1').get().id);
  await page.locator('#sc-channel-picker').getByRole('button',{name:'Phone call',exact:true}).click();
  const callEditor=page.locator('#sc-phone-editor'),callField=callEditor.getByRole('textbox',{name:'Phone script',exact:true});
  await page.locator('.sc-phone-styles').getByRole('button',{name:'Professional',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#sc-phone-editor textarea')?.value.startsWith('Hello Robert,'));
  assert.equal(await callEditor.isVisible(),true);assert.equal(await callField.isVisible(),true);assert.equal(await callField.isEnabled(),true);
  assert.equal(await callEditor.locator('.sc-phone-review li').count(),1);assert.equal(await callEditor.locator('.sc-phone-review li').textContent(),'result');assert.match(await callField.inputValue(),/ISO 45001:2018/);
  assert.doesNotMatch(await page.locator('#sc-status').textContent(),/Answers|their words|Still needed/);
  let releaseCatalogue,catalogueStarted;const catalogueGate=new Promise(resolve=>releaseCatalogue=resolve),started=new Promise(resolve=>catalogueStarted=resolve);
  const slowCatalogue=async route=>{catalogueStarted();await catalogueGate;await route.continue();};
  await page.route('**/api/script-library?*',slowCatalogue);
  await page.locator('.sc-phone-styles').getByRole('button',{name:'Professional',exact:true}).click();
  let catalogueDeadline;
  try{await Promise.race([started,new Promise((_,reject)=>{catalogueDeadline=setTimeout(()=>reject(Error('Phone style catalogue request was not dispatched')),10000);})]);}
  catch(error){releaseCatalogue();throw error;}
  finally{clearTimeout(catalogueDeadline);}
  const duringLoad='Manual calling notes written during a slow style request.';await callField.fill(duringLoad);releaseCatalogue();
  await page.waitForFunction(()=>/edits are preserved/.test(document.getElementById('sc-status')?.textContent||''));assert.equal(await callField.inputValue(),duringLoad);
  await page.unroute('**/api/script-library?*',slowCatalogue);
  const calling='Hello Robert, Robin Lane from Fixture Industrial.\nThem: [Answers]\nYou: [their words].';
  await callField.fill(calling);await callEditor.getByRole('button',{name:'Save',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#sc-phone-editor [role="status"]')?.textContent==='Saved to this CRM contact');
  assert.equal(JSON.parse(f.DB.raw.prepare('SELECT payload_json FROM phone_script_drafts').get().payload_json).message,calling);
  await page.setViewportSize({width:390,height:844});await callField.scrollIntoViewIfNeeded();const phoneBox=await callField.boundingBox();assert.ok(phoneBox.width>0&&phoneBox.x>=0&&phoneBox.x+phoneBox.width<=391);
  await page.context().close();page=await open();await settled(page,'storyselling');assert.deepEqual(await fields(page),personalized,'phone editing preserves email');
  await page.locator('#sc-channel-picker').getByRole('button',{name:'Phone call',exact:true}).click();
  await page.waitForFunction(expected=>document.querySelector('#sc-phone-editor textarea')?.value===expected,calling);
  assert.equal(await page.locator('#sc-phone-editor textarea').isVisible(),true);
  assert.equal(JSON.parse(f.DB.raw.prepare('SELECT payload_json FROM core_script_registry WHERE id=?').get(phoneMaster.id).payload_json).body,phoneMaster.body);
  for(const table of ['gmail_messages','microsoft_mail_messages','gmail_test_messages','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0,'zero outbound or queued messages in '+table);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);assert.deepEqual(errors,[]);
  const evidence={verdict:'LOCAL_CONTROLLED_ACCEPTANCE',workspace:workspaceId,authenticatedBrowserContexts:contexts.length,browser:'Chromium',viewports:[{width:1440,height:1100},{width:390,height:844}],coreStyles:styleEvidence,invalidPreparation:{previousDraftPreserved:true,visibleRetry:true,retryApplied:true},exactManualCrmSnapshot:true,freshBrowserReopen:true,syncRecipientRecovery:true,readableTemplatePersonalization:true,sellerDocumentPersonalization:true,missingFieldBoldReview:true,partialTemplateReopenRepaired:true,phoneEditorVisibleAndSaved:true,phoneEditsSurviveSlowStyle:true,newerCrmRecovery:{failedWorkspacePuts,exactTextRestored:true,savedBadgeTruthful:true},reopenProviderReplays:0,twoBuyerIsolation:true,lateOtherBuyerPreparationPreservedCurrentDraft:true,linkedin:{visibleProfileReviewAndCrmAcknowledgement:true,existingConfirmationGatePassed:true,exactCrmSave:true,freshBrowserReopen:true,emailDraftPreserved:true,reopenProviderReplays:0},failedSave:{attempts:failedSaves,workingTextPreserved:true,savedBadgeTruthful:true,retrySaved:true},providerRequests:f.providerRequests.slice(0,40),outboundMessages:0,paidContactRequests:0,consoleErrors:errors,blockedBrowserOrigins:[...new Set(blocked)],unproven:['arbitrary real-model semantic quality','production customer-session acceptance','translated-source preservation in authenticated browser','late provider response versus manual edit (editing is disabled while generation runs)','five enabled subjects for every style when all required facts are supplied','live external LinkedIn profile review'],requests:requestTrace(f.calls),screenshots};
  await fs.writeFile(path.join(artifactDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }catch(error){await fs.mkdir(artifactDir,{recursive:true});if(page)await shot('journey-failure.png').catch(()=>{});const diagnostics={error:String(error),consoleErrors:errors,requests:requestTrace(f.calls),providers:f.providerRequests,state:await page?.evaluate(()=>({recipient:document.getElementById('message-recipient')?.textContent,readiness:document.getElementById('mw-readiness-text')?.textContent,notice:document.getElementById('mw-updating-notice')?.textContent,editor:document.getElementById('mw-editor-status')?.textContent,toast:document.getElementById('toast')?.textContent,conflict:window.LeadIntelServerBridge?.conflict,selection:JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).scriptBuyer,items:JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items.map(x=>({id:x.selectedPersonId,style:x.messageStudioDraft?.mode,origin:x.messageStudioDraft?.editorOrigin,saved:x.messageStudioDraft?.scriptSavedAt,body:x.drafts?.emailBody?.slice(0,100)})),editDisabled:document.getElementById('mw-edit-message')?.disabled,report:LeadIntelPageQuality.getReport('messages')})).catch(()=>null)};await fs.writeFile(path.join(artifactDir,'failure.json'),JSON.stringify(diagnostics,null,2)+'\n');console.error('Step 6 browser diagnostics',JSON.stringify(diagnostics));throw error;
 }finally{providerGate?.release();await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();await f.close();}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))verifyStep6Journey({artifactDir:process.env.LEADINTEL_STEP6_ARTIFACT_DIR}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
