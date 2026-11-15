const test=require('node:test'),assert=require('node:assert/strict');
const Brand=require('../brand-identity.js'),Outreach=require('../outreach-engine.js');
const legacy=require('./fixtures/legacy-branded-signature-approval.json');
const identity=(senderName='Robin Lane',companyDisplayName='North Works')=>({status:'ready',revision:3,senderName,companyDisplayName,email:'hello@seller.example',website:'https://seller.example/',updatedAt:'2026-11-01T10:00:00.000Z'});
const body=b=>'Hi Alex,\n\nCould we discuss the drawings?\n\nBest regards,\n'+b.senderName+'\n'+b.companyDisplayName;
const occurrences=(text,value)=>text.split(value).length-1;

test('new rendering snapshots retain the exact authored closing and add each identity only once',()=>{
 for(const b of [identity(),identity('Elīna Ozola','Baltic Makers')]){
  const message=body(b),html='<p>Hi Alex,</p><p>Could we discuss the drawings?</p><p>Best regards,<br>'+b.senderName+'<br>'+b.companyDisplayName+'</p>';
  const snapshot=Brand.snapshot(b,{emailRenderVersion:2});assert.equal(snapshot.emailRenderVersion,2);
  const rendered=Brand.renderEmail({subject:'Drawings',bodyText:message,bodyHtml:html,brandSnapshot:snapshot});
  assert.equal(rendered.textBody,message+'\n\n'+b.email+'\n'+b.website);
  assert.ok(rendered.htmlBody.includes(html),'the authored rich-text body remains exact');
  for(const value of [b.senderName,b.companyDisplayName]){assert.equal(occurrences(rendered.textBody,value),1);assert.equal(occurrences(rendered.htmlBody,value),1);}
  assert.ok(rendered.htmlBody.includes('mailto:'+b.email));
 }
});

test('body mentions and another person’s closing do not suppress the sender footer',()=>{
 const b=identity(),snapshot=Brand.snapshot(b,{emailRenderVersion:2});
 for(const message of ['Robin Lane at North Works can review this.','Best regards,\nAlex Buyer\nBuyer Company']){
  const rendered=Brand.renderEmail({bodyText:message,brandSnapshot:snapshot});
  assert.equal(rendered.textBody,message+'\n\n'+[b.senderName,b.companyDisplayName,b.email,b.website].join('\n'));
 }
});

test('event closings that already contain contact details add only the missing contact fields',()=>{
 const b=identity(),message=body(b)+'\n'+b.email;
 const rendered=Brand.renderEmail({bodyText:message,brandSnapshot:Brand.snapshot(b,{emailRenderVersion:2})});
 assert.equal(rendered.textBody,message+'\n\n'+b.website);assert.equal(occurrences(rendered.htmlBody,b.email),1);assert.equal(occurrences(rendered.htmlBody,b.senderName),1);
 const complete={...b,phone:'+371 20000000',linkedinUrl:'https://www.linkedin.com/in/seller',postalAddress:'Factory Road\nRiga'},all=body(complete)+'\n'+[complete.email,complete.phone,complete.website,complete.linkedinUrl,complete.postalAddress].join('\n');
 assert.equal(Brand.renderEmail({bodyText:all,brandSnapshot:Brand.snapshot(complete,{emailRenderVersion:2})}).textBody,all);
});

test('signature roles and explicit custom text remain available while an empty added footer is omitted',()=>{
 const b={...identity(),senderTitle:'Project Manager',signatureText:'Available Monday to Friday'},message='Hello\n\nBest regards,\n'+b.senderName+'\n'+b.senderTitle+'\n'+b.companyDisplayName;
 const rendered=Brand.renderEmail({bodyText:message,brandSnapshot:Brand.snapshot(b,{emailRenderVersion:2})});
 assert.equal(rendered.textBody,message+'\n\n'+[b.signatureText,b.email,b.website].join('\n'));
 assert.equal(occurrences(rendered.htmlBody,b.senderTitle),1);
 const minimal={...identity(),email:'',website:''},plain=body(minimal),empty=Brand.renderEmail({bodyText:plain,brandSnapshot:Brand.snapshot(minimal,{emailRenderVersion:2})});
 assert.equal(empty.textBody,plain);assert.doesNotMatch(empty.htmlBody,/border-top:2px/);
});

test('legacy approved bytes survive normalization without adopting a new rendering version',()=>{
 const original=structuredClone(legacy.item),restored=Outreach.normalizeOutreachState({items:[original]}).items[0];
 assert.equal(original.brandSnapshot.emailRenderVersion,undefined);assert.equal(restored.brandSnapshot.emailRenderVersion,undefined);
 assert.equal(Outreach.approvalCurrent(restored),true);assert.deepEqual(Outreach.renderApprovedEmail(restored),legacy.email);
});

test('new approvals bind the new signature rendering to their immutable snapshot and survive reopening',()=>{
 const draft=structuredClone(legacy.item);draft.approved=false;
 const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-11-15T20:00:00.000Z',{brandIdentity:draft.brandSnapshot});
 assert.equal(approved.brandSnapshot.emailRenderVersion,2);assert.equal(approved.approvedSource.emailBody,draft.drafts.emailBody);
 assert.equal(occurrences(Outreach.renderApprovedEmail(approved).textBody,approved.brandSnapshot.senderName),1);
 const restored=Outreach.normalizeOutreachState({items:[JSON.parse(JSON.stringify(approved))]}).items[0];
 assert.equal(Outreach.approvalCurrent(restored),true);assert.deepEqual(Outreach.renderApprovedEmail(restored),approved.approvedEmail);
 const changed=structuredClone(approved);delete changed.brandSnapshot.emailRenderVersion;
 assert.equal(Outreach.approvalCurrent(changed),false,'changing render semantics requires explicit approval');
});

test('unsupported snapshot rendering versions cannot silently fall back to another approved output',()=>{
 const bad={...identity(),emailRenderVersion:99};assert.equal(Brand.validate(bad).valid,false);assert.throws(()=>Brand.snapshot(bad));
});
