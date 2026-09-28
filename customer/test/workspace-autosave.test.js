const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','workspace-persistence.js'),'utf8');

test('a discovery result saves automatically after a debounce and reports saved status',async()=>{
  const values=new Map([['leadintel_customer_v2_state',JSON.stringify({website:'ercon.lv'})]]);
  const listeners=new Map(),timers=new Map();let nextTimer=0;
  const storage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  const status={textContent:''},button={textContent:'',disabled:false,dataset:{},addEventListener(){}},bar={dataset:{}};
  const sandbox={console,URL,Request,Response,Date,Promise,LeadIntelServerBridge:{session:{authenticated:false}},localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:async()=>new Response('{}',{status:200}),
    document:{readyState:'complete',querySelector:selector=>selector==='.workspace-save-bar'?bar:null,getElementById:id=>id==='save-workspace'?button:id==='workspace-save-state'?status:null,addEventListener(){}},
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){},setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},CustomEvent:class CustomEvent{}};
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'workspace-persistence.js'});
  values.set('leadintel_customer_v2_discovery',JSON.stringify({selectedProspects:[{company:'Billerud',domain:'billerud.com'}]}));
  listeners.get('leadintel:workspace-dirty')();
  assert.match(status.textContent,/saving shortly/);
  const pending=[...timers].find(([,item])=>item.ms===2200);
  assert.ok(pending,'a bounded debounce should be scheduled');
  timers.delete(pending[0]);pending[1].fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(status.textContent,/Saved in this browser · cloud sync pending/);
  const snapshot=JSON.parse(values.get('leadintel_customer_v2_workspace_saved_snapshot_v1'));
  assert.match(snapshot.data.leadintel_customer_v2_discovery,/Billerud/);
  assert.equal(button.textContent,'Save now');
});

test('save panel recovers a server conflict by keeping local changes',async()=>{
  const values=new Map([['leadintel_customer_v2_state',JSON.stringify({website:'https://ercon.lv',profile:{website:'https://ercon.lv'}})]]);
  let click,kept=0;
  const button={textContent:'',disabled:false,dataset:{},addEventListener(name,handler){if(name==='click')click=handler;}};
  const status={textContent:''},bar={dataset:{}};
  const bridge={session:{authenticated:true},workspace:{id:'w1'},conflict:true,async resolveConflictKeepLocal(){kept++;bridge.conflict=false;return {saved:true};}};
  const sandbox={console,URL,Request,Response,Date,Promise,LeadIntelServerBridge:bridge,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:async()=>new Response('{}',{status:200}),document:{readyState:'complete',querySelector:selector=>selector==='.workspace-save-bar'?bar:null,getElementById:id=>id==='save-workspace'?button:id==='workspace-save-state'?status:null,addEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,CustomEvent:class CustomEvent{}};
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'workspace-persistence.js'});
  assert.equal(button.textContent,'Keep my local changes');
  click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(kept,1);
  assert.doesNotMatch(status.textContent,/Sync failed|Sync conflict/);
});
