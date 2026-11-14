const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
function fixture(){
 const dom=new JSDOM('<span class="autosave"></span><span id="workspace-save-state"></span><div class="workspace-save-bar"></div><button id="save-workspace"></button>',{url:'https://example.test/customer/'}),values=new Map();
 const b={ready:true,session:{authenticated:true},workspace:{id:'fixture'},saveNow:async()=>({saved:true})},listeners=new Map();
 const c={console,URL,Request,Response,Date,Promise,document:dom.window.document,location:{href:'https://example.test/customer/'},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},LeadIntelServerBridge:b,fetch:()=>{throw Error('No requests permitted')},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){},setTimeout:()=>1,clearTimeout(){},CustomEvent:class{}};c.globalThis=c;vm.runInNewContext(source,c);return {c,b,dom,status:dom.window.document.getElementById('workspace-save-state'),listeners};
}
test('save failure exposes bounded HTTP status, code and error name through the DOM without raw error payload',async()=>{
 const f=fixture();try{f.b.saveNow=async()=>{throw Object.assign(new TypeError('private@example.test bearer=secret-token'),{status:503,code:'response_body_failed',requestPath:'/api/customer/state?private=secret-token',payload:{secret:'secret-token'}})};
 assert.equal(await f.c.LeadIntelWorkspacePersistence.saveWorkspace(),false);assert.match(f.status.textContent,/HTTP 503/);assert.match(f.status.textContent,/response_body_failed/);assert.match(f.status.textContent,/TypeError/);assert.doesNotMatch(f.dom.window.document.body.outerHTML,/private@example|secret-token|private=/);
 }finally{f.dom.window.close();}
});
test('a successful retry clears visible diagnostic and tooltip',async()=>{
 const f=fixture();try{f.b.saveNow=async()=>{throw Object.assign(new Error('unavailable'),{status:502,code:'workspace_http_502'})};await f.c.LeadIntelWorkspacePersistence.saveWorkspace();assert.match(f.status.textContent,/HTTP 502/);f.b.saveNow=async()=>({saved:true});assert.equal(await f.c.LeadIntelWorkspacePersistence.saveWorkspace(),true);assert.doesNotMatch(f.status.textContent,/HTTP 502|workspace_http_502/);assert.equal(f.status.title,'');}finally{f.dom.window.close();}
});
test('unstructured diagnostic fields cannot disclose message-like private values or inject markup',async()=>{
 const f=fixture();try{f.b.saveNow=async()=>{throw {name:'<img src=x onerror=secret>',code:'private@example.test?token=secret',status:'503 secret',message:'Section sizes: private@example.test secret'}};await f.c.LeadIntelWorkspacePersistence.saveWorkspace();assert.doesNotMatch(f.dom.window.document.body.outerHTML,/private@example|onerror|token=secret/);assert.match(f.status.textContent,/Sync failed/);}finally{f.dom.window.close();}
});
