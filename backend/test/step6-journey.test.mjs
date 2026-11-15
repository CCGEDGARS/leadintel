import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {step6Fixture,reviewedLinkedInUrl} from './step6-journey-fixture.mjs';
import {loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {sha256} from '../src/security.js';

test('Step 6 fixture executes the authorized production AI boundary with hashed session and encrypted key',async()=>{
 const f=await step6Fixture();
 try{
  const session=f.DB.raw.prepare('SELECT token_hash FROM sessions').get();assert.equal(session.token_hash,await sha256(sessionToken));assert.notEqual(session.token_hash,sessionToken);
  const integration=f.DB.raw.prepare('SELECT encrypted_api_key,last_used_at FROM workspace_ai_integrations').get();assert.ok(integration.encrypted_api_key);assert.notEqual(integration.encrypted_api_key,'step6-fixture-key');
  const sources={triggerSummary:'',offer:'industrial automation',value:'',difference:'Our team supports industrial projects.',approach:'',meetingValue:''};
  const body=JSON.stringify({system:'Prepare only the supplied six fields.',prompt:JSON.stringify({sources,style:'professional'}),task:'outreach-generation',max_output_tokens:300});
  const request=(workspace,cookie)=>fetch(f.origin+'/api/ai/generate?workspace_id='+workspace,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:'leadintel_session='+cookie}:{})},body});
  assert.equal((await request(workspaceId)).status,401);assert.equal((await request('foreign-workspace',sessionToken)).status,403);assert.equal(f.providerRequests.length,0);
  const response=await request(workspaceId,sessionToken);assert.equal(response.status,200);const result=await response.json();assert.deepEqual(JSON.parse(result.text),sources);assert.equal(f.providerRequests.length,1);assert.equal(f.providerRequests[0].kind,'fields');
  assert.ok(f.DB.raw.prepare('SELECT last_used_at FROM workspace_ai_integrations').get().last_used_at);assert.doesNotMatch(JSON.stringify(result),/step6-fixture-key|encrypted_api_key/);
  const state=await f.getState();assert.equal(state.payload.main.answerStatus.meeting_value,'user');
  const person=state.payload.discovery.selectedProspects[0].people.find(person=>person.id==='robert');assert.equal(person.publicLinkedinUrl,reviewedLinkedInUrl);assert.ok(!person.linkedinConfirmedUrl);assert.ok(!state.payload.meta.discovery.selectedLinkedInBuyer,'browser acceptance must complete the real profile review');
 }finally{await f.close();}
});

// This journey now includes repeated fresh contexts, LinkedIn, owner-library
// personalization and phone save/reload. The former 150-second whole-test
// deadline cancels it under the full-suite browser load. Keep the runner's
// individual action deadlines; allow four minutes for the complete workflow.
test('authenticated Chromium saves exact rich-text Messages to real CRM, reopens, recovers failed saves and isolates two buyers',{timeout:240000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Local Chromium/Playwright unavailable; LEADINTEL_REQUIRE_BROWSER=true makes browser acceptance mandatory.');return;}
 const {verifyStep6Journey}=await import('../../scripts/verify-step6-journey.mjs');
 const artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step6-test-')),evidence=await verifyStep6Journey({artifactDir});
 assert.equal(evidence.exactManualCrmSnapshot,true);assert.equal(evidence.freshBrowserReopen,true);assert.equal(evidence.syncRecipientRecovery,true);assert.equal(evidence.readableTemplatePersonalization,true);assert.equal(evidence.newerCrmRecovery.exactTextRestored,true);assert.equal(evidence.reopenProviderReplays,0);assert.equal(evidence.twoBuyerIsolation,true);assert.equal(evidence.lateOtherBuyerPreparationPreservedCurrentDraft,true);assert.equal(evidence.linkedin.visibleProfileReviewAndCrmAcknowledgement,true);assert.equal(evidence.linkedin.emailDraftPreserved,true);assert.equal(evidence.linkedin.freshBrowserReopen,true);assert.equal(evidence.invalidPreparation.previousDraftPreserved,true);assert.equal(evidence.failedSave.workingTextPreserved,true);assert.equal(evidence.failedSave.retrySaved,true);assert.equal(evidence.coreStyles.length,4);assert.equal(evidence.outboundMessages,0);assert.equal(evidence.paidContactRequests,0);assert.deepEqual(evidence.consoleErrors,[]);
 t.diagnostic('Controlled local browser/real SQL evidence: '+path.join(artifactDir,'evidence.json'));
});

test('saved buyer Messages opens from cold Setup without first visiting Companies',{timeout:90000},async t=>{
 let chromium;
 try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}
 catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await step6Fixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 async function open(){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());
  await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
  const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(f.origin+'/customer/');
  await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated&&window.LeadIntelDiscoveryUI);
  await p.waitForLoadState('networkidle');return p;
 }
 try{
  let p=await open();await p.waitForFunction(()=>typeof discovery!=='undefined'&&discovery?.selectedProspects?.length);
  const buyer=p.locator('[data-keep-buyer][data-person-id="robert"]').first();
  await buyer.evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await buyer.click();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId==='robert');
  await p.locator('#continue-to-outreach').click();await p.locator('#step-6.active').waitFor();
  await p.waitForFunction(()=>document.getElementById('message-recipient')?.textContent.includes('Robert'));
  await p.locator('[data-workflow-stage="1"] strong').click();await p.locator('#step-1.active').waitFor();
  const acknowledged=await p.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(acknowledged.saved,true);
  const providerCalls=f.providerRequests.length;await p.context().close();p=await open();
  await p.locator('#step-1.active').waitFor();assert.equal(await p.evaluate(()=>discovery===null),true,'Setup intentionally leaves Companies unmounted');
  await p.locator('[data-workflow-stage="6"] strong').click();
  await p.locator('#step-6.active').waitFor();
  await p.waitForFunction(()=>document.getElementById('message-recipient')?.textContent.includes('Robert'));
  assert.equal(await p.evaluate(()=>Boolean(discovery?.selectedProspects?.some(c=>c.people?.some(p=>p.id==='robert')))),true);
  assert.equal(await p.locator('.step-view.active').count(),1);
  assert.equal(await p.locator('[data-wa-open]').isEnabled(),true);
  assert.equal(f.providerRequests.length,providerCalls,'opening the saved message does not repeat AI generation');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close();}
});

test('a reviewed source URL update reopens the same saved recipient through CRM and fresh browsers',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await step6Fixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[],dir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step6-test-source-'));
 const source='https://forge.example/leadership/robert-lund',draft={subject:'Robert — saved supplier question',message:'Hello Robert,\n\nThis is the exact reviewed supplier question.\n\nBest regards,\nRobin Lane'};let p;
 async function open(){const c=await browser.newContext({viewport:{width:1440,height:1100}});await c.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await c.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await c.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&discovery?.selectedProspects?.length);await page.waitForLoadState('networkidle');return page;}
 async function select(){const button=p.locator('[data-keep-buyer][data-person-id="robert"]').first();await button.evaluate(n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});await button.click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId==='robert');await p.locator('#continue-to-outreach').click();await p.locator('#step-6.active').waitFor();}
 async function ready(){await p.waitForFunction(()=>document.getElementById('mw-edit-message')?.disabled===false&&document.getElementById('mw-preparing-editor')?.hidden,null,{timeout:20000});}
 async function exact(){assert.equal(await p.locator('#outreach-email-subject').inputValue(),draft.subject);assert.equal(await p.locator('#outreach-email-body').inputValue(),draft.message);}
 async function persist(){const result=await p.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(result.saved,true);}
 try{
  p=await open();await select();await p.locator('#message-calendly').evaluate(n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});await p.locator('#message-calendly').fill('https://calendly.com/fixture/intro');await p.locator('#message-save-core').click();await p.locator('[data-writing-style="professional"]').click();await ready();await p.locator('#mw-edit-message').click();await p.locator('#outreach-email-subject').fill(draft.subject);await p.locator('#outreach-email-body-rich').fill(draft.message);await p.locator('#mw-save-message').click();await p.waitForFunction(()=>document.getElementById('mw-draft-badge')?.textContent==='Saved');await persist();
  const baseline=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items.find(i=>i.selectedPersonId==='robert')),providerCount=f.providerRequests.length;await p.context().close();
  const saved=await f.getState();saved.payload.discovery.selectedProspects[0].people.find(p=>p.id==='robert').publicNameUrl=source;await f.replace(saved.payload,saved.version);p=await open();await exact();await p.waitForFunction(()=>/could not be verified/.test(document.getElementById('mw-readiness-text')?.textContent||''));
  await p.locator('#back-to-discovery').click();const button=p.locator('[data-keep-buyer][data-person-id="robert"]').first();await button.evaluate(n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});await button.click();await p.waitForFunction(source=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.recipientIdentity?.identitySourceUrl===source,source);await p.locator('#continue-to-outreach').click();await p.locator('#step-6.active').waitFor();await ready();await exact();
  const reopened=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items.find(i=>i.selectedPersonId==='robert'));assert.deepEqual(reopened.messageStudioDraft.tailoredOriginal,baseline.messageStudioDraft.tailoredOriginal);assert.deepEqual(reopened.messageStudioDraft.recipientIdentity,baseline.messageStudioDraft.recipientIdentity);assert.ok(f.providerRequests.slice(providerCount).every(r=>r.kind==='translation'),'reviewing a changed citation may refresh its brief display, never regenerate the saved email');assert.ok(f.providerRequests.length<=providerCount+1);const afterReview=f.providerRequests.length;
  await persist();await p.context().close();p=await open();await ready();await exact();assert.equal(f.providerRequests.length,afterReview);assert.equal(await p.locator('#message-recipient').textContent(),'Robert Lund');assert.equal(await p.locator('#mw-draft-badge').textContent(),'Saved');
  await p.screenshot({path:path.join(dir,'source-reviewed-exact-reopen.png'),fullPage:true});assert.deepEqual(errors,[]);for(const table of ['gmail_messages','crm_enrichment_requests','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);
  await fs.writeFile(path.join(dir,'evidence.json'),JSON.stringify({verdict:'LOCAL_CONTROLLED_ACCEPTANCE',oldChoiceBlocked:true,explicitBuyerReselection:true,currentCrmRecipientVerified:true,exactSavedTextPreserved:true,originalCitationPreserved:true,tailoredOriginalPreserved:true,freshBrowserReopen:true,sourceDisplayRefreshes:afterReview-providerCount,savedDraftRegenerations:0,providerReplays:0,paidContactRequests:0,outboundMessages:0,consoleErrors:errors},null,2));t.diagnostic(path.join(dir,'evidence.json'));
 }catch(error){if(p&&!p.isClosed()){await p.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({error:String(error),consoleErrors:errors,providers:f.providerRequests,notice:await p.locator('#mw-readiness-text').textContent().catch(()=>''),toast:await p.locator('#toast').textContent().catch(()=>''),step:await p.locator('.step-view.active').getAttribute('id').catch(()=>''),requests:f.calls.slice(-25).map(({method,path,status})=>({method,path,status}))},null,2));}throw error;}
 finally{await browser.close();await f.close();}
});

test('explicit Writing Assistant profile review saves exact copy, approves and reopens unsent Delivery',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}
 const f=await step6Fixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[],dir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-profile-review-'));
 // Enable the real source-library routes with an empty private object store.
 // Review/save needs their acknowledged workspace revision, even without books.
 const objects=new Map();f.env.WRITING_REFERENCES_ALLOWED_WORKSPACES=workspaceId;
 f.env.WRITING_REFERENCES_BUCKET={async put(key,value){objects.set(key,value);},async get(key){const value=objects.get(key);return value===undefined?null:{async text(){return String(value);}};},async delete(key){objects.delete(key);}};
 const draft={subject:'Supplier evaluation contact',message:'Hi Robert,\n\nRobin represents Fixture Industrial. Could you point me to the person who evaluates external industrial automation suppliers?\n\nIf useful, you can book an optional 20-minute Zoom call here:\nhttps://calendly.com/fixture/intro\n\nBest regards,\nRobin Lane'};let p;
 async function open(){const c=await browser.newContext({viewport:{width:1440,height:1100}});await c.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await c.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);const page=await c.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated);await page.waitForLoadState('networkidle');return page;}
 async function persist(){const result=await p.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(result.saved,true);}
 async function ready(){await p.waitForFunction(()=>document.getElementById('mw-edit-message')?.disabled===false&&document.getElementById('mw-preparing-editor')?.hidden,null,{timeout:20000});}
 async function sender(){return p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('leadintel_customer_v2_state')),o=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')),brand=LeadIntelBrandIdentity.normalize(s.brandIdentity);delete brand.revision;delete brand.updatedAt;return {brand,settings:LeadIntelMessageStudio.foundation(o.messageStudio,s,{},'').essentials,authority:LeadIntelOutreach.messageSourceAuthority(s,o.messageStudio)};});}
 try{
  p=await open();await p.waitForFunction(()=>typeof discovery!=='undefined'&&discovery?.selectedProspects?.length);
  // Initialize the saved Strategy through its real screen before modelling its approval.
  await p.locator('[data-workflow-stage="3"] strong').click();await p.locator('#step-4.active').waitFor();await p.locator('[data-workflow-stage="5"] strong').click();await p.locator('#step-5.active').waitFor();
  const buyer=p.locator('[data-keep-buyer][data-person-id="robert"]').first();await buyer.evaluate(n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});await buyer.click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').selectedEmailBuyer?.personId==='robert');await p.locator('#continue-to-outreach').click();await p.locator('#step-6.active').waitFor();
  await p.locator('#message-calendly').evaluate(n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS')a.open=true;});await p.locator('#message-calendly').fill('https://calendly.com/fixture/intro');await p.locator('#message-save-core').click();await p.locator('[data-writing-style="professional"]').click();await ready();
  await p.locator('#mw-edit-message').click();await p.locator('#outreach-email-subject').fill(draft.subject);await p.locator('#outreach-email-body-rich').fill(draft.message);await p.locator('#mw-save-message').click();await p.waitForFunction(()=>document.getElementById('mw-draft-badge')?.textContent==='Saved');await persist();await p.context().close();
  // An older opportunity can retain invalidation flags after the current
  // workspace Profile has already been reviewed. Preserve its exact saved copy.
  const saved=await f.getState(),item=saved.payload.outreach.items.find(i=>i.selectedPersonId==='robert');
  const {default:Strategy}=await import('../../customer/strategy-integrity.js');
  saved.payload.main.approved=true;saved.payload.main.market.strategyApproved=true;
  saved.payload.main.market.strategyApproval=Strategy.approval(saved.payload.main);
  assert.equal(Strategy.status(saved.payload.main).current,true,JSON.stringify(Strategy.status(saved.payload.main)));
  Object.assign(item,{contextNeedsRefresh:true,reapprovalRequired:true,approvalBrandMode:'branded',approvalSchemaVersion:0});
  const original=structuredClone(item.messageStudioDraft.tailoredOriginal);
  await f.replace(saved.payload,saved.version);p=await open();await p.locator('#step-6.active').waitFor();await ready();
  assert.equal(await p.locator('#outreach-email-body').inputValue(),draft.message);
  await p.locator('#approve-outreach').evaluate(n=>n.click());await p.waitForFunction(()=>/commercial profile changed/.test(document.getElementById('toast')?.textContent||''));
  const stale=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items.find(i=>i.selectedPersonId==='robert'));assert.equal(stale.approved,false);assert.equal(stale.contextNeedsRefresh,true);
  const callsBefore=f.providerRequests.length;
  await p.locator('[data-wa-open]').click();await p.locator('dialog.wa-dialog').waitFor();await p.locator('[data-wa-continue]').click();await p.waitForFunction(()=>!document.querySelector('dialog.wa-dialog')?.open);
  assert.equal(f.providerRequests.length,callsBefore,'explicit review/save uses the existing exact draft without another AI generation');
  const reviewed=await p.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).items.find(i=>i.selectedPersonId==='robert'));
  assert.equal(reviewed.contextNeedsRefresh,false);assert.equal(reviewed.reapprovalRequired,false);assert.equal(reviewed.approved,false);assert.equal(reviewed.drafts.emailBody,draft.message);assert.deepEqual(reviewed.messageStudioDraft.tailoredOriginal,original);
  const detail=await p.evaluate(async()=>{const choice=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).scriptBuyer;return LeadIntelServerBridge.getCrmCompany(choice.recipientIdentity.companyId);});
  const receipt=detail.activities.find(a=>a.metadata?.script_package?.item?.messageStudioDraft?.reviewedMessageScope&&!a.metadata.script_package.item.contextNeedsRefresh);assert.ok(receipt,'normal Continue must acknowledge its current-profile copy in real CRM');assert.equal(receipt.metadata.script_package.item.drafts.emailBody,draft.message);
  await ready();await p.locator('#mw-add-flow').click();await p.locator('#step-7.active').waitFor();
  await p.waitForFunction(()=>document.getElementById('delivery-email')?.value||document.getElementById('delivery-recipient')?.value||document.querySelector('#step-7')?.textContent.includes('robert@'));
  const approved=await p.evaluate(()=>{const o=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')),i=o.items.find(i=>i.selectedPersonId==='robert'),s=JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));return {approved:i.approved,payload:LeadIntelOutreach.buildApprovedSendPayload(i),sourceCurrent:LeadIntelOutreach.sourceAuthorityCurrent(i,s,o.messageStudio||{}),sender:(()=>{const brand=LeadIntelBrandIdentity.normalize(s.brandIdentity);delete brand.revision;delete brand.updatedAt;return {brand,settings:LeadIntelMessageStudio.foundation(o.messageStudio,s,{},'').essentials,authority:LeadIntelOutreach.messageSourceAuthority(s,o.messageStudio)};})(),material:LeadIntelStrategyIntegrity.material(s),strategy:{approved:s.market.strategyApproved,approval:s.market.strategyApproval,status:LeadIntelStrategyIntegrity.status(s),invalidated:s.market.strategyApprovalInvalidated}};});
  assert.equal(approved.approved,true);assert.equal(approved.payload.textBody,draft.message);assert.equal(approved.sourceCurrent,true);
  const reviewedMaterial=await p.evaluate(()=>LeadIntelStrategyIntegrity.material(JSON.parse(localStorage.getItem('leadintel_customer_v2_state'))));
  assert.deepEqual(reviewedMaterial,approved.material,'Delivery navigation preserves the approved commercial facts');
  const reviewedStrategy=await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));return {approved:s.market.strategyApproved,approval:s.market.strategyApproval,status:LeadIntelStrategyIntegrity.status(s),invalidated:s.market.strategyApprovalInvalidated};});
  assert.deepEqual(reviewedStrategy,approved.strategy,'Delivery navigation preserves the current Strategy approval');
  const reviewedSender=await sender();assert.deepEqual(reviewedSender,approved.sender,'Delivery navigation preserves sender authority');await persist();const acknowledged=await f.getState();assert.deepEqual({approved:acknowledged.payload.main.market.strategyApproved,approval:acknowledged.payload.main.market.strategyApproval},{approved:reviewedStrategy.approved,approval:reviewedStrategy.approval},'workspace acknowledgement retains Strategy approval');await p.context().close();p=await open();
  const reopenedMaterial=await p.evaluate(()=>LeadIntelStrategyIntegrity.material(JSON.parse(localStorage.getItem('leadintel_customer_v2_state'))));
  assert.deepEqual(reopenedMaterial,reviewedMaterial,'a fresh session must retain the approved commercial context');
  const reopenedStrategy=await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));return {approved:s.market.strategyApproved,approval:s.market.strategyApproval,status:LeadIntelStrategyIntegrity.status(s),invalidated:s.market.strategyApprovalInvalidated};});
  assert.deepEqual(reopenedStrategy,reviewedStrategy,'a fresh session must retain the current Strategy approval');
  assert.deepEqual(await sender(),reviewedSender,'a fresh session must retain sender authority');
  await p.locator('[data-workflow-stage="7"] strong').click();await p.locator('#step-7.active').waitFor();
  assert.deepEqual(await p.evaluate(()=>LeadIntelStrategyIntegrity.material(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')))),reviewedMaterial,'sidebar navigation retains approved commercial facts');
  assert.deepEqual(await sender(),reviewedSender,'opening Delivery from the sidebar retains sender authority');
  const reopened=await p.evaluate(()=>{const o=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')),i=o.items.find(i=>i.selectedPersonId==='robert');return LeadIntelOutreach.buildApprovedSendPayload(i);});assert.equal(reopened.textBody,draft.message);assert.equal(reopened.recipient,approved.payload.recipient);await p.waitForFunction(recipient=>document.getElementById('delivery-recipient')?.value===recipient,approved.payload.recipient);
  for(const table of ['gmail_messages','crm_enrichment_requests','outreach_automation_queue'])assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM '+table).get().n,0);
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'evidence.json'),JSON.stringify({verdict:'LOCAL_CONTROLLED_ACCEPTANCE',staleApprovalBlocked:true,explicitCurrentProfileReview:true,exactCrmSnapshot:true,separateApproval:true,unsentDelivery:true,freshBrowserReopen:true,outboundMessages:0,paidContactRequests:0,consoleErrors:errors},null,2));t.diagnostic(path.join(dir,'evidence.json'));
 }catch(error){if(p&&!p.isClosed()){await p.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({error:String(error),consoleErrors:errors,toast:await p.locator('#toast').textContent().catch(()=>''),assistantStatus:await p.locator('[data-wa-work-status]').textContent().catch(()=>''),active:await p.locator('.step-view.active').getAttribute('id').catch(()=>''),context:await p.evaluate(()=>{const meta=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}'),o=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}'),d=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery')||'{}'),i=o.items?.find(i=>i.selectedPersonId==='robert'),c=d.selectedProspects?.find(c=>c.domain===i?.domain);return {choice:meta.scriptBuyer,person:c?.people?.find(p=>p.id==='robert'),item:i&&{approved:i.approved,contextNeedsRefresh:i.contextNeedsRefresh,reapprovalRequired:i.reapprovalRequired,error:i.error,flow:i.messageStudioDraft?.flowMembership,recipient:i.approvalAuthority?.recipient,sourceAuthority:i.approvalAuthority?.sourceAuthority},delivery:JSON.parse(localStorage.getItem('leadintel_customer_v2_delivery')||'{}'),eligible:window.LeadIntelDelivery?.approvedDeliveryPackages(o,JSON.parse(localStorage.getItem('leadintel_customer_v2_state'))).map(i=>({key:LeadIntelDelivery.packageKey(i),recipient:LeadIntelOutreach.approvedRecipient(i)})),sourceCurrent:i&&LeadIntelOutreach.sourceAuthorityCurrent(i,JSON.parse(localStorage.getItem('leadintel_customer_v2_state')),o.messageStudio||{}),approvalCurrent:i&&LeadIntelOutreach.approvalCurrent(i),options:[...document.querySelectorAll('#delivery-company-select option')].map(n=>({value:n.value,text:n.textContent})),readiness:document.getElementById('mw-readiness-text')?.textContent};}).catch(()=>null),requests:f.calls.slice(-20).map(({method,path,status})=>({method,path,status}))},null,2));}throw error;}
 finally{await browser.close();await f.close();}
});
