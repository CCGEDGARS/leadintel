const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Market=require('../profile-market-research.js');
const Journey=require('../journey-progress.js');
function fixture(profile=null){
 const prerequisite={hidden:true}, button={handler:()=>42},preview={hidden:false},progress={text:'Researching'};
 const workbench={parentNode:{},button,preview,progress},events=[],listeners=[];
 const root={document:{getElementById:id=>({'market-research-workbench':workbench,'market-profile-prerequisite':prerequisite}[id]),addEventListener:(name,fn)=>listeners.push(fn)},localStorage:{getItem:()=>JSON.stringify({profile})},CustomEvent:class{constructor(type){this.type=type}},dispatchEvent:event=>events.push(event.type)};
 const host={moves:0,appendChild(node){this.moves++;node.parentNode=this;this.child=node;}};
 return {root,host,workbench,prerequisite,events,listeners};
}
test('mount and reopen preserve original research controls, preview and progress',()=>{
 const f=fixture({companyName:'Ercon'}),original=f.workbench;
 assert.equal(Market.mount(f.host,f.root),true);assert.equal(Market.mount(f.host,f.root),true);
 assert.equal(f.host.moves,1);assert.equal(f.host.child,original);assert.equal(f.host.child.button.handler(),42);
 assert.equal(f.host.child.preview.hidden,false);assert.equal(f.host.child.progress.text,'Researching');
 assert.equal(f.prerequisite.hidden,true);assert.deepEqual(f.events,['leadintel:profile-market-opened','leadintel:profile-market-opened']);
});
test('missing profile displays prerequisite without creating a second workbench',()=>{
 const f=fixture();assert.equal(Market.mount(f.host,f.root),true);assert.equal(f.prerequisite.hidden,false);
 assert.equal(Market.mount(null,f.root),false);assert.equal(f.host.moves,1);
});
test('market entry routes to Profile then opens market tab without starting a search',async()=>{
 const actions=[];const root={LeadIntelCustomerNavigation:{setStep:step=>actions.push(step)},LeadIntelReferenceCustomerLauncher:{open:async segment=>{actions.push(segment);return true;}}};
 assert.equal(await Market.open(root),true);assert.deepEqual(actions,[2,'market']);
});
test('delegated navigation installs once and reviews findings through Profile Review event',()=>{
 const f=fixture();Market.install(f.root);Market.install(f.root);assert.equal(f.listeners.length,1);
 f.listeners[0]({target:{closest:selector=>selector==='[data-review-market-strategy]'?{}:null}});
 assert.deepEqual(f.events,['leadintel:review-research-profile']);
});
test('only Profile owns research controls while Strategy retains findings and decisions',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const profile=html.slice(html.indexOf('id="profile-market-research-home"'),html.indexOf('id="profile-market-research-home"')+18000);
 for(const id of Market.RESEARCH_IDS){assert.equal(html.split(`id="${id}"`).length-1,1);assert.ok(profile.includes(`id="${id}"`));}
 assert.ok(html.includes('id="research-run-preview"'));assert.ok(html.includes('data-open-profile-market'));
 const strategy=html.slice(html.indexOf('id="strategy-flow"'));assert.ok(strategy.includes('id="research-results-intro"'));assert.ok(strategy.includes('id="activate-market-strategy"'));
 assert.equal(strategy.includes('id="run-market-research"'),false);
});
test('market research progress belongs to Profile and known companies remain in Companies',()=>{
 const stages=Journey.buildJourneyModel({currentStep:2,availability:{1:true,2:true},main:{profile:{},market:{researchStatus:'running'}}});
 assert.equal(stages[1].steps.find(step=>step.id==='research').label,'Market research in progress');
 assert.equal(stages[2].steps.some(step=>step.id==='research'),false);
 const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');assert.match(ui,/Add or import known companies/);
 const manager=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');assert.match(manager,/data-company-segment="targets" hidden/);assert.match(manager,/data-company-segment="market"/);
});

test('profile approval seeding preserves evidence, reports and research linkage',()=>{
 const vm=require('node:vm'),Engine=require('../market-engine.js');
 const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const fn=source.slice(source.indexOf('function seedMarketStrategy(){'),source.indexOf('function approveProfile(){'));
 const state={profile:{priorityOffers:'Legal support',idealCustomer:'Businesses',targetMarkets:'Finland',recommendedSignals:[{id:'legal',name:'Legal proceedings',active:true}]},market:{signals:[{id:'legal',name:'Legal proceedings',active:true},{id:'custom-manual',name:'Custom signal',active:false}],researchStatus:'partial',lastResearchAt:'2026-10-01',researchResults:[{url:'https://example.com/legal',title:'Legal proceedings',market:'Finland'}],researchReports:[{id:'saved',sources:[]}],researchProfileLink:{linkedAt:'2026-10-01',sourceCount:1},researchErrors:[{provider:'OpenAI',message:'Timed out'}]}};
 vm.runInNewContext(fn+';seedMarketStrategy()',{state,LeadIntelMarket:Engine,contentLanguage:()=> 'en'});
 assert.equal(state.market.researchStatus,'partial');assert.equal(state.market.lastResearchAt,'2026-10-01');
 assert.equal(state.market.researchResults[0].url,'https://example.com/legal');assert.equal(state.market.researchReports[0].id,'saved');assert.equal(state.market.researchProfileLink.sourceCount,1);assert.equal(state.market.researchErrors[0].message,'Timed out');assert.equal(state.market.signals.find(item=>item.id==='custom-manual').active,false);
});
