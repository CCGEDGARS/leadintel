const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
test('a restored saved draft cannot retain the initial no-message caption',()=>{
 const h=mounted({selected:'professional'});try{
  h.w.upsertItem({...h.item(),messageStudioDraft:{...h.item().messageStudioDraft,status:'Ready to generate. No message has been created yet.'}});h.w.renderAll();
  assert.match(h.q('message-generation-status').textContent,/saved to CRM/i);
  assert.equal(h.q('outreach-email-body').value,h.before.message);
 }finally{h.w.close();}
});
test('an unsaved edit cannot inherit the previous saved caption',()=>{
 const h=mounted({selected:'professional'});try{
  h.w.upsertItem({...h.item(),drafts:{...h.item().drafts,emailBody:'Newer unsaved wording'},messageStudioDraft:{...h.item().messageStudioDraft,status:'Draft saved to CRM.'}});h.w.renderAll();
  assert.match(h.q('message-generation-status').textContent,/unsaved changes/i);
  assert.equal(h.q('outreach-email-body').value,'Newer unsaved wording');
 }finally{h.w.close();}
});
