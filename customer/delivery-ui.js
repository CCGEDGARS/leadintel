import './test-email-ui.js?v=20261015-v1&app-dialogs=20261017-v1&recipient-gate=20261019-v1';
const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
  const ASSET_VERSION="20260924-workspace-content-english-v1";
const SERVER_BRIDGE_ASSET="server-bridge.js?v=20260925-apollo-buyer-search-v1&messages-reliability=20261031-v1&delivery-reliability=20261031-v1&step7-delivery=20261102-v1";
const asset=path=>`${path}?v=${ASSET_VERSION}&messages-reliability=20261031-v1&delivery-reliability=20261031-v1&step7-delivery=20261102-v1`;
const q=id=>document.getElementById(id);
let delivery=loadDelivery();
let manualDraftOperation=null;
let recordingOperation=null,syncOperation=null,historyOperation=null;
let deliverySyncError="",deliverySyncAcknowledged=false;
function contentLanguage(){return LeadIntelContentLanguage.workspaceContentLanguage();}

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return {};}}
function persistMainStep(step){const main=readJson(MAIN_STORAGE_KEY);main.step=Number(step)||1;localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(main));}
function loadDelivery(){return LeadIntelDelivery.normalizeDeliveryState(readJson(DELIVERY_STORAGE_KEY));}
window.addEventListener('leadintel:company-records-changed',event=>{if(event.detail?.workspaceId!==crmBridge()?.workspace?.id)return;delivery=loadDelivery();renderAll();});
function saveDelivery(){delivery=LeadIntelDelivery.normalizeDeliveryState(delivery);localStorage.setItem(DELIVERY_STORAGE_KEY,JSON.stringify(delivery));window.LeadIntelJourney?.refresh?.();}
function outreachState(){return LeadIntelOutreach.normalizeOutreachState(readJson(OUTREACH_STORAGE_KEY));}
function discoveryState(){return LeadIntelDiscovery.normalizeDiscoveryState(readJson(DISCOVERY_STORAGE_KEY));}
function saveDiscovery(value){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(LeadIntelDiscovery.normalizeDiscoveryState(value)));}
function approvedPackages(){return LeadIntelDelivery.approvedDeliveryPackages(outreachState(),readJson(MAIN_STORAGE_KEY));}
function pipeline(){return discoveryState().pipeline||[];}
function currentPackage(){const list=approvedPackages();if(delivery.selectedPackageKey)return list.find(item=>LeadIntelDelivery.packageKey(item)===delivery.selectedPackageKey)||null;const matching=list.filter(item=>item.domain===delivery.selectedDomain);return matching.length===1?matching[0]:null;}
function currentSendRecord(){const pkg=currentPackage();return pkg?LeadIntelDelivery.findDeliveryRecord(delivery,pkg,approvedBuyerEmail(pkg)):null;}
function currentRecord(){return delivery.opportunities.find(item=>item.id===delivery.selectedRecordId)||currentSendRecord();}
function approvedBuyerEmail(pkg){return LeadIntelDelivery.approvedRecipient(pkg,crmBridge()?.workspace?.id||'');}
function receiveMessageFlow(event){
 const detail=event.detail||{},pkg=approvedPackages().find(item=>item.domain===detail.domain&&item.selectedPersonId===detail.personId&&item.approvedAt===detail.approvedAt),entry=pkg?.messageStudioDraft?.flowMembership;
 if(detail.workspaceId!==crmBridge()?.workspace?.id||!pkg||pkg.channel!=='email'||pkg.selectedPersonId!==detail.personId||pkg.approvedAt!==detail.approvedAt||entry?.status!=='ready'||entry.workspaceId!==detail.workspaceId||entry.personId!==detail.personId||entry.subject!==pkg.drafts.emailSubject||entry.message!==pkg.drafts.emailBody)return;
 delivery.selectedDomain=pkg.domain;delivery.selectedPackageKey=LeadIntelDelivery.packageKey(pkg);delivery.selectedRecordId="";saveDelivery();showDeliveryStep();
}
function deliveryQualityContext(){
 const Q=window.LeadIntelPageQuality,make=Q.check,pkg=currentPackage(),record=currentRecord(),source=pkg?.approvedSource,expected=pkg?.dossier?.people?.find(person=>person.id===pkg.selectedPersonId),recipient=LeadIntelDelivery.normalizeEmail(q('delivery-recipient')?.value||record?.recipientEmail||expected?.email||''),email=approvedBuyerEmail(pkg);
 const checks=[
  make('approved-package','Approved email package selected',Boolean(pkg?.approved&&pkg.channel!=='linkedin'),'Select an approved email in Messages.',{actions:['send'],target:{step:6,id:'approve-outreach'}}),
  make('approval-current','Approval matches the exact message',Boolean(pkg&&LeadIntelOutreach.approvalCurrent?.(pkg)),'Review and approve the current saved message before sending.',{actions:['send'],target:{step:6,id:'approve-outreach'}}),
  make('recipient-match','Recipient matches the approved buyer',Boolean(recipient&&email&&recipient===email),'Use the email belonging to this approved buyer.',{actions:['send'],target:{id:'delivery-recipient'}}),
  make('not-sent','Duplicate delivery checked',!LeadIntelDelivery.findDeliveryRecord(delivery,pkg,recipient)?.sentAt&&!pendingManualSend(pkg,recipient),'This opportunity already has a recorded send. Review its delivery history.',{actions:['send'],target:{id:'delivery-sent-at'}})
 ];
 return {loaded:Boolean(q('step-7')),inputs:{pkg,record,recipient,domain:delivery.selectedDomain},checks};
}
function toast(message){const el=q("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600);}
function stageRank(stage){return LeadIntelDiscovery.CRM_STAGES.indexOf(stage);}
function updatePipelineStage(domain,target){
  const state=discoveryState();const item=state.pipeline.find(row=>row.domain===domain);if(!item)return false;
  const terminal=new Set(["Won","Lost"]);if(terminal.has(item.stage))return true;
  if(terminal.has(target)||stageRank(target)>stageRank(item.stage))item.stage=target;
  item.updatedAt=new Date().toISOString();saveDiscovery(state);return true;
}
function markOutreachContacted(pkg,at){
  const state=outreachState();const item=[...state.items,...Object.values(state.buyerDrafts||{})].find(row=>LeadIntelDelivery.packageKey(row)===LeadIntelDelivery.packageKey(pkg));if(!item)return;
  item.contactedAt=item.contactedAt||at;localStorage.setItem(OUTREACH_STORAGE_KEY,JSON.stringify(state));
}
function crmBridge(){return window.LeadIntelServerBridge||null;}
function crmAuthenticated(){const b=crmBridge();return Boolean(b?.session?.authenticated&&b?.workspace);}
function crmDomain(value){return window.LeadIntelCrm?.canonicalDomain(value)||String(value||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].toLowerCase();}
function crmActivityId(kind,domain,stamp){return `${kind}-${crmDomain(domain)}-${String(stamp||"")}`.replace(/[^A-Za-z0-9._:-]/g,"-").slice(0,128);}
function deliveryAccountContext(){const b=crmBridge();return JSON.stringify([b?.workspace?.id,b?.workspace?.role,b?.session?.user?.id,b?.session?.authenticated,b?.ready,b?.conflict,b?.resolvingSync,localStorage.getItem('leadintel_account_context_v1')||'',window.LeadIntelAccountCache?.current?.()??null]);}
function deliveryPackageContext(pkg){return JSON.stringify(pkg?[LeadIntelDelivery.packageKey(pkg),pkg.approved,pkg.reapprovalRequired,pkg.contextNeedsRefresh,pkg.localizationApprovalBlocked,pkg.approvalAuthority,pkg.approvedSource,pkg.drafts,pkg.dossier?.people?.find(p=>String(p.id)===String(pkg.selectedPersonId)),pkg.messageStudioDraft?.flowMembership]:null);}
function captureDeliveryAction({pkg=currentPackage(),recipient=q('delivery-recipient')?.value||'',requireSource=false}={}){const main=readJson(MAIN_STORAGE_KEY);return {requireSource,bridge:crmBridge(),cache:window.LeadIntelAccountCache,account:deliveryAccountContext(),pkg:deliveryPackageContext(pkg),recipient:LeadIntelDelivery.normalizeEmail(recipient),profile:JSON.stringify([main.profile,main.answers,main.website,main.brandIdentity]),selection:JSON.stringify([delivery.selectedDomain,delivery.selectedPackageKey,delivery.selectedRecordId])};}
function deliveryActionCurrent(owner){const main=readJson(MAIN_STORAGE_KEY);return owner&&(!owner.requireSource||LeadIntelOutreach.sourceAuthorityCurrent?.(currentPackage(),main,outreachState().messageStudio||{}))&&crmBridge()===owner.bridge&&crmAuthenticated()&&owner.bridge.ready!==false&&!owner.bridge.conflict&&!owner.bridge.resolvingSync&&window.LeadIntelAccountCache===owner.cache&&(!owner.cache?.current||owner.cache.current())&&deliveryAccountContext()===owner.account&&deliveryPackageContext(currentPackage())===owner.pkg&&LeadIntelDelivery.normalizeEmail(q('delivery-recipient')?.value||'')===owner.recipient&&JSON.stringify([main.profile,main.answers,main.website,main.brandIdentity])===owner.profile&&JSON.stringify([delivery.selectedDomain,delivery.selectedPackageKey,delivery.selectedRecordId])===owner.selection;}
function requireDeliveryAction(owner){if(!deliveryActionCurrent(owner))throw Object.assign(new Error('Message, recipient or account changed. Review the current saved message and retry.'),{code:'DELIVERY_CONTEXT_CHANGED'});}
async function durableCompany(domain,owner=captureDeliveryAction(),{create=true}={}){
  if(!crmAuthenticated())return {ok:false,error:'Sign in to verify the saved recipient and company.'};const b=owner.bridge,key=crmDomain(domain);requireDeliveryAction(owner);
  const listed=await b.listCrmCompanies({q:key,limit:20});requireDeliveryAction(owner);if(!listed.ok)return listed;
  const matches=(listed.companies||[]).filter(row=>crmDomain(row.normalized_domain||row.website)===key);if(matches.length>1)return {ok:false,error:'CRM company identity is ambiguous. Review this company.'};let company=matches[0]||null;
  if(!company&&!create)return {ok:false,error:'Saved CRM company not found. Restore it in CRM before recording more activity.'};
  if(!company){const local=pipeline().find(row=>crmDomain(row.domain||row.website)===key),payload=local&&window.LeadIntelCrm?.mapLocalPipelineItemToCrm(local);if(!payload)return {ok:false,error:'CRM company not found'};requireDeliveryAction(owner);const saved=await b.saveCrmCompany(payload);requireDeliveryAction(owner);if(!saved.ok)return saved;company=saved.company;}
  if(!company?.id||crmDomain(company.normalized_domain||company.website)!==key||company.workspace_id!==b.workspace.id)return {ok:false,error:'Saved company does not match this workspace and message.'};
  return {ok:true,company};
}
async function syncCrmDelivery(domain,{activity=null,stage='',markCustomer=false}={}){
  const owner=captureDeliveryAction();try{const resolved=await durableCompany(domain,owner);requireDeliveryAction(owner);if(!resolved.ok)return resolved;const b=owner.bridge,company=resolved.company;
  if(activity){
    const provider=activity.metadata?.delivery_channel?.replace('-api',''),key=activity.metadata?.idempotency_key;
    if(['gmail','microsoft'].includes(provider)&&key&&!activity.id.startsWith('delivery-')){
      // Old scoped receipts lack the canonical activity ID. Reuse an owned
      // retained receipt when visible, otherwise use the server's scoped hash.
      const detail=b.getCrmCompany?await b.getCrmCompany(company.id):null;requireDeliveryAction(owner);
      const existing=detail?.ok&&(detail.activities||[]).find(row=>row.workspace_id===b.workspace.id&&row.company_id===company.id&&(row.activity_type||row.type)==='email.sent'&&row.metadata?.idempotency_key===key&&row.channel===provider);
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([b.workspace.id,company.id,provider,key])));requireDeliveryAction(owner);
      activity={...activity,id:existing?.id||`delivery-${provider}-${Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')}`};
    }
    requireDeliveryAction(owner);const recorded=await b.recordCrmActivity(company.id,activity);requireDeliveryAction(owner);if(!recorded.ok)return recorded;}
  let latest=company;if(stage){const moved=await b.addCrmToPipeline(company.id,stage);requireDeliveryAction(owner);if(!moved.ok)return moved;latest=moved.company||latest;}
  if(markCustomer){const customer=await b.markCrmCustomer(company.id);requireDeliveryAction(owner);if(!customer.ok)return customer;latest=customer.company||latest;}
  window.dispatchEvent(new CustomEvent('leadintel:crm-changed',{detail:{company:latest}}));return {ok:true,company:latest};
  }catch(error){return {ok:false,error:error.message,code:error.code};}
}
async function outboundAllowed(domain,{owner=captureDeliveryAction(),pkg=currentPackage(),recipient=approvedBuyerEmail(pkg)}={}){
  const resolved=await durableCompany(domain,owner);requireDeliveryAction(owner);if(!resolved.ok)return resolved;
  if(['suppressed','archived'].includes(resolved.company?.lifecycle_status))return {ok:false,error:'Restore the CRM company before preparing outreach.'};
  const b=owner.bridge;if(!b.getCrmCompany||!window.LeadIntelContactPolicy?.accepted)return {ok:false,error:'Recipient verification is unavailable. Open Buyers to restore the contact checks.'};
  const detail=await b.getCrmCompany(resolved.company.id);requireDeliveryAction(owner);
  if(!detail?.ok||detail.company?.id!==resolved.company.id||detail.company?.workspace_id!==b.workspace.id||crmDomain(detail.company.normalized_domain||detail.company.website)!==crmDomain(domain)||['suppressed','archived'].includes(detail.company.lifecycle_status))return {ok:false,error:'Saved CRM company changed. Review it before preparing outreach.'};
  const person=pkg?.dossier?.people?.find(p=>String(p.id)===String(pkg.selectedPersonId)),identity=pkg?.approvalAuthority?.recipient,minimum=window.LeadIntelBuyerConfirmationPolicy?.level?.()||'provider_verified';
  const canonicalProfile=v=>String(v||'').replace(/^https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com/i,'https://linkedin.com').replace(/\/$/,'').toLowerCase(),name=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
  const consistent=c=>{const values=keys=>keys.map(key=>c[key]).filter(value=>typeof value==='string'&&value.trim()),same=(list,expected,normalize=name)=>list.every(value=>normalize(value)===normalize(expected));return same(values(['name','full_name','public_name','publicName']),identity?.name)&&same(values(['title','job_title','jobTitle','role']),identity?.title)&&same(values(['email','work_email','normalized_email']),recipient)&&same([...values(['linkedin_url','public_linkedin_url','linkedinUrl','linkedin','linkedinConfirmedUrl','publicLinkedinUrl']),c.profile?.linkedinUrl].filter(Boolean),identity?.linkedin,canonicalProfile)&&same([...values(['company','company_name','companyName','organization_name']),typeof c.organization==='string'?c.organization:c.organization?.name].filter(Boolean),identity?.company||pkg.company)&&(!detail.company.company_name||name(detail.company.company_name)===name(identity?.company||pkg.company));};
  const matches=(detail.contacts||[]).filter(c=>consistent(c)&&c.id&&c.company_id===resolved.company.id&&(!c.workspace_id||c.workspace_id===b.workspace.id)&&(!identity?.contactId||String(c.id)===String(identity.contactId))&&String(c.external_person_id||'')===String(pkg.selectedPersonId)&&name(c.name)===name(person?.publicName||person?.name)&&(!person?.title||name(c.title)===name(person.title))&&canonicalProfile(c.linkedin_url||c.public_linkedin_url||'')===canonicalProfile(identity?.linkedin||'')&&[c.linkedin_url,c.public_linkedin_url].filter(Boolean).every(p=>canonicalProfile(p)===canonicalProfile(identity?.linkedin||''))&&window.LeadIntelContactPolicy.accepted(c,domain,minimum)&&LeadIntelDelivery.normalizeEmail(c.normalized_email||c.work_email||c.email)===recipient);
  return matches.length===1?{ok:true,company:resolved.company,contact:matches[0]}:{ok:false,error:'The approved person and exact email are not currently confirmed in CRM. Review this buyer in Buyers.'};
}

function injectDeliveryUI(){
  if(!document.querySelector('link[data-leadintel-asset="delivery-css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href=asset("delivery.css")+"&delivery-experience=20261024-v1&delivery-spacing=20261024-v1";link.dataset.leadintelAsset="delivery-css";document.head.appendChild(link);}
  const draftPanel=document.querySelector("#step-6 .outreach-drafts");
  if(draftPanel&&!q("continue-to-delivery"))draftPanel.insertAdjacentHTML("afterend",'<div class="delivery-entry workflow-next-action"'+(q('step-6')?.classList.contains('message-workspace')?' hidden':'')+'><div><span class="eyebrow">Next step</span><strong>Deliver approved content and teach LeadIntel what actually converts.</strong></div><button class="primary-btn stage-next-action" id="continue-to-delivery" type="button" disabled aria-disabled="true">Approve a Message First</button></div>');
  const content=document.querySelector("main.content");
  if(content&&!q("step-7"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-7" data-step="7">
    <div class="profile-header delivery-header"><div><span class="eyebrow">Step 7 · Delivery</span><h1>Send, follow up and track results.</h1><p>Review your recipient, send your approved message, then manage replies and follow-ups here.</p></div><div class="profile-header-actions"><span class="profile-status" id="delivery-status">Ready</span><button class="secondary-btn small" id="back-to-outreach" type="button">← Messages</button></div></div>

    <section class="panel connector-card" id="delivery-mailbox"><div><span class="connector-badge"><i></i> Gmail Compose or Microsoft · Manual confirmation</span><h3>Your connected mailbox</h3><p>LeadIntel prepares delivery only from a human-approved campaign package. Connect Gmail or Microsoft mail to send the tailored message without leaving the workspace.</p></div><div class="warning-note"><strong>Production Gmail status loads here; Microsoft mail status appears beside it.</strong><br>Manual sends require an explicit action. Automatic sending applies only when activated and within the saved limits.</div></section>

    <section class="panel delivery-opportunity"><div class="section-title"><span class="eyebrow">Approved opportunity</span><h3>Choose who you are contacting</h3><p>Only message packages approved in Messages are eligible to send. If none exist yet, the controls remain safely disabled while this page stays available.</p></div><div class="delivery-control-grid"><label>Opportunity<select id="delivery-company-select"></select></label><label>Recipient email<input id="delivery-recipient" type="email" autocomplete="email" placeholder="buyer@company.com"></label><div class="delivery-buttons"><button class="secondary-btn" id="open-gmail-draft" type="button">Open Gmail draft ↗</button><button class="primary-btn" id="confirm-delivery-sent" type="button">Confirm sent ✓</button></div></div>
      <p class="delivery-compose-hint">Gmail draft uses plain text. A connected mailbox includes the approved formatting.</p><section class="delivery-preview" aria-labelledby="delivery-preview-heading"><h4 id="delivery-preview-heading">Approved message</h4><p id="delivery-preview-recipient"></p><strong id="delivery-preview-subject"></strong><div id="delivery-preview-body"></div><iframe id="delivery-preview-frame" title="Approved branded email preview" sandbox="" referrerpolicy="no-referrer" hidden></iframe></section><div class="delivery-sync"><p id="delivery-sync-status" role="status" aria-live="polite"></p><button class="secondary-btn small" id="delivery-retry-sync" type="button" hidden>Retry CRM sync</button><button class="secondary-btn small" id="delivery-refresh-history" type="button">Refresh saved history</button></div><div class="delivery-state-grid"><article><span>CRM stage</span><strong id="delivery-crm-stage">Ready for Outreach</strong></article><article><span>Sent</span><strong id="delivery-sent-at">Not yet</strong></article><article><span>Latest reply</span><strong id="delivery-reply-category">—</strong></article><article><span>Outcome</span><strong id="delivery-outcome">—</strong></article></div>
    </section>

    <section class="panel delivery-history"><label for="delivery-history-select">Sent email to track</label><select id="delivery-history-select" aria-describedby="delivery-history-hint"></select><p id="delivery-history-hint">Choose an earlier sent email to record its reply or outcome. Sending controls above use the selected approved message.</p></section><p class="delivery-recording-note" id="delivery-recording-note">Reply and outcome controls unlock after a confirmed send.</p><div class="reply-outcome-grid" id="delivery-outcomes"><section class="panel reply-panel"><div class="section-title"><span class="eyebrow">Reply intelligence</span><h3>Record the reply</h3><p id="delivery-reply-hint">Paste the customer response. LeadIntel classifies it conservatively and updates the pipeline automatically.</p></div><label class="delivery-field-label" for="reply-text">Customer reply</label><textarea id="reply-text" aria-describedby="delivery-reply-hint" rows="9" placeholder="Paste the customer reply here..."></textarea><div class="delivery-reply-footer"><div id="reply-classification" class="reply-classification" role="status" aria-live="polite">Classification: —</div><button class="primary-btn" id="record-reply" type="button">Record reply</button></div></section>
      <section class="panel"><div class="section-title"><span class="eyebrow">Commercial outcome</span><h3>Advance the real sales stage</h3><p>Use outcomes only when they actually happen. Later stages never move backwards.</p></div><div class="outcome-buttons"><button class="secondary-btn" data-outcome-stage="Meeting" type="button">Meeting</button><button class="secondary-btn" data-outcome-stage="Proposal" type="button">Proposal</button><button class="secondary-btn" data-outcome-stage="Won" type="button">Won</button><button class="secondary-btn" data-outcome-stage="Lost" type="button">Lost</button></div></section></div>

    <section class="panel"><div class="section-title"><span class="eyebrow">Activity history</span><h3>What actually happened</h3></div><div id="delivery-activity" class="activity-list"></div></section>

    <section class="panel delivery-learning"><div class="section-title"><span class="eyebrow">Results & insights</span><h3>Learn what starts conversations</h3><p>Track results by message style, market, offer and signal. Early suggestions start after three sends in a segment; they are exploratory, not proof of effectiveness.</p></div><div id="learning-scorecard" class="learning-scorecard"></div><div id="learning-segments" class="learning-segments"></div><div id="learning-recommendations" class="learning-recommendations"></div><div class="learning-actions"><button class="secondary-btn small" id="export-learning-data" type="button">Export learning data</button></div></section>
  </section>`);if(content&&!q("delivery-workflow-status"))content.querySelector("#step-7")?.insertAdjacentHTML("beforeend",'<div class="delivery-workflow-next"><div><span class="eyebrow">Next step</span><p id="delivery-next-hint" role="status"></p></div><button class="secondary-btn" id="delivery-workflow-status" type="button">Review messages →</button></div>');
}
function showStep(step){if(window.LeadIntelCustomerNavigation?.setStep&&window.LeadIntelCustomerNavigation.setStep(step)!==false){window.LeadIntelJourney?.refresh?.();return;}document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});window.LeadIntelJourney?.refresh?.();window.scrollTo({top:0,behavior:"smooth"});}
function ensureSelection(){const list=approvedPackages();if(!list.length)return;if(delivery.selectedPackageKey){const selected=list.find(item=>LeadIntelDelivery.packageKey(item)===delivery.selectedPackageKey);if(selected)delivery.selectedDomain=selected.domain;return;}const sameDomain=list.filter(item=>item.domain===delivery.selectedDomain),selected=sameDomain.length===1?sameDomain[0]:!delivery.selectedDomain&&list.length===1?list[0]:null;if(selected){delivery.selectedDomain=selected.domain;delivery.selectedPackageKey=LeadIntelDelivery.packageKey(selected);saveDelivery();}}

function showDeliveryStep(){persistMainStep(7);ensureSelection();renderAll();showStep(7);void refreshDeliveryHistory();}
function showOutreachStep(){if(window.LeadIntelJourney?.openWorkflowStage){window.LeadIntelJourney.openWorkflowStage(6);return;}persistMainStep(6);showStep(6);}

function deliverySubmission(pkg=currentPackage()){const b=crmBridge();return LeadIntelDelivery.readSubmissionReceipt?.(sessionStorage,b?.workspace?.id,b?.session?.user?.id,pkg,approvedBuyerEmail(pkg));}
function deliveryTrace(action){let op;try{op=window.LeadIntelReliabilityTrace?.begin(action);}catch{}return {checkpoint(phase,outcome){try{op?.checkpoint(phase,outcome);}catch{}},finish(outcome){try{op?.finish(outcome);}catch{}}};}
async function openGmailDraft(){const trace=deliveryTrace('delivery_manual');trace.checkpoint('request','pending');try{const result=await openGmailDraftOperation();trace.finish(result?'partial':'blocked');return result;}catch(error){trace.finish('fail');throw error;}}
async function openGmailDraftOperation(){
  const pkg=currentPackage();if(!pkg){toast('Profile, Strategy or message context may have changed. Review and approve the exact message in Messages.');return false;}
  if(deliverySubmission(pkg)||pendingManualSend(pkg,approvedBuyerEmail(pkg))){toast('Check the original provider submission in Delivery and your Sent folder before opening another draft.');return false;}
  if(manualDraftOperation&&deliveryActionCurrent(manualDraftOperation.owner)){toast('The approved recipient is being checked.');return false;}
  const owner=captureDeliveryAction({requireSource:true}),quality=window.LeadIntelPageQuality,ticket=quality?.capture('delivery','send');if(quality&&!ticket){toast(quality.getReport('delivery').message);return false;}
  const operation={owner};manualDraftOperation=operation;const button=q('open-gmail-draft');if(button)button.disabled=true;
  try{requireDeliveryAction(owner);const allowed=await outboundAllowed(pkg.domain,{owner,pkg,recipient:owner.recipient});requireDeliveryAction(owner);if(!allowed.ok){toast(allowed.error);return false;}if(quality&&!quality.current(ticket))throw new Error('Delivery selection changed. Review the current message.');
  const url=LeadIntelDelivery.buildGmailComposeUrl(pkg,owner.recipient);if(!url){toast('Review the exact approved recipient and message in Messages.');return false;}window.open(url,'_blank','noopener,noreferrer');toast('Gmail draft requested · check popup settings if it does not open. Send it there, then confirm here');return true;
  }catch(error){if(crmBridge()===owner.bridge&&deliveryAccountContext()===owner.account)toast(error.message);return false;}
  finally{if(manualDraftOperation===operation){manualDraftOperation=null;if(button&&crmBridge()===owner.bridge&&deliveryAccountContext()===owner.account)button.disabled=false;}}
}
async function runRecording(kind,work){
 if(recordingOperation){toast('The previous record is still being saved.');return {ok:false,pending:true};}
 const operation={kind,owner:captureDeliveryAction()};recordingOperation=operation;renderAll();
 try{return await work();}catch(error){if(deliveryActionCurrent(operation.owner))toast(error.message);return {ok:false,error:error.message,code:error.code};}
 finally{if(recordingOperation===operation){recordingOperation=null;if(crmBridge()===operation.owner.bridge&&deliveryAccountContext()===operation.owner.account)renderAll();}}
}
function pendingManualSend(pkg=currentPackage(),recipient=approvedBuyerEmail(pkg)){return pendingForAccount().some(entry=>entry.deferredSend&&entry.domain===pkg?.domain&&entry.activity?.metadata?.delivery_record?.record?.recipientEmail===recipient);}
async function checkManualDelivery(owner,domain,recipient){
 requireDeliveryAction(owner);if(!owner.bridge.checkDeliveryStatus)return {ok:false,error:'Delivery status verification is unavailable. Refresh and retry before recording a send.'};
 const result=await owner.bridge.checkDeliveryStatus({domain,recipient});requireDeliveryAction(owner);
 if(!result?.ok||result.workspace_id!==owner.bridge.workspace.id||result.domain!==domain||result.recipient!==recipient||typeof result.manual_record_allowed!=='boolean')return {ok:false,error:result?.error||'Delivery status could not be verified. Retry before recording a send.'};
 return result.manual_record_allowed?{ok:true}:{ok:false,code:'DELIVERY_RECONCILIATION_REQUIRED',submissionUncertain:true,error:'The original API delivery is still unconfirmed. Check and reconcile that submission before recording a manual send.'};
}
function pendingForAccount(){const b=crmBridge();return (delivery.pendingSync||[]).filter(row=>row.workspaceId===b?.workspace?.id&&row.userId===b?.session?.user?.id);}
function renderSync(){
 const status=q('delivery-sync-status'),retry=q('delivery-retry-sync'),refresh=q('delivery-refresh-history');if(!status)return;
 const count=pendingForAccount().length;status.textContent=syncOperation?'Saving records to CRM…':recordingOperation?.kind==='sent'?'Checking and recording delivery…':count?`${count} record${count===1?'':'s'} kept in this browser · CRM sync pending${deliverySyncError?' · '+deliverySyncError:''}`:historyOperation?'Checking saved CRM history…':deliverySyncError||(!delivery.opportunities.length?'No delivery recorded yet':deliverySyncAcknowledged?'Recorded history saved to CRM':'Delivery history · refresh to check CRM');
 if(retry){retry.hidden=!count;retry.disabled=Boolean(syncOperation||recordingOperation);}
 if(refresh)refresh.disabled=Boolean(historyOperation||syncOperation||recordingOperation);
}
function queueCrmRecord(record,activity,{stage='',markCustomer=false,deferredSend=false}={}){
 const b=crmBridge(),id=activity.id,entry={id,workspaceId:b.workspace.id,userId:b.session.user.id,domain:record.domain,stage,markCustomer,deferredSend,activity:{...activity,metadata:{...activity.metadata,delivery_record:LeadIntelDelivery.crmRecordSnapshot(record,b.workspace.id)}}};
 if(!(delivery.pendingSync||[]).some(row=>row.id===id))delivery.pendingSync.push(entry);saveDelivery();renderSync();return entry;
}
async function flushDeliverySync(){
 if(syncOperation)return {ok:false,pending:true};const owner=captureDeliveryAction();try{requireDeliveryAction(owner);}catch(error){return {ok:false,error:error.message,code:error.code};}
 const operation={owner};syncOperation=operation;deliverySyncError='';renderSync();
 try{
  for(const entry of pendingForAccount().slice(0,50)){
   requireDeliveryAction(owner);
   if(entry.deferredSend){const allowed=await checkManualDelivery(owner,entry.domain,entry.activity.metadata.delivery_record.record.recipientEmail);if(!allowed.ok){deliverySyncError=allowed.error;return allowed;}}
   const result=await syncCrmDelivery(entry.domain,entry);requireDeliveryAction(owner);
   if(!result.ok){deliverySyncError=result.error||'CRM unavailable';return result;}
   if(entry.deferredSend){
    delivery=LeadIntelDelivery.restoreCrmHistory(delivery,{company:result.company,activities:[{...entry.activity,workspace_id:entry.workspaceId,company_id:result.company.id}]},entry.workspaceId);
    const record=entry.activity.metadata.delivery_record.record;updatePipelineStage(entry.domain,entry.stage);const pkg=approvedPackages().find(item=>item.domain===entry.domain&&item.selectedPersonId===record.personId&&item.approvedAt===record.approvedAt);if(pkg)markOutreachContacted(pkg,record.sentAt);
    if(!delivery.activity.some(row=>row.id===entry.id))delivery.activity.unshift({id:entry.id,type:'message.sent',domain:entry.domain,at:record.sentAt,stage:'Contacted'});
   }
   delivery.pendingSync=delivery.pendingSync.filter(row=>row.id!==entry.id);saveDelivery();
  }deliverySyncAcknowledged=true;return {ok:true};
 }catch(error){if(deliveryActionCurrent(owner))deliverySyncError=error.message;return {ok:false,error:error.message,code:error.code};}
 finally{if(syncOperation===operation){syncOperation=null;if(crmBridge()===owner.bridge&&deliveryAccountContext()===owner.account)renderSync();}}
}
async function refreshDeliveryHistory(){
 if(historyOperation||!crmBridge()?.getCrmCompany||!crmAuthenticated()||crmBridge().ready===false)return;
 const owner=captureDeliveryAction(),domain=currentRecord()?.domain||currentPackage()?.domain||delivery.selectedDomain;if(!domain)return;
 const operation={owner};historyOperation=operation;renderSync();
 try{
  requireDeliveryAction(owner);const resolved=await durableCompany(domain,owner,{create:false});requireDeliveryAction(owner);if(!resolved.ok)throw Error(resolved.error||'CRM unavailable');
  const detail=await owner.bridge.getCrmCompany(resolved.company.id);requireDeliveryAction(owner);if(!detail.ok)throw Error(detail.error||'CRM history unavailable');
  // History reads are bounded and never trigger provider work. Older local history is retained.
  let cursor=detail.activity_next_cursor,pages=0;const seen=new Set();
  while(cursor&&owner.bridge.getCrmActivities&&pages++<4&&!seen.has(cursor)){seen.add(cursor);const page=await owner.bridge.getCrmActivities(resolved.company.id,{limit:100,cursor});requireDeliveryAction(owner);if(!page.ok)throw Error(page.error||'CRM history unavailable');detail.activities.push(...(page.activities||[]));cursor=page.next_cursor;}
  if(detail.company?.id!==resolved.company.id)throw Error('Saved company changed.');
  delivery=LeadIntelDelivery.restoreCrmHistory(delivery,detail,owner.bridge.workspace.id);saveDelivery();deliverySyncAcknowledged=true;deliverySyncError=cursor?'Older history is available in CRM.':'';
 }catch(error){if(deliveryActionCurrent(owner))deliverySyncError=error.message;}
 finally{if(historyOperation===operation){historyOperation=null;if(crmBridge()===owner.bridge&&deliveryAccountContext()===owner.account){renderAll();if(!deliveryActionCurrent(owner))void refreshDeliveryHistory();}}}
}
async function confirmSent(metadata={}){return runRecording('sent',()=>confirmSentOperation(metadata));}
async function confirmSentOperation(metadata={}){
 const owner=captureDeliveryAction({requireSource:true});requireDeliveryAction(owner);const pkg=currentPackage();if(!pkg){toast('Select an approved opportunity');return {ok:false};}
 const submission=deliverySubmission(pkg);
 if(submission?.status==='sent'&&!Object.keys(metadata).length&&submission.key&&submission.providerMessageId&&['gmail','microsoft'].includes(submission.provider))metadata={deliveryChannel:submission.provider,submissionKey:submission.key,providerMessageId:submission.providerMessageId,threadId:submission.threadId,crmActivityId:submission.crmActivityId};
 const provider=['gmail','microsoft'].includes(metadata.deliveryChannel);
 if(submission&&(!provider||submission.status!=='sent'||!metadata.submissionKey||metadata.submissionKey!==submission.key||metadata.deliveryChannel!==submission.provider||metadata.providerMessageId!==submission.providerMessageId||String(metadata.threadId||'')!==String(submission.threadId||''))||provider&&!submission){const error='Check the original provider submission and Sent folder before recording delivery. An unconfirmed API submission cannot be recorded as a manual send.';toast(error);return {ok:false,error,submissionUncertain:submission?.status!=='sent'};}
 if(!provider&&!currentSendRecord()?.sentAt){if(pendingManualSend(pkg,owner.recipient)){toast('This manual record is pending CRM sync. Retry its saved record.');return {ok:false,pending:true};}const accepted=await(window.LeadIntelDialogs?.confirm(`Record that you already sent “${pkg.drafts.emailSubject}” to ${owner.recipient} outside LeadIntel? Only continue after checking your Sent folder.`,{title:'Record external send?',action:'Record sent'})??false);if(!accepted)return {ok:false,cancelled:true};requireDeliveryAction(owner);const status=await checkManualDelivery(owner,pkg.domain,owner.recipient);if(!status.ok){toast(status.error);return status;}}
 const result=LeadIntelDelivery.confirmSend(delivery,pkg,owner.recipient,submission?.at||new Date().toISOString(),metadata);if(result.error){toast(result.error);return {ok:false,error:result.error};}
 const deferredSend=!provider&&!result.duplicate;if(!deferredSend){delivery=result.state;delivery.selectedRecordId='';saveDelivery();updatePipelineStage(pkg.domain,'Contacted');markOutreachContacted(pkg,result.record.sentAt);}
 if(!result.duplicate){
  const activityId=provider?(metadata.crmActivityId||`${metadata.deliveryChannel}-send-${metadata.submissionKey}`).replace(/[^A-Za-z0-9._:-]/g,'-').slice(0,128):`manual-send-${crypto.randomUUID()}`;
  const activity=LeadIntelDelivery.buildSentCrmActivity(pkg,result.record,{id:activityId,channel:provider?metadata.deliveryChannel:'gmail-compose',api:provider});if(provider)activity.metadata.idempotency_key=metadata.submissionKey;queueCrmRecord(result.record,activity,{stage:'Contacted',deferredSend});
 }
 const savedOwner=captureDeliveryAction(),crm=await flushDeliverySync();if(!deliveryActionCurrent(savedOwner))return {...crm,localRecorded:true};renderAll();window.dispatchEvent(new CustomEvent('leadintel:delivery-recorded',{detail:{workspaceId:owner.bridge.workspace.id,domain:pkg.domain}}));toast(crm.ok?'Send recorded · CRM saved':deferredSend?'Manual record kept in this browser · CRM confirmation pending':'Send recorded in this browser · retry CRM sync');return {...crm,localRecorded:!deferredSend||crm.ok};
}
function previewReply(){const text=q('reply-text')?.value||'';q('reply-classification').textContent=`Classification: ${text.trim()?LeadIntelDelivery.classifyReply(text).replaceAll('_',' '):'—'}`;}
async function recordReply(){return runRecording('reply',async()=>{
 const owner=captureDeliveryAction();requireDeliveryAction(owner);const record=currentRecord();if(!record?.sentAt){toast('Confirm the send before recording a reply');return {ok:false};}
 const text=q('reply-text').value,replyAt=new Date().toISOString(),result=LeadIntelDelivery.recordReply(delivery,record.id,text,replyAt);if(result.error){toast(result.error);return {ok:false,error:result.error};}
 delivery=result.state;saveDelivery();const target=LeadIntelDelivery.recommendedPipelineStage(result.record);updatePipelineStage(record.domain,target);const latest=result.record.replies[0];
 queueCrmRecord(result.record,{id:`manual-reply-${crypto.randomUUID()}`,type:'email.reply_received',channel:'manual',direction:'inbound',summary:`Reply recorded · ${result.record.latestReplyCategory.replaceAll('_',' ')}`,occurred_at:latest.at,metadata:{category:latest.category,recipient:record.recipientEmail,reply_id:latest.id}},{stage:target});
 const crm=await flushDeliverySync();if(!deliveryActionCurrent(owner))return crm;if(q('reply-text').value===text)q('reply-text').value='';renderAll();toast(crm.ok?'Reply recorded · CRM saved':'Reply kept in this browser · retry CRM sync');return {...crm,localRecorded:true};
 });}
async function recordOutcome(stage){return runRecording('outcome',async()=>{
 const owner=captureDeliveryAction();requireDeliveryAction(owner);const record=currentRecord();if(!record?.sentAt){toast('Confirm the send before recording an outcome');return {ok:false};}
 const result=LeadIntelDelivery.recordOutcome(delivery,record.id,stage,new Date().toISOString());if(result.error){toast(result.error);return {ok:false,error:result.error};}
 if(record.outcomeStage===result.record.outcomeStage){toast('This outcome is already recorded.');return {ok:true,duplicate:true};}
 delivery=result.state;saveDelivery();updatePipelineStage(record.domain,result.record.outcomeStage);const finalStage=result.record.outcomeStage,types={Meeting:'meeting.recorded',Proposal:'proposal.recorded',Won:'deal.won',Lost:'deal.lost'};
 queueCrmRecord(result.record,{id:`outcome-${crypto.randomUUID()}`,type:types[finalStage],summary:`Commercial outcome · ${finalStage}`,occurred_at:result.record.outcomeAt,metadata:{stage:finalStage,recipient:record.recipientEmail}},{stage:finalStage,markCustomer:finalStage==='Won'});
 const crm=await flushDeliverySync();if(!deliveryActionCurrent(owner))return crm;renderAll();toast(crm.ok?`${finalStage} recorded · CRM saved`:`${finalStage} kept in this browser · retry CRM sync`);return {...crm,localRecorded:true};
 });}
function exportLearningData(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3,contentLanguage());const payload={schema_version:1,exported_at:new Date().toISOString(),connector:delivery.connector,delivery,learning:summary};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`leadintel-learning-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Learning data exported");}

function crmStage(){return pipeline().find(item=>item.domain===(currentRecord()?.domain||delivery.selectedDomain))?.stage||LeadIntelDelivery.recommendedPipelineStage(currentRecord());}
function selectionValue(item,list=approvedPackages()){return list.filter(row=>row.domain===item.domain).length>1?LeadIntelDelivery.packageKey(item):item.domain;}
function renderSelector(){const list=approvedPackages();const select=q("delivery-company-select");if(!select)return;select.innerHTML=list.length?list.map(item=>`<option value="${esc(selectionValue(item,list))}" ${LeadIntelDelivery.packageKey(item)===delivery.selectedPackageKey?"selected":""}>${esc(item.company)} · ${esc(approvedBuyerEmail(item)||item.selectedPersonId||"Recipient needed")} · ${esc(item.drafts?.emailSubject||"Approved email")}</option>`).join(""):'<option value="">No approved message packages yet</option>';const gate=q("continue-to-delivery");if(gate){const action=window.LeadIntelNextAction?.forStage(6,{approvedCampaignCount:list.length})||{label:list.length?"Continue to Delivery →":"Approve a Message First",enabled:Boolean(list.length)};gate.disabled=!action.enabled;gate.setAttribute("aria-disabled",String(!action.enabled));gate.textContent=action.label;}const record=currentRecord();q("delivery-recipient").value=approvedBuyerEmail(currentPackage())||record?.recipientEmail||"";q("delivery-recipient").disabled=!list.length;q("open-gmail-draft").disabled=!list.length||Boolean(manualDraftOperation&&deliveryActionCurrent(manualDraftOperation.owner));q("confirm-delivery-sent").disabled=!currentPackage()||Boolean(recordingOperation);}
function renderState(){const confirmButton=q('confirm-delivery-sent');if(confirmButton){confirmButton.disabled=!currentPackage()||Boolean(recordingOperation);confirmButton.textContent=recordingOperation?.kind==='sent'?'Recording…':'Confirm sent ✓';}const record=currentRecord();const packages=approvedPackages();q("delivery-crm-stage").textContent=packages.length?crmStage():"Waiting for approved package";q("delivery-sent-at").textContent=record?.sentAt?new Date(record.sentAt).toLocaleString():"Not yet";q("delivery-reply-category").textContent=record?.latestReplyCategory?record.latestReplyCategory.replaceAll("_"," "):"—";q("delivery-outcome").textContent=record?.outcomeStage||"—";q("delivery-status").textContent=record?.outcomeStage||record?.latestReplyCategory?"Active":record?.sentAt?"Contacted":packages.length?"Ready":"Waiting for package";q("reply-text").disabled=!record?.sentAt;q("record-reply").disabled=!record?.sentAt||Boolean(recordingOperation);document.querySelectorAll("[data-outcome-stage]").forEach(btn=>btn.disabled=!record?.sentAt||Boolean(recordingOperation));const note=q("delivery-recording-note");if(note)note.hidden=Boolean(record?.sentAt);const footer=q("delivery-workflow-status");if(footer){footer.textContent=!packages.length?"Review messages →":!record?.sentAt?"Review recipient & send ↑":!record?.outcomeStage?"Record an outcome ↑":"View conversations ↑";footer.disabled=false;footer.setAttribute("aria-disabled","false");q("delivery-next-hint").textContent=!packages.length?"Approve and save a message in Messages to get started.":!record?.sentAt?"Your approved message is ready. Review the recipient before sending.":!record?.outcomeStage?"Your message is recorded. Add an outcome when it happens, or review replies above.":"Keep the conversation moving. Review replies and any next steps above.";}previewReply();}
function activityLabel(item){if(item.type==="message.sent")return "Message sent";if(item.type==="reply.received")return `Reply · ${item.category.replaceAll("_"," ")}`;if(item.type==="outcome.recorded")return `Outcome · ${item.stage}`;return item.type;}
function renderActivity(){const target=q("delivery-activity");if(!target)return;const rows=delivery.activity.filter(item=>!delivery.selectedDomain||item.domain===delivery.selectedDomain);target.innerHTML=rows.length?rows.map(item=>`<div class="activity-row"><span>${esc(item.type)}</span><strong>${esc(activityLabel(item))}</strong><small>${new Date(item.at).toLocaleString()}</small></div>`).join(""):'<div class="learning-empty">No delivery activity recorded for this opportunity yet.</div>';}
function metricCard(label,value){return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;}
function segmentCard(title,rows){return `<div class="learning-segment-card"><h4>${esc(title)}</h4>${rows.length?rows.slice(0,6).map(row=>`<div class="learning-segment-row"><strong>${esc(row.key)}</strong><span>${row.sent} sent</span><span>${row.replyRate}% reply</span><span>${row.meetingRate}% meet</span></div>`).join(""):'<div class="learning-empty">Not enough activity yet.</div>'}</div>`;}
function renderLearning(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3,contentLanguage());const m=summary.metrics;q("learning-scorecard").innerHTML=[metricCard("Sent",m.sent),metricCard("Replies",`${m.replied} · ${m.replyRate}%`),metricCard("Meetings",`${m.meetings} · ${m.meetingRate}%`),metricCard("Proposals",m.proposals),metricCard("Won / Lost",`${m.won} / ${m.lost}`),metricCard("Win rate",`${m.winRate}%`)].join("");q("learning-segments").hidden=!m.sent;q("learning-segments").innerHTML=[segmentCard("By tone",summary.byTone),segmentCard("By market",summary.byMarket),segmentCard("By offer",summary.byOffer),segmentCard("By signal",summary.bySignal)].join("");q("learning-recommendations").setAttribute('lang',contentLanguage());q("learning-recommendations").innerHTML=summary.recommendations.length?summary.recommendations.map(item=>`<div>${esc(item)}</div>`).join(""):`<div class="learning-empty learning-start"><strong>${m.sent?'Building your first insights':'Your results start with the first send'}</strong><p>${m.sent?'Keep recording replies and outcomes. Suggestions appear once a segment has at least 3 sends; treat small samples as early signals.':'Send your first approved message above. Replies, meetings and outcomes will build this view as they are recorded.'}</p></div>`;}
function renderHistory(){const select=q('delivery-history-select');if(!select)return;select.innerHTML='<option value="">Current approved email</option>'+delivery.opportunities.filter(row=>row.sentAt).map(row=>`<option value="${esc(row.id)}">${esc(row.company||row.domain)} · ${esc(row.recipientEmail)} · ${esc(row.subject||'Sent email')} · ${esc(new Date(row.sentAt).toLocaleString())}</option>`).join('');select.value=delivery.selectedRecordId||'';}
function renderPreview(){
 const pkg=currentPackage(),payload=pkg&&LeadIntelOutreach.buildApprovedSendPayload(pkg,approvedBuyerEmail(pkg)),body=q('delivery-preview-body');
 q('delivery-preview-recipient').textContent=payload?.recipient||'No approved recipient selected';q('delivery-preview-subject').textContent=payload?.subject||'Review and approve a message in Messages';
 const frame=q('delivery-preview-frame'),branded=Boolean(payload?.htmlBody&&pkg?.approvalBrandMode==='branded');frame.hidden=!branded;body.hidden=branded;if(branded){frame.srcdoc=payload.htmlBody;body.textContent=payload.textBody;return;}frame.removeAttribute('srcdoc');
 const html=payload?.htmlBody&&window.LeadIntelRichText?.matchingHtml?.(payload.textBody,payload.htmlBody);if(html){body.innerHTML=html;body.classList.add('has-rich-text');}else{body.textContent=payload?.textBody||'';body.classList.remove('has-rich-text');}
}
function renderAll(){if(window.LeadIntelPageQuality)queueMicrotask(()=>window.LeadIntelPageQuality.refresh('delivery'));ensureSelection();renderSelector();renderHistory();renderState();renderPreview();renderSync();renderActivity();renderLearning();globalThis.LeadIntelTestEmail?.mount(document.querySelector('#step-7 .delivery-buttons'),'delivery-test-email',()=>({item:currentPackage(),channel:'email'}));}
function reviewNextStep(){
 const record=currentRecord();if(!approvedPackages().length){showOutreachStep();return;}
 const target=q(!record?.sentAt?'delivery-recipient':!record?.outcomeStage?'delivery-outcomes':'conversation-panel');
 if(!target)return;target.scrollIntoView?.({behavior:'smooth',block:'center'});
 if(target.matches('input,button,select,textarea'))target.focus({preventScroll:true});else {target.tabIndex=-1;target.focus({preventScroll:true});}
}
function bindDelivery(){
 q('delivery-retry-sync')?.addEventListener('click',()=>void runRecording('sync',async()=>{const result=await flushDeliverySync();renderAll();return result;}));
 q('delivery-refresh-history')?.addEventListener('click',()=>void refreshDeliveryHistory());
 window.addEventListener('leadintel:server-ready',()=>{delivery=loadDelivery();renderAll();void refreshDeliveryHistory();});

  q('delivery-history-select')?.addEventListener('change',event=>{delivery.selectedRecordId=event.target.value;saveDelivery();renderState();renderActivity();});
  q('delivery-workflow-status')?.addEventListener('click',reviewNextStep);
  window.addEventListener('leadintel:outreach-sent',()=>{delivery=loadDelivery();renderAll();});
  window.addEventListener('leadintel:message-flow-ready',receiveMessageFlow);
  window.addEventListener("leadintel:outreach-approved",event=>{delivery=loadDelivery();if(event.detail?.domain){delivery.selectedDomain=event.detail.domain;delivery.selectedPackageKey="";}ensureSelection();renderAll();});
  q("continue-to-delivery")?.addEventListener("click",showDeliveryStep);q("back-to-outreach")?.addEventListener("click",showOutreachStep);q("delivery-company-select")?.addEventListener("change",e=>{const pkg=approvedPackages().find(item=>selectionValue(item)===e.target.value);if(!pkg)return;delivery.selectedDomain=pkg.domain;delivery.selectedPackageKey=LeadIntelDelivery.packageKey(pkg);delivery.selectedRecordId="";saveDelivery();renderAll();void refreshDeliveryHistory();});q("open-gmail-draft")?.addEventListener("click",openGmailDraft);q("confirm-delivery-sent")?.addEventListener("click",()=>void confirmSent());q("reply-text")?.addEventListener("input",previewReply);q("record-reply")?.addEventListener("click",recordReply);q("step-7")?.addEventListener("click",e=>{const btn=e.target.closest("[data-outcome-stage]");if(btn)recordOutcome(btn.dataset.outcomeStage);});q("export-learning-data")?.addEventListener("click",exportLearningData);q("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY))localStorage.removeItem(DELIVERY_STORAGE_KEY);},0));
  window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)!==7)return;persistMainStep(7);ensureSelection();renderAll();void refreshDeliveryHistory();});
}
function loadProductionSaas(){
  const loadMailboxUi=()=>{if(document.querySelector('script[data-production-gmail-ui]'))return;const ui=document.createElement('script');ui.src=asset('production-gmail-ui.js')+'&delivery-modes=2&page-procedures=20261010-v1&audit-delivery=20261015-v1&delivery-records=20261024-v2';ui.dataset.productionGmailUi='true';document.body.appendChild(ui);};
  if(document.querySelector('script[data-server-bridge]')){loadMailboxUi();return;}
  const bridge=document.createElement('script');bridge.src=SERVER_BRIDGE_ASSET;bridge.dataset.serverBridge='true';
  bridge.addEventListener('load',loadMailboxUi);
  document.body.appendChild(bridge);
}
function initDelivery(){injectDeliveryUI();window.LeadIntelConversations?.refresh?.();window.LeadIntelPageQuality?.register('delivery',{read:deliveryQualityContext});bindDelivery();renderAll();if(readJson(MAIN_STORAGE_KEY).step===7)showDeliveryStep();loadProductionSaas();}
initDelivery();
window.LeadIntelDeliveryUI={ready:true,currentPackage,confirmSent};
window.dispatchEvent(new CustomEvent('leadintel:delivery-ready'));
import './content-variants.js?v=20260929-public-first-email-v1&app-dialogs=20261017-v1';

