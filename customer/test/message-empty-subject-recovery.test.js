const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio.js'),E=require('../message-editor.js');
const {mounted}=require('./helpers/message-runtime.js');
test('an approved draft can be created with supported subjects when optional project subjects are unavailable',()=>{
 const studio=S.normalize({mode:'professional',essentials:{sender:'Robin Lane',company:'North Works',offer:'steel manufacturing and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify delivery',difference:'Our team supports industrial projects.',approach:'Project delivery',meetingValue:'project lessons',calendly:'https://calendly.com/north/intro',nextAction:'Choose a time'}});
 const context={channel:'email',firstName:'Alex',buyerName:'Alex Buyer',buyerCompany:'Buyer',buyerRole:'Procurement Director'};
 const audit=S.subjectAudit(studio,context);assert.ok(audit.ready>0&&audit.ready<5);
 const draft=E.tailor(studio,context);assert.ok(audit.rows.some(row=>row.ready&&row.subject===draft.subject));
 assert.doesNotThrow(()=>E.validateCoreDraft(studio,context,draft));
 assert.throws(()=>E.validateCoreDraft(studio,context,{...draft,message:draft.message+' invented claim'}),/differs/);
});
test('a blank new recipient has no falsely applied or selected style and reopening preserves explicit creation',()=>{
 const h=mounted({selected:'professional'});try{
 const item=h.item();item.drafts.emailSubject='';item.drafts.emailBody='';delete item.messageStudioDraft;h.w.upsertItem(item);h.w.renderAll();
 assert.equal(h.w.document.querySelectorAll('[data-writing-style][aria-pressed="true"]').length,0);
 h.w.prepareMessageOnOpen();assert.equal(h.item().drafts.emailBody,'');
 h.w.document.querySelector('[data-writing-style="professional"]').click();
 assert.ok(h.item().drafts.emailBody.trim());assert.equal(h.q('mw-empty').hidden,true);
 assert.equal(h.w.document.querySelector('[data-writing-style="professional"]').getAttribute('aria-pressed'),'true');
 }finally{h.w.close();}
});
