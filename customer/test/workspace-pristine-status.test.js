const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','workspace-persistence.js'),'utf8');

function storage(values=new Map()){return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function loadPersistence(initial={}){
  const values=new Map(Object.entries(initial));
  const autosave={innerHTML:''};
  const sandbox={
    console,URL,Request,Response,Date,Promise,localStorage:storage(values),sessionStorage:storage(),
    location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:async()=>new Response('{}',{status:200}),
    document:{readyState:'complete',querySelector:selector=>selector==='.autosave'?autosave:null,getElementById:()=>null,addEventListener(){}},
    addEventListener(){},removeEventListener(){},setTimeout(callback){callback();return 1;},clearTimeout(){},CustomEvent:class CustomEvent{}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'workspace-persistence.js'});
  return {sandbox,values,autosave};
}

test('a pristine reset workspace is clean rather than an unsaved draft',()=>{
  const {sandbox,autosave}=loadPersistence();
  assert.equal(sandbox.LeadIntelWorkspacePersistence.hasMeaningfulWorkspaceData(),false);
  assert.equal(sandbox.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
  assert.match(autosave.innerHTML,/New workspace · ready/);
});

test('meaningful never-saved input is still reported as an unsaved draft',()=>{
  const {sandbox}=loadPersistence({leadintel_customer_v2_state:JSON.stringify({website:'example.com'})});
  assert.equal(sandbox.LeadIntelWorkspacePersistence.hasMeaningfulWorkspaceData(),true);
  assert.equal(sandbox.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
});
