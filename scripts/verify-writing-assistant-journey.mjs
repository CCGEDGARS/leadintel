import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {step6Fixture} from '../backend/test/step6-journey-fixture.mjs';
import {loadPlaywright,sessionToken,workspaceId} from '../backend/test/step5-journey-fixture.mjs';

const artifactDir='/tmp/leadintel-writing-assistant-review';
const f=await step6Fixture(),{chromium}=await loadPlaywright();
const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const contexts=[],errors=[],requests=[];let page,invalid=false,holdReply=null;
f.env.WRITING_REFERENCES_ALLOWED_WORKSPACES=workspaceId;
f.env.WRITING_REFERENCES_BUCKET={get:async()=>null,put:async()=>{},delete:async()=>{}};
const providerFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.hostname==='api.openai.com'){
  const body=JSON.parse(options.body),data=JSON.parse(body.input||'{}');
  if(data.context?.writingContext){
   requests.push(data);
   if(holdReply){const hold=holdReply;holdReply=null;hold.started();await hold.wait;}
   const advice=/^Why/.test(data.instruction),draft=data.context.currentDraft;
   const value={reply:advice?'The question is clear and specific.':'Clarified the wording.',draft:advice?null:{subject:draft.subject,message:data.context.writingContext==='general'?'Compare the available options before deciding.':draft.message.replace('Hello','Hi')},citations:[],warnings:[]};
   const output=invalid?'invalid JSON':JSON.stringify(value);invalid=false;
   return Response.json({output_text:output,usage:{input_tokens:10,output_tokens:10}});
  }
 }
 return providerFetch(input,options);
};
async function open(){
 const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
 const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',error=>errors.push(error.message));
 await p.goto(f.origin+'/customer/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&LeadIntelServerBridge.session?.authenticated&&window.LeadIntelDiscoveryUI&&typeof discovery!=='undefined'&&discovery.selectedProspects?.length);
 await p.waitForLoadState('networkidle');
 return p;
}
async function assistant(){await page.locator('[data-wa-open]').click();await page.locator('#wa-writing-dialog').waitFor({state:'visible'});}
async function general(){await page.locator('[data-wa-context-mode]').selectOption('general');}
async function submit(text){await page.locator('[data-wa-instruction]').fill(text);await page.locator('[data-wa-generate]').click();await page.waitForFunction(()=>document.querySelector('.wa-session')?.getAttribute('aria-busy')==='false');}
async function confirmLoad(){await page.locator('[data-wa-load-selected]').click();const confirmation=page.getByRole('dialog',{name:'Replace the working copy?'});if(await confirmation.isVisible())await confirmation.getByRole('button',{name:'Continue',exact:true}).click();}
try{
 await fs.mkdir(artifactDir,{recursive:true});page=await open();
 const proceed=page.locator('[data-keep-buyer][data-person-id="robert"]').first();
 for(const detail of await proceed.locator('xpath=ancestor::details').all())if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
 await proceed.click();await page.locator('#step-6.active #message-studio').waitFor();
 await assistant();await general();
 await page.locator('[data-wa-clear]').click();
 await page.locator('[data-wa-edit-subject]').fill('Compare options');
 await page.locator('#wa-working-message-rich').fill('We compare project options before deciding.');
 await submit('Make this clearer.');
 assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 assert.equal(requests.at(-1).context.writingContext,'general');assert.equal(requests.at(-1).context.recipient,undefined);
 await page.locator('[data-wa-undo]').click();assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'We compare project options before deciding.');
 await page.locator('[data-wa-redo]').click();assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 await submit('Why is this question useful?');assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 invalid=true;await submit('Improve this again.');assert.match(await page.locator('[data-wa-status]').textContent(),/invalid/i);assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 let started,release;const began=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);holdReply={started,wait};
 await page.locator('[data-wa-instruction]').fill('Rewrite this clearly.');await page.locator('[data-wa-generate]').click();await began;
 await page.locator('[data-wa-cancel]').click();release();assert.match(await page.locator('[data-wa-status]').textContent(),/Cancelled/);assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 await page.locator('[data-wa-save-template]').click();await page.getByText('Template saved to your writing library.',{exact:true}).waitFor();
 let failSave=true;await page.route('**/api/writing-workspace/**',route=>{if(failSave&&route.request().method()==='PUT'){failSave=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Controlled save outage'})});}return route.continue();});
 await page.locator('[data-wa-continue]').click();await page.getByText('Controlled save outage',{exact:true}).waitFor();assert.equal(await page.locator('#wa-writing-dialog').isVisible(),true);assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 await page.locator('[data-wa-continue]').click();await page.locator('#wa-writing-dialog').waitFor({state:'hidden'});
 const records=f.DB.raw.prepare('SELECT payload_json FROM writing_workspace_records WHERE workspace_id=?').all(workspaceId).map(r=>JSON.parse(r.payload_json));assert.equal(records.length,2);assert.deepEqual(records.map(r=>r.kind).sort(),['draft','template']);
 await page.context().close();page=await open();
 await page.evaluate(()=>LeadIntelCustomerNavigation.setStep(6));await page.locator('#step-6.active').waitFor();
 await assistant();await general();await page.locator('[data-wa-load]').click();await page.locator('[data-wa-scripts] option').first().waitFor({state:'attached'});await confirmLoad();
 await page.waitForFunction(()=>document.querySelector('[data-wa-edit-body]')?.value==='Compare the available options before deciding.');
 await page.locator('[data-wa-clear]').click();assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'');await page.locator('[data-wa-undo]').click();assert.equal(await page.locator('[data-wa-edit-body]').inputValue(),'Compare the available options before deciding.');
 await page.screenshot({path:artifactDir+'/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:artifactDir+'/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.setViewportSize({width:1440,height:1100});await page.locator('[data-wa-context-mode]').selectOption('customer');
 const customerDraft={subject:'Robert — a practical question',message:'Hello Robert,\n\nRobin Lane from Fixture Industrial here. Would a 20-minute Zoom conversation be useful?\n\nRobin Lane'};
 await page.locator('[data-wa-edit-subject]').fill(customerDraft.subject);await page.locator('#wa-working-message-rich').fill(customerDraft.message);
 await page.locator('[data-wa-continue]').click();await page.locator('#wa-writing-dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('#outreach-email-subject').inputValue(),customerDraft.subject);assert.equal(await page.locator('#outreach-email-body').inputValue(),customerDraft.message);
 const snapshots=f.DB.raw.prepare("SELECT metadata_json FROM crm_activities WHERE activity_type='dossier.built'").all().map(r=>JSON.parse(r.metadata_json).script_package?.item).filter(Boolean);
 assert.ok(snapshots.some(item=>item.selectedPersonId==='robert'&&item.drafts.emailBody===customerDraft.message&&item.approved===false),'Continue saves the exact customer draft without approval or sending');
 assert.deepEqual(errors,[]);
 await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify({result:'passed',provider:'controlled',requests:requests.length,checks:['draft creation','general context isolation','Undo/Redo','advice preserves draft','invalid output preserves draft','cancel generation','failed save and retry','template and draft saves','fresh browser reload','Clear/Undo','mobile viewport','exact customer CRM handoff without approval or sending'],pageErrors:errors},null,2));
 console.log('Writing Assistant browser journey passed. Evidence: '+artifactDir);
}catch(error){console.log('Page errors',errors);console.log('Recent HTTP calls',JSON.stringify(f.calls.slice(-8).map(({method,path,status})=>({method,path,status}))));if(page&&!page.isClosed()){await page.screenshot({path:artifactDir+'/failure.png',fullPage:true}).catch(()=>{});await fs.writeFile(artifactDir+'/failure.txt',(await page.locator('body').innerText()).slice(-18000)).catch(()=>{});}throw error;}
finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser.close();globalThis.fetch=providerFetch;await f.close();}
