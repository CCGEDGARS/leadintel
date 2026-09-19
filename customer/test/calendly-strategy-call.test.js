const test=require('node:test');
const assert=require('node:assert/strict');
const Outreach=require('../outreach-engine.js');

const dossier={company:'Example Manufacturing',domain:'example.com',market:'Sweden',recommendedOffer:'production optimization',matchedSignals:[{name:'Factory expansion'}],evidence:[]};
const contact={firstName:'Anna'};
const profile={companyName:'LeadIntel',priorityOffers:'production optimization'};

test('generated English email and follow-up use the configured strategy call as the conversion CTA',()=>{
  const drafts=Outreach.buildOutreachDrafts(dossier,contact,profile,'consultative','en');
  assert.match(drafts.emailBody,/https:\/\/calendly\.com\/edgars-7go\/strategy-call-2/);
  assert.match(drafts.followUp,/https:\/\/calendly\.com\/edgars-7go\/strategy-call-2/);
});

test('generated Latvian email and follow-up use the same strategy call URL',()=>{
  const drafts=Outreach.buildOutreachDrafts(dossier,contact,profile,'consultative','lv');
  assert.match(drafts.emailBody,/https:\/\/calendly\.com\/edgars-7go\/strategy-call-2/);
  assert.match(drafts.followUp,/https:\/\/calendly\.com\/edgars-7go\/strategy-call-2/);
});
