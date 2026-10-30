const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
function setup(){
 const w=new JSDOM(`<style>${fs.readFileSync(path.join(__dirname,'../app-shell.css'),'utf8')}</style><div class="top-actions"><button id="open-crm">CRM</button><div id="server-account"><span id="server-account-label">User</span><span id="server-sync-status">Sync conflict · local changes preserved</span><div id="server-conflict-actions"><button id="server-use-server">Use server version</button><button id="server-keep-local">Keep my local changes</button></div><button id="server-sync-recovery">Download recovery copy</button></div><span class="autosave">Sync conflict · local and server versions preserved</span><button id="save-workspace">Keep my local changes</button></div><button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button>`,{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 w.setInterval=()=>0;w.LeadIntelServerBridge={status:'error',session:{authenticated:true},workspace:{id:'one'},conflict:true};
 w.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>true,isExplicitlySaved:()=>true,hasMeaningfulWorkspaceData:()=>true};
 const choices=[];for(const id of ['server-use-server','server-keep-local','server-sync-recovery','save-workspace'])w.document.getElementById(id).addEventListener('click',()=>choices.push(id));
 for(const f of ['attention-centre-model.js','attention-centre.js','topbar.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return {w,d:w.document,choices};
}
test('conflict header opens one review surface without choosing or duplicating recovery actions',()=>{
 const {w,d,choices}=setup();try{
  const review=d.getElementById('topbar-save');assert.equal(review.textContent,'Review sync');
  assert.equal(w.getComputedStyle(d.getElementById('server-conflict-actions')).display,'none');
  assert.equal(w.getComputedStyle(d.getElementById('server-sync-recovery')).display,'none');
  review.focus();review.click();assert.deepEqual(choices,[]);assert.equal(d.getElementById('workspace-attention-drawer').hidden,false);
  assert.match(d.querySelector('[data-sync-review]').textContent,/both versions/i);
  d.querySelector('[data-sync-choice="server-keep-local"]').click();assert.deepEqual(choices,['server-keep-local']);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(d.getElementById('workspace-attention-drawer').hidden,true);assert.equal(d.activeElement,review);
 }finally{w.close();}
});
test('review keeps both version choices and backup available, mirrors busy state, and clears only after sync',()=>{
 const {w,d,choices}=setup();try{
  d.getElementById('topbar-save').click();
  for(const id of ['server-use-server','server-sync-recovery']){d.querySelector(`[data-sync-choice="${id}"]`).click();assert.equal(choices.at(-1),id);}
  w.LeadIntelServerBridge.resolvingSync=true;d.getElementById('server-keep-local').disabled=true;w.dispatchEvent(new w.Event('leadintel:sync-resolving'));w.LeadIntelAttention.refresh();
  assert.equal(d.querySelector('[data-sync-choice="server-keep-local"]').disabled,true);
  assert.equal(d.querySelector('[data-sync-choice="server-use-server"]').disabled,true);
  assert.equal(d.getElementById('topbar-status').textContent,'Saving…');
  const count=choices.length;d.querySelector('[data-sync-choice="server-keep-local"]').click();assert.equal(choices.length,count);
  w.LeadIntelServerBridge.resolvingSync=false;w.LeadIntelServerBridge.conflict=false;w.LeadIntelServerBridge.status='synced';
  d.querySelector('.autosave').textContent='Saved automatically to LeadIntel';d.getElementById('server-sync-status').textContent='Synced to LeadIntel';w.LeadIntelWorkspacePersistence.hasUnsavedChanges=()=>false;
  w.dispatchEvent(new w.Event('leadintel:sync-settled'));w.LeadIntelAttention.refresh();w.LeadIntelTopbar.update();
  assert.equal(d.querySelector('[data-sync-review]').hidden,true);assert.equal(d.getElementById('topbar-save').hidden,true);assert.equal(d.getElementById('topbar-status').textContent,'Saved');
 }finally{w.close();}
});
test('the sync attention card reviews a conflict instead of silently keeping local changes',()=>{
 const {w,d,choices}=setup();try{
  d.getElementById('workspace-attention').click();
  const card=[...d.querySelectorAll('.attention-item')].find(el=>el.textContent.includes('Workspace sync needs attention'));
  card.querySelector('button').click();assert.deepEqual(choices,[]);assert.equal(d.getElementById('workspace-attention-drawer').hidden,false);
 }finally{w.close();}
});

test('sync recovery remains the single actionable prerequisite until resolved, then buyer quality returns',()=>{
 const {w,d}=setup();try{
 w.LeadIntelJourney={getModel:()=>[{id:5,name:'Buyers',active:true,steps:[{id:'buyer-quality',label:'Buyer research quality needs review',action:'Complete buyer checks',complete:false}]}]};
 w.LeadIntelAttention.refresh();d.getElementById('workspace-attention').click();
 assert.equal(w.LeadIntelAttention.list().some(item=>item.id==='stage-5-buyer-quality'),false);
 w.LeadIntelServerBridge.conflict=false;w.LeadIntelServerBridge.status='synced';d.querySelector('.autosave').textContent='Saved';w.LeadIntelWorkspacePersistence.hasUnsavedChanges=()=>false;
 w.LeadIntelAttention.refresh();assert.equal(w.LeadIntelAttention.list().some(item=>item.id==='stage-5-buyer-quality'),true);
 }finally{w.close();}
});
