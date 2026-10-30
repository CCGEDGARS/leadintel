const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{mounted}=require('./helpers/message-runtime.js');
const ready={ready:true,authenticated:true,hasDraft:true,savedDraft:true,senderIdentityReady:true,channel:'email',appliedStyle:'professional',selectedStyle:'professional'};
test('a saved message needing recipient review has one visible primary action without generating or approving',()=>{
 const h=mounted({selected:'professional'});try{
  h.w.LeadIntelMessageWorkspace.render(h.w.document,{...ready,unpersonalizedDraft:true});const action=h.q('mw-flow-resolve'),footer=h.w.document.querySelector('.mw-message-footer'),before=h.item();
  assert.equal(h.q('mw-add-flow').hidden,true);assert.equal(action.hidden,false);assert.equal(action.parentElement,footer);assert.ok(action.classList.contains('primary-btn'));assert.equal(action.disabled,false);assert.equal(action.textContent,'Review message update');
  action.click();assert.equal(h.q('mw-tools-drawer').open,true);assert.equal(h.w.document.activeElement,h.q('message-generate'));assert.deepEqual(h.item(),before);assert.equal(h.requests.length,0);
  h.w.LeadIntelMessageWorkspace.render(h.w.document,ready);assert.equal(action.hidden,true);assert.equal(h.q('mw-add-flow').hidden,false);assert.equal(h.q('mw-add-flow').disabled,false);
 }finally{h.w.close();}
});
test('busy review stays legible and disabled, while a sync blocker opens review without choosing data',()=>{
 const h=mounted({selected:'professional'});try{
  const d=h.w.document;for(const file of ['styles.css','message-workspace.css']){const style=d.createElement('style');style.textContent=fs.readFileSync(require.resolve('../'+file),'utf8');d.head.append(style);}
  h.w.LeadIntelMessageWorkspace.render(d,{...ready,unpersonalizedDraft:true,busy:true});const action=h.q('mw-flow-resolve');assert.equal(action.disabled,true);assert.equal(h.w.getComputedStyle(action).opacity,'1');
  let opened=0;h.w.LeadIntelAttention={open(){opened++;}};h.w.LeadIntelMessageWorkspace.render(d,{...ready,syncConflict:true});const before=h.item();action.click();assert.equal(opened,1);assert.deepEqual(h.item(),before);assert.equal(h.requests.length,0);assert.equal(h.q('mw-add-flow').hidden,true);
 }finally{h.w.close();}
});
