const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function fixture(){
 let account='workspace-one',strategy={strategySignature:'signed-evidence',approved:'reviewed',answers:{offer:'Equipment',buyer_roles:'Operations'},icps:[['one'],['two']]};
 const context={discoveryAccountContext:()=>account,fingerprint:()=>JSON.stringify(strategy)};
 vm.runInNewContext(source.slice(source.indexOf('function discoveryOperationContext()'),source.indexOf('function sameStrategyFingerprint(')),context);
 return {read:()=>context.discoveryOperationContext(),set:value=>strategy=value,account:value=>account=value,get strategy(){return strategy;}};
}
test('operation ownership survives JSON object-key reordering without changing evidence or values',()=>{
 const h=fixture(),before=h.read();h.set({...h.strategy,answers:{buyer_roles:'Operations',offer:'Equipment'}});assert.equal(h.read(),before);
});
test('operation ownership still rejects every material value, array order and account change',()=>{
 for(const change of [s=>({...s,strategySignature:'new-evidence'}),s=>({...s,approved:'new-review'}),s=>({...s,answers:{...s.answers,buyer_roles:'Finance'}}),s=>({...s,icps:s.icps.slice().reverse()}),s=>({...s,answers:{...s.answers,offer:null}}),s=>({...s,answers:{...s.answers,newField:'new'}})]){
  const h=fixture(),before=h.read();h.set(change(h.strategy));assert.notEqual(h.read(),before);
 }
 const h=fixture(),before=h.read();h.account('workspace-two');assert.notEqual(h.read(),before);
});
