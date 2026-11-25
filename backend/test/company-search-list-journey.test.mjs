import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';

test('Companies Save list → acknowledged export → fresh browser → CRM lists → deletion through actual HTTP/SQL',{timeout:120000},async t=>{
 let chromium;try{({chromium}=await loadPlaywright());await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable');return;}
 const f=await journeyFixture(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 t.after(async()=>{await browser.close();await f.close();});
 const saved=await f.getState();saved.payload.main.website='https://seller.example/';saved.payload.main.targetMarkets=['Sweden'];saved.payload.meta.discovery.website='https://seller.example/';saved.payload.meta.discovery.pipelineWebsite='https://seller.example/';saved.payload.discovery={status:'complete',needsRefresh:true,candidates:[],pipeline:[],selectedProspects:[f.candidate],potentialMatches:Array.from({length:30},(_,index)=>{const i=30-index;return {company:'Factory '+i,domain:'factory'+i+'.example',market:'Sweden',needsRecheck:true,qualificationGaps:['Company verification incomplete'],qualification:i===30?undefined:{qualificationKind:'company',score:i===29?0:90-i},evidence:[{url:'https://factory'+i+'.example/news',text:'Exact source evidence '+i}]};})};
 // A cutoff on whitespace used to give the browser and server different fingerprints.
 const longQuote='fixture evidence'.padEnd(1999,'x')+' additional text';
 saved.payload.discovery.potentialMatches[0].evidence.push({url:'https://factory30.example/long',text:longQuote});
 await putCustomerState(f.env,{workspaceId,userId:'storage-owner',expectedVersion:saved.version,payload:saved.payload});
 async function open(){const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(f.origin+'/customer/');await p.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelCompanyListUI&&window.LeadIntelDiscoveryUI);await p.waitForLoadState('networkidle');await p.evaluate(()=>LeadIntelDiscoveryUI.open({focus:'companies'}));await p.locator('#prior-company-search > summary').click();try{await p.waitForFunction(()=>document.getElementById('save-company-search-list')?.disabled===false,{},{timeout:10000});}catch(e){console.log(JSON.stringify({errors,view:await p.evaluate(()=>({status:document.getElementById('company-search-list-status')?.textContent,role:LeadIntelServerBridge.workspace?.role,count:LeadIntelDiscoveryUI.getCompanyListSnapshot().snapshot?.rows.length}))}));throw e;}return p;}
 let p=await open();assert.equal(await p.locator('#export-company-search-list').isDisabled(),true);assert.match(await p.locator('#company-search-list-status').textContent(),/31 companies/);
 const fixtureNames=Array.from({length:30},(_,i)=>'Factory '+(i+1));
 async function readCompanyRows(page,selector,fromSaved){
  // The qualification worker can show the list actions before publishing its rows.
  await page.locator(selector).first().waitFor({state:'attached',timeout:15000});
  return page.locator(selector).evaluateAll((rows,saved)=>rows.map(row=>{
   const cell=selector=>row.querySelector(selector)?.textContent;
   return saved?{company:cell('td:nth-child(2) strong'),rank:cell('td:first-child'),score:row.cells[3].firstChild.textContent}:
    {company:cell('.company-row-name'),rank:cell('.company-row-rank')??'—',score:cell('.company-row-score strong')?.split('/')[0]??'—'};
  }),fromSaved);
 }
 const liveRows=await readCompanyRows(p,'#step-5 details.company-result-row',false);
 assert.equal(liveRows.length,31);
 assert.deepEqual(liveRows.filter(r=>r.company.startsWith('Factory ')).map(r=>r.company),fixtureNames);
 for(const [i,row] of liveRows.entries())assert.equal(row.rank,row.score==='—'?'—':String(i+1));
 assert.deepEqual(liveRows.filter(r=>r.company.startsWith('Factory ')).slice(-2).map(r=>r.score),['0','—']);
 f.DB.raw.exec("CREATE TRIGGER snapshot_full BEFORE INSERT ON company_lists BEGIN SELECT RAISE(ABORT,'WORKSPACE_STORAGE_FULL'); END");
 await p.locator('#save-company-search-list').click();await p.waitForFunction(()=>/storage|space|full|limit/i.test(document.getElementById('company-search-list-status').textContent));assert.equal(await p.locator('#export-company-search-list').isDisabled(),true);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,0);f.DB.raw.exec('DROP TRIGGER snapshot_full');
 await p.locator('#save-company-search-list').click();await p.waitForFunction(()=>!document.getElementById('export-company-search-list').disabled);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,1);
 assert.match(await p.locator('#company-search-list-status').textContent(),/Saved · 31 companies/);
 const artifact='/tmp/leadintel-company-search-list';await fs.mkdir(artifact,{recursive:true});await p.locator('#company-search-list-actions').screenshot({path:artifact+'/desktop.png'});
 const websites=await p.evaluate(()=>Object.fromEntries(LeadIntelDiscoveryUI.getCompanyListSnapshot().snapshot.rows.map(row=>[row.company,row.website])));
 const expectedSheet=[['Rank','Company','Website','Company fit score'],...liveRows.map(row=>[
  row.rank==='—'?'':row.rank,row.company,websites[row.company],row.score==='—'?'':row.score
 ])];
 for(const type of ['csv','xlsx']){
  await p.locator('#company-search-list-format').selectOption(type);
  const event=p.waitForEvent('download');
  await p.locator('#export-company-search-list').click();
  const file=artifact+'/companies.'+type;
  await (await event).saveAs(file);
  if(type==='csv'){
   const expectedCsv=expectedSheet.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n');
   assert.equal(await fs.readFile(file,'utf8'),'\uFEFF'+expectedCsv);
  }else{
   const xml=execFileSync('unzip',['-p',file,'xl/worksheets/sheet1.xml'],{encoding:'utf8'});
   const actual=await p.evaluate(xml=>Array.from(new DOMParser().parseFromString(xml,'application/xml').querySelectorAll('row'),
    row=>Array.from(row.children,cell=>cell.textContent)),xml);
   assert.deepEqual(actual,expectedSheet);
   assert.match(xml,/<c r="A2"><v>1<\/v><\/c>/);
  }
 }
 await p.setViewportSize({width:390,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.locator('#company-search-list-actions').screenshot({path:artifact+'/mobile.png'});
 await p.context().close();p=await open();await p.waitForFunction(()=>!document.getElementById('export-company-search-list').disabled);
 await p.locator('#open-crm').click();await p.locator('#crm-company-lists').click();await p.locator('[data-cl="open"]').first().click();await p.waitForSelector('.cl-table-wrap');assert.equal(await p.locator('.cl-table-wrap tbody tr').count(),31);assert.equal(await p.locator('[data-cl="buyer"]').count(),0);assert.match(await p.locator('.cl-result-heading').textContent(),/Saved search results/);
 assert.deepEqual(await readCompanyRows(p,'.cl-table-wrap tbody tr',true),liveRows);
 assert.ok((await p.locator('.cl-table-wrap').textContent()).includes(longQuote.trim().slice(0,1999)));
 const crmDownload=p.waitForEvent('download');
 await p.locator('[data-cl="csv"]').click();
 await (await crmDownload).saveAs(artifact+'/reopened.csv');
 assert.deepEqual(await fs.readFile(artifact+'/reopened.csv'),await fs.readFile(artifact+'/companies.csv'));
 await p.locator('[data-cl="delete"]').click();await p.locator('[data-li-cancel]').click();assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_lists').get().n,1);
 await p.locator('[data-cl="delete"]').click();await p.locator('[data-li-accept]').click();await p.waitForFunction(()=>document.querySelector('#company-list-content')?.textContent.includes('No lists yet'));assert.equal(await p.locator('#export-company-search-list').isDisabled(),true);assert.equal(await p.evaluate(()=>LeadIntelDiscoveryUI.getCompanyListSnapshot().snapshot.rows.length),31);
 await p.locator('#save-company-search-list').click();await p.waitForFunction(()=>!document.getElementById('export-company-search-list').disabled);await p.context().close();
 const next=await f.getState();next.payload.discovery.potentialMatches.push({company:'Added later',domain:'later.example',needsRecheck:true,qualificationGaps:['Company verification incomplete'],evidence:[{url:'https://later.example/',text:'Company source awaiting verification'}]});await putCustomerState(f.env,{workspaceId,userId:'storage-owner',expectedVersion:next.version,payload:next.payload});
 p=await open();assert.equal(await p.locator('#export-company-search-list').isDisabled(),true);assert.match(await p.locator('#company-search-list-status').textContent(),/32 companies/);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM crm_companies').get().n,1);assert.deepEqual(f.providerCalls,[]);assert.ok(f.externalCalls.every(call=>['www.isof.se','svenska.se','en.bab.la','europa.eu'].includes(new URL(call.url).hostname)),'only the existing background language-pack sources may be read');assert.deepEqual(errors,[]);
 await fs.writeFile(artifact+'/evidence.json',JSON.stringify({companies:31,failedSaveBlockedExport:true,freshBrowser:true,changedResultsNeedSave:true,deletedCopyPreservesResearch:true,exports:['csv','xlsx'],errors},null,2));
});
