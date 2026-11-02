const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../outreach-engine'),E=require('../message-editor');
const copy=value=>JSON.parse(JSON.stringify(value));
const older='2026-11-01T10:00:00.000Z',newer='2026-11-02T10:00:00.000Z';

function saved({domain='factory.example',personId='p1',name='Alex Buyer',company='Factory Labs',body='Industrial automation scope.',stamp=older,channel='email'}={}){
 const draft={subject:channel==='email'?'Project scope':'',message:body,...(channel==='email'?{messageHtml:'<p>'+body+'</p>'}:{})};
 return {domain,company,selectedPersonId:personId,channel,dossier:{domain,company,people:[{id:personId,name}]},drafts:channel==='email'?{emailSubject:draft.subject,emailBody:body,emailBodyHtml:draft.messageHtml}:{linkedinMessage:body},messageStudioDraft:{editorOrigin:'manual',scriptSavedAt:stamp,savedDraft:draft,recipientIdentity:{version:1,personId,companyDomain:domain,name},languageVersions:{originalLanguage:'en',activeLanguage:'en',versions:{en:{...draft}}}}};
}

test('a newer acknowledged CRM save supersedes an unchanged acknowledged workspace save across industries',()=>{
 for(const seller of [{company:'Factory Labs',domain:'factory.example',body:'Industrial automation scope.'},{company:'Legal North',domain:'legal.example',body:'Commercial contract review scope.'}]){
  const local=O.normalizeOutreachState({items:[saved(seller)]}).items[0],remote=O.normalizeOutreachState({items:[saved({...seller,body:seller.body+' Revised.',stamp:newer})]}).items[0];
  const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(remote),seller.domain);
  const before=copy({local,restored});
  assert.equal(O.canReconcileSavedBuyerDraft(local),true);
  assert.equal(O.preferNewerSavedBuyerDraft(local,restored),true);
  assert.equal(O.preferNewerSavedBuyerDraft(restored,local),false);
  assert.deepEqual({local,restored},before);
 }
});

test('plain, formatted and LinkedIn save acknowledgements survive workspace and CRM serialization',()=>{
 for(const format of ['plain','formatted','linkedin']){
  const channel=format==='linkedin'?'linkedin':'email',local=saved({channel}),remote=saved({channel,stamp:newer});
  for(const item of [local,remote]){
   if(format==='plain')delete item.drafts.emailBodyHtml;
   if(format==='formatted')item.drafts.emailBodyHtml='<p><b>'+item.drafts.emailBody+'</b></p>';
   item.messageStudioDraft.savedDraft=channel==='linkedin'?{subject:'',message:item.drafts.linkedinMessage}:E.workingDraft(item);
  }
  const state=O.normalizeOutreachState(JSON.parse(JSON.stringify({items:[remote]}))),normalized=state.items[0];
  const snapshot=JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(normalized))),restored=O.restoreCrmScriptSnapshot(snapshot,remote.domain);
  const normalizedLocal=O.normalizeOutreachState({items:[local]}).items[0];
  assert.equal(E.savedDraft(restored),true,format);
  assert.equal(O.canReconcileSavedBuyerDraft(restored),true,format);
  assert.equal(O.preferNewerSavedBuyerDraft(normalizedLocal,restored),true,format);
  assert.deepEqual(restored.messageStudioDraft.savedDraft,normalized.messageStudioDraft.savedDraft);
  if(format==='formatted')assert.match(restored.drafts.emailBodyHtml,/<strong>/);
 }
});

test('an empty unprotected local draft may recover the caller-verified recipient save',()=>{
 const remote=saved({stamp:newer});
 for(const local of [null,{domain:remote.domain,selectedPersonId:'p1',channel:'email',drafts:{}}]){
  assert.equal(O.canReconcileSavedBuyerDraft(local),true);
  assert.equal(O.preferNewerSavedBuyerDraft(local,remote),true);
 }
 assert.equal(O.preferNewerSavedBuyerDraft(null,null),false);
});

test('subject, body, HTML and acknowledgement changes preserve unsaved local work',()=>{
 const mutations=[
  item=>item.drafts.emailSubject+=' ',
  item=>item.drafts.emailBody+=' Revised.',
  item=>item.drafts.emailBodyHtml='<p><strong>'+item.drafts.emailBody+'</strong></p>',
  item=>item.drafts.emailBody='',
  item=>delete item.messageStudioDraft.savedDraft,
  item=>delete item.messageStudioDraft.scriptSavedAt,
  item=>item.messageStudioDraft.scriptSavedAt='not a date',
  item=>item.messageStudioDraft.savePending=true
 ];
 for(const mutate of mutations){
  const local=saved();mutate(local);
  assert.equal(O.canReconcileSavedBuyerDraft(local),false);
  assert.equal(O.preferNewerSavedBuyerDraft(local,saved({stamp:newer})),false);
 }
 const typedSubject={domain:'factory.example',selectedPersonId:'p1',channel:'email',drafts:{emailSubject:'My unsaved subject'},messageStudioDraft:{editorOrigin:'manual'}};
 assert.equal(O.canReconcileSavedBuyerDraft(typedSubject),false);
});

test('approved, contacted, flow and active translated copies stay protected',()=>{
 const mutations=[
  item=>item.approved=true,
  item=>item.reapprovalRequired=true,
  item=>item.approvedAt=older,
  item=>item.contactedAt=older,
  item=>item.linkedinSentAt=older,
  item=>item.messageStudioDraft.flowMembership={status:'ready'},
  item=>item.messageStudioDraft.flowPlans=[{id:'scheduled-review'}],
  item=>item.messageStudioDraft.languageVersions.activeLanguage='ru'
 ];
 for(const mutate of mutations){
  const local=saved();mutate(local);
  assert.equal(O.canReconcileSavedBuyerDraft(local),false);
  assert.equal(O.preferNewerSavedBuyerDraft(local,saved({stamp:newer})),false);
 }
});

test('remote saves need their own exact acknowledgement and a strictly newer valid timestamp',()=>{
 const mutations=[
  item=>delete item.messageStudioDraft.savedDraft,
  item=>delete item.messageStudioDraft.scriptSavedAt,
  item=>item.messageStudioDraft.scriptSavedAt='invalid',
  item=>item.messageStudioDraft.scriptSavedAt=older,
  item=>item.messageStudioDraft.savePending=true,
  item=>item.drafts.emailSubject+=' Changed',
  item=>item.drafts.emailBody+=' Changed',
  item=>item.drafts.emailBodyHtml='<p><em>'+item.drafts.emailBody+'</em></p>'
 ];
 for(const mutate of mutations){const remote=saved({stamp:newer});mutate(remote);assert.equal(O.preferNewerSavedBuyerDraft(saved(),remote),false);}
});

test('domain, buyer, channel, active language, workspace and recipient identity mismatches fail closed',()=>{
 const mutations=[
  item=>item.domain='other.example',
  item=>item.selectedPersonId='p2',
  item=>item.channel='linkedin',
  item=>item.messageStudioDraft.languageVersions.activeLanguage='lv',
  item=>item.workspaceId='w2',
  item=>item.messageStudioDraft.recipientIdentity.name='Different Buyer',
  item=>item.messageStudioDraft.recipientIdentity.personId='p2',
  item=>item.messageStudioDraft.recipientIdentity.companyDomain='other.example',
  item=>delete item.messageStudioDraft.recipientIdentity
 ];
 for(const mutate of mutations){
  const local={...saved(),workspaceId:'w1'},remote={...saved({stamp:newer}),workspaceId:'w1'};mutate(remote);
  assert.equal(O.preferNewerSavedBuyerDraft(local,remote),false);
 }
});

test('LinkedIn and native non-English saves reconcile only within their exact channel and language',()=>{
 const local=saved({channel:'linkedin'}),remote=saved({channel:'linkedin',body:'Updated direct message.',stamp:newer});
 assert.equal(O.preferNewerSavedBuyerDraft(local,remote),true);
 for(const item of [local,remote])item.messageStudioDraft.languageVersions={originalLanguage:'ru',activeLanguage:'ru',versions:{}};
 assert.equal(O.canReconcileSavedBuyerDraft(local),true);
 assert.equal(O.preferNewerSavedBuyerDraft(local,remote),true);
 remote.messageStudioDraft.languageVersions.activeLanguage='en';
 assert.equal(O.preferNewerSavedBuyerDraft(local,remote),false);
});
