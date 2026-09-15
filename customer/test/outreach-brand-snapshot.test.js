const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Outreach=require('../outreach-engine.js');
const Delivery=require('../delivery-engine.js');

const readyIdentity={
  schemaVersion:1,
  status:'ready',
  revision:7,
  companyDisplayName:'SellerCo',
  senderName:'Anna Seller',
  senderTitle:'Commercial Director',
  website:'https://seller.example/',
  phone:'+371 20000000',
  linkedinUrl:'https://www.linkedin.com/in/anna-seller',
  primaryColor:'#0B5D4B',
  signatureText:'Kind regards,',
  legalFooter:'Confidential commercial communication.',
  postalAddress:'Riga, Latvia',
  assets:{
    logo:{id:'logo_7',url:'https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/logo_7',mimeType:'image/png',width:320,height:80,altText:'SellerCo logo',updatedAt:'2026-09-15T20:00:00.000Z'},
    headshot:null,
    banner:null
  },
  options:{includeLogo:true,includeHeadshot:false,includeBanner:false},
  updatedAt:'2026-09-15T20:00:00.000Z'
};

function item(body='Hello buyer,\n\nUseful context.\n\nBest,\n[Your name]\nSellerCo'){
  return {
    domain:'buyer.example',
    company:'Buyer AB',
    dossier:{company:'Buyer AB',domain:'buyer.example',people:[],evidence:[],hypotheses:[]},
    drafts:{
      tone:'consultative',
      emailSubject:'A grounded subject',
      emailBody:body,
      linkedinMessage:'A grounded LinkedIn message',
      callOpener:'Call opener',
      followUp:'Follow-up',
      objectionReply:'Reply'
    },
    approved:false
  };
}

test('approval freezes the valid ready identity revision and resolved managed assets',()=>{
  const source=structuredClone(readyIdentity);
  const approved=Outreach.approveOutreachItem(item(),item().drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:source});
  assert.equal(approved.approved,true);
  assert.equal(approved.brandSnapshot.revision,7);
  assert.equal(approved.brandSnapshot.assets.logo.id,'logo_7');
  assert.ok(Object.isFrozen(approved.brandSnapshot));
  assert.ok(Object.isFrozen(approved.brandSnapshot.assets));

  source.senderName='Changed Later';
  source.assets.logo.id='changed-later';
  assert.equal(approved.brandSnapshot.senderName,'Anna Seller');
  assert.equal(approved.brandSnapshot.assets.logo.id,'logo_7');
});

test('approved preview and manual-send payload are exactly the same frozen rendering',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const preview=Outreach.renderApprovedEmail(approved);
  const send=Outreach.buildApprovedSendPayload(approved,'buyer@example.com');
  assert.deepEqual(
    {subject:send.subject,textBody:send.textBody,htmlBody:send.htmlBody},
    preview
  );
  assert.equal(send.body,preview.textBody,'legacy body must carry the exact rendered text fallback');
  assert.equal(approved.drafts.emailBody,preview.textBody,'existing explicit manual-send paths must receive the frozen text rendering');
  const compose=new URL(Delivery.buildGmailComposeUrl(approved,'buyer@example.com'));
  assert.equal(compose.searchParams.get('body'),preview.textBody);
  assert.match(preview.htmlBody,/SellerCo logo/);
  assert.match(preview.textBody,/Anna Seller/);
  assert.doesNotMatch(preview.textBody,/\[Your name\]/);

  const later=structuredClone(readyIdentity);
  later.senderName='Different Step 1 Sender';
  later.revision=8;
  assert.deepEqual(Outreach.renderApprovedEmail(approved),preview,'later Step 1 changes must not affect the approved rendering');
});

test('explicit refresh invalidates approval and removes the frozen delivery rendering',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const refreshed=Outreach.invalidateOutreachApproval(approved);
  assert.equal(refreshed.approved,false);
  assert.equal(refreshed.approvedAt,'');
  assert.equal(refreshed.brandSnapshot,null);
  assert.equal(refreshed.approvedEmail,null);
  assert.equal(Outreach.renderApprovedEmail(refreshed),null);
  assert.equal(Outreach.buildApprovedSendPayload(refreshed,'buyer@example.com'),null);
});

test('legacy and non-ready identities preserve the approved plain-text email',()=>{
  const draft=item('Customer-edited body with [Your name] kept literally.');
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:{...readyIdentity,status:'draft'}});
  const preview=Outreach.renderApprovedEmail(approved);
  assert.equal(approved.approved,true);
  assert.equal(approved.brandSnapshot,null);
  assert.deepEqual(preview,{subject:'A grounded subject',textBody:'Customer-edited body with [Your name] kept literally.',htmlBody:null});
});

test('sender placeholder cleanup applies only to unchanged generated content',()=>{
  const generated=item();
  const generatedApproval=Outreach.approveOutreachItem(generated,generated.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  assert.doesNotMatch(generatedApproval.approvedSource.emailBody,/\[Your name\]/);

  const edited={...generated.drafts,emailBody:'My deliberate customer copy says: keep [Your name] as an example.'};
  const editedApproval=Outreach.approveOutreachItem(generated,edited,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  assert.match(editedApproval.approvedSource.emailBody,/\[Your name\]/);
  assert.match(Outreach.renderApprovedEmail(editedApproval).textBody,/\[Your name\]/);
});

test('normalization restores a branded approved package from source plus snapshot, never stored HTML',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const tampered=structuredClone(approved);
  tampered.approvedEmail.htmlBody='<script>alert(1)</script>';
  const restored=Outreach.normalizeOutreachState({selectedDomain:'buyer.example',items:[tampered]}).items[0];
  assert.equal(restored.approved,true);
  assert.doesNotMatch(restored.approvedEmail.htmlBody,/<script/i);
  assert.deepEqual(Outreach.renderApprovedEmail(restored),restored.approvedEmail);
});

test('outreach UI snapshots Step 1 identity, preserves edit detection and invalidates approval on regeneration',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','outreach-ui.js'),'utf8');
  const discovery=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(source,/approveOutreachItem\(source,edited\.drafts,[\s\S]*brandIdentity:mainState\(\)\.brandIdentity/);
  assert.match(source,/regenerateDrafts\(\)[\s\S]*invalidateOutreachApproval\(current\)/);
  assert.match(source,/renderApprovedEmail\(item\)/);
  assert.match(source,/buildApprovedSendPayload\(item\)/);
  assert.doesNotMatch(source,/\.sendGmail\(|\.sendMicrosoftMail\(/,'Task 5 must not create an automatic delivery path');
  assert.match(discovery,/const OUTREACH_ASSET_VERSION="20260916-brand-outreach-v1";/);
  assert.match(discovery,/outreach-engine\.js\?v=\$\{OUTREACH_ASSET_VERSION\}/);
  assert.match(discovery,/outreach-ui\.js\?v=\$\{OUTREACH_ASSET_VERSION\}/);
  assert.match(html,/discovery-ui\.js\?v=20260916-brand-outreach-v1/);
});
