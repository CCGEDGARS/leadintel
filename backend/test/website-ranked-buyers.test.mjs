import test from 'node:test';
import {access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {journeyFixture,loadPlaywright,sessionToken} from './step5-journey-fixture.mjs';

test('a saved website scan starts the ranked public job and opens Messages for its exact buyer',{timeout:85000},async t=>{
 let chromium;
 try{({chromium}=await loadPlaywright());await access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}
 catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable in this test environment');return;}
 const f=await journeyFixture({durableJobs:true});
 t.after(()=>f.close());
 const state=await f.getState(),{payload}=state,c=f.candidate,url='https://'+c.domain+'/';
 payload.main.step=2;
 payload.meta.discovery.visibleStep=2;
 payload.discovery.selectedProspects=[];
 payload.main.websiteScans={activeId:'scan',items:[{id:'scan',name:'Website prospects',url,managementLimit:5,rows:[{id:'row',name:c.company,website:url,crmId:c.crmId,sourceUrl:url,quote:'Forge Industries builds equipment.',selected:true,identityStatus:'verified',identityUrl:url}]}]};
 await f.replace(payload,state.version);
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
 const evidence={version:1,domain:c.domain,records:[{name:'Alice Berg',email:'alice@forge.example',finder:'Test finder',qualification:'valid'}]};
 await page.goto(f.origin+'/customer/#buyer-email-evidence='+encodeURIComponent(JSON.stringify(evidence)));await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelServerBridge?.session?.authenticated&&window.LeadIntelDiscoveryUI?.openWebsiteBuyers);
 await page.locator('[data-step-marker="2"]').click();
 await page.locator('#website-scanning-open').click();
 const find=page.getByRole('button',{name:'Find buyers',exact:true}).filter({visible:true});
 await find.click();
 const panel=page.locator('#website-buyer-results');
 await panel.waitFor();
 try{await page.waitForFunction(()=>discovery?.selectedProspects?.some(c=>c.buyerResearchJob?.id),null,{timeout:9000});}
 catch(error){throw Error('Scanner job did not start: '+await panel.innerText()+' '+errors.join(', ')+' '+JSON.stringify(f.calls.slice(-8)),{cause:error});}
 const job=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').get();
 assert.equal(JSON.parse(job.input_json).fullResearch,true);assert.ok(!JSON.parse(job.input_json).paidResearch);
 for(let n=0;n<16;n++){
  const current=f.DB.raw.prepare('SELECT status FROM buyer_research_jobs WHERE id=?').get(job.id);
  if(!['queued','running'].includes(current.status))break;
  await f.runJobs(job.id);
 }
 const cards=panel.locator('.selected-prospect-person'),card=cards.filter({hasText:'Robert Lund'});
 try{await card.getByRole('button',{name:'Proceed',exact:true}).waitFor({timeout:18000});}
 catch(error){throw Error('Missing ranked buyer: '+await panel.innerText()+' '+errors.join(', '),{cause:error});}
 assert.equal(await cards.count(),2);
 assert.deepEqual(await card.locator('.buyer-four-actions button').allTextContents(),['Paid email','Paid phone','Refresh','Proceed']);
 assert.match(await card.innerText(),/robert@forge.example/);
 assert.equal(await card.locator('a[href="https://forge.example/team"]').count()>0,true);
 await page.waitForFunction(()=>discovery.selectedProspects[0]?.buyerResearchJob?.status&&!["running","queued"].includes(discovery.selectedProspects[0].buyerResearchJob.status));
 await panel.getByRole('button',{name:'Apply saved email evidence'}).click();
 await page.getByRole('button',{name:'Save evidence',exact:true}).click();
 const alice=cards.filter({hasText:'Alice Berg'});
 await alice.getByText('Imported provider report · Test finder · valid').waitFor();
 assert.match(await alice.innerText(),/Mailbox unverified/);
 const download=page.waitForEvent('download');
 await panel.getByRole('button',{name:'Download research report',exact:true}).click();
 const {readFile}=await import('node:fs/promises');
 const report=JSON.parse(await readFile(await (await download).path(),'utf8'));
 assert.equal(report.execution.jobId,job.id);assert.equal(report.domain,c.domain);
 assert.ok(report.execution.completedChecks>0);
 const commands=f.calls.filter(call=>call.path.startsWith('/api/buyers/research')&&call.action==='start').length;
 const save=await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}));assert.equal(save.saved,true);
 await page.reload();
 await page.waitForFunction(()=>window.LeadIntelDiscoveryUI?.openWebsiteBuyers&&window.LeadIntelServerBridge?.ready);
 await page.locator('[data-step-marker="2"]').click();await page.locator('#website-scanning-open').click();
 await card.getByRole('button',{name:'Proceed',exact:true}).waitFor();
 await alice.getByText('Imported provider report · Test finder · valid').waitFor();
 assert.equal(f.calls.filter(call=>call.path.startsWith('/api/buyers/research')&&call.action==='start').length,commands);
 await card.getByRole('button',{name:'Proceed',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#step-6.active'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery_meta')).selectedEmailBuyer.email),'robert@forge.example');
 assert.deepEqual(errors,[]);
 assert.equal(f.externalCalls.some(c=>/people\/match|enrich|send_email/.test(c.url)),false);
});

test('a fresh Danish website scan ranks three sourced buyers and preserves each email outcome without a second lookup', {timeout:90000}, async t=>{
 const executablePath=process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium';
 let chromium;
 try{({chromium}=await loadPlaywright());await access(executablePath);}
 catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable');return;}

 const domain='fjord-form.dk',company='Fjord Form',home='https://'+domain+'/';
 const profile='https://dk.linkedin.com/in/karl-vester-fixture';
 const about='I dag ejes Fjord Form A/S af produktionsdirektør Erik Madsen og CEO Lars Jensen. Erik Madsen og Lars Jensen står for den daglige drift af virksomheden.';
 const pages=new Map([
  [home,company],[home+'om-os/',about],[home+'kontakt/','Kontakt Fjord Form'],
  [profile,'# Karl Vester\n\n**Projektleder**\n\n## Employment History\n\n### [Fjord Form](https://www.linkedin.com/company/fjord-form)\n\n- 2023-02-01 - now: Projektleder']
 ]);
 const batch=[],sequence=[];
 const f=await journeyFixture({
  durableJobs:true,durableWebsite:true,
  initialCandidate:{company:'Existing Company',domain:'existing.example',buyerRoles:['CEO','Production Director','Project Manager'],people:[]},
  externalFetch:async input=>{
   if(String(input)===home)return new Response('<html><title>Fjord Form</title><h1>Fjord Form</h1><p>Fjord Form manufactures steel structures for industrial customers.</p></html>',{headers:{'Content-Type':'text/html'}});
  },
  researchServices:{
   read:async url=>{
    if(url===home)sequence.push('company website');
    const markdown=pages.get(url);
    if(!markdown)throw Error('Page unavailable in fixture');
    return {data:{url,markdown,links:[],metadata:{sourceURL:url,statusCode:200}}};
   },
   search:async query=>{
    if(/linkedin|projekt|project|manager/i.test(query)){
     if(sequence.includes('AI search plan'))sequence.push('public people search');
     return [{url:profile,title:'Karl Vester - Projektleder',description:'Projektleder · Erfaring: Fjord Form'}];
    }
    return [];
   },
   registry:async()=>({status:'unsupported'}),apollo:async()=>{sequence.push('Apollo identities');return {people:[]};},
   plan:async(_env,_workspace,{queries})=>{
    sequence.push('AI search plan');
    return {queries:queries.slice(0,4),findMorePeople:false};
   },
   dossier:async()=>{sequence.push('company research');return {status:'partial',continuation:false,people:[],facts:[],channels:[],sources:[],passes:[]};},
   review:async()=>({supervisor:{status:'not_assessed'},conflicts:[]}),
   emailWaterfall:async(_env,_workspace,owner,names,options)=>{
    sequence.push('priority email lookup');
    assert.equal(owner,domain);assert.equal(options.maxCredits,0);batch.push([...names]);
    return names.map(name=>{
     if(name==='Karl Vester')return {status:'incomplete',reason:'No provider ran within the credit allowance.'};
     if(name==='Erik Madsen')return {status:'found',email:'em@'+domain,finder:'enrow',qualification:'valid',mailbox:'unverified'};
     assert.equal(name,'Lars Jensen');
     return {status:'found',email:'lj@'+domain,finder:'orbisearch',qualification:'safe',mailbox:'deliverable',verifier:'orbisearch',confidence:98,catchAll:false};
    });
   }
  }
 });
 t.after(()=>f.close());
 const state=await f.getState();
 state.payload.discovery.selectedProspects=[];
 state.payload.main.step=2;state.payload.meta.discovery.visibleStep=2;
 await f.replace(state.payload,state.version);
 const browser=await chromium.launch({executablePath,args:['--no-sandbox']});t.after(()=>browser.close());
 const context=await browser.newContext();
 await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);
 await context.route('**/*',route=>new URL(route.request().url()).origin===f.origin?route.continue():route.abort());
 const page=await context.newPage();
 async function openScanner(){
  await page.waitForFunction(()=>window.LeadIntelServerBridge?.session?.authenticated&&window.LeadIntelDiscoveryUI?.openWebsiteBuyers);
  await page.locator('[data-step-marker="2"]').click();
  await page.locator('#website-scanning-open').click();
 }
 await page.goto(f.origin+'/customer/');await openScanner();
 await page.locator('#website-scanning-url').fill(home);
 await page.getByRole('button',{name:'Scan website',exact:true}).click();
 await page.getByRole('table',{name:'Website scan results'}).waitFor();
 await page.getByRole('button',{name:'Find buyers',exact:true}).filter({visible:true}).click();
 await page.waitForFunction(()=>discovery?.selectedProspects?.some(c=>c.buyerResearchJob?.id));
 const job=f.DB.raw.prepare('SELECT id FROM buyer_research_jobs WHERE domain=?').get(domain);
 for(let i=0;i<25;i++){
  const {status}=f.DB.raw.prepare('SELECT status FROM buyer_research_jobs WHERE id=?').get(job.id);
  if(!['running','queued'].includes(status))break;
  await f.runJobs(job.id);
 }
 const panel=page.locator('#website-buyer-results'),cards=panel.locator('.selected-prospect-person');
 async function assertResults(){
  try{await panel.getByText('3 priority buyers',{exact:true}).waitFor({timeout:12000});}
  catch(error){throw Error('Unexpected shortlist: '+await panel.innerText(),{cause:error});}
  for(const [name,expected] of [
   ['Lars Jensen',['lj@'+domain,'Mailbox deliverable']],
   ['Erik Madsen',['em@'+domain,'Mailbox unverified']],
   ['Karl Vester',['Check incomplete','No provider ran within the credit allowance.']]
  ]){
   const card=cards.filter({hasText:name});const text=await card.innerText();
   assert.deepEqual(await card.locator('[data-contact-channel]').evaluateAll(nodes=>nodes.map(node=>node.dataset.contactChannel)),['linkedin','phone','company','gmail']);
   const workEmail=card.locator('[data-contact-channel=company]');
   assert.equal(await workEmail.getAttribute('data-contact-status'),name==='Karl Vester'?'incomplete':'found',name+' work email field state');
   for(const value of expected)assert.ok(text.includes(value),name+' should show '+value+'; actual '+text);
   assert.deepEqual(await card.locator('.buyer-four-actions button').allTextContents(),['Paid email','Paid phone','Refresh','Proceed']);
  }
 }
 await page.waitForFunction(()=>discovery?.selectedProspects?.some(c=>c.buyerResearchJob?.id&&!['queued','running'].includes(c.buyerResearchJob.status)));
 await assertResults();
 const first=stage=>{assert.ok(sequence.includes(stage),stage+' must run');return sequence.indexOf(stage);};
 assert.ok(first('company website')<first('Apollo identities'));
 assert.ok(first('Apollo identities')<first('AI search plan'));
 assert.ok(first('AI search plan')<first('public people search'));
 assert.ok(first('public people search')<first('company research'));
 assert.ok(first('company research')<first('priority email lookup'));
 const callsBeforeReload=[...sequence];
 assert.equal((await page.evaluate(()=>LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true}))).saved,true);
 await page.reload();await openScanner();await assertResults();
 assert.deepEqual(sequence,callsBeforeReload);
 assert.deepEqual(batch.map(names=>names.sort()),[['Erik Madsen','Karl Vester','Lars Jensen']]);
 assert.equal(f.DB.raw.prepare('SELECT count(*) AS n FROM buyer_research_jobs WHERE domain=?').get(domain).n,1);
 assert.equal(f.DB.raw.prepare('SELECT count(*) AS n FROM additional_contact_attempts').get().n,0);
 const previousScan=await page.locator('#website-scanning-history').inputValue();
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',last_error='workspace_records_full:5678',revision=revision+1 WHERE id=?").run(job.id);
 await page.getByRole('button',{name:'Scan website',exact:true}).click();
 await page.waitForFunction(old=>document.querySelector('#website-scanning-history')?.value!==old&&document.querySelector('#website-scanning-history')?.options.length===2,previousScan);
 assert.equal(await panel.isVisible(),false);
 const newScan=await page.locator('#website-scanning-history').inputValue();
 await page.getByRole('button',{name:'Find buyers',exact:true}).filter({visible:true}).click();
 await page.waitForFunction(old=>discovery.selectedProspects.some(c=>c.buyerResearchJob?.id&&c.buyerResearchJob.id!==old),job.id);
 const fresh=f.DB.raw.prepare("SELECT * FROM buyer_research_jobs WHERE json_extract(input_json,'$.websiteScanId')=?").get(newScan);
 assert.notEqual(fresh.id,job.id);
 assert.equal(await panel.getByText(/Buyer research paused · CRM/).count(),0);
 await page.locator('#website-scanning-history').selectOption(previousScan);
 await panel.getByText(/Buyer research paused · CRM/).first().waitFor();
 await page.locator('#website-scanning-history').selectOption(newScan);
 await page.waitForFunction(id=>discovery.selectedProspects.some(c=>c.buyerResearchJob?.id===id),fresh.id);
 assert.equal(await panel.getByText(/Buyer research paused · CRM/).count(),0);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM buyer_research_jobs WHERE domain=?').get(domain).n,2);

 for(let i=0;i<25;i++){
  const {status}=f.DB.raw.prepare('SELECT status FROM buyer_research_jobs WHERE id=?').get(fresh.id);
  if(!['running','queued'].includes(status))break;
  await f.runJobs(fresh.id);
 }
 await page.waitForFunction(id=>discovery.selectedProspects.some(c=>c.buyerResearchJob?.id===id&&!['running','queued'].includes(c.buyerResearchJob.status)),fresh.id);
 assert.ok(f.DB.raw.prepare("SELECT COUNT(*) AS n FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND json_extract(result_json,'$.reused')=1").get(fresh.id).n>0);
 for(const email of ['lj@'+domain,'em@'+domain])await panel.getByText(email,{exact:true}).first().waitFor();
 assert.equal(batch.flat().filter(name=>name==='Lars Jensen'||name==='Erik Madsen').length,2,'Previously found addresses require no second lookup');

 // Delete the paused scan, then scan that same URL again while its CRM record still exists.
 await page.locator('#website-scanning-history').selectOption(previousScan);
 await panel.getByText(/Buyer research paused · CRM/).first().waitFor();
 await page.getByRole('button',{name:'Delete this scan',exact:true}).click();
 await page.getByRole('dialog').getByRole('button').last().click();
 await page.waitForFunction(()=>document.querySelector('#website-scanning-history')?.options.length===1);
 await page.getByRole('button',{name:'Scan website',exact:true}).click();
 await page.waitForFunction(([deleted,other])=>{
  const select=document.querySelector('#website-scanning-history');
  return select?.options.length===2&&select.value&&![deleted,other].includes(select.value)&&![...select.options].some(o=>o.value===deleted);
 },[previousScan,newScan]);
 assert.equal(await panel.isVisible(),false);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM buyer_research_jobs WHERE domain=?').get(domain).n,2,'Scanning alone starts no buyer lookup');

});
