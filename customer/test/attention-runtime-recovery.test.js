const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
function runtime(){
 const w=new JSDOM('<button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button>',{url:'https://workspace.example',runScripts:'outside-only'}).window;
 w.setInterval=()=>0;w.LeadIntelServerBridge={workspace:{id:'w1'}};w.LeadIntelWorkspacePersistence={hasMeaningfulWorkspaceData:()=>false,hasUnsavedChanges:()=>false};
 for(const file of ['attention-centre-model.js','attention-centre.js'])w.eval(fs.readFileSync(require.resolve('../'+file),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const incident=error=>{const event=new w.Event('unhandledrejection');event.reason=error;w.dispatchEvent(event);w.LeadIntelAttention.refresh();};
 return {w,incident,items:()=>w.LeadIntelAttention.list().filter(item=>item.target.type==='runtime')};
}
const crmError=()=>Object.assign(new Error('CRM request timed out'),{code:'request_timeout',requestPath:'/api/crm/companies',transient:true});
test('verified CRM recovery clears only its pre-existing typed incident and retains an unknown component failure',()=>{
 const r=runtime();try{
  r.incident(crmError());r.incident(new TypeError('Buyer card renderer failed'));
  assert.equal(r.items().length,2);const recover=r.w.LeadIntelAttention.prepareCrmRecovery('w1');recover();r.w.LeadIntelAttention.refresh();
  assert.equal(r.items().length,1);assert.match(r.items()[0].technical,/Buyer card renderer failed/);
 }finally{r.w.close();}
});
test('same-scope incidents raised during recovery remain active after its earlier snapshot succeeds',()=>{
 const r=runtime();try{
  r.incident(crmError());const recover=r.w.LeadIntelAttention.prepareCrmRecovery('w1');r.incident(crmError());recover();r.w.LeadIntelAttention.refresh();
  assert.equal(r.items().length,1);
 }finally{r.w.close();}
});
test('a recovered read cannot clear another workspace, bridge, endpoint or untyped lookalike incident',()=>{
 const cases=[error=>({...error,workspaceId:'w2'}),error=>({...error,requestPath:'/api/customer/state'}),error=>({...error,transient:false}),error=>new Error(error.message)];
 for(const mutate of cases){const r=runtime();try{const error=mutate(crmError());if(!error.message)error.message='CRM request timed out';r.incident(error);r.w.LeadIntelAttention.prepareCrmRecovery('w1')();r.w.LeadIntelAttention.refresh();assert.equal(r.items().length,1);}finally{r.w.close();}}
 for(const replace of [r=>{r.w.LeadIntelServerBridge.workspace.id='w2';},r=>{r.w.LeadIntelServerBridge={workspace:{id:'w1'}};}]){const r=runtime();try{r.incident(crmError());const recover=r.w.LeadIntelAttention.prepareCrmRecovery('w1');replace(r);recover();r.w.LeadIntelAttention.refresh();assert.equal(r.items().length,1);}finally{r.w.close();}}
});
test('ordinary workspace save, provider or journey success never clears an unknown runtime incident',()=>{
 const r=runtime();try{r.incident(new Error('Unknown page failure'));for(const name of ['leadintel:server-synced','leadintel:journey-changed','leadintel:provider-status'])r.w.dispatchEvent(new r.w.Event(name));r.w.LeadIntelAttention.refresh();assert.equal(r.items().length,1);}finally{r.w.close();}
});
