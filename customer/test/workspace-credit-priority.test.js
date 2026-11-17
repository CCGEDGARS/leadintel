const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,70));
async function mount(){
 const w=new JSDOM('<style>'+read('app-shell.css')+read('attention-centre.css')+'</style><div class="top-actions"><button id="open-crm">CRM</button><span id="server-sync-status">Sync failed</span><button id="save-workspace">Save</button></div><button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button><button id="open-settings">Settings</button>',{url:'https://app.example',runScripts:'outside-only'}).window;
 let rows=[{provider:'firecrawl',configured:true,source:'customer',credit_issue:{code:'credits_exhausted',source:'customer'}}],fail=false;
 w.setInterval=()=>0;w.LeadIntelServerBridge={workspace:{id:'one'},session:{authenticated:true},status:'error'};
 w.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>true,hasMeaningfulWorkspaceData:()=>true};
 w.fetch=async url=>({ok:!fail,json:async()=>({providers:url.includes('/services/status')?rows:[]})});
 for(const name of ['attention-centre-model.js','attention-centre.js','topbar.js'])w.eval(read(name));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 return {w,setRows:value=>rows=value,setFailure:value=>fail=value};
}
test('confirmed credit failure makes visible Workspace status red and precedes sync warnings',async()=>{
 const {w}=await mount();try{
  const d=w.document,button=d.getElementById('topbar-workspace-status');
  assert.equal(button.dataset.healthStatus,'error');assert.match(button.textContent,/Credits/);
  assert.equal(w.getComputedStyle(button.querySelector('[data-topbar-badge]')).backgroundColor,'rgb(194, 65, 59)');
  button.click();const first=d.querySelector('.attention-item');assert.match(first.textContent,/Firecrawl/);assert.equal(first.getAttribute('role'),'alert');
  assert.equal(w.getComputedStyle(first.querySelector('strong')).color,'rgb(160, 43, 38)');
  assert.ok(first.compareDocumentPosition(d.querySelector('.workspace-sync-section'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(w.LeadIntelAttention.list()[0].severity,'error');assert.match(button.title,/billing issue/);
  let settings=0;d.getElementById('open-settings').onclick=()=>settings++;first.querySelector('button').click();assert.equal(settings,1);
 }finally{w.close();}
});
test('recheck failure retains red credit alerts; confirmed recovery restores yellow nonbilling warnings',async()=>{
 const {w,setRows,setFailure}=await mount();try{
  setFailure(true);await w.LeadIntelAttention.recheck();await settle();assert.equal(w.document.getElementById('topbar-workspace-status').dataset.healthStatus,'error');
  setFailure(false);setRows([{provider:'firecrawl',configured:true,source:'customer',state:'bad',metadata:{error:'HTTP 429 rate limit'}}]);
  await w.LeadIntelAttention.recheck();await settle();const button=w.document.getElementById('topbar-workspace-status');
  assert.equal(button.dataset.healthStatus,'recommendation');assert.equal(button.querySelector('[data-topbar-credit-alert]').hidden,true);assert.equal(w.document.querySelector('.attention-item.is-error'),null);
  assert.equal(w.getComputedStyle(button.querySelector('[data-topbar-badge]')).backgroundColor,'rgb(188, 143, 42)');
 }finally{w.close();}
});
test('Treg exhaustion appears without leaking alerts into another workspace',async()=>{
 const {w,setRows}=await mount();try{
  setRows([{provider:'treg',configured:true,source:'customer',credit_issue:{code:'credits_exhausted',source:'customer'}}]);await w.LeadIntelAttention.recheck();await settle();
  assert.match(w.document.querySelector('.attention-item.is-error').textContent,/Treg/);
  w.LeadIntelServerBridge.workspace.id='two';setRows([]);w.dispatchEvent(new w.Event('leadintel:workspace-changed'));await settle();
  assert.equal(w.document.querySelector('.attention-item.is-error'),null);assert.notEqual(w.document.getElementById('topbar-workspace-status').dataset.healthStatus,'error');
 }finally{w.close();}
});
