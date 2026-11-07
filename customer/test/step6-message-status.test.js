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

test('many unresolved brackets have a compact status and a complete accessible review list',()=>{
 const h=mounted({selected:'professional'});try{
  const values=['Project phase','Project location','Case result','Reference date','Agreed capacity'],body=values.map(v=>'['+v+']').join(' '),item=h.item();
  h.w.upsertItem({...item,drafts:{...item.drafts,emailBody:body},messageStudioDraft:{...item.messageStudioDraft,editorOrigin:'manual'}});h.w.renderAll();
  assert.match(h.q('mw-updating-notice').textContent,/5 details still need review/);assert.ok(h.q('mw-updating-notice').textContent.length<100);assert.equal(h.q('mw-missing-facts').hidden,false);
  assert.deepEqual([...h.q('mw-missing-facts-list').children].map(li=>li.textContent),values);
  h.q('mw-missing-facts').open=true;h.w.renderAll();assert.equal(h.q('mw-missing-facts').open,true);assert.equal(h.q('mw-save-message').disabled,false);assert.equal(h.q('approve-outreach').disabled,true);
 }finally{h.w.close();}
});
