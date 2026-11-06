const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {mounted}=require('./helpers/message-runtime.js');
test('real Messages layout places phone editor outside the hidden email draft card',()=>{
 const h=mounted({runtimeSetup:fs.readFileSync(require.resolve('../channel-scripts.js'),'utf8')+`\nLeadIntelServerBridge.session.user.id='user';handoffContact.contact.id='contact';handoffContact.contact.company_id='company';installChannelScripts();`});
 try{const editor=h.q('sc-phone-editor');assert.ok(editor);assert.equal(editor.parentElement.className,'mw-editor');assert.equal(editor.closest('.outreach-drafts'),null);assert.equal(editor.closest('details'),null);assert.ok(editor.querySelector('[aria-label="Phone script"]'));assert.ok([...editor.querySelectorAll('button')].some(b=>b.textContent==='Save'));}finally{h.w.close();}
});
test('phone readiness does not inherit missing email subject or Calendly requirements',()=>{
 const h=mounted();try{
 h.w.LeadIntelPageQuality=require('../page-quality.js');
 h.w.LeadIntelChannelWorkspace={phoneActive:()=>true,phoneReadiness:()=>({loaded:true,busy:false,dirty:true,hasDraft:true,missing:[]}),context:()=>({companyId:'company',contactId:'contact'}),draft:()=>({subject:'',message:'Hello Alex. [Answers]'})};
 const context=h.w.messageQualityContext();assert.equal(context.inputs.channel,'phone');assert.ok(context.checks.every(row=>!['required-fields','placeholders-resolved','message-present'].includes(row.id)));assert.equal(context.checks.find(row=>row.id==='phone-facts').status,'pass');
 }finally{h.w.close();}
});
