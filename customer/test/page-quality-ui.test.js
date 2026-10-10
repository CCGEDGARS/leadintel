const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const engine=fs.readFileSync(require.resolve('../page-quality.js'),'utf8'),ui=fs.readFileSync(require.resolve('../page-quality-ui.js'),'utf8');
function harness(loadEngine=true){
 const dom=new JSDOM('<head></head><body><section id="journey-stage-guide"></section><section class="step-view active" id="step-1" data-step="1"></section><section id="step-2"></section><section id="step-4"></section><button id="to-questionnaire">Continue</button><button id="approve-profile">Approve</button><button id="mw-add-flow">Flow</button><div id="toast"></div><button id="confirm-targeting"></button></body>',{url:'https://leadintel.example/customer/',runScripts:'outside-only'}),w=dom.window;
 let missing=[];w.LeadIntelServerBridge={ready:true,session:{authenticated:true},workspace:{id:'w1'},conflict:false};w.LeadIntelStep2Brief={confirmationMissing:()=>missing};w.LeadIntelTargeting={isConfirmed:()=>true};w.LeadIntelWebsiteActivation={isCurrentWebsiteActive:()=>true};w.LeadIntelPageProcedures={strategyBlockers:()=>[]};w.LeadIntelCustomerNavigation={setStep(){}};
 const main={website:'https://seller.example',targetMarkets:['Sweden'],answers:{priority_offers:'Confirmed offer'},profile:{companyName:'Seller'},approved:true,market:{icps:[{active:true}],signals:[{active:true}]}};w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));if(loadEngine)w.eval(engine);w.eval(ui);
 return {w,dom,main,get api(){return w.LeadIntelPageQuality;},set missing(value){missing=value;},close(){w.close();}};
}
test('the compact status uses one expandable set of actual checks and never duplicates on refresh',()=>{
 const h=harness();h.api.refresh('setup');const panel=h.w.document.querySelector('[data-page-quality]');assert.match(panel.textContent,/Page check: Ready/);assert.equal(panel.open,false);assert.equal(panel.querySelectorAll('li').length,h.api.getReport('setup').checks.length);
 for(let i=0;i<5;i++)h.api.refresh('setup');assert.equal(h.w.document.querySelectorAll('[data-page-quality]').length,1);assert.equal(panel.querySelector('[data-quality-resolve]').hidden,true);h.close();
});
test('missing confirmations block an actual approval click and give the next required action',()=>{
 const h=harness();h.missing=['proof_points'];let approvals=0;const button=h.w.document.getElementById('approve-profile');button.addEventListener('click',()=>approvals++);button.click();assert.equal(approvals,0);assert.match(h.w.document.getElementById('toast').textContent,/Review and confirm/);
 h.missing=[];button.click();assert.equal(approvals,1);h.w.LeadIntelServerBridge.conflict=true;button.click();assert.equal(approvals,1);h.close();
});
test('current action checks block stale enabled Flow controls without rewriting a saved message',()=>{
 const h=harness();let saved=true,flows=0;const original='My exact saved message';h.api.register('messages',{read:()=>({loaded:true,inputs:{original},checks:[h.api.check('save','Saved',saved,'Save this message first.',{actions:['flow']})]})});h.w.document.getElementById('mw-add-flow').addEventListener('click',()=>flows++);
 h.w.document.getElementById('mw-add-flow').click();assert.equal(flows,1);saved=false;h.w.document.getElementById('mw-add-flow').click();assert.equal(flows,1);assert.equal(original,'My exact saved message');h.close();
});
test('invalid cached JSON and missing module adapters fail closed instead of showing Ready',()=>{
 const h=harness();h.w.localStorage.setItem('leadintel_customer_v2_state','broken');assert.equal(h.api.require('profile','approve'),false);assert.equal(h.api.getReport('profile').state,'blocked');assert.equal(h.api.require('delivery','send'),false);h.close();
});
test('opening and refreshing never issue research, saves or sends',async()=>{
 const h=harness();let requests=0;h.w.fetch=()=>{requests++;throw Error('unexpected API');};await h.api.open('profile');await h.api.open('strategy');h.api.refresh('setup');assert.equal(requests,0);assert.equal(JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_state')).answers.priority_offers,'Confirmed offer');h.close();
});

test('Setup continuation uses the actual button and requires website activation',()=>{
 const h=harness();let advances=0;h.w.document.getElementById('to-questionnaire').addEventListener('click',()=>advances++);h.w.LeadIntelWebsiteActivation.isCurrentWebsiteActive=()=>false;h.w.document.getElementById('to-questionnaire').click();assert.equal(advances,0);assert.match(h.w.document.getElementById('toast').textContent,/Activate/);h.w.LeadIntelWebsiteActivation.isCurrentWebsiteActive=()=>true;h.w.document.getElementById('to-questionnaire').click();assert.equal(advances,1);h.close();
});
test('workspace loading completion retries the current page procedure without authorizing a send',async()=>{
 const h=harness();h.w.document.querySelector('.step-view.active').dataset.step='6';let preparations=0;h.api.register('messages',{read:()=>({loaded:true,checks:[h.api.check('approval','Approved',false,'Approve first.',{actions:['send']})]}),prepare(){preparations++;}});h.w.LeadIntelServerBridge.ready=false;await h.api.open('messages');assert.equal(preparations,0);h.w.LeadIntelServerBridge.ready=true;h.w.dispatchEvent(new h.w.CustomEvent('leadintel:server-ready'));await Promise.resolve();await Promise.resolve();assert.equal(preparations,1);assert.equal(h.api.require('messages','send'),false);h.close();
});

test('a failed readiness engine load blocks critical clicks while leaving editing available',()=>{
 const h=harness(false);let approvals=0,edits=0;h.w.document.getElementById('approve-profile').addEventListener('click',()=>approvals++);const edit=h.w.document.createElement('button');edit.id='mw-edit-message';edit.addEventListener('click',()=>edits++);h.w.document.body.appendChild(edit);h.w.document.getElementById('approve-profile').click();edit.click();assert.equal(approvals,0);assert.equal(edits,1);assert.match(h.w.document.querySelector('[data-page-quality]').textContent,/Blocked.*could not load/);h.close();
});
