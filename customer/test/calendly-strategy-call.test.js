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


test('workspace Settings exposes secure Calendly connect and disconnect controls',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const settings=fs.readFileSync(path.join(__dirname,'..','service-settings-extension.js'),'utf8');
  assert.match(settings,/data-integration="calendly"/);
  assert.match(settings,/\/api\/integrations\/calendly\/connect/);
  assert.match(settings,/\/api\/integrations\/calendly\/disconnect/);
  assert.match(settings,/type="password"/);
  assert.match(settings,/A confirmed booking stops follow-ups and advances the matching CRM company to Meeting/);
  assert.doesNotMatch(settings,/personal_access_token\s*[:=]\s*['"][^'"]+['"]/,'no Calendly token may be embedded in customer code');
});
