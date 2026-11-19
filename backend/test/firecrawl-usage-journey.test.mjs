import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {requestFirecrawl} from '../src/firecrawl-request.js';

test('Ask LeadIntel explains saved Firecrawl usage through authenticated HTTP and reopens on desktop/mobile without starting provider work',{timeout:90000},async t=>{
  try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(e){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw e;t.skip('Chromium unavailable');return;}
  const f=await journeyFixture({durableCopilot:true}),{chromium}=await loadPlaywright(),browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const dir='/tmp/leadintel-firecrawl-usage',errors=[];await fs.mkdir(dir,{recursive:true});let context,page;
  const question='Why did my Firecrawl free credits run out in 10 minutes? Check https://www.firecrawl.dev/app for duplicate requests.';
  try{
    const credential={apiKey:'CONTROLLED_NOT_A_REAL_KEY',row:{metadata_json:'{}'}},payload={query:'PRIVATE_TEST_QUERY',limit:4,scrapeOptions:{formats:['markdown']}};
    for(let i=0;i<2;i++)await requestFirecrawl(f.env,workspaceId,'search',{credential,payload,purpose:'company_list',fetchImpl:async()=>Response.json({success:true,creditsUsed:6,data:[]})});
    let modelCalls=0;f.env.COPILOT_TEST_PROVIDER={generate:async()=>{modelCalls++;throw Error('Diagnostic must not generate with AI');},search:async()=>{modelCalls++;throw Error('Diagnostic must not search');}};
    async function open(width){context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===f.origin?r.continue():r.abort());await context.addCookies([{name:'leadintel_session',value:sessionToken,url:f.origin}]);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(f.origin+'/customer/');await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready,null,{timeout:25000});await page.waitForLoadState('networkidle');await page.locator('#leadintel-copilot-entry').click();await page.locator('#leadintel-copilot-drawer textarea').waitFor();await page.waitForFunction(()=>Math.abs(document.getElementById('leadintel-copilot-drawer').getBoundingClientRect().right-innerWidth)<2);}
    await open(1440);const before=f.externalCalls.length;
    await page.locator('#leadintel-copilot-drawer textarea').fill(question);await page.locator('.copilot-send').click();
    await page.waitForFunction(()=>document.getElementById('leadintel-copilot-drawer')?.textContent.includes('12 credits were explicitly reported'));
    const saved=f.DB.raw.prepare("SELECT content,metadata_json FROM copilot_messages WHERE workspace_id=? AND role='assistant' ORDER BY rowid DESC LIMIT 1").get(workspaceId),metadata=JSON.parse(saved.metadata_json);
    assert.equal(metadata.model_calls,0);assert.equal(metadata.search_calls,0);assert.equal(metadata.firecrawl_usage.selected.requests,2);assert.match(saved.content,/1 repeated identical request needs review/);assert.doesNotMatch(saved.content,/PRIVATE_TEST|CONTROLLED_NOT/);
    assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM copilot_research_jobs').get().n,0);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM copilot_research_tasks').get().n,0);assert.equal(modelCalls,0);assert.equal(f.externalCalls.length,before);
    await page.screenshot({path:dir+'/desktop.png',fullPage:true});await context.close();
    await open(390);await page.waitForFunction(()=>document.getElementById('leadintel-copilot-drawer')?.textContent.includes('12 credits were explicitly reported'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.equal(modelCalls,0);assert.deepEqual(errors,[]);await page.screenshot({path:dir+'/mobile.png',fullPage:true});
    const denied=await fetch(f.origin+'/api/copilot/chat?workspace_id=foreign-workspace',{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({message:question})});assert.equal(denied.status,403);
    const anonymous=await fetch(f.origin+'/api/copilot/chat?workspace_id='+workspaceId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question})});assert.equal(anonymous.status,401);
    await fs.writeFile(dir+'/evidence.json',JSON.stringify({authenticated:true,persisted:true,mobile:true,modelCalls,privateWorkspaceDenied:true,anonymousDenied:true,pageErrors:errors,realProviderCalls:0},null,2));
  }catch(e){await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await context?.close();await browser.close();await f.close();}
});
