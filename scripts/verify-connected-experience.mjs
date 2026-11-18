import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from '../backend/test/step5-journey-fixture.mjs';

// Actual authenticated app/HTTP/SQLite; external research remains controlled.
export async function verifyConnectedExperience({artifactDir='/tmp/leadintel-connected-experience',observeOnly=false}={}){
 const fixture=await journeyFixture(),{chromium}=await loadPlaywright();
 const browser=await chromium.launch({executablePath:process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 await fs.mkdir(artifactDir,{recursive:true});
 const errors=[],requests=[],evidence={};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
  await context.addCookies([{name:'leadintel_session',value:sessionToken,url:fixture.origin}]);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/'))requests.push({path:url.pathname,query:url.search,method:request.method()});});
  await page.goto(fixture.origin+'/customer/');
  await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelJourney&&window.LeadIntelDiscoveryUI&&window.LeadIntelMyFlows&&window.LeadIntelStep2Readiness);
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>LeadIntelWorkspacePersistence.saveWorkspace({automatic:true})),true);
  await page.waitForFunction(()=>!LeadIntelWorkspacePersistence.hasUnsavedChanges()&&!LeadIntelServerBridge.isWorkspaceSaving());
  evidence.initial=await page.evaluate(()=>({stage:document.querySelector('.step-view.active')?.id,requests:performance.getEntriesByType('resource').length,model:LeadIntelJourney.getModel().map(s=>({name:s.name,next:s.nextAction,status:s.status}))}));
  // Repeated status notifications must not replace the navigation under a user's pointer.
  evidence.navigation=await page.evaluate(async()=>{
   const node=document.querySelector('[data-workflow-stage="5"] [data-sidebar-expand]');node.focus();
   const links=[...document.querySelectorAll('[data-sidebar-substep]')];let modelBuilds=0,navigationBuilds=0,mutations=0;
   const original=LeadIntelJourneyProgress.buildJourneyModel;LeadIntelJourneyProgress.buildJourneyModel=(...args)=>{modelBuilds++;if(new Error().stack.includes('at syncProcessMap '))navigationBuilds++;return original(...args);};
   const observer=new MutationObserver(rows=>mutations+=rows.length);observer.observe(document.querySelector('.steps'),{childList:true,subtree:true});
   for(let i=0;i<20;i++)window.dispatchEvent(new CustomEvent('leadintel:journey-changed'));
   await new Promise(resolve=>setTimeout(resolve,80));observer.disconnect();LeadIntelJourneyProgress.buildJourneyModel=original;
   return {modelBuilds,navigationBuilds,mutations,retainedLinks:links.filter(link=>link.isConnected).length,links:links.length,focusPreserved:document.activeElement===node};
  });
  const start=requests.length;
  await page.evaluate(async()=>{await Promise.all(Array.from({length:10},()=>LeadIntelMyFlows.refreshSummary()));});
  evidence.flowRequests=requests.slice(start).filter(r=>r.path==='/api/flows'&&r.method==='GET').length;
  await page.screenshot({path:artifactDir+'/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>{const frame=document.querySelector('.steps').getBoundingClientRect(),active=document.querySelector('.steps > .active').getBoundingClientRect();return active.left>=frame.left&&active.right<=frame.right;});
  evidence.mobile=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,sidebarHeight:document.querySelector('.progress-panel').getBoundingClientRect().height,activeStageVisible:true}));
  await page.screenshot({path:artifactDir+'/mobile.png'});
  evidence.singleGuidance=await page.locator('#step-5 > .step-action-guidance').isHidden();
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-workflow-stage="1"] [data-sidebar-expand]').click();
  const markets=page.locator('[data-workflow-stage="1"] [data-sidebar-substep="markets"]');await markets.scrollIntoViewIfNeeded();
  const box=await markets.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(async()=>{for(let i=0;i<20;i++)window.dispatchEvent(new CustomEvent('leadintel:journey-changed'));await new Promise(resolve=>setTimeout(resolve,80));});
  await page.mouse.up();await page.locator('#step-1.active').waitFor();evidence.clickSurvivedRefresh=true;
  assert.equal((await fixture.getState()).payload.discovery.selectedProspects[0].people[0].id,fixture.candidate.people[0].id,'navigation must preserve the saved recipient');
  evidence.pageErrors=errors;
  await fs.writeFile(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));
  if(!observeOnly){assert.deepEqual(errors,[]);assert.equal(evidence.flowRequests,1);assert.equal(evidence.navigation.navigationBuilds,1);assert.equal(evidence.navigation.retainedLinks,evidence.navigation.links);assert.equal(evidence.navigation.focusPreserved,true);assert.equal(evidence.singleGuidance,true);assert.ok(evidence.mobile.width<=evidence.mobile.viewport);assert.ok(evidence.mobile.sidebarHeight<300);}
  return evidence;
 }finally{await browser.close();await fixture.close();}
}
if(process.argv[1]?.endsWith('verify-connected-experience.mjs'))console.log(JSON.stringify(await verifyConnectedExperience({observeOnly:process.argv.includes('--observe'),artifactDir:process.env.LEADINTEL_EXPERIENCE_ARTIFACTS||'/tmp/leadintel-connected-experience'}),null,2));
