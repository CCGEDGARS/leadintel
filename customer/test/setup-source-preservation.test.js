const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function run(optional){
 const state={website:'https://seller.example/',additionalLinks:['https://seller.example/evidence']};let saved=0;
 const context={state,LeadIntelProfile:require('../profile-engine.js'),window:{LeadIntelWorkspaceIsolation:{canonicalDomain:value=>new URL(value).hostname}},$:id=>id==='company-website'?{value:'seller.example'}:optional,saveState:()=>saved++,invalidateStrategicOutputs:()=>assert.fail('same seller must remain intact')};
 vm.runInNewContext(app.match(/function readSources\(\)\{[\s\S]*?\n\}/)[0]+';readSources();',context);return {state,saved};
}
test('Setup navigation preserves saved optional sources when their input is absent',()=>{
 const {state,saved}=run(null);assert.deepEqual(state.additionalLinks,['https://seller.example/evidence']);assert.equal(saved,1);
});
test('an explicitly present empty optional source input still clears the saved links',()=>{
 const {state}=run({value:''});assert.equal(state.additionalLinks.length,0);
});
