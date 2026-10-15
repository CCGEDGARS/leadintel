const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Market=require('../opportunity-led-icp.js').install(require('../market-engine.js'));
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
test('Strategy renders all four cards openly and keeps missing-evidence profiles disabled',()=>{
 const state={profile:{idealCustomer:'B2B firms',priorityOffers:'Services'},market:{icps:Market.buildIcpCandidates({}).filter(x=>x.type==='core')}};
 const container={innerHTML:''};
 const context={state,LeadIntelMarket:Market,$:()=>container,esc:x=>String(x??''),enforceIcpActivationRequirements:()=>{for(const x of state.market.icps)if(['lookalike','opportunity-led'].includes(x.type))x.active=false;},icpActivationRequirement:x=>({available:!['lookalike','opportunity-led'].includes(x.type),reason:'Evidence required',action:'Add evidence',target:'profile'})};
 vm.runInNewContext(app.slice(app.indexOf('function renderIcps(){'),app.indexOf('function renderSignalDesigner(){'))+'renderIcps();',context);
 assert.equal(state.market.icps.length,4);assert.equal((container.innerHTML.match(/<article /g)||[]).length,4);assert.doesNotMatch(container.innerHTML,/<details/);assert.equal((container.innerHTML.match(/data-icp-field="active"[^>]* disabled/g)||[]).length,2);
 vm.runInNewContext('renderIcps();',context);assert.equal(state.market.icps.length,4);
});

test('activated reference names fill generated lookalike text without mutating saved manual edits or toggles',()=>{
 const profile={idealCustomer:'Healthcare providers',priorityOffers:'Staff training',targetMarkets:'Estonia',lookalikeCustomers:''};
 const state={profile,market:{icps:Market.buildIcpCandidates(profile)}};
 const saved=state.market.icps.find(item=>item.type==='lookalike');saved.active=false;
 saved.rationale='Use  as commercial anchors, then look for similar organizations in Estonia.';
 const container={innerHTML:''};
 const model={active:true,dna:{referenceProfiles:[{companyName:'North Clinic'},{companyName:'South Hospital'}]}};
 const context={state,LeadIntelMarket:Market,$:()=>container,esc:x=>String(x??''),enforceIcpActivationRequirements:()=>{},icpActivationRequirement:()=>({available:true,model})};
 vm.runInNewContext(app.slice(app.indexOf('function renderIcps(){'),app.indexOf('function renderSignalDesigner(){'))+'renderIcps();',context);
 assert.match(container.innerHTML,/North Clinic; South Hospital/);
 assert.equal(saved.active,false);assert.equal(saved.description,Market.buildIcpCandidates(profile).find(item=>item.type==='lookalike').description);
 saved.description='My manual definition';saved.rationale='Approved manual rationale';
 vm.runInNewContext('renderIcps();',context);
 assert.match(container.innerHTML,/My manual definition/);assert.match(container.innerHTML,/Approved manual rationale/);
 assert.equal(saved.active,false);
});

test('canonical past-customer lens hides the duplicate generic card and preserves its saved fields',()=>{
 const state={profile:{},market:{icps:Market.buildIcpCandidates({})}};
 const generic=state.market.icps.find(item=>item.type==='lookalike');generic.description='Saved custom context';
 state.market.icps.push({id:'icp-reference-lookalike',type:'lookalike-led',active:false,name:'Past Customer Context',description:'Reference model'});
 const container={innerHTML:''};
 const context={state,LeadIntelMarket:Market,$:()=>container,esc:x=>String(x??''),enforceIcpActivationRequirements:()=>{},icpActivationRequirement:()=>({available:true})};
 vm.runInNewContext(app.slice(app.indexOf('function renderIcps(){'),app.indexOf('function renderSignalDesigner(){'))+'renderIcps();',context);
 assert.equal((container.innerHTML.match(/<article /g)||[]).length,4);
 assert.doesNotMatch(container.innerHTML,/value="Lookalike ICP"/);assert.match(container.innerHTML,/Past Customer Context/);
 assert.equal(state.market.icps.find(item=>item.type==='lookalike').description,'Saved custom context');
});
