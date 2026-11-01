const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Market=require('../opportunity-led-icp.js').install(require('../market-engine.js'));
const Lookalike=require('../lookalike-discovery.js');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function part(start,end){const a=app.indexOf(start);return app.slice(a,app.indexOf(end,a));}
function harness(icps=[]){
 const dom=new JSDOM('<div id="icp-list"></div>'),state={profile:{idealCustomer:'Business buyers'},market:{icps,signals:[],opportunities:[],contentLanguage:'en'}},context={strategyIntegrity:()=>require('../strategy-integrity.js'),state,document:dom.window.document,esc:x=>String(x??''),$:id=>dom.window.document.getElementById(id),saveState:()=>{},syncResearchSourcesToSignals:()=>{},LeadIntelMarket:{...Market,buildIcpCandidates:()=>[{id:'icp-core',type:'core',name:'Core ICP',active:true,description:'Business buyers'}]},icpActivationRequirement:icp=>({available:icp.type==='core'||context.evidenceAvailable,reason:'Verified evidence required',target:'run-market-research',action:'Add evidence'}),evidenceAvailable:false};
 vm.createContext(context);vm.runInContext(part('function enforceIcpActivationRequirements(){','function readMarketEdits(')+part('function readMarketEdits(','function syncResearchSourcesToSignals(){')+part('function renderIcps(){','function renderSignalDesigner(){'),context);return {context,state,document:dom.window.document};
}
test('normalization keeps every profile and its saved preference and reference identity',()=>{
 const icps=[...Market.buildIcpCandidates({}),{id:'icp-reference-lookalike',type:'lookalike-led',active:false,requestedActive:false,referenceFingerprint:'model-one'}];
 const normalized=Market.normalizeMarketState(JSON.parse(JSON.stringify({icps})));
 assert.equal(normalized.icps.length,5);assert.equal(normalized.icps.find(x=>x.id==='icp-reference-lookalike').requestedActive,false);assert.equal(normalized.icps.find(x=>x.id==='icp-reference-lookalike').referenceFingerprint,'model-one');
});
test('missing Core starts on; existing deliberate Core off survives rendering and reload',()=>{
 const h=harness([{id:'opp',type:'opportunity-led',active:false}]);h.context.renderIcps();assert.equal(h.state.market.icps.find(x=>x.type==='core').active,true);
 const core=h.state.market.icps.find(x=>x.type==='core');core.active=false;core.requestedActive=false;
 h.state.market=Market.normalizeMarketState(JSON.parse(JSON.stringify(h.state.market)));h.context.renderIcps();h.context.renderIcps();assert.equal(h.state.market.icps.find(x=>x.type==='core').active,false);
});
test('missing prerequisites clear On and do not silently activate after reload',()=>{
 const h=harness([{id:'opp',type:'opportunity-led',name:'Opportunity',active:true}]);h.context.renderIcps();
 let opp=h.state.market.icps.find(x=>x.id==='opp');assert.equal(opp.active,false);assert.equal(opp.requestedActive,false);
 assert.equal(h.document.querySelector('[data-icp-field="active"]').checked,false);assert.match(h.document.body.textContent,/Setup required/);
 h.state.market=Market.normalizeMarketState(JSON.parse(JSON.stringify(h.state.market)));h.context.evidenceAvailable=true;h.context.renderIcps();
 opp=h.state.market.icps.find(x=>x.id==='opp');assert.equal(opp.active,false);assert.equal(opp.requestedActive,false);
});
test('user can switch a temporarily unavailable profile off and it stays off when evidence returns',()=>{
 const h=harness([{id:'opp',type:'opportunity-led',name:'Opportunity',active:true}]);h.context.renderIcps();const toggle=h.document.querySelector('[data-icp-field="active"]');assert.equal(toggle.disabled,false);toggle.checked=false;h.context.readMarketEdits();
 h.context.evidenceAvailable=true;h.context.renderIcps();assert.equal(h.state.market.icps[0].requestedActive,false);assert.equal(h.state.market.icps[0].active,false);
});
test('all profiles get one consistent status panel and blocked evidence never becomes active',()=>{
 const h=harness([{id:'icp-core',type:'core',active:false},{id:'opp',type:'opportunity-led',active:false}]);h.context.renderIcps();assert.equal(h.document.querySelectorAll('.icp-state-notice').length,2);assert.equal(h.document.querySelectorAll('.icp-state-notice[data-state="off"]').length,1);assert.equal(h.document.querySelectorAll('.icp-state-notice[data-state="blocked"]').length,1);assert.equal(h.state.market.icps[1].active,false);
});
test('Opportunity localization preserves On through absent evidence and restores effective use',()=>{
 let icp={...Market.buildIcpCandidates({}).find(x=>x.type==='opportunity-led'),active:true,requestedActive:true};
 let state=Market.localizeGeneratedState({icps:[icp],opportunities:[]},{},'en');icp=state.icps.find(x=>x.type==='opportunity-led');assert.equal(icp.active,false);assert.equal(icp.requestedActive,true);
 state=Market.normalizeMarketState(JSON.parse(JSON.stringify(state)));state.opportunities=[{id:'op',active:true,profileOnly:false,evidence:[{url:'https://example.com/news'}]}];
 const restored=Market.localizeGeneratedState(state,{},'lv').icps.find(x=>x.type==='opportunity-led');assert.equal(restored.active,true);assert.equal(restored.requestedActive,true);
});
test('one usable reference automatically enables Lookalike and missing models keep it off',()=>{
 const model={active:true,fingerprint:'new',dna:{active:true,activeCount:1}};
 const off={id:'icp-reference-lookalike',type:'lookalike-led',active:false,requestedActive:false,referenceFingerprint:'old'};
 assert.equal(Lookalike.syncReferenceLookalikeIcp([off],{},model)[0].active,true);
 const on={...off,active:true,requestedActive:true};const blocked=Lookalike.syncReferenceLookalikeIcp([on],{},null)[0];assert.equal(blocked.active,false);assert.equal(blocked.requestedActive,false);
 const saved=Market.normalizeMarketState({icps:[blocked]}).icps;assert.equal(Lookalike.syncReferenceLookalikeIcp(saved,{},model)[0].active,true);
});
test('hidden legacy reference profiles cannot bypass the canonical reference Off choice',()=>{
 const normalized=Market.normalizeMarketState({icps:[{id:'icp-lookalike',type:'lookalike',active:true},{id:'icp-reference-lookalike',type:'lookalike-led',active:false,requestedActive:false}]});
 assert.equal(normalized.icps[0].active,false);assert.equal(normalized.icps[0].requestedActive,true);
 assert.equal(Market.effectiveTargetingProfile({lookalikeCustomers:'Legacy reference'},normalized).lookalikeCustomers,'');
});
test('profile reapproval preserves explicit On and Off preferences, including the canonical reference lens',()=>{
 const state={profile:{idealCustomer:'B2B buyers'},market:{icps:[{id:'icp-core',type:'core',active:false,requestedActive:false},{id:'icp-opportunity-led',type:'opportunity-led',active:false,requestedActive:true},{id:'icp-reference-lookalike',type:'lookalike-led',active:false,requestedActive:false}]}};
 const context={strategyIntegrity:()=>require('../strategy-integrity.js'),state,contentLanguage:()=> 'en',LeadIntelMarket:Market};vm.runInNewContext(part('function seedMarketStrategy(){','function requireConfirmedTargeting(){')+';seedMarketStrategy()',context);
 assert.equal(state.market.icps.find(x=>x.id==='icp-core').requestedActive,false);assert.equal(state.market.icps.find(x=>x.id==='icp-opportunity-led').requestedActive,true);assert.equal(state.market.icps.find(x=>x.id==='icp-reference-lookalike').requestedActive,false);
});
test('repairing a partial all-Off strategy does not silently enable missing optional profiles',()=>{
 const h=harness([{id:'icp-core',type:'core',name:'Core',active:false,requestedActive:false}]);
 h.context.LeadIntelMarket.buildIcpCandidates=()=>[{id:'icp-core',type:'core',active:true},{id:'trigger',type:'trigger-led',active:true}];
 h.context.evidenceAvailable=true;h.context.renderIcps();assert.ok(h.state.market.icps.every(x=>x.active===false));
});
test('an explicit Core On survives edits, repeated rendering and normalized reload',()=>{
 const h=harness([{id:'icp-core',type:'core',name:'Core',active:false}]);h.context.renderIcps();
 h.document.querySelector('[data-icp-field="active"]').checked=true;h.context.readMarketEdits();h.context.renderIcps();
 h.state.market=Market.normalizeMarketState(JSON.parse(JSON.stringify(h.state.market)));h.context.renderIcps();
 assert.equal(h.state.market.icps[0].active,true);assert.equal(h.state.market.icps[0].requestedActive,true);
});

test('first reference activation enables even a previously switched-off lens',()=>{
 const pending=Lookalike.syncReferenceLookalikeIcp([],{},null);assert.equal(pending[0].active,false);
 const saved=Market.normalizeMarketState(JSON.parse(JSON.stringify({icps:pending}))).icps;
 const model={active:true,fingerprint:'first',dna:{active:true,activeCount:1}};
 assert.equal(Lookalike.syncReferenceLookalikeIcp(saved,{},model)[0].active,true);
 saved[0].requestedActive=false;assert.equal(Lookalike.syncReferenceLookalikeIcp(saved,{},model)[0].active,true);
});

test('localization never enables a missing optional Opportunity profile after evidence and reload',()=>{
 const state=Market.localizeGeneratedState({icps:[{id:'icp-core',type:'core',active:false}],opportunities:[{id:'op',active:true,evidence:[{url:'https://example.com/news'}]}]}, {}, 'lv');
 const opportunity=Market.normalizeMarketState(JSON.parse(JSON.stringify(state))).icps.find(x=>x.type==='opportunity-led');
 assert.equal(opportunity.active,false);assert.equal(opportunity.requestedActive,false);
});
