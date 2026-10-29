const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{mounted}=require('./helpers/message-runtime.js');
test('Step 6 ends with meeting options, Tools, then its single main continuation action',()=>{
 const h=mounted({selected:'brutal'});try{
  const d=h.w.document,meeting=h.q('mw-meeting-options'),tools=h.q('mw-tools-drawer'),footer=d.querySelector('.mw-message-footer');
  assert.equal(meeting.nextElementSibling,tools);assert.equal(tools.nextElementSibling,footer);assert.equal(footer.parentElement.lastElementChild,footer);
  assert.equal(footer.querySelectorAll('#mw-add-flow').length,1);assert.equal(d.querySelector('.mw-editor-head button'),null);
  for(const id of ['mw-edit-message','mw-save-message','mw-version-history','message-save-as-template','mw-copy-email'])assert.ok(tools.contains(h.q(id)),id);
  assert.equal(h.q('mw-save-message').classList.contains('primary-btn'),false);
  const before=h.item(),text=h.q('outreach-email-body').value;tools.open=true;tools.open=false;
  assert.deepEqual(h.item(),before);assert.equal(h.q('outreach-email-body').value,text);assert.equal(h.requests.length,0,'opening Tools cannot generate, save or send');
 }finally{h.w.close();}
});
test('language, meeting and tools disclosures use matching shape and spacing',()=>{
 const h=mounted({selected:'professional'});try{
  const d=h.w.document,style=d.createElement('style');style.textContent=fs.readFileSync(require.resolve('../message-workspace.css'),'utf8');d.head.append(style);
  for(const id of ['mw-language-tools','mw-meeting-options','mw-tools-drawer'])assert.ok(h.q(id).classList.contains('mw-disclosure'),id);
  assert.equal(h.q('mw-language-tools').parentElement,h.q('mw-meeting-options').parentElement);
  const values=['mw-language-tools','mw-meeting-options','mw-tools-drawer'].map(id=>{const s=h.w.getComputedStyle(h.q(id));return [s.borderRadius,s.padding,s.border,s.minHeight,s.boxSizing];});
  assert.deepEqual(values[1],values[0]);assert.deepEqual(values[2],values[0]);
 }finally{h.w.close();}
});
test('Step 6 conflict controls open sync review instead of targeting hidden legacy recovery controls',()=>{
 const h=mounted({selected:'professional'});try{
  let opened=0;h.w.LeadIntelAttention={open(){opened++;}};h.w.LeadIntelServerBridge.conflict=true;
  h.w.eval('renderMessageWorkspace()');const before=h.item();
  h.q('mw-flow-resolve').click();assert.equal(opened,1);h.q('mw-resolve').click();assert.equal(opened,2);
  assert.deepEqual(h.item(),before);assert.equal(h.requests.length,0);
 }finally{h.w.close();}
});
