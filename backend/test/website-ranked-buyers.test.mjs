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
