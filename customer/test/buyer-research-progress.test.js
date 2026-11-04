const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('buyer research exposes five meaningful live phases',()=>{
 for(const label of ['Verifying company','buyer-role categories','Identifying and ranking relevant people','Verifying identities and current roles','Finalizing public contact evidence']) assert.ok(ui.includes(label),label);
 assert.match(ui,/buyerResearchProgressHtml/);
 assert.match(ui,/Completed checks are saved. Provider failures or time limits will show an action to retry./);
});

test('search button communicates active research rather than looking disabled',()=>{
 assert.match(ui,/Refreshing…/);
 assert.match(css,/\.buyer-research-spinner/);
 assert.match(css,/@keyframes buyerResearchSpin/);
});

test('buyer progress has accessible live status and bounded progress bar',()=>{
 assert.match(ui,/role="status" aria-live="polite"/);
 assert.match(ui,/buyer-research-progress-bar/);
 assert.match(css,/\.buyer-research-progress ol/);
});

test('actual progress panel identifies queued work, saved activity and request age rather than an idle spinner',()=>{
 const vm=require('node:vm'),{JSDOM}=require('jsdom'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const now=Date.now(),html=context.buyerResearchProgressHtml({buyerResearchProgress:{jobId:'saved-job',phase:'official',executionStatus:'queued',step:1,startedAt:new Date(now-300000).toISOString(),elapsedSeconds:300,checkpointAt:new Date(now-180000).toISOString(),completedChecks:2,inProgressChecks:0,label:'Reading official company sources'}}),dom=new JSDOM(html),text=dom.window.document.body.textContent;
 assert.match(text,/Research queued/);assert.match(text,/300s since request/);assert.match(text,/2 saved checks/);assert.match(text,/No new saved activity/);dom.window.close();
});

test('compact timing distinguishes an empirical forecast, no history, and exceeded estimate',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const candidate={buyerResearchProgress:{jobId:'j',phase:'contacts',step:4,executionStatus:'running',startedAt:new Date(Date.now()-60000).toISOString(),timing:{estimate:{lowerSeconds:180,upperSeconds:300,samples:5}}}};
 assert.match(context.buyerResearchProgressHtml(candidate),/About 2–4 min remaining/);
 candidate.buyerResearchProgress.startedAt=new Date(Date.now()-600000).toISOString();assert.match(context.buyerResearchProgressHtml(candidate),/Taking longer than estimated/);
 candidate.buyerResearchProgress.timing={};assert.match(context.buyerResearchProgressHtml(candidate),/Remaining time not yet available/);
 candidate.buyerResearchProgress.executionStatus='queued';candidate.buyerResearchProgress.label='Reading official company sources';assert.match(context.buyerResearchProgressHtml(candidate),/Waiting to continue/);
});

 test('scheduling activity cannot masquerade as a completed research result',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const html=context.buyerResearchProgressHtml({buyerResearchProgress:{jobId:'j',phase:'official',executionStatus:'queued',startedAt:new Date(Date.now()-180000).toISOString(),checkpointAt:new Date().toISOString(),timing:{lastResultAt:null}}});
 assert.doesNotMatch(html,/Last completed check:/);assert.match(html,/No new saved activity/);
 });
