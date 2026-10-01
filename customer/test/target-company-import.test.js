const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function runtime({saveFails=false}={}){
 const storage=new Map([['leadintel_customer_v2_state',JSON.stringify({website:'https://seller.example',referenceCustomers:{rows:[{companyName:'Reference',website:'https://reference.example'}]},targetCompanies:[{companyName:'Existing',website:'https://existing.example'}]})]]);
 const nodes=new Map();
 function get(id){if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',innerHTML:'',onclick:null,dataset:{},querySelector:s=>get(s.slice(1)),querySelectorAll:()=>[]});return nodes.get(id);}
 const preview=get('targets-import-preview');preview.querySelectorAll=()=>[{dataset:{targetImportRow:'0'}},{dataset:{targetImportRow:'1'}}];
 const document={getElementById:id=>id==='reference-customer-modal'?get(id):null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const ctx={URL,console,document,setTimeout:()=>0,clearTimeout(){},CustomEvent:class{},dispatchEvent(){},addEventListener(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'review-workspace'},saveNow:async()=>({saved:!saveFails})}};
 vm.createContext(ctx);
 for(const name of ['reference-customers.js','reference-customer-ui.js']){
  let source=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  if(name==='reference-customer-ui.js')source=source.replace("root.LeadIntelReferenceCustomerUI={runtimeVersion:","root.__previewTargetImport=previewTargetImport;root.LeadIntelReferenceCustomerUI={runtimeVersion:");
  vm.runInContext(`(function(){${source}\n})()`,ctx);
 }
 return {ctx,get,storage,preview};
}
test('target CSV requires review and preserves references and existing targets through save and reload',async()=>{
 const r=runtime();const before=r.storage.get('leadintel_customer_v2_state');
 await r.ctx.__previewTargetImport({name:'targets.csv',text:async()=> 'Company,Website\nNew Company,https://new.example\nExisting Duplicate,https://existing.example'});
 assert.equal(r.storage.get('leadintel_customer_v2_state'),before);assert.equal(r.preview.hidden,false);
 await r.get('targets-confirm-import').onclick();
 const saved=JSON.parse(r.storage.get('leadintel_customer_v2_state'));assert.equal(saved.targetCompanies.length,2);assert.equal(saved.referenceCustomers.rows[0].companyName,'Reference');assert.equal(saved.targetCompanies[0].domain,'existing.example');assert.equal(saved.targetCompanies[1].domain,'new.example');assert.match(r.get('target-company-status').textContent,/Targets saved to your workspace/);
 const reloaded=r.ctx.LeadIntelReferenceCustomers.normalizeTargetCompanies(saved.targetCompanies,saved.website);assert.equal(reloaded.length,2);
});
test('failed workspace sync retains imported targets and exposes a visible retry',async()=>{
 const r=runtime({saveFails:true});await r.ctx.__previewTargetImport({name:'targets.csv',text:async()=> 'Company,Website\nNew Company,https://new.example\nExisting,https://existing.example'});await r.get('targets-confirm-import').onclick();
 assert.equal(JSON.parse(r.storage.get('leadintel_customer_v2_state')).targetCompanies.length,2);assert.equal(r.get('targets-save-account').hidden,false);assert.match(r.get('target-company-status').textContent,/browser|sync/i);
});
test('cancelled or stale target import cannot modify another workspace',async()=>{
 const r=runtime();const before=r.storage.get('leadintel_customer_v2_state');await r.ctx.__previewTargetImport({name:'targets.csv',text:async()=> 'Company,Website\nNew Company,https://new.example'});r.ctx.LeadIntelServerBridge.workspace.id='another-workspace';await r.get('targets-confirm-import').onclick();assert.equal(r.storage.get('leadintel_customer_v2_state'),before);assert.match(r.get('target-company-status').textContent,/Workspace changed/);
});
test('an older file finishing late cannot replace the newest import preview',async()=>{
 const r=runtime();let release;const old=r.ctx.__previewTargetImport({name:'old.csv',text:()=>new Promise(resolve=>release=resolve)});await r.ctx.__previewTargetImport({name:'new.csv',text:async()=> 'Company,Website\nLatest,https://latest.example'});release('Company,Website\nOld,https://old.example');await old;assert.match(r.preview.innerHTML,/Latest/);assert.doesNotMatch(r.preview.innerHTML,/Old/);
});
