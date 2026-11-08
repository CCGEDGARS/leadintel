const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js'),E=require('../message-editor.js');
const snapshot=h=>JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'));
for(const operation of ['booking-change','save-core'])test(`${operation} saves entered meeting settings before rendering and survives reopen`,()=>{
 const h=mounted({selected:'professional'}),url='https://calendly.com/independent-seller/discussion',invitation='Arrange the scope discussion here: {{calendly}}';
 try{
  h.q('message-calendly').value=url;
  h.q('message-calendly').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  // Workspace/progress refreshes can render before the field loses focus.
  h.w.eval('renderAll()');
  if(operation==='save-core'){h.q('message-nextAction').value=invitation;h.q('message-save-core').click();}
  else h.q('message-calendly').dispatchEvent(new h.w.Event('change',{bubbles:true}));
  const saved=snapshot(h);
  assert.equal(saved.messageStudio.essentials.calendly,url);
  assert.equal(h.q('message-calendly').value,url);
  if(operation==='save-core')assert.equal(saved.messageStudio.essentials.nextAction,invitation);
  assert.deepEqual(E.workingDraft(h.item()),h.before,'changing settings preserves the current copy while preparation is pending');
  assert.equal(h.item().localizationApprovalBlocked,true);
  const reopened=mounted({selected:'professional',outreachSnapshot:saved});
  try{assert.equal(reopened.q('message-calendly').value,url);if(operation==='save-core')assert.equal(reopened.q('message-nextAction').value,invitation);}finally{reopened.w.close();}
 }finally{h.w.close();}
});
