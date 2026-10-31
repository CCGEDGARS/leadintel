const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function fixture(){
 const w=new JSDOM('<main><article class="selected-prospect-row" data-buyer-company="example.com"><section class="company-message-brief"></section><section class="buyer-research-progress"></section><details class="buyer-research-details"><section class="buyer-quality-supervisor"><details><ul><li data-buyer-requirement="research">Contact research incomplete</li></ul></details></section></details><button data-keep-buyer>Proceed</button></article><footer class="workflow-next-action"><button id="continue-to-outreach"></button></footer></main>',{url:'https://example.test'}).window;
 const person={id:'p',name:'Anna Buyer',kept:true},candidate={domain:'example.com',company:'Example',people:[person]},row={candidate,person,index:0,choice:{email:'anna@example.com'}};let selected=true,checks=[],quality={passed:true,requirements:[]},brief={facts:[{quote:'Verified source fact'}],buyer:{verified:true}},sent=0,meta={selectedEmailBuyer:{personId:'p',workspaceId:'w'}};
 const c={window:w,document:w.document,LeadIntelDiscovery:{...D,buyerQualityAssessment:()=>quality},crmAuthenticated:()=>true,canonicalDomain:D.canonicalDomain,buyerSelectionRows:()=>[candidate],buyerSelectionPending:new Set(),enrichmentResults:new Map(),personKey:()=> 'p',verifiedBuyerEmail:()=> 'anna@example.com',pruneStaleBuyerActions(){},currentJourneyFocus:()=>'buyers',mainState:()=>({profile:{}}),loadMeta:()=>meta,$:id=>w.document.getElementById(id),bridge:()=>({workspace:{id:'w'}}),discovery:{selectedProspects:[candidate]},showToast(){},addBuyerToFlow:async()=>{sent++;return true;}};
 w.LeadIntelPageQuality={getReport:()=>({checks})};w.LeadIntelResearchBrief={build:()=>brief};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function selectedEmailBuyer('),source.indexOf('let buyerConfirmationLevel=')),c);c.selectedEmailBuyer=()=>selected?row:null;
 return {w,c,row,candidate,gate:w.document.getElementById('continue-to-outreach'),quality(v){quality=v},brief(v){brief=v},checks(v){checks=v},sent:()=>sent,selected(v){selected=v}};
}
test('Buyers primary action remains visible and guides an unfinished mandatory task without a handoff',async()=>{
 const f=fixture();try{
  f.selected(false);f.quality({passed:false,requirements:[{id:'research',passed:false,reason:'Mandatory contact checks are incomplete'}]});f.c.renderSelectedEmailBuyer();assert.equal(f.gate.disabled,false);assert.match(f.gate.textContent,/Review/);assert.equal(f.gate.closest('footer').hidden,false);
  assert.equal(await f.c.continueBuyerMessages(),false);assert.equal(f.sent(),0);assert.equal(f.w.document.querySelector('.buyer-research-details').open,true);assert.equal(f.w.document.activeElement.dataset.buyerRequirement,'research');
  f.selected(true);f.quality({passed:true,requirements:[]});f.c.renderSelectedEmailBuyer();assert.equal(f.gate.textContent,'Continue to Messages →');assert.equal(await f.c.continueBuyerMessages(),true);assert.equal(f.sent(),1);
 }finally{f.w.close();}
});
test('without a currently accepted selected recipient, missing company facts guide to research',async()=>{
 for(const brief of [{facts:[],buyer:{verified:true}}]){
  const f=fixture();try{f.selected(false);f.brief(brief);const before=JSON.stringify(f.row);f.c.renderSelectedEmailBuyer();assert.match(f.gate.textContent,/Review/);await f.c.continueBuyerMessages();assert.equal(f.sent(),0);assert.equal(f.w.document.activeElement.className.includes('company-message-brief'),true);assert.equal(JSON.stringify(f.row),before);}finally{f.w.close();}
 }
});
test('an active research phase guides to progress; stale task data cannot authorize a handoff',async()=>{
 const f=fixture();try{f.selected(false);f.candidate.publicContactStatus='loading';f.c.renderSelectedEmailBuyer();assert.equal(f.gate.disabled,false);await f.c.continueBuyerMessages();assert.equal(f.sent(),0);assert.ok(f.w.document.activeElement.classList.contains('buyer-research-progress'));}finally{f.w.close();}
});

test('an explicitly accepted manual recipient can continue while aggregate buyer requirements remain open',async()=>{const f=fixture();try{f.quality({passed:false,requirements:[{id:'research',passed:false,reason:'Another buyer is incomplete'}]});f.candidate.publicContactStatus='loading';f.c.renderSelectedEmailBuyer();assert.equal(f.gate.textContent,'Continue to Messages →');assert.equal(await f.c.continueBuyerMessages(),true);assert.equal(f.sent(),1);}finally{f.w.close();}});
