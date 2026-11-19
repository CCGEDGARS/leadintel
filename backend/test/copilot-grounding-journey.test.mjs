import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';

test('grounded answers show their saved basis, navigate to Strategy and reopen with a fresh answer after state changes',{timeout:90000},async t=>{
  try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable');return;}
  const f=await journeyFixture({durableCopilot:true}),{chromium}=await loadPlaywright();
  const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const dir='/tmp/leadintel-copilot-grounding',errors=[];await fs.mkdir(dir,{recursive:true});let context,page,spent=0;
  f.env.COPILOT_TEST_PROVIDER={generate:async()=>{spent++;throw Error('Unexpected AI generation');},search:async()=>{spent++;throw Error('Unexpected research');}};
  try{
    let state=await f.getState();state.payload.main.market.signals=[{id:'custom-tender',name:'Tender or procurement activity',active:true,weight:9,keywords:'procurement'},{id:'custom-hiring',name:'Hiring',active:false,weight:7,keywords:'hiring'}];await f.replace(state.payload,state.version);
    async function open(width){context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready,null,{timeout:25000});await page.waitForLoadState('networkidle');await page.locator('#leadintel-copilot-entry').click();await page.locator('#leadintel-copilot-drawer textarea').waitFor();await page.waitForFunction(()=>Math.abs(document.getElementById('leadintel-copilot-drawer').getBoundingClientRect().right-innerWidth)<2);}
    async function ask(){await page.locator('#leadintel-copilot-drawer textarea').fill('How many active signals do I have?');await page.locator('.copilot-send').click();}
    await open(1440);await ask();await page.waitForFunction(()=>document.querySelector('.copilot-message.is-assistant')?.textContent.includes('1 active signal'));
    let card=page.locator('.copilot-message.is-assistant').last();await card.locator('.copilot-grounding summary').click();await card.getByText('Open Strategy',{exact:true}).click();
    await page.locator('.step-view.active[data-step="4"]').waitFor();assert.match(await card.innerText(),/weight 9\/10/);assert.match(await card.innerText(),/Saved workspace checked/);
    await page.locator('[data-copilot-action="print"]').click();const print=await page.locator('#copilot-print-dialog iframe').getAttribute('srcdoc');assert.match(print,/Basis for this answer/);await page.locator('[data-copilot-print-close]').click();
    await page.screenshot({path:dir+'/desktop.png',fullPage:true});await context.close();
    state=await f.getState();state.payload.main.market.signals.find(x=>x.id==='custom-hiring').active=true;await f.replace(state.payload,state.version);
    await open(390);await page.waitForFunction(()=>document.querySelector('.copilot-message.is-assistant')?.textContent.includes('1 active signal'));
    assert.equal(await page.locator('.copilot-grounding summary').count(),1);await ask();await page.waitForFunction(()=>[...document.querySelectorAll('.copilot-message.is-assistant')].some(el=>el.textContent.includes('2 active signals')));
    card=page.locator('.copilot-message.is-assistant').last();await card.locator('.copilot-grounding summary').click();assert.match(await card.innerText(),/2 active signals/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    const rows=f.DB.raw.prepare("SELECT metadata_json FROM copilot_messages WHERE workspace_id=? AND role='assistant' ORDER BY rowid").all(workspaceId).map(row=>JSON.parse(row.metadata_json));assert.equal(rows.length,2);assert.ok(rows[1].grounding.workspace_version>rows[0].grounding.workspace_version);assert.ok(rows.every(row=>row.model_calls===0&&row.search_calls===0));assert.equal(spent,0);assert.deepEqual(errors,[]);
    await page.screenshot({path:dir+'/mobile.png',fullPage:true});await fs.writeFile(dir+'/evidence.json',JSON.stringify({authenticated:true,savedHistory:true,freshState:true,desktop:true,mobile:true,navigation:true,printEvidence:true,modelCalls:spent,pageErrors:errors},null,2));
  }catch(e){await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await context?.close();await browser.close();await f.close();}
});
