import {profileMain,profileServices,referenceQuote} from './company-list-profile-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {step1Fixture} from './step1-journey-fixture.mjs';
import {loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import app from '../src/app.js';
import {runCompanyListJobs} from '../src/company-lists.js';
const require=createRequire(import.meta.url),Ref=require('../../customer/reference-customers.js');
async function openCompanies(browser, fixture, contexts, errors) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  contexts.push(context);
  await context.addCookies([{name:'leadintel_session',value:sessionToken,url:fixture.origin}]);
  await context.route('**/*',route=>{
    return new URL(route.request().url()).origin===fixture.origin ? route.continue() : route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(fixture.origin+'/customer/');
  await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelCompanyListUI&&window.LeadIntelDiscoveryUI);
  await page.waitForLoadState('networkidle');
  await page.evaluate(()=>LeadIntelDiscoveryUI.open({focus:'companies'}));
  return page;
}

test('company-list browser chooses one reference, verifies criteria, builds 200 with browser closed, downloads, saves and reopens through real HTTP/SQL',{timeout:180000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable');return;}
 const f=await step1Fixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[],errors=[];
 t.after(async()=>{await browser.close();await f.close();});
 const row=Ref.normalizeImportedRows([{companyName:'Reference factory',website:'https://reference.example/'}])[0],quote='Builds automated production equipment for factories';
 const saved=await f.getState();Object.assign(saved.payload.main,{website:'https://seller.example/',answers:{priority_offers:'production equipment',ideal_customer:'manufacturers',buyer_roles:'Head of Procurement'},targetMarkets:['Sweden'],profile:{companyName:'Seller',priorityOffers:'production equipment',idealCustomer:'manufacturers',decisionMakers:'Head of Procurement',targetMarkets:'Sweden'},referenceCustomers:{rows:[row],analyses:{[row.id]:{sourceEvidence:[{field:'capabilities',url:row.website,quote}]}}},market:{...profileMain().market,signals:[{id:'hiring',name:'Hiring',keywords:['hiring engineers'],active:true},{id:'inactive',name:'Inactive signal',active:false}]}});
 await putCustomerState(f.env,{workspaceId,userId:'storage-owner',expectedVersion:saved.version,payload:saved.payload});
 let batch=0;f.env.COMPANY_LIST_TEST_SERVICES={search:async()=>{const offset=batch++*10;return Array.from({length:10},(_,i)=>({url:`https://maker${offset+i}.example/`}));},read:async url=>({url,markdown:`Maker${new URL(url).hostname.match(/\d+/)[0]} builds automated production equipment. Operates in Stockholm, Sweden.`}),generate:async p=>{if(p.stage==='review')return {decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:(p.candidate.profileMatches||[]).map(m=>m.profileId),supportedSignalIds:(p.candidate.signalMatches||p.candidate.matches).map(m=>m.signalId),reason:'Official company operations and location support the selected reference comparison and seller application.',gaps:[]};if(p.stage==='plan')return {queries:Array.from({length:8},(_,i)=>'Sweden production equipment segment '+(p.round*8+i))};const source=p.pages.at(-1),company=source.text.split(' ')[0];return {company,website:source.url,commercialFit:{status:'supported',url:source.url,quote:`${company} builds automated production equipment.`,reason:'Its production equipment operations are relevant to the supplied seller offer.'},identity:{url:source.url,quote:`${company} builds automated production equipment.`},location:{market:'Sweden',label:'Stockholm',url:source.url,quote:'Operates in Stockholm, Sweden.'},signalMatches:[],[p.criteria.profiles?'profileMatches':'matches']:[{...(p.criteria.profiles?{profileId:p.criteria.profiles.find(x=>x.type==='lookalike').id}:{signalId:'lookalike'}),url:source.url,quote:`${company} builds automated production equipment.`,referenceId:p.criteria.references[0].id,referenceQuote:quote,strength:90,reason:'Shared production equipment capability'}]};}};
 const open=()=>openCompanies(browser,f,contexts,errors);
 let p=await open();await p.locator('[data-cl="new"]').click();await p.waitForSelector('#company-list-form');
 assert.equal(await p.locator('[name="profile"]').count(),4);assert.equal(await p.locator('[name="profile"]:checked').count(),4);assert.equal(await p.locator('[name="signalMode"]').inputValue(),'boost');
 await p.locator('[name="profileMode"]').selectOption('all');await p.locator('[name="signalMode"]').selectOption('require');await p.locator('[name="mode"]').selectOption('all');
 await p.locator('[data-cl="review"]').click();assert.match(await p.locator('#company-list-preview').textContent(),/Profiles \(all\).*Core.*Lookalike.*Trigger-led.*Opportunity-led.*Require \(all\).*Hiring/);
 await p.locator('[name="profile"][value="icp-core"]').uncheck();assert.equal(await p.locator('[data-cl="start"]').count(),0,'changing a selection invalidates review');
 await p.locator('[name="profile"][value="icp-trigger-led"]').uncheck();await p.locator('[name="profile"][value="icp-opportunity-led"]').uncheck();await p.locator('[name="profileMode"]').selectOption('any');await p.locator('[name="signalMode"]').selectOption('off');assert.equal(await p.locator('#company-list-buying-fields').isVisible(),false);
 await fs.mkdir('/tmp/leadintel-company-lists',{recursive:true});await p.locator('#company-list-panel').screenshot({path:'/tmp/leadintel-company-lists/profiles-desktop.png'});
 await p.setViewportSize({width:390,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.locator('#company-list-panel').screenshot({path:'/tmp/leadintel-company-lists/profiles-mobile.png'});await p.locator('[name="profile"][value="icp-reference-lookalike"]').scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/leadintel-company-lists/profiles-mobile-viewport.png'});await p.setViewportSize({width:1440,height:1000});
 await p.locator('[name="name"]').fill('Focused manufacturers');await p.locator('[name="referenceGroup"]').selectOption('custom');await p.locator('[name="reference"]').first().check();await p.locator('[name="preset"]').selectOption('custom');await p.locator('[name="count"]').fill('200');await p.locator('[name="count"]').blur();assert.equal(await p.locator('[name="budget"]').inputValue(),'4000');await p.locator('[data-cl="review"]').click();await p.waitForSelector('#company-list-preview .cl-preview');assert.match(await p.locator('#company-list-preview').textContent(),/Reference factory/);assert.equal(await p.locator('[name="signal"][value="inactive"]').count(),0);await p.locator('[data-cl="start"]').click();await p.waitForSelector('.cl-result-heading');await f.settleBackground();
 await p.context().close();const noop=async()=>{};for(let i=0;i<90&&f.DB.raw.prepare('SELECT status FROM company_lists').get().status!=='complete';i++){const pending=[];await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:v=>pending.push(v)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);}
 p=await open();await p.locator('[data-cl="lists"]').click();await p.locator('[data-cl="open"]').first().click();await p.waitForFunction(()=>document.querySelectorAll('.cl-table-wrap tbody tr').length===10);assert.match(await p.locator('#company-list-content').textContent(),/200 of 200/);
 await fs.mkdir('/tmp/leadintel-company-lists',{recursive:true});await p.locator('#company-list-panel').screenshot({path:'/tmp/leadintel-company-lists/desktop.png'});await p.locator('[data-cl="show-all"]').click();assert.equal(await p.locator('.cl-table-wrap tbody tr').count(),200);await p.locator('[data-cl="show-all"]').click();assert.equal(await p.locator('.cl-table-wrap tbody tr').count(),10);
 for(const type of ['csv','xlsx']){const event=p.waitForEvent('download');await p.locator('[data-cl="'+type+'"]').click();const download=await event;assert.ok(download.suggestedFilename().endsWith('.'+type));const file='/tmp/leadintel-company-lists/companies.'+type;await download.saveAs(file);const content=await fs.readFile(file,'utf8');assert.match(content,/Maker199/);assert.match(content,/Reference evidence/);assert.match(content,/Evidence review/);assert.equal(type==='csv'?(content.match(/^"Maker\d+","https:/gm)||[]).length:(content.match(/<row r=/g)||[]).length-1,200);}
 await p.locator('[data-cl="save"]').click();await p.waitForFunction(()=>document.querySelector('.cl-result-heading')?.textContent.includes('Saved to CRM'));assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM crm_companies').get().n,200);
 await p.setViewportSize({width:390,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.locator('#company-list-panel').screenshot({path:'/tmp/leadintel-company-lists/mobile.png'});
 p=await open();await p.locator('[data-cl="lists"]').click();await p.locator('[data-cl="open"]').first().click();await p.waitForSelector('.cl-table-wrap');assert.equal(await p.locator('.cl-table-wrap tbody tr').count(),10);assert.match(await p.locator('.cl-result-heading').textContent(),/Saved to CRM/);assert.equal((await f.getState()).payload.main.market.signals.find(s=>s.id==='inactive').active,false);
 await p.locator('[data-cl="delete"]').click();await p.locator('[data-li-cancel]').click();assert.equal(await p.locator('.cl-table-wrap tbody tr').count(),10);
 await p.locator('#open-crm').click();await p.locator('#crm-company-lists').click();await p.locator('[data-cl="open"]').first().click();await p.waitForSelector('.cl-table-wrap');
 await p.locator('[data-cl="buyer"]').first().click();await p.waitForFunction(()=>document.querySelector('#discovery-stage-title')?.textContent.includes('decision-makers'));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery')||'{}').selectedProspects?.some(c=>c.domain==='maker0.example'&&c.crmId));assert.ok(f.calls.some(c=>c.path==='/api/company-lists'&&c.body?.action==='buyer'));
 for(const c of contexts)await c.close();
 const changed=await f.getState();changed.payload.main.market.icps.find(x=>x.id==='icp-reference-lookalike').active=false;changed.payload.main.market.icps.find(x=>x.id==='icp-core').active=false;changed.payload.main.market.deletedSignalIds=['hiring'];await putCustomerState(f.env,{workspaceId,userId:'storage-owner',expectedVersion:changed.version,payload:changed.payload});
 p=await open();await p.locator('[data-cl="new"]').click();await p.waitForSelector('#company-list-form');assert.equal(await p.locator('[name="profile"][value="icp-reference-lookalike"]').isDisabled(),true);assert.equal(await p.locator('[name="profile"][value="icp-core"]').isDisabled(),true);assert.equal(await p.locator('[name="signal"][value="hiring"]').count(),0);
 await p.locator('[data-cl="lists"]').click();await p.locator('[data-cl="open"]').first().click();await p.waitForSelector('.cl-table-wrap');assert.match(await p.locator('#company-list-content').textContent(),/Lookalike/);assert.match(await p.locator('#company-list-content').textContent(),/200 of 200/);
 assert.deepEqual(errors,[]);await fs.writeFile('/tmp/leadintel-company-lists/evidence.json',JSON.stringify({rows:200,crm:200,backgroundWithBrowserClosed:true,visibleTop:10,downloads:['csv','xlsx'],freshBrowser:true,errors},null,2));
});

test('lookalike list with five references and no optional triggers progresses within the chosen allowance', {timeout:120000},async t=>{
  let chromium;
  try{
    ({chromium}=await loadPlaywright());
    await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');
  }catch(error){
    if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;
    return t.skip('Chromium unavailable');
  }
  const f=await step1Fixture();
  t.after(()=>f.close());
  const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  t.after(()=>browser.close());
  const saved=await f.getState(),main=profileMain();
  const refs=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({companyName:'Reference '+i,website:'https://reference'+i+'.example/'})));
  main.targetMarkets=['Denmark'];
  main.profile={companyName:'Seller',website:main.website,priorityOffers:'Production equipment',idealCustomer:'Equipment manufacturers',targetMarkets:'Denmark',decisionMakers:'Head of Procurement'};
  main.referenceCustomers=Ref.activateReferenceCustomers({rows:refs,analyses:Object.fromEntries(refs.map(ref=>[ref.id,{capabilities:[referenceQuote],sourceEvidence:[{field:'capabilities',url:ref.website,quote:referenceQuote}]}]))},refs.map(ref=>ref.id));
  main.referenceCustomerPortfolio={selectedListId:'manufacturers',lists:[{id:'manufacturers',name:'Manufacturers',active:true,reference:main.referenceCustomers}]};
  main.market.signals=[{id:'tender',name:'Tender or procurement activity',active:true}];
  Object.assign(saved.payload.main,main);
  await putCustomerState(f.env,{workspaceId,userId:'storage-owner',expectedVersion:saved.version,payload:saved.payload});

  const services=profileServices({count:10});
  f.env.COMPANY_LIST_TEST_SERVICES={...services,
    read:async url=>{
      const page=await services.read(url);
      return {...page,markdown:page.markdown.replace('Stockholm, Sweden','Aarhus, Denmark')};
    },
    generate:async task=>{
      if(task.stage==='plan')return {queries:['Danish production equipment manufacturers']};
      const response=await services.generate(task);
      if(task.stage==='assess')response.location={...response.location,market:'Denmark',label:'Aarhus',quote:response.location.quote.replace('Stockholm, Sweden','Aarhus, Denmark')};
      return response;
    }
  };
  const errors=[],contexts=[],page=await openCompanies(browser,f,contexts,errors);
  await page.locator('[data-cl="new"]').click();
  for(const id of ['icp-core','icp-trigger-led','icp-opportunity-led'])await page.locator('[name="profile"][value="'+id+'"]').uncheck();
  await page.locator('[name="signal"][value="tender"]').uncheck();
  await page.locator('[name="budget"]').fill('10');
  assert.equal(await page.locator('[name="reference"]:checked').count(),5);
  assert.match(await page.locator('#company-list-allowance-note').innerText(),/partial list/);
  await page.locator('[data-cl="review"]').click();
  await page.locator('[data-cl="start"]').click({timeout:5000});
  await page.waitForSelector('.cl-result-heading');
  await f.settleBackground();
  await page.context().close();
  const readRun=()=>f.DB.raw.prepare('SELECT input_json,state_json,status FROM company_lists').get();
  async function finishAllowance(){
    const noop=async()=>{};
    for(let tick=0;tick<8;tick++){
      if(['incomplete','complete'].includes(readRun().status))return;
      const pending=[];
      await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});
      await Promise.all(pending);
    }
    assert.fail('The registered scheduler did not reach the target or the reviewed allowance.');
  }
  await finishAllowance();
  const row=readRun(),criteria=JSON.parse(row.input_json),state=JSON.parse(row.state_json);
  assert.deepEqual(criteria.markets,['Denmark']);
  assert.deepEqual(criteria.profiles.map(p=>p.type),['lookalike']);
  assert.equal(criteria.references.length,5);
  assert.equal(criteria.count,10);
  assert.equal(criteria.signals.length,0);
  assert.equal(criteria.signalMode,'off');
  assert.equal(state.operations,10);
  assert.equal(row.status,'incomplete');
  assert.equal(state.failureCode,'allowance');
  assert.ok(state.results.length>0&&state.results.length<10);
  assert.ok(state.results.every(r=>r.signalBonus===0&&r.score===r.fitScore&&r.profileMatches[0].referenceId));
  const reopened=await openCompanies(browser,f,contexts,errors);
  await reopened.locator('[data-cl="lists"]').click();
  await reopened.locator('[data-cl="open"]').first().click();
  await reopened.waitForSelector('.cl-result-heading');
  assert.match(await reopened.locator('#company-list-content').innerText(),new RegExp(state.results.length+' of 10'));
  const originalDomains=state.results.map(r=>r.domain);
  for(let extension=0;extension<3&&readRun().status==='incomplete';extension++){
    const resumed=reopened.waitForResponse(r=>r.url().includes('/api/company-lists')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='resume');
    await reopened.getByRole('button',{name:'Add 10 operations and continue'}).click();
    assert.equal((await resumed).status(),200);
    await f.settleBackground();
    await finishAllowance();
    await reopened.locator('[data-cl="refresh"]').click();
    const {results}=JSON.parse(readRun().state_json);
    await reopened.waitForFunction(count=>document.querySelector('#company-list-content')?.innerText.includes(count+' of 10'),results.length);
  }
  const completed=readRun(),finalState=JSON.parse(completed.state_json);
  assert.equal(completed.status,'complete');
  assert.equal(new Set(finalState.results.map(r=>r.domain)).size,10);
  assert.ok(originalDomains.every(domain=>finalState.results.some(r=>r.domain===domain)));
  assert.deepEqual(errors,[]);
});
