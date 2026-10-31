const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function runtime(){
 const candidate={company:'Example',domain:'example.com',people:[],peopleStatus:'idle'},calls=[],data=new Map();
 const b={workspace:{id:'one'},session:{authenticated:true,user:{id:'owner'}},conflict:false};
 const ctx={console,URL,URLSearchParams,AbortController,DOMException,CustomEvent:class{},setTimeout,clearTimeout,LeadIntelDiscovery:D,LeadIntelServerBridge:b,localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},navigator:{languages:[]},addEventListener(){},removeEventListener(){},dispatchEvent(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source.replace(/\ninitDiscoveryWhenReady\(\);\s*$/,''),ctx);
 vm.runInContext('discovery={candidates:[],selectedProspects:[]}',ctx);
 Object.defineProperty(ctx,'discovery',{get:()=>vm.runInContext('discovery',ctx),set:value=>{ctx.nextDiscovery=value;vm.runInContext('discovery=nextDiscovery',ctx);delete ctx.nextDiscovery;}});
 Object.assign(ctx,{setJourneyFocus:focus=>calls.push(focus),findPotentialDecisionMakers:async domain=>{calls.push(domain);candidate.peopleStatus='loading';return true;},saveDiscovery:()=>{},renderAll:()=>{},showToast:()=>{}});
 ctx.discovery.selectedProspects=[candidate];
 return {ctx,candidate,calls,b,data};
}
test('newly selected company starts identity research once and opens Buyers',async()=>{
 const {ctx,candidate,calls}=runtime();assert.equal(typeof ctx.startSelectedBuyerResearch,'function');await ctx.startSelectedBuyerResearch(candidate);await ctx.startSelectedBuyerResearch(candidate);assert.deepEqual(calls,['buyers','example.com']);
});
test('reselections never restart completed, empty, failed or retained research',async()=>{
 for(const state of [{peopleStatus:'complete'},{peopleStatus:'empty'},{peopleStatus:'error'},{people:[{name:'Anna Andersson'}]},{buyerDiscovery:{checkedAt:'2026-10-21'}}]){const {ctx,candidate,calls}=runtime();Object.assign(candidate,state);assert.equal(typeof ctx.startSelectedBuyerResearch,'function');await ctx.startSelectedBuyerResearch(candidate);assert.equal(calls.length,0);}
});
test('a blocked or rejected initial search becomes visible and retryable without unhandled rejection',async()=>{
 for(const result of [false,new Error('Research unavailable')]){const {ctx,candidate}=runtime();ctx.findPotentialDecisionMakers=async()=>{if(result instanceof Error)throw result;return result;};assert.equal(typeof ctx.startSelectedBuyerResearch,'function');await ctx.startSelectedBuyerResearch(candidate);assert.equal(candidate.peopleStatus,'error');assert.match(candidate.buyerDiscovery.lastError.message,/research/i);}
});
test('the qualified-company selection action launches the shared research path',async()=>{
 const {ctx,candidate,calls}=runtime();ctx.discovery={candidates:[candidate],selectedProspects:[]};ctx.findPotentialDecisionMakers=async domain=>{calls.push(domain);ctx.discovery.selectedProspects[0].peopleStatus='loading';return true;};Object.assign(ctx,{candidateIsActionable:()=>true,qualificationAssessment:()=>({matchedSignals:[]}),saveCandidate:async()=>true,canonicalDomain:D.canonicalDomain,rememberSelectedProspect:row=>ctx.discovery.selectedProspects.push(row)});
 vm.runInContext(source.slice(source.indexOf('async function selectQualifiedForBuyers('),source.indexOf('async function savePotentialProspect(')),ctx);
 assert.equal(await ctx.selectQualifiedForBuyers(0),true);assert.deepEqual(calls,['buyers','example.com']);assert.equal(ctx.discovery.selectedProspects[0].peopleStatus,'loading');
});
function targetSelection(){
 const r=runtime(),pending=[],b=r.b,ctx=r.ctx;ctx.discovery.selectedProspects=[];
 Object.assign(ctx,{bridge:()=>b,canonicalDomain:D.canonicalDomain,selectedTargets:()=>[{domain:'example.com',companyName:'Example'}],mainState:()=>({targetMarkets:['Sweden']}),LeadIntelDiscovery:{...D,buyerRolesForTarget:()=> 'Procurement'},ensureCrmCompany:()=>new Promise(resolve=>pending.push(resolve)),focusBuyerCompany:()=>{}});
 ctx.findPotentialDecisionMakers=async domain=>{r.calls.push(domain);ctx.discovery.selectedProspects.find(c=>c.domain===domain).peopleStatus='loading';return true;};
 vm.runInContext(source.slice(source.indexOf('async function selectTargetForBuyers('),source.indexOf('async function selectQualifiedForBuyers(')),ctx);return {...r,pending,b};
}
test('double selecting a target while CRM is saving launches only one run and preserves its owner',async()=>{
 const {ctx,pending,calls}=targetSelection(),first=ctx.selectTargetForBuyers('example.com'),second=ctx.selectTargetForBuyers('example.com');assert.equal(pending.length,1,'a repeated click must not submit a second CRM save');assert.equal(await second,false);pending[0]({id:'crm'});assert.equal(await first,true);const owner=ctx.discovery.selectedProspects[0];assert.equal(owner.domain,'example.com');assert.equal(calls.filter(c=>c==='example.com').length,1);assert.equal(ctx.discovery.selectedProspects[0],owner);
});
test('target selection cannot cross a workspace switch while CRM is saving',async()=>{
 const {ctx,pending,b,calls}=targetSelection(),selection=ctx.selectTargetForBuyers('example.com');b.workspace.id='two';pending[0]({id:'crm'});assert.equal(await selection,false);assert.equal(ctx.discovery.selectedProspects.length,0);assert.equal(calls.length,0);
});
test('a removed selection, conflict or signed-out session cannot launch research',async()=>{
 for(const condition of ['removed','conflict','signed-out']){const {ctx,candidate,calls}=runtime();if(condition==='removed')ctx.discovery.selectedProspects=[];if(condition==='conflict')ctx.bridge=()=>({conflict:true});if(condition==='signed-out')ctx.crmAuthenticated=()=>false;await ctx.startSelectedBuyerResearch(candidate);assert.equal(calls.includes('example.com'),false);}
});
test('identity retry cannot overlap an active public contact pass',async()=>{
 const {ctx,candidate,calls}=runtime();Object.assign(candidate,{buyerSearchMode:'user_selected_target',publicContactStatus:'loading'});Object.assign(ctx,{canonicalDomain:D.canonicalDomain,selectedProspects:()=>[candidate],buyerSelectionRows:()=>[candidate],candidateIsActionable:()=>true});
 vm.runInContext(source.slice(source.indexOf('async function findPotentialDecisionMakers('),source.indexOf('async function startSelectedBuyerResearch(')),ctx);assert.equal(await ctx.findPotentialDecisionMakers(candidate.domain),false);assert.equal(calls.length,0);
});
test('no identities routes the quality action through buyer discovery and does not claim zero emails before research',()=>{
 const ctx={window:{},LeadIntelDiscovery:D,verifiedBuyerEmail:()=>'',enrichmentResults:new Map(),personKey:(c,p)=>p.id,esc:String,crmAuthenticated:()=>true};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerOutcomeEvidenceHtml('),source.indexOf('function buyerResearchAccountabilityHtml(')),ctx);
 for(const peopleStatus of ['idle','error','empty','loading']){const dom=new JSDOM(ctx.buyerQualitySupervisorHtml({domain:'example.com',people:[],peopleStatus})),doc=dom.window.document;assert.ok(doc.querySelector('[data-find-prospect-buyers="example.com"]'));assert.doesNotMatch(doc.body.textContent,/0\/4 priority buyers have confirmed/);if(peopleStatus==='idle')assert.match(doc.body.textContent,/Research not started/);dom.window.close();}
});
