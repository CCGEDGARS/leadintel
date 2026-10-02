const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Market=require('../opportunity-led-icp.js').install(require('../market-engine.js'));
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
test('Strategy renders all four cards openly and keeps missing-evidence profiles disabled',()=>{
 const state={profile:{idealCustomer:'B2B firms',priorityOffers:'Services'},market:{icps:Market.buildIcpCandidates({}).filter(x=>x.type==='core')}};
 const container={innerHTML:''};
 const context={state,LeadIntelMarket:Market,$:()=>container,esc:x=>String(x??''),enforceIcpActivationRequirements:()=>{for(const x of state.market.icps)if(['lookalike','opportunity-led'].includes(x.type))x.active=false;},icpActivationRequirement:x=>({available:!['lookalike','opportunity-led'].includes(x.type),reason:'Evidence required',action:'Add evidence',target:'profile'})};
 vm.runInNewContext(app.slice(app.indexOf('function renderIcps(){'),app.indexOf('function renderSignalDesigner(){'))+'renderIcps();',context);
 assert.equal(state.market.icps.length,4);assert.equal((container.innerHTML.match(/<article /g)||[]).length,4);assert.doesNotMatch(container.innerHTML,/<details/);assert.equal((container.innerHTML.match(/ disabled/g)||[]).length,2);
 vm.runInNewContext('renderIcps();',context);assert.equal(state.market.icps.length,4);
});
