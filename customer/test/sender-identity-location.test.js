const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const Studio=require('../message-studio.js');
const Location=require('../sender-identity-location.js');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('sender identity is absent from Setup and mounted once into Messages without losing its controls',()=>{
 const dom=new JSDOM(file('index.html'),{runScripts:'outside-only'});
 assert.equal(dom.window.document.querySelector('#step-1 #brand-identity'),null);
 const host=dom.window.document.querySelector('#brand-identity');
 assert.ok(host);
 const doc=dom.window.document;
 const destination=doc.createElement('section');destination.id='message-sender-identity';doc.body.append(destination);
 dom.window.eval(file('sender-identity-location.js'));
 const sender=host.querySelector('#brand-sender-name');sender.value='Existing sender';
 let inputCalls=0;sender.addEventListener('input',()=>inputCalls++);
 dom.window.LeadIntelSenderIdentityLocation.mount(doc);
 dom.window.LeadIntelSenderIdentityLocation.mount(doc);
 assert.equal(doc.querySelectorAll('#message-sender-identity #brand-identity').length,1);
 assert.equal(sender.value,'Existing sender');sender.dispatchEvent(new dom.window.Event('input'));
 assert.equal(inputCalls,1);
});

test('website lifecycle simplification never moves the Messages identity back to Setup',()=>{
 const dom=new JSDOM(file('index.html'),{runScripts:'outside-only'});
 const doc=dom.window.document,destination=doc.createElement('section');
 destination.id='message-sender-identity';doc.body.append(destination);
 dom.window.eval(file('sender-identity-location.js'));
 dom.window.LeadIntelSenderIdentityLocation.mount(doc);
 dom.window.eval(file('website-input-sync.js'));
 dom.window.LeadIntelWebsiteInputSync.simplifyStepOne();
 assert.equal(doc.querySelector('#brand-identity').parentElement,destination);
 assert.equal(doc.querySelector('#step-1 #brand-identity'),null);
});

test('workflow settings remain visible in Setup when sender identity is staged elsewhere',async()=>{
 const dom=new JSDOM(file('index.html'),{runScripts:'outside-only',url:'https://example.com/customer/'});
 dom.window.eval(file('outreach-automation-ui.js'));
 await dom.window.LeadIntelOutreachAutomationUI.refresh();
 assert.ok(dom.window.document.querySelector('#step-1 #delivery-setup'));
});

test('linked identity overrides stale message sender details, including deliberate clearing',()=>{
 for(const company of ['Law practice','Manufacturing team']){
  const main={senderIdentityVersion:1,brandIdentity:{senderName:'New sender',senderTitle:'Partner',companyDisplayName:company}};
  const saved={essentials:{sender:'Old sender',company:'Old company',calendly:'https://calendly.com/example/call'}};
  const current=Studio.foundation(saved,main);
  assert.equal(current.essentials.sender,'New sender');assert.equal(current.essentials.company,company);
  assert.equal(current.essentials.calendly,saved.essentials.calendly);
  assert.equal(Studio.foundation(saved,{...main,brandIdentity:{}}).essentials.sender,'');
 }
});

test('migration preserves existing brand data and runs once so deleted names do not return',()=>{
 const main={brandIdentity:{senderName:'Existing sender',phone:'+123',assets:{logo:{id:'retained'}}}};
 const defaults={sender:'Old message sender',company:'Legal firm',senderRole:'Partner'};
 assert.equal(Location.migrate(main,defaults),true);
 assert.equal(main.brandIdentity.senderName,'Existing sender');
 assert.equal(main.brandIdentity.companyDisplayName,'Legal firm');
 assert.equal(main.brandIdentity.assets.logo.id,'retained');
 main.brandIdentity.senderName='';
 assert.equal(Location.migrate(main,defaults),false);
 assert.equal(main.brandIdentity.senderName,'');
});
