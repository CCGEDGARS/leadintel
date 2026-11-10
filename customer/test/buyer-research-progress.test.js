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
 assert.match(ui,/Finding buyers…/);
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
 assert.match(text,/Research delayed/);assert.match(text,/5 min 0s since request/);assert.match(text,/2 saved checks/);assert.match(text,/No new saved activity/);dom.window.close();
});

test('compact timing distinguishes an empirical forecast, no history, and exceeded estimate',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const candidate={buyerResearchProgress:{jobId:'j',phase:'contacts',step:4,executionStatus:'running',startedAt:new Date(Date.now()-60000).toISOString(),timing:{estimate:{lowerSeconds:180,upperSeconds:300,samples:5}}}};
 assert.match(context.buyerResearchProgressHtml(candidate),/About 2–4 min remaining/);
 candidate.buyerResearchProgress.startedAt=new Date(Date.now()-600000).toISOString();candidate.buyerResearchProgress.timing.lastResultAt=new Date().toISOString();assert.match(context.buyerResearchProgressHtml(candidate),/Taking longer than estimated/);
 candidate.buyerResearchProgress.startedAt=new Date().toISOString();candidate.buyerResearchProgress.timing={};assert.match(context.buyerResearchProgressHtml(candidate),/Finish time unavailable/);
 candidate.buyerResearchProgress.executionStatus='queued';candidate.buyerResearchProgress.label='Reading official company sources';assert.match(context.buyerResearchProgressHtml(candidate),/Waiting to continue/);
});

 test('scheduling activity cannot masquerade as a completed research result',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const html=context.buyerResearchProgressHtml({buyerResearchProgress:{jobId:'j',phase:'official',executionStatus:'queued',startedAt:new Date(Date.now()-180000).toISOString(),checkpointAt:new Date().toISOString(),timing:{lastResultAt:null}}});
 assert.doesNotMatch(html,/Last completed check:/);assert.match(html,/No new saved activity/);
 });

test('a stalled check is visible outside collapsed research details',()=>{
 const vm=require('node:vm'),{JSDOM}=require('jsdom'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const dom=new JSDOM(context.buyerResearchProgressHtml({buyerResearchProgress:{jobId:'j',phase:'dossier',step:2,executionStatus:'running',startedAt:new Date(Date.now()-394000).toISOString(),timing:{lastResultAt:new Date(Date.now()-180000).toISOString()}}}));
 dom.window.document.querySelectorAll('details').forEach(n=>n.remove());assert.match(dom.window.document.body.textContent,/Delayed · no completed check for 3 min/);dom.window.close();
});

test('reopened slow durable research shows a stop control and does not call an incomplete dossier complete',()=>{
 const vm=require('node:vm'),{JSDOM}=require('jsdom'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const dom=new JSDOM(context.buyerResearchProgressHtml({domain:'example.com',buyerResearchProgress:{jobId:'j',phase:'contacts',step:4,executionStatus:'running',startedAt:new Date(Date.now()-3435000).toISOString(),stages:{official:true,dossier:false,identities:true,contacts:false,review:false},timing:{lastResultAt:new Date(Date.now()-300000).toISOString(),runWindow:{deadlineAt:new Date(Date.now()-1000).toISOString()}}}}));
 const doc=dom.window.document;assert.equal(doc.querySelector('[data-stop-buyer-job]').dataset.stopBuyerJob,'example.com');assert.equal(doc.querySelectorAll('li.done').length,2);assert.match(doc.querySelector('li.needs-review').textContent,/Company research.*needs review/);assert.equal(doc.querySelector('.buyer-research-spinner'),null);assert.match(doc.body.textContent,/Research time limit reached/);assert.match(doc.body.textContent,/57 min 15s since request/);dom.window.close();
});
test('a lost status connection offers status recovery and Stop, while a saved pause offers Resume',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const c={domain:'example.com',buyerResearchProgress:{jobId:'j',phase:'error',step:4,connection:'unavailable'}};
 assert.match(context.buyerResearchProgressHtml(c),/data-check-buyer-job/);assert.match(context.buyerResearchProgressHtml(c),/data-stop-buyer-job/);assert.doesNotMatch(context.buyerResearchProgressHtml(c),/data-resume-buyer-job/);
 c.buyerResearchProgress.connection='connected';assert.match(context.buyerResearchProgressHtml(c),/data-resume-buyer-job/);
});
test('resuming an old job starts a new elapsed display without treating earlier checks as a current stall',()=>{
 const vm=require('node:vm'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const now=Date.now(),html=context.buyerResearchProgressHtml({domain:'example.com',buyerResearchProgress:{jobId:'j',phase:'contacts',step:4,executionStatus:'queued',startedAt:new Date(now-3600000).toISOString(),timing:{lastResultAt:new Date(now-3500000).toISOString(),runWindow:{startedAt:new Date(now-1000).toISOString(),deadlineAt:new Date(now+1799000).toISOString()}}}});
 assert.match(html,/1s since request/);assert.doesNotMatch(html,/Research delayed|no completed check for/);
});

test('a window-paused final phase reports verified stage coverage rather than suggesting all five stages passed',()=>{
 const vm=require('node:vm'),{JSDOM}=require('jsdom'),context={Date,esc:value=>String(value??'')};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function buyerResearchProgressHtml('),ui.indexOf('async function findExecutiveBuyer(')),context);
 const dom=new JSDOM(context.buyerResearchProgressHtml({domain:'example.com',buyerDiscovery:{researchIncomplete:true},buyerResearchProgress:{jobId:'j',phase:'error',step:5,executionStatus:'needs_review',connection:'connected',label:'Research paused after 30 minutes.',diagnostics:[{code:'run_window'}],stages:{official:false,dossier:false,identities:true,contacts:false,review:false},timing:{runWindow:{expired:true}}}}));
 const doc=dom.window.document;assert.match(doc.querySelector('.buyer-research-progress-head').textContent,/1 of 5 stages verified/);assert.doesNotMatch(doc.querySelector('.buyer-research-progress-head').textContent,/Stage 5 of 5/);assert.equal(doc.querySelectorAll('li.done').length,1);assert.equal(doc.querySelectorAll('li.active').length,0,'a paused job has no active stage');assert.equal(doc.querySelectorAll('li.needs-review').length,4);assert.equal(doc.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),'1');assert.equal(doc.querySelector('.buyer-research-progress-head strong').textContent,'Research paused');assert.match(doc.body.textContent,/Resume unfinished research/);dom.window.close();
});
