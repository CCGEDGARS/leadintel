const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Market=require('../market-engine.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
test('customer-defined signals survive a rebuild of recommended signals',()=>{
 const added=Market.addCustomSignal([],{name:'Hiring an operations or IT manager',keywords:'operations manager; IT manager; job ad; hiring',priority:'medium',weight:7});
 const custom=added.signals.find(item=>String(item.id).startsWith('custom-'));
 assert.ok(custom,'custom signal gets a custom- id');
 const recommended=[{id:'signal-expansion',name:'Expansion',keywords:['new office'],priority:'medium',weight:6,active:true}];
 const rebuilt=Market.normalizeSignals(recommended,added.signals,[]);
 assert.ok(rebuilt.some(item=>item.id===custom.id),'custom signal kept when the saved list is passed');
 assert.equal(Market.normalizeSignals(recommended,[],[]).some(item=>item.id===custom.id),false,'an empty saved list drops it — which is why app.js must never pass []');
});
test('changing buying triggers rebuilds signals against the saved list, not an empty one',()=>{
 assert.equal(/normalizeSignals\(state\.profile\.recommendedSignals,\[\]/.test(app),false);
 assert.match(app,/normalizeSignals\(state\.profile\.recommendedSignals,state\.market\.signals\|\|\[\],state\.market\.deletedSignalIds\)/);
});
