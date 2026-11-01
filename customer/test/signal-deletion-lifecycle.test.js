const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Market=require('../market-engine.js');
const seeds=[{id:'expansion',name:'Expansion',active:true},{id:'leadership',name:'New leader',active:false}];
function reopen(market){market=Market.normalizeMarketState(JSON.parse(JSON.stringify(market)));market.signals=Market.normalizeSignals(seeds,market.signals,market.deletedSignalIds);return market;}
test('removing a recommendation survives reseeding, save/reload and localization without changing other choices',()=>{
 let market=Market.normalizeMarketState({signals:Market.normalizeSignals(seeds,[]),researchResults:[{url:'https://example.com/news',title:'Evidence'}]});
 market=Market.removeSignal(market,'expansion');market=reopen(Market.localizeGeneratedState(market,{},'lv'));
 assert.deepEqual(market.signals.map(s=>s.id),['leadership']);assert.equal(market.signals[0].active,false);assert.equal(market.researchResults.length,1);
 market=Market.removeSignal(market,'leadership');assert.equal(reopen(market).signals.length,0,'empty selection must stay empty');
});
test('custom signal removal can be undone after reload with edits preserved and strategy approval invalidated',()=>{
 let market=Market.normalizeMarketState({signals:[...Market.normalizeSignals(seeds,[]),{id:'custom-office',name:'Office',keywords:'new office',weight:8,active:false}],strategyApproved:true,strategyApprovedAt:'yesterday'});
 market=Market.removeSignal(market,'custom-office');assert.equal(market.signals.length,2);assert.equal(market.strategyApproved,false);assert.equal(market.strategyApprovedAt,'');
 market=Market.restoreRemovedSignal(reopen(market));assert.equal(market.signals[2].keywords,'new office');assert.equal(market.signals[2].active,false);assert.equal(market.lastRemovedSignal,null);
});
test('removal is workspace-local and invalid IDs do not delete another signal',()=>{
 const first=Market.normalizeMarketState({signals:Market.normalizeSignals(seeds,[])}),second=reopen(first);
 assert.equal(Market.removeSignal(first,'missing').signals.length,2);
 const changed=Market.removeSignal(first,'expansion');assert.equal(reopen(second).signals.length,2);assert.equal(reopen(changed).signals.length,1);
});
test('adding beyond the signal limit reports failure rather than silently discarding the new signal',()=>{
 const full=Array.from({length:20},(_,i)=>({id:`custom-${i}`,name:`Signal ${i}`}));
 const result=Market.addCustomSignal(full,{name:'Twenty first'});assert.equal(result.added,false);assert.match(result.error,/20/);
});
test('app deletion uses persistent removal and all reseeding paths honor deleted IDs',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(app,/LeadIntelMarket\.removeSignal\(state.market/);assert.match(app,/LeadIntelMarket\.restoreRemovedSignal/);
 const calls=[...app.matchAll(/LeadIntelMarket\.normalizeSignals\(([^;]+)\);/g)].map(m=>m[1]);assert.equal(calls.length,4);for(const args of calls)assert.match(args,/deletedSignalIds/);
});
test('Strategy deletion updates rendered rows and exposes a working Undo action across reseeding',()=>{
 const {JSDOM}=require('jsdom'),app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const document=new JSDOM(fs.readFileSync(require.resolve('../index.html'),'utf8')).window.document;
 assert.ok(document.getElementById('undo-remove-signal'),'Undo must be available in the real page');
 const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
 const context=vm.createContext({syncResearchContextStale:()=>false,LeadIntelTargeting:{isConfirmed:()=>true},state:{website:'https://seller.example',targetMarkets:['Sweden'],approved:true,profile:{recommendedSignals:seeds},market:Market.normalizeMarketState({signals:Market.normalizeSignals(seeds,[])})},document,$:id=>document.getElementById(id),esc:s=>String(s),LeadIntelMarket:Market,contentLanguage:()=> 'en',saveState:()=>{},showToast:()=>{},readMarketEdits:()=>{},syncResearchSourcesToSignals:()=>{},researchContextFingerprint:()=> 'same'});
 vm.runInContext(extract('function ensureMarketStrategySeeded(){','async function openModule(')+extract('function renderSignalDesigner(){','function addCustomSignal(){')+extract('function removeSignal(index){','async function waitForMarketServerBridge(')+';function renderMarketStrategy(){ensureMarketStrategySeeded();renderSignalDesigner();}renderMarketStrategy();removeSignal(0);',context);
 assert.equal(document.querySelectorAll('[data-remove-signal]').length,1);assert.equal(document.getElementById('signal-removal-undo').hidden,false);
 assert.match(document.getElementById('signal-removal-label').textContent,/Expansion/);
 vm.runInContext('undoRemoveSignal()',context);assert.equal(document.querySelectorAll('[data-remove-signal]').length,2);assert.equal(document.getElementById('signal-removal-undo').hidden,true);
});
