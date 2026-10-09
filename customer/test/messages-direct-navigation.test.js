const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const full=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
const start=full.indexOf('// Messages can be opened directly'),end=full.indexOf('function openDiscoveryFromHandoff(',start);
assert.ok(start>=0&&end>start);
function harness(initialStep=5){
 let calls=0,visible=false;const events={},errors=[];
 const page={classList:{toggle:(key,on)=>{if(key==='active')visible=on;}}};
 const window={LeadIntelOutreachUI:{openBuyerScripts(){}},LeadIntelJourney:{refresh(){}},addEventListener:(name,fn)=>events[name]=fn};
 const document={getElementById:key=>key==='step-6'?page:null,querySelectorAll:()=>[page]};
 const context={window,document,localStorage:{getItem:()=>JSON.stringify({step:initialStep})},loadOutreachModules:async()=>{calls++;},showToast:text=>errors.push(text),console};
 vm.runInNewContext(full.slice(start,end),context);
 return {events,context,errors,counts:()=>({calls,visible})};
}
test('direct Messages navigation loads module and activates Step 6',async()=>{
 const h=harness(6);h.events['leadintel:module-opened']({detail:{step:6}});await h.context.ensureMessagesStageLoaded();
 assert.ok(h.counts().calls>=1);assert.equal(h.counts().visible,true);assert.equal(h.errors.length,0);
});
test('other stages do not load the Messages module',async()=>{
 const h=harness(5);h.events['leadintel:module-opened']({detail:{step:4}});await Promise.resolve();
 assert.equal(h.counts().calls,0);
});
