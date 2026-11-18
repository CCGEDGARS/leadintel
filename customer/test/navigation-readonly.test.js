const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
test('navigation persists only its page and never overwrites newer independently saved fields',()=>{
 let raw=JSON.stringify({step:1,profile:{name:'New profile'},market:{strategyApproved:true},eventCampaigns:{name:'Saved event'}}),writes=0;
 const c={window:{},STORAGE_KEY:'main',localStorage:{getItem:()=>raw,setItem:(k,v)=>{raw=v;writes++;}}};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function persistNavigationStep('),app.indexOf('function setStep(')),c);
 c.persistNavigationStep(4);assert.deepEqual(JSON.parse(raw),{step:4,profile:{name:'New profile'},market:{strategyApproved:true},eventCampaigns:{name:'Saved event'}});c.persistNavigationStep(4);assert.equal(writes,1);
 c.window.LeadIntelAccountCache={};c.persistNavigationStep(2);assert.equal(writes,1,'unverified account cannot change another saved workspace');
});
test('saving unchanged legacy profile controls preserves approval; real edits still invalidate it',()=>{
 const input={dataset:{profileField:'priorityOffers'},value:'Machinery'},signal={dataset:{signalIndex:'0'},checked:true};let saves=0;
 const c={state:{profile:{priorityOffers:'Machinery',targetMarkets:'Sweden',recommendedSignals:[{name:'Hiring'}]},approved:true},document:{querySelectorAll:s=>s.includes('textarea')?[input]:[signal]},LeadIntelProfile:{expandTargetMarkets:x=>[x]},saveState:()=>saves++};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function fieldValue('),app.indexOf('function renderProfile('))+app.slice(app.indexOf('function saveProfileEdits('),app.indexOf('function acceptCanonicalProfileEdits(')),c);
 assert.equal(c.saveProfileEdits(),true);assert.equal(saves,0);assert.equal(c.state.approved,true);input.value='Changed offer';assert.equal(c.saveProfileEdits(),true);assert.equal(saves,1);assert.equal(c.state.approved,false);
});
test('legacy bridge schedules actual writes but ignores navigation-only storage changes',()=>{
 const bridge=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8'),Sync=require('../workspace-sync.js');let dirty=0,saves=0;class Storage{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)||null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
 const localStorage=new Storage();localStorage.setItem('main',JSON.stringify({step:1,answers:{offer:'Machinery'}}));const c={Storage,localStorage,KEYS:{main:'main',meta:'meta'},suppress:false,root:{LeadIntelWorkspaceSync:Sync},markDirtyLocalState:()=>dirty++,scheduleSave:()=>saves++};vm.createContext(c);vm.runInContext(bridge.slice(bridge.indexOf('  function sameStoredContent('),bridge.indexOf('  function scheduleSave('))+';patchStorage();',c);
 localStorage.setItem('main',JSON.stringify({step:4,answers:{offer:'Machinery'}}));localStorage.setItem('meta',JSON.stringify({visibleStep:4,activeJourneyStage:3}));assert.equal(dirty,0);assert.equal(saves,0);
 localStorage.setItem('main',JSON.stringify({step:4,answers:{offer:'Changed'}}));assert.equal(dirty,1);assert.equal(saves,1);localStorage.removeItem('main');assert.equal(saves,2);
});
