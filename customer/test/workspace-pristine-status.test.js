const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','workspace-persistence.js'),'utf8');

function storage(values=new Map()){return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function loadPersistence(initial={},serverPayload={}){
  const values=new Map(Object.entries(initial));
  const autosave={innerHTML:''};
  const sandbox={
    console,URL,Request,Response,Date,Promise,localStorage:storage(values),sessionStorage:storage(),
    location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:async()=>new Response(JSON.stringify(serverPayload),{status:200}),
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

test('buyer changes after a saved snapshot survive workspace hydration and require saving',async()=>{
  const main=JSON.stringify({website:'ercon.lv'});
  const original=JSON.stringify({selectedProspects:[]});
  const current=JSON.stringify({selectedProspects:[{company:'Billerud',domain:'billerud.com',people:[{name:'Johan'}]}]});
  const snapshot={schema_version:1,saved_at:'2026-09-28T09:00:00.000Z',data:{leadintel_customer_v2_state:main,leadintel_customer_v2_discovery:original}};
  const {sandbox,values,autosave}=loadPersistence({
    leadintel_customer_v2_state:main,
    leadintel_customer_v2_discovery:current,
    leadintel_customer_v2_workspace:'workspace-1',
    leadintel_customer_v2_server_versions:JSON.stringify({'workspace-1':7}),
    leadintel_customer_v2_workspace_explicit_save_v1:'1',
    leadintel_customer_v2_workspace_saved_snapshot_v1:JSON.stringify(snapshot)
  },{version:7,payload:{main:{website:'ercon.lv'},discovery:{selectedProspects:[]},meta:{persistence:{explicit_saved:true}}}});
  assert.equal(sandbox.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
  assert.match(autosave.innerHTML,/Unsaved changes/);
  const response=await sandbox.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=workspace-1');
  assert.equal(response.status,200);
  assert.equal(values.get('leadintel_customer_v2_discovery'),current);
  assert.equal(JSON.parse(values.get('leadintel_customer_v2_server_dirty')).base_version,7);
  assert.equal(JSON.parse(values.get('leadintel_customer_v2_workspace_saved_snapshot_v1')).data.leadintel_customer_v2_discovery,original);
});
