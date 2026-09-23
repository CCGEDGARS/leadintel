const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Outreach=require('../outreach-engine.js');
const Delivery=require('../delivery-engine.js');
const LOGO_ID='l'.repeat(43);

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
    logo:{id:LOGO_ID,url:`https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${LOGO_ID}`,mimeType:'image/png',width:320,height:80,altText:'SellerCo logo',updatedAt:'2026-09-15T20:00:00.000Z'},
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
    approved:false,
    campaignScenario:{id:'core',summary:'Default campaign',language:'en',resolvedLanguage:'en',languageSource:'manual'},
    localizationStatus:'native',
    localizationApprovalBlocked:false,
    localizationProvenance:{provider:'built-in',model:'LeadIntel native templates',language:'en',selectionSource:'manual'}
  };
}

function loadBrowserConsumer(filename,globals={}){
  const window={...globals,addEventListener(){}};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),{window,document,console,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}});
  return window;
}

test('approval freezes the valid ready identity revision and resolved managed assets',()=>{
  const source=structuredClone(readyIdentity);
  const approved=Outreach.approveOutreachItem(item(),item().drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:source});
  assert.equal(approved.approved,true);
  assert.equal(approved.brandSnapshot.revision,7);
  assert.equal(approved.brandSnapshot.assets.logo.id,LOGO_ID);
  assert.ok(Object.isFrozen(approved.brandSnapshot));
  assert.ok(Object.isFrozen(approved.brandSnapshot.assets));

  source.senderName='Changed Later';
  source.assets.logo.id='changed-later';
  assert.equal(approved.brandSnapshot.senderName,'Anna Seller');
  assert.equal(approved.brandSnapshot.assets.logo.id,LOGO_ID);
});

test('manual Gmail compose and Gmail/Microsoft API payloads ignore later draft mutations and use the frozen rendering',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const preview=Outreach.renderApprovedEmail(approved);
  const send=Outreach.buildApprovedSendPayload(approved,'buyer@example.com');
  assert.deepEqual(
    {subject:send.subject,textBody:send.textBody,htmlBody:send.htmlBody},
    preview
  );
  assert.equal(send.body,preview.textBody,'legacy body must carry the exact rendered text fallback');
  assert.equal(approved.drafts.emailBody,approved.approvedSource.emailBody,'approval must retain the plain approved source rather than cache rendered branding in drafts');
  approved.drafts.emailSubject='MUTATED SUBJECT';
  approved.drafts.emailBody='MUTATED BODY';
  const compose=new URL(Delivery.buildGmailComposeUrl(approved,'buyer@example.com'));
  assert.equal(compose.searchParams.get('su'),preview.subject);
  assert.equal(compose.searchParams.get('body'),preview.textBody);

  const production=loadBrowserConsumer('production-gmail-ui.js',{LeadIntelOutreach:Outreach,LeadIntelDelivery:Delivery}).LeadIntelProductionMail;
  assert.equal(typeof production?.buildProviderSendRequest,'function','production mailbox UI must expose the request builder used by both providers');
  for(const idempotencyKey of ['gmail-key','microsoft-key']){
    const request=production.buildProviderSendRequest(approved,'buyer@example.com',idempotencyKey);
    assert.deepEqual(
      {subject:request.subject,body:request.body,textBody:request.textBody,htmlBody:request.htmlBody},
      {subject:preview.subject,body:preview.textBody,textBody:preview.textBody,htmlBody:preview.htmlBody}
    );
    assert.equal(request.recipient,'buyer@example.com');
    assert.equal(request.domain,'buyer.example');
    assert.equal(request.idempotencyKey,idempotencyKey);
  }
  assert.match(preview.htmlBody,/SellerCo logo/);
  assert.match(preview.textBody,/Anna Seller/);
  assert.doesNotMatch(preview.textBody,/\[Your name\]/);

  const later=structuredClone(readyIdentity);
  later.senderName='Different Step 1 Sender';
  later.revision=8;
  assert.deepEqual(Outreach.renderApprovedEmail(approved),preview,'later Step 1 changes must not affect the approved rendering');
});

test('automatic handoff uses the frozen plain-text source and never queues snapshot branding',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const preview=Outreach.renderApprovedEmail(approved);
  approved.drafts.emailSubject='MUTATED AUTOMATION SUBJECT';
  approved.drafts.emailBody='MUTATED AUTOMATION BODY';

  const handoff=loadBrowserConsumer('outreach-automation-delivery-handoff.js').LeadIntelOutreachAutomationDeliveryHandoff;
  assert.equal(typeof handoff?.buildApprovedAutomationPackage,'function','automatic handoff must expose its real queue payload builder');
  const queued=handoff.buildApprovedAutomationPackage(approved,'buyer@example.com');
  assert.equal(queued.subject,approved.approvedSource.emailSubject);
  assert.equal(queued.body,approved.approvedSource.emailBody);
  assert.equal(queued.followup_body,approved.approvedSource.followUp);
  assert.notEqual(queued.body,preview.textBody);
  assert.doesNotMatch(queued.body,new RegExp(`Anna Seller|Confidential commercial communication|${LOGO_ID}`));
  assert.equal('htmlBody' in queued,false);
  assert.equal('brandSnapshot' in queued,false);
  assert.equal(queued.recipient,'buyer@example.com');
  assert.equal(queued.contact_identity,'buyer.example');
});

test('CRM sent activity records the frozen approved subject after drafts mutate',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  approved.drafts.emailSubject='MUTATED CRM SUBJECT';
  const activity=Delivery.buildSentCrmActivity(approved,{
    recipientEmail:'buyer@example.com',
    sentAt:'2026-09-15T21:05:00.000Z'
  },{
    id:'manual-send-buyer.example-1',
    channel:'gmail-compose',
    api:false
  });
  assert.equal(activity.subject,'A grounded subject');
  assert.equal(activity.id,'manual-send-buyer.example-1');
  assert.equal(activity.summary,'Email sent to buyer@example.com');
  assert.equal(activity.occurred_at,'2026-09-15T21:05:00.000Z');
  assert.deepEqual(activity.metadata,{recipient:'buyer@example.com',delivery_channel:'gmail-compose'});
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

test('corrupted persisted branded snapshots invalidate approval and block every delivery payload',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const corrupted=structuredClone(approved);
  corrupted.brandSnapshot.assets.logo.url='https://attacker.example/tracking.png';

  const restored=Outreach.normalizeOutreachState({selectedDomain:'buyer.example',items:[corrupted]}).items[0];
  assert.equal(restored.approved,false);
  assert.equal(restored.reapprovalRequired,true);
  assert.match(restored.error,/regenerate.*approve again/i);
  assert.equal(Outreach.renderApprovedEmail(restored),null);
  assert.equal(Outreach.buildApprovedSendPayload(restored,'buyer@example.com'),null);
  assert.equal(Delivery.buildGmailComposeUrl(restored,'buyer@example.com'),'');
  const production=loadBrowserConsumer('production-gmail-ui.js',{LeadIntelOutreach:Outreach,LeadIntelDelivery:Delivery}).LeadIntelProductionMail;
  assert.equal(production.buildProviderSendRequest(restored,'buyer@example.com','blocked-key'),null);

  const regenerated=Outreach.invalidateOutreachApproval(restored);
  const reapproved=Outreach.approveOutreachItem(regenerated,regenerated.drafts,'2026-09-16T08:00:00.000Z',{brandIdentity:readyIdentity});
  assert.equal(reapproved.approved,true);
  assert.equal(reapproved.reapprovalRequired,false);
  assert.notEqual(Outreach.buildApprovedSendPayload(reapproved,'buyer@example.com'),null);
});

test('missing branded snapshot provenance invalidates approval and blocks restore and direct send',()=>{
  const draft=item();
  const approved=Outreach.approveOutreachItem(draft,draft.drafts,'2026-09-15T21:00:00.000Z',{brandIdentity:readyIdentity});
  const corrupted=structuredClone(approved);
  corrupted.brandSnapshot=null;

  assert.equal(Outreach.renderApprovedEmail(corrupted),null,'direct consumers must not downgrade branded HTML to plain text');
  assert.equal(Outreach.buildApprovedSendPayload(corrupted,'buyer@example.com'),null);

  const restored=Outreach.normalizeOutreachState({selectedDomain:'buyer.example',items:[corrupted]}).items[0];
  assert.equal(restored.approved,false);
  assert.equal(restored.reapprovalRequired,true);
  assert.match(restored.error,/branded email.*regenerate.*approve again/i);
  assert.equal(restored.approvalBrandMode,'branded');
  assert.equal(Outreach.renderApprovedEmail(restored),null);
  assert.equal(Outreach.buildApprovedSendPayload(restored,'buyer@example.com'),null);
});

test('explicit branded approval provenance blocks downgrade even when cached HTML and snapshot are both missing',()=>{
  const corrupted=item('Previously branded body.');
  corrupted.approved=true;
  corrupted.approvedAt='2026-09-15T21:00:00.000Z';
  corrupted.approvalSchemaVersion=1;
  corrupted.approvalBrandMode='branded';
  corrupted.brandRevision=7;
  corrupted.brandSnapshot=null;
  corrupted.approvedEmail=null;
  const restored=Outreach.normalizeOutreachState({selectedDomain:'buyer.example',items:[corrupted]}).items[0];
  assert.equal(restored.approved,false);
  assert.equal(restored.reapprovalRequired,true);
  assert.equal(Outreach.buildApprovedSendPayload(restored,'buyer@example.com'),null);
});

test('legacy approved packages with no brand snapshot remain approved plain text',()=>{
  const legacy=item('Legacy approved plain text.');
  legacy.approved=true;
  legacy.approvedAt='2026-09-01T09:00:00.000Z';
  delete legacy.brandSnapshot;
  delete legacy.approvedSource;
  const restored=Outreach.normalizeOutreachState({selectedDomain:'buyer.example',items:[legacy]}).items[0];
  assert.equal(restored.approved,true);
  assert.equal(restored.reapprovalRequired,false);
  assert.deepEqual(Outreach.renderApprovedEmail(restored),{subject:'A grounded subject',textBody:'Legacy approved plain text.',htmlBody:null});
});

test('outreach UI snapshots Step 1 identity, preserves edit detection and invalidates approval on regeneration',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','outreach-ui.js'),'utf8');
  const discovery=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  const delivery=fs.readFileSync(path.join(__dirname,'..','delivery-ui.js'),'utf8');
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  const automationLoader=fs.readFileSync(path.join(__dirname,'..','outreach-automation-loader.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(source,/approveOutreachItem\(source,edited\.drafts,[\s\S]*brandIdentity:mainState\(\)\.brandIdentity/);
  assert.match(source,/regenerateDrafts\(\)[\s\S]*invalidateOutreachApproval\(current\)/);
  assert.match(source,/renderApprovedEmail\(item\)/);
  assert.match(source,/buildApprovedSendPayload\(item\)/);
  assert.match(source,/Reapproval required/);
  assert.match(source,/Regenerate & reapprove/);
  assert.match(source,/Sending is blocked/);
  assert.doesNotMatch(source,/\.sendGmail\(|\.sendMicrosoftMail\(/,'Task 5 must not create an automatic delivery path');
  assert.match(discovery,/const OUTREACH_ASSET_VERSION="20260924-friendly-workflow-labels-v1";/);
  assert.match(discovery,/outreach-engine\.js\?v=\$\{OUTREACH_ASSET_VERSION\}/);
  assert.match(discovery,/outreach-localization\.js\?v=\$\{OUTREACH_ASSET_VERSION\}/);
  assert.match(discovery,/outreach-ui\.js\?v=\$\{OUTREACH_ASSET_VERSION\}/);
  assert.match(source,/const LANGUAGE_ASSET_VERSION="20260924-friendly-workflow-labels-v1";/);
  assert.match(delivery,/const ASSET_VERSION="20260924-friendly-workflow-labels-v1";/);
  assert.match(processMap,/outreach-automation-loader\.js\?v=20260916-brand-outreach-v2/);
  assert.match(automationLoader,/outreach-automation-delivery-handoff\.js\?v=20260916-brand-outreach-v2/);
  assert.match(html,/process-map\.js\?v=20260924-friendly-workflow-labels-v1/);
  assert.match(html,/discovery-ui\.js\?v=20260924-friendly-workflow-labels-v1/);
});
