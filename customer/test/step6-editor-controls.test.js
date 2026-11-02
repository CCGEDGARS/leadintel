const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {mounted}=require('./helpers/message-runtime.js');
const E=require('../message-editor.js');

function withStyles(h){
 const sheet=h.w.document.createElement('style');
 sheet.textContent=fs.readFileSync(require.resolve('../message-workspace.css'),'utf8');
 h.w.document.head.append(sheet);
}
function visible(h,element){
 if(!element?.isConnected)return false;
 for(let current=element;current;current=current.parentElement){
  const style=h.w.getComputedStyle(current);
  if(current.hidden||style.display==='none'||style.visibility==='hidden')return false;
  if(current.tagName==='DETAILS'&&!current.open&&!current.querySelector(':scope > summary')?.contains(element))return false;
 }
 return true;
}
function show(h,extra={}){
 return h.w.LeadIntelMessageWorkspace.render(h.w.document,{ready:true,authenticated:true,hasDraft:true,savedDraft:true,senderIdentityReady:true,channel:'email',appliedStyle:'professional',selectedStyle:'professional',originalAvailable:true,...extra});
}

test('mounted editor exposes its primary controls while optional tools stay collapsed',()=>{
 const h=mounted({selected:'professional'});try{
  withStyles(h);show(h);const d=h.w.document,tools=h.q('mw-tools-drawer'),head=d.querySelector('.mw-editor-head'),before=h.item();
  assert.equal(tools.open,false);
  for(const id of ['mw-edit-message','mw-save-message','mw-restore-original']){
   assert.equal(d.querySelectorAll('#'+id).length,1,id+' has one canonical control');
   assert.equal(visible(h,h.q(id)),true,id+' is visible without opening Tools');
   assert.ok(head.contains(h.q(id)),id+' stays beside the working message');
  }
  for(const id of ['mw-version-history','message-save-as-template','mw-copy-email','message-generate']){
   assert.equal(d.querySelectorAll('#'+id).length,1,id+' has one canonical control');
   assert.ok(tools.contains(h.q(id)),id+' remains in optional tools');
   assert.equal(visible(h,h.q(id)),false,id+' is secondary');
  }
  assert.ok(head.compareDocumentPosition(h.q('outreach-email-subject'))&h.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(head.compareDocumentPosition(h.q('outreach-email-body'))&h.w.Node.DOCUMENT_POSITION_FOLLOWING);
  tools.open=true;tools.open=false;
  assert.deepEqual(h.item(),before);assert.equal(h.requests.length,0,'disclosure changes do not generate or save');
 }finally{h.w.close();}
});

test('Edit and Cancel use the visible canonical toolbar and preserve exact draft text',()=>{
 const h=mounted({selected:'professional'});try{
  withStyles(h);const body=h.q('outreach-email-body'),subject=h.q('outreach-email-subject'),before={body:body.value,subject:subject.value};
  assert.equal(visible(h,h.q('mw-edit-message')),true);h.q('mw-edit-message').click();
  assert.equal(body.readOnly,false);assert.equal(visible(h,h.q('mw-cancel-edit')),true);
  assert.equal(visible(h,h.q('mw-save-message')),true);assert.equal(h.q('mw-save-message').disabled,false);
  body.value='  Deliberate draft\n\nExact spacing  ';subject.value='Edited subject';body.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  assert.equal(h.q('mw-tools-drawer').open,false);h.q('mw-cancel-edit').click();
  assert.equal(body.value,before.body);assert.equal(subject.value,before.subject);assert.equal(body.readOnly,true);
  assert.equal(visible(h,h.q('mw-cancel-edit')),false);assert.equal(visible(h,h.q('mw-edit-message')),true);assert.equal(h.requests.length,0);
 }finally{h.w.close();}
});

test('Reset is visible outside the hidden assistant and restores the first tailored working copy',()=>{
 const h=mounted({selected:'professional'});try{
  withStyles(h);h.w.upsertItem(E.apply(h.item(),{subject:'Manual subject',message:'Manual working alternative'},{origin:'manual'}));h.w.renderAll();
  assert.equal(visible(h,h.q('mw-restore-original')),true);assert.equal(h.q('mw-restore-original').disabled,false);
  h.q('mw-restore-original').click();
  assert.deepEqual(E.workingDraft(h.item()),h.before);assert.equal(h.q('mw-tools-drawer').open,false);assert.equal(h.requests.length,0);
 }finally{h.w.close();}
});

test('failure exposes Retry beside the preserved editor and respects pending-work gates',()=>{
 const h=mounted({selected:'professional'});try{
  withStyles(h);const before=h.q('outreach-email-body').value;
  show(h,{generationError:true,styleFeedback:{state:'failed',style:'curiosity'}});
  assert.equal(visible(h,h.q('mw-retry-message')),true);assert.equal(h.q('mw-retry-message').disabled,false);
  assert.ok(h.w.document.querySelector('.mw-editor-head').contains(h.q('mw-retry-message')));
  assert.equal(h.q('mw-tools-drawer').open,false);assert.equal(h.q('outreach-email-body').value,before);
  show(h,{generationError:true,busy:true});assert.equal(visible(h,h.q('mw-retry-message')),true);assert.equal(h.q('mw-retry-message').disabled,true);
  show(h);assert.equal(visible(h,h.q('mw-retry-message')),false);
 }finally{h.w.close();}
});

test('remount retains toolbar identities and listeners without opening optional tools',()=>{
 const h=mounted({selected:'professional'});try{
  withStyles(h);const ids=['mw-edit-message','mw-save-message','mw-cancel-edit','mw-restore-original','mw-retry-message','outreach-email-subject','outreach-email-body'];
  const controls=ids.map(id=>h.q(id));let edits=0;h.q('mw-edit-message').addEventListener('click',()=>edits++);
  assert.equal(h.w.LeadIntelMessageWorkspace.mount(h.w.document),false);
  for(const [index,id] of ids.entries()){assert.equal(h.q(id),controls[index]);assert.equal(h.w.document.querySelectorAll('#'+id).length,1);}
  h.q('mw-edit-message').click();assert.equal(edits,1);assert.equal(h.q('outreach-email-body').readOnly,false);assert.equal(h.q('mw-tools-drawer').open,false);
 }finally{h.w.close();}
});
