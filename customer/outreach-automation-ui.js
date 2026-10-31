(function(root){
'use strict';
const ID='outreach-automation-panel';
let policy=null,status=null,approvedPackage=null,busy=false,suppressedContacts=null;
let policyLoadError='',policyWorkspace='',refreshRequest=0,suppressionLoadError='',stateOwner='',policyOwner='',operationOwner=0,queueOperationOwner=0;
const identities=new WeakMap();let identitySequence=0;
function objectId(value){if(!value||typeof value!=='object')return '';if(!identities.has(value))identities.set(value,++identitySequence);return identities.get(value);}
function accountKey(){const b=bridge(),cache=root.LeadIntelAccountCache;return JSON.stringify([objectId(b),b?.workspace?.id,b?.workspace?.role,b?.session?.user?.id,b?.session?.user?.role,b?.session?.authenticated,b?.gmail,b?.ready,b?.conflict,b?.resolvingSync,objectId(cache),cache?.current?cache.current():true,typeof localStorage==='undefined'?null:localStorage.getItem('leadintel_account_context_v1')]);}
function syncOwner(){const key=accountKey();if(stateOwner!==key){stateOwner=key;policy=null;status=null;approvedPackage=null;suppressedContacts=null;policyWorkspace='';policyOwner='';busy=false;queueOperationOwner=0;operationOwner++;}return key;}
function authority({withPolicy=false}={}){const key=syncOwner(),b=bridge(),policyKey=withPolicy?JSON.stringify(serverPolicy()):'',accountCurrent=()=>accountKey()===key&&Boolean(b?.session?.authenticated&&b?.workspace?.id&&b.ready!==false&&!b.conflict&&!b.resolvingSync);return {bridge:b,key,accountCurrent,current:()=>accountCurrent()&&(!root.LeadIntelAccountCache?.current||root.LeadIntelAccountCache.current())&&(!withPolicy||JSON.stringify(serverPolicy())===policyKey)};}
function canonicalItems(){try{const saved=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}');const seen=new Set();return [...(Array.isArray(saved.items)?saved.items:[]),...Object.values(saved.buyerDrafts||{})].filter(item=>{const key=JSON.stringify([item?.domain,item?.selectedPersonId,item?.channel||'email']);if(seen.has(key))return false;seen.add(key);return true;});}catch{return [];}}
function canonicalItem(item){return canonicalItems().find(row=>row.domain===item?.domain&&String(row.selectedPersonId)===String(item?.selectedPersonId)&&JSON.stringify(row)===JSON.stringify(item))||null;}
function sourceCurrent(item){let main={},studio={};try{main=JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}');studio=JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')||'{}').messageStudio||{};}catch{return false;}return root.LeadIntelOutreach?.sourceAuthorityCurrent?.(item,main,studio)===true;}
function activeAutomatic(){const p=serverPolicy(),b=bridge();return Boolean(isOwner()&&p.automaticDelivery==='enabled'&&p.mode==='automatic'&&p.enabled&&!p.paused&&!p.emergencyStop&&b?.gmail?.connected);}
const days=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];
function bridge(){return root.LeadIntelServerBridge||null;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function css(){if(document.querySelector('link[data-outreach-automation-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./outreach-automation.css?v=20261024-delivery-experience-v1&delivery-spacing=20261024-v1';l.dataset.outreachAutomationCss='1';document.head.appendChild(l);}
function anchor(){return document.querySelector('.step-view[data-step="7"]');}
function isOwner(){syncOwner();return policyOwner===stateOwner&&String(status?.role||policy?.role||'')==='owner'&&(!bridge()?.workspace?.role||bridge().workspace.role==='owner');}
function serverPolicy(){syncOwner();return policyOwner===stateOwner?(policy?.policy||policy||{automaticDelivery:'manual_only'}):{automaticDelivery:'manual_only'};}
function serverStatus(){syncOwner();return status||{};}
function approvedItems(){return canonicalItems().filter(item=>root.LeadIntelOutreach?.approvalCurrent?.(item)&&sourceCurrent(item));}
function deliveryTrace(action){let op;try{op=root.LeadIntelReliabilityTrace?.begin(action);}catch{}return {checkpoint(phase,outcome){try{op?.checkpoint(phase,outcome);}catch{}},finish(outcome){try{op?.finish(outcome);}catch{}}};}
async function queueApprovedPackages(domain=''){const trace=deliveryTrace('delivery_queue');trace.checkpoint('request','pending');try{const result=await queueApprovedPackagesOperation(domain,trace);trace.finish(result.queued?(result.skipped?'partial':'pass'):'blocked');return result;}catch(error){trace.finish('fail');throw error;}}
async function queueApprovedPackagesOperation(domain='',trace=deliveryTrace('delivery_queue')){
  syncOwner();const owned=authority({withPolicy:true}),b=owned.bridge;if(busy||!owned.current()||!activeAutomatic()||!b?.getCrmCompany||!b?.listCrmCompanies||!b?.enqueueOutreachAutomation)return {queued:0,skipped:0};
  const items=approvedItems().filter(item=>!domain||String(item.domain||'')===domain).slice(0,50);let queued=0,skipped=0;const token=++operationOwner;queueOperationOwner=token;busy=true;
  const current=item=>token===operationOwner&&owned.current()&&activeAutomatic()&&(!item||canonicalItem(item)&&sourceCurrent(item)&&root.LeadIntelOutreach?.approvalCurrent?.(item));
  try{for(const item of items){if(!current(item))break;try{
    const key=String(item.domain||'').toLowerCase(),personId=String(item.selectedPersonId||''),recipient=root.LeadIntelOutreach?.approvedRecipient?.(item);if(!key||!personId||!recipient){skipped++;continue;}
    const list=await b.listCrmCompanies({q:key,limit:20});if(!current(item))break;
    const companies=list?.ok?(list.companies||[]).filter(row=>String(row.normalized_domain||'').toLowerCase()===key):[],company=companies.length===1?companies[0]:null;if(!company){skipped++;continue;}
    const detail=await b.getCrmCompany(company.id);if(!current(item))break;if(!detail?.ok||String(detail.company?.id||'')!==String(company.id)||detail.company?.workspace_id!==b.workspace.id||String(detail.company?.normalized_domain||'').toLowerCase()!==key||['suppressed','archived'].includes(detail.company?.lifecycle_status)){skipped++;continue;}
    const expected=item.approvalAuthority?.recipient,level=root.LeadIntelBuyerConfirmationPolicy?.level?.()||root.LeadIntelServiceSettings?.confirmationLevel?.();
    const matches=(detail.contacts||[]).filter(row=>{
      const external=String(row.external_person_id||''),id=String(row.id||''),email=String(row.normalized_email||row.work_email||row.email||'').trim().toLowerCase(),name=String(row.full_name||row.name||row.public_name||'').trim();
      if(external?external!==personId:id!==personId)return false;
      if(expected?.contactId&&id!==expected.contactId||row.company_id&&String(row.company_id)!==String(company.id)||email!==recipient||name!==expected?.name)return false;
      const text=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase(),profile=value=>text(value).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\//,'linkedin.com/').replace(/\/$/,''),nonempty=values=>values.filter(value=>typeof value==='string'&&value.trim());
      const roles=nonempty([row.title,row.job_title,row.jobTitle,row.role]),profiles=nonempty([row.linkedin_url,row.linkedinUrl,row.linkedin,row.linkedinConfirmedUrl,row.publicLinkedinUrl,row.public_linkedin_url,row.profile?.linkedinUrl]),names=nonempty([row.name,row.full_name,row.public_name]),emails=nonempty([row.normalized_email,row.work_email,row.email]),organizations=nonempty([row.company,row.company_name,row.companyName,typeof row.organization==='string'?row.organization:row.organization?.name,row.organization_name]);
      if(names.some(value=>text(value)!==text(expected.name))||emails.some(value=>text(value)!==text(recipient))||roles.some(value=>text(value)!==text(expected.title))||expected.title&&!roles.length||profiles.some(value=>profile(value)!==profile(expected.linkedin))||expected.linkedin&&!profiles.length||organizations.some(value=>text(value)!==text(expected.company||item.company)))return false;
      if(detail.company?.company_name&&text(detail.company.company_name)!==text(expected.company||item.company))return false;
      return root.LeadIntelContactPolicy?root.LeadIntelContactPolicy.accepted(row,key,level):String(row.email_status||'').toLowerCase()==='verified';
    });
    if(matches.length!==1){skipped++;continue;}
    const payload=root.LeadIntelOutreachAutomationDeliveryHandoff?.buildApprovedAutomationPackage?.(item,recipient);if(!payload||!current(item)){skipped++;continue;}
    trace.checkpoint('persistence','pending');const result=await b.enqueueOutreachAutomation(payload);trace.checkpoint('persistence',result?.ok?'pass':'fail');if(!current(item))break;if(result?.ok){if(!result.duplicate)queued++;}else skipped++;
  }catch{if(!current(item))break;skipped++;}}}finally{if(token===operationOwner){busy=false;if(owned.current())await refresh();}}
  if(owned.current())message(`${queued} approved verified contact${queued===1?'':'s'} queued.${skipped?` ${skipped} skipped; review contact verification or previous outreach.`:''}`);
  return {queued,skipped};
}
function setupBadge(mode,active,dirty=false){
  if(active&&mode==='automatic')return {title:'Automatic',detail:dirty?'Sending on · Save changes':'Sending on'};
  if(active)return {title:'Manual selected',detail:'Sending on until saved'};
  if(mode==='automatic')return {title:'Automatic plan',detail:dirty?'Sending off · Save to keep':'Sending off · Saved'};
  return {title:'Manual',detail:dirty?'Automatic sending off · Save to keep':'Automatic sending off'};
}
function updateSetupBadge(card,active,dirty=false){
  const mode=card.querySelector('[name="delivery-setup-mode"]:checked')?.value||'manual';
  const badge=card.querySelector('#delivery-setup-badge');if(!badge)return;
  const value=setupBadge(mode,active,dirty);badge.querySelector('strong').textContent=value.title;badge.querySelector('small').textContent=value.detail;
}
function renderSetup(){
  const brand=document.getElementById('pdf-input')?.closest('.source-panel')||document.getElementById('target-market-selector')||document.getElementById('brand-identity');if(!brand)return;
  let card=document.getElementById('delivery-setup');if(!card){card=document.createElement('section');card.id='delivery-setup';card.className='panel brand-identity-panel delivery-setup';brand.after(card);}
  const authenticated=Boolean(bridge()?.session?.authenticated&&bridge()?.workspace?.id);
  const p=serverPolicy(),ready=authenticated&&Boolean(policy)&&policyWorkspace===bridge()?.workspace?.id,owner=isOwner(),preferred=p.preferredMode||p.mode||'manual';
  if(p.approvedWorkflow){card.innerHTML=`<div class="delivery-setup-header"><div><span class="eyebrow">Approved workflow</span><h3>Delivery is controlled by your workflow</h3><p>Status: ${esc(p.approvedWorkflow.status)}. Review approved limits, pause or take over in Workflow automation.</p></div></div><button data-open-approved-workflow>Open workflow controls</button>`;card.querySelector('[data-open-approved-workflow]')?.addEventListener('click',()=>root.LeadIntelApprovedWorkflow?.open());root.LeadIntelQualificationSettings?.mount(card);const footer=document.createElement('div');footer.className='delivery-settings-footer';card.appendChild(footer);root.LeadIntelAdditionalContacts?.mountPaidSearch?.(card);return;}
  const limit=Number(p.workspaceDailyLimit||5),preset=[5,10,20].includes(limit)?String(limit):'custom';
  const active=p.automaticDelivery==='enabled'&&p.mode==='automatic'&&p.enabled;
  const initialBadge=setupBadge(preferred,active);
  card.innerHTML=`<div class="delivery-setup-header"><div><span class="eyebrow">Step 1 · Workflow settings</span><h3>Choose how LeadIntel works</h3><p>Set your delivery mode and company qualification rules.</p></div><span class="brand-identity-status delivery-setup-badge" id="delivery-setup-badge" role="status" aria-live="polite"><strong>${initialBadge.title}</strong><small>${initialBadge.detail}</small></span></div>
    <fieldset class="delivery-mode-options" ${!ready||!owner?'disabled':''}><legend>Delivery mode</legend><label class="delivery-mode-option"><input type="radio" name="delivery-setup-mode" value="manual" ${preferred!=='automatic'?'checked':''}><span><strong>Manual</strong><small>Review and send each approved message yourself.</small></span></label><label class="delivery-mode-option"><input type="radio" name="delivery-setup-mode" value="automatic" ${preferred==='automatic'?'checked':''}><span><strong>Automatic plan</strong><small>Save the preference now. Sending stays off until activation in Delivery.</small></span></label></fieldset>
    <div id="delivery-setup-auto-limits" class="delivery-setup-controls" ${preferred==='automatic'?'':'hidden'}><label for="delivery-setup-limit">Daily email limit</label><select id="delivery-setup-limit" ${!ready||!owner?'disabled':''}><option value="5" ${preset==='5'?'selected':''}>5 emails</option><option value="10" ${preset==='10'?'selected':''}>10 emails</option><option value="20" ${preset==='20'?'selected':''}>20 emails</option><option value="custom" ${preset==='custom'?'selected':''}>Custom</option></select><input id="delivery-setup-custom" type="number" min="1" max="500" value="${esc(limit)}" aria-label="Custom daily email limit" ${preset==='custom'?'':'hidden'} ${!ready||!owner?'disabled':''}><button id="delivery-setup-save" class="primary-btn" type="button" ${!ready||!owner?'disabled':''}>Save settings</button></div>
    <p class="delivery-setup-note">${!authenticated?'Sign in to save this preference to your workspace.':!ready?esc(policyLoadError||'Loading delivery settings…'):!owner?'Only the workspace owner can change delivery settings.':active?'Automatic sending is active. Manage its schedule, pause and stop controls in Delivery.':'Saving settings will not send email. Automatic sending requires a connected mailbox, approved messages and a separate activation in Delivery.'}</p><p id="delivery-setup-message" role="status" aria-live="polite">${esc(policyLoadError)}</p>${authenticated&&(!ready||policyLoadError)?'<button id="delivery-setup-retry" class="secondary-btn" type="button">Retry delivery settings</button>':''}`;
  root.LeadIntelQualificationSettings?.mount(card);
  const footer=document.createElement('div');footer.className='delivery-settings-footer';footer.appendChild(card.querySelector('#delivery-setup-save'));card.appendChild(footer);root.LeadIntelAdditionalContacts?.mountPaidSearch?.(card);
  card.querySelector('#delivery-setup-retry')?.addEventListener('click',()=>refresh());
  const choice=card.querySelector('#delivery-setup-limit'),custom=card.querySelector('#delivery-setup-custom');
  choice.addEventListener('change',()=>{custom.hidden=choice.value!=='custom';updateSetupBadge(card,active,true);});
  custom.addEventListener('input',()=>updateSetupBadge(card,active,true));
  card.querySelectorAll('[name="delivery-setup-mode"]').forEach(input=>input.addEventListener('change',()=>{card.querySelector('#delivery-setup-auto-limits').hidden=card.querySelector('[name="delivery-setup-mode"]:checked')?.value!=='automatic';updateSetupBadge(card,active,true);}));
  card.querySelector('#delivery-setup-save').addEventListener('click',async()=>{
    const mode=card.querySelector('[name="delivery-setup-mode"]:checked')?.value||'manual';
    const value=mode==='automatic'?Number(choice.value==='custom'?custom.value:choice.value):limit,notice=card.querySelector('#delivery-setup-message');
    if(mode==='automatic'&&(!Number.isInteger(value)||value<1||value>500)){notice.textContent='Choose a whole number from 1 to 500.';return;}
    const owned=authority({withPolicy:true}),b=owned.bridge;if(busy||!owned.current()||!isOwner()||!b?.saveOutreachAutomationPolicy){notice.textContent='Sign in to save this setting.';return;}
    const token=++operationOwner;busy=true;const button=card.querySelector('#delivery-setup-save');button.disabled=true;
    try{
      await root.LeadIntelQualificationSettings?.saveFromCard(card);if(token!==operationOwner||!owned.current())return;
      const result=await b.saveOutreachAutomationPolicy({...p,mode,enabled:active&&mode==='automatic',workspaceDailyLimit:value,mailboxDailyLimit:mode==='automatic'?value:Number(p.mailboxDailyLimit||limit)});
      if(token!==operationOwner||!owned.current())return;if(!result?.ok)throw new Error(result?.error||'Delivery settings could not be saved. Qualification rules may have saved; retry.');
      await refresh();if(!owned.accountCurrent()||token!==operationOwner)return;document.getElementById('delivery-setup-message').textContent='Settings saved. Review and approve the workflow separately before activation.';
    }catch(error){if(owned.current())(document.getElementById('delivery-setup-message')||notice).textContent=error.message||'Settings could not be saved. Retry.';}finally{if(token===operationOwner){busy=false;button.disabled=false;}syncOwner();}
  });
}
function selectedDays(p){const set=new Set((p.workingDays||[1,2,3,4,5]).map(String));return days.map(([n,label])=>`<label class="oa-day"><input type="checkbox" data-oa-day="${n}" ${set.has(n)?'checked':''}>${label}</label>`).join('');}
function queueEligibility(){return Boolean(activeAutomatic()&&approvedPackage&&!busy);}
function renderSuppression(destination){
  let card=document.getElementById('outreach-contact-suppression');
  if(!card){card=document.createElement('section');card.id='outreach-contact-suppression';card.className='oa-card';destination.appendChild(card);}
  const owner=isOwner();
  const rows=suppressedContacts||[];
  card.innerHTML=`<div class="oa-suppression-head"><div><span class="eyebrow">Contact preferences</span><h3>Do not contact</h3><p>Block an address from all outreach in this workspace. Unsubscribe replies are blocked automatically.</p></div><span class="oa-role">${suppressedContacts===null?'List unavailable':rows.length+' blocked contact'+(rows.length===1?'':'s')}</span></div><form id="oa-suppress-form"><label for="oa-suppress-email">Contact email<input id="oa-suppress-email" type="email" autocomplete="email" required placeholder="name@company.com" ${owner?'':'disabled'}></label><button class="secondary-btn" type="submit" ${owner?'':'disabled'}>Block contact</button></form>${suppressionLoadError?`<p class="oa-load-error" role="status">${esc(suppressionLoadError)}</p><button class="secondary-btn small" type="button" data-oa-suppression-retry>Retry blocked list</button>`:''}${rows.length?`<details><summary>View blocked contacts</summary><ul>${rows.map(row=>`<li>${esc(row.email)} · ${esc(row.reason)}</li>`).join('')}</ul></details>`:''}<p id="oa-suppress-message" role="status" aria-live="polite"></p>`;
  card.querySelector('[data-oa-suppression-retry]')?.addEventListener('click',refresh);
  card.querySelector('#oa-suppress-form')?.addEventListener('submit',async event=>{
    event.preventDefault();const owned=authority({withPolicy:true});if(busy||!owned.current()||!isOwner())return;const address=card.querySelector('#oa-suppress-email').value.trim(),token=++operationOwner;busy=true;try{const result=await owned.bridge.suppressOutreachContact?.(address);if(token!==operationOwner||!owned.current())return;
    if(!result?.ok){card.querySelector('#oa-suppress-message').textContent=result?.error||'Could not block contact';return;}
    await refresh();if(owned.accountCurrent()&&token===operationOwner)document.getElementById('oa-suppress-message').textContent='Contact blocked from outreach.';}catch(error){if(owned.current())card.querySelector('#oa-suppress-message').textContent=error.message||'Could not block contact';}finally{if(token===operationOwner)busy=false;syncOwner();}
  });
}
function renderVerificationReview(destination){
  let el=document.getElementById('oa-verification-review');if(!el){el=document.createElement('section');el.id='oa-verification-review';el.className='oa-card';destination.appendChild(el);}
  const rows=serverStatus().verificationReview||[];el.hidden=!rows.length;
  el.innerHTML='<h4>Email verification · Needs review</h4>'+rows.map(row=>`<div><strong>${esc(row.recipient)}</strong><p>${esc(row.last_error_message)}</p><button class="secondary-btn small" data-retry-verification="${esc(row.id)}" ${isOwner()?'':'disabled'}>Retry verification</button></div>`).join('');
  el.querySelectorAll('[data-retry-verification]').forEach(button=>button.addEventListener('click',async()=>{const owned=authority({withPolicy:true});if(busy||!owned.current()||!isOwner())return;const token=++operationOwner;busy=true;button.disabled=true;try{const response=await root.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/outreach-automation/retry-verification?workspace_id='+encodeURIComponent(owned.bridge.workspace.id),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:button.dataset.retryVerification}),signal:AbortSignal.timeout(10000)});if(token!==operationOwner||!owned.current())return;if(!response.ok)throw new Error('Could not retry verification');await refresh();}catch(e){if(owned.current())message(e.message,true);}finally{if(token===operationOwner){busy=false;button.disabled=false;}syncOwner();}}));
}
function renderQueueTakeover(destination){
 const rows=Array.isArray(serverStatus().queue?.sequences)?serverStatus().queue.sequences:[];let section=document.getElementById('oa-manual-takeover');if(!rows.length){section?.remove();return;}if(!section){section=document.createElement('section');section.id='oa-manual-takeover';section.className='outreach-automation-panel';destination.appendChild(section);}
 section.innerHTML=`<h3>Queued delivery</h3><p>Cancel future automatic steps before taking over manually. Saved message history stays available. Sent or in-flight email cannot be recalled.</p><ul>${rows.map(row=>`<li>${esc(row.recipient)} · ${esc(row.pendingSteps)} pending <button class="secondary-btn small" type="button" data-oa-cancel-sequence="${esc(row.id)}" ${!isOwner()||busy||row.canCancel!==true?'disabled':''}>${row.canCancel===true?'Cancel future steps':'Reconcile submission first'}</button></li>`).join('')}</ul><p data-oa-takeover-status role="status" aria-live="polite"></p>`;
 section.querySelectorAll('[data-oa-cancel-sequence]').forEach(button=>button.addEventListener('click',()=>cancelQueuedSequence(button.dataset.oaCancelSequence)));
}
async function cancelQueuedSequence(id){
 const owned=authority({withPolicy:true}),row=serverStatus().queue?.sequences?.find(row=>row.id===id),stamp=JSON.stringify(row);if(busy||!owned.current()||!isOwner()||row?.canCancel!==true)return false;const token=++operationOwner,trace=deliveryTrace('delivery_pause');let outcomeMessage='',failed=false,traceOutcome='canceled';busy=true;render();
 const currentAccount=()=>token===operationOwner&&owned.current()&&isOwner(),current=()=>currentAccount()&&JSON.stringify(serverStatus().queue?.sequences?.find(row=>row.id===id))===stamp;
 try{const confirmed=await (root.LeadIntelDialogs?.confirm(`Cancel future automatic steps for ${row.recipient}? Sent or in-flight email cannot be recalled. You must separately review and send any manual message.`)??false);if(!confirmed||!current())return false;trace.checkpoint('persistence','pending');const response=await root.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/outreach-automation/cancel-sequence?workspace_id='+encodeURIComponent(owned.bridge.workspace.id),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,approved:true}),signal:AbortSignal.timeout(10000)});if(!currentAccount())return false;const value=await response.json();if(!currentAccount())return false;if(!response.ok)throw Error(value.error||'Future steps could not be cancelled');busy=false;await refresh();if(owned.accountCurrent()){outcomeMessage='Future automatic steps cancelled. Review the saved message before sending manually.';traceOutcome='pass';}return true;
 }catch(error){outcomeMessage=error.message||'Future steps could not be cancelled';failed=true;traceOutcome='fail';return false;}finally{trace.finish(traceOutcome);if(token===operationOwner){busy=false;render();if(owned.current()){if(outcomeMessage){message(outcomeMessage,failed);const status=document.querySelector('[data-oa-takeover-status]');if(status)status.textContent=outcomeMessage;}const button=[...document.querySelectorAll('[data-oa-cancel-sequence]')].find(button=>button.dataset.oaCancelSequence===id);(button||document.getElementById('oa-refresh'))?.focus();}}}
}
function render(){
  renderSetup();
  const destination=anchor();if(!destination)return;
  renderSuppression(destination);renderVerificationReview(destination);renderQueueTakeover(destination);
  const p=serverPolicy();const s=serverStatus();let el=document.getElementById(ID);if(!el){el=document.createElement('section');el.id=ID;el.className='outreach-automation-panel';}const mailbox=destination.querySelector('.connector-card');if(mailbox)mailbox.after(el);else if(el.parentNode!==destination)destination.appendChild(el);
  if(policyLoadError||!policy||policyWorkspace!==bridge()?.workspace?.id){
    el.innerHTML=`<div class="oa-head"><div><span class="oa-kicker">Delivery mode</span><h3>${policyLoadError?'Delivery status unavailable':'Checking delivery settings'}</h3><p>${esc(policyLoadError||(!bridge()?.session?.authenticated?'Sign in to load your saved delivery mode.':'Loading the saved sending mode for this workspace…'))}</p></div><span class="oa-role">${policyLoadError?'Needs attention':'Not verified'}</span></div>${policyLoadError?'<button class="secondary-btn small" type="button" data-oa-retry>Retry delivery status</button>':''}`;
    el.querySelector('[data-oa-retry]')?.addEventListener('click',refresh);return;
  }
  if(p.approvedWorkflow){el.innerHTML=`<div class="oa-head"><div><span class="oa-kicker">Approved workflow delivery</span><h3>${p.approvedWorkflow.status==='automatic'?'Automatic workflow':'Workflow '+esc(p.approvedWorkflow.status)}</h3><p>Only messages created under your approved workflow can send automatically. Use the workflow controls for review, limits, pause and manual takeover.</p><p>${Number(s.activity?.sent)||0} sent · ${Number(s.queue?.queued)||0} queued · ${Number(s.activity?.replies)||0} replies</p></div></div><button data-open-approved-workflow>Open workflow controls</button>`;el.querySelector('[data-open-approved-workflow]')?.addEventListener('click',()=>root.LeadIntelApprovedWorkflow?.open());return;}
  if(p.automaticDelivery==='manual_only'){
    el.innerHTML=`<div class="oa-head"><div><span class="oa-kicker">Delivery mode</span><h3>Manual delivery</h3><p>You choose when each approved email is sent. Review the recipient and use Send with Gmail or Microsoft above.</p><p class="oa-manual-note">First-email automation is off. Separately approved conversation follow-ups are managed in Conversations &amp; follow-ups.</p></div><span class="oa-role">Manual sending</span></div><button class="secondary-btn small" type="button" data-oa-settings>Delivery settings →</button><p class="oa-message" id="oa-message" role="status" aria-live="polite"></p>`;
    el.querySelector('[data-oa-settings]')?.addEventListener('click',()=>{root.LeadIntelCustomerNavigation?.setStep?.(1);document.getElementById('delivery-setup')?.scrollIntoView?.({behavior:'smooth',block:'center'});});
    return;
  }
  const owner=isOwner();const usage=s.usage||{},q=s.queue||{},activity=s.activity||{};
  const custom=!['5','10','20'].includes(String(p.workspaceDailyLimit||20));
  el.innerHTML=`
  <div class="oa-head"><div><span class="oa-kicker">Outreach Automation</span><h3>Safe automatic Gmail outreach</h3><p>Manual stays available. Automatic sends only approved contacts under server-enforced limits.</p></div><span class="oa-role">${owner?'Owner controls':'Read only'}</span></div>
  <div class="outreach-automation-grid">
    <div class="oa-card"><h4>Mode & limits</h4>
      <label>Mode<select id="oa-mode"><option value="manual" ${p.mode!=='automatic'?'selected':''}>Manual</option><option value="automatic" ${p.mode==='automatic'?'selected':''}>Automatic</option></select></label>
      <label class="oa-toggle"><input id="oa-enabled" type="checkbox" ${p.enabled?'checked':''}> Automation enabled</label>
      <label>Workspace daily limit<select id="oa-workspace-limit"><option>5</option><option>10</option><option>20</option><option value="custom" ${custom?'selected':''}>Custom</option></select></label>
      <input id="oa-custom-limit" type="number" min="1" max="500" value="${esc(p.workspaceDailyLimit||20)}" ${custom?'':'hidden'} aria-label="Custom daily limit">
      <label>Mailbox daily limit<input id="oa-mailbox-limit" type="number" min="1" max="500" value="${esc(p.mailboxDailyLimit||20)}"><small>One Gmail mailbox per workspace today. Both limits apply; the sending window may allow fewer messages.</small></label>
    </div>
    <div class="oa-card"><h4>Schedule</h4><span class="oa-label">Working days</span><div class="oa-days">${selectedDays(p)}</div>
      <label>Timezone<input id="oa-timezone" value="${esc(p.timezone||'Europe/Riga')}"></label>
      <div class="oa-two"><label>Send window start<input id="oa-window-start" type="time" value="${esc(p.sendWindowStart||'09:00')}"></label><label>Send window end<input id="oa-window-end" type="time" value="${esc(p.sendWindowEnd||'16:30')}"></label></div>
      <span class="oa-label">Delay range</span><div class="oa-two"><label>Min minutes<input id="oa-delay-min" type="number" min="1" value="${esc(p.minDelayMinutes||8)}"></label><label>Max minutes<input id="oa-delay-max" type="number" min="1" value="${esc(p.maxDelayMinutes||18)}"></label></div>
    </div>
    <div class="oa-card"><h4>Follow-ups</h4><label>Follow-ups<input id="oa-followups" type="number" min="0" max="5" value="${esc(p.maxFollowups??2)}"></label><label>Follow-up delays, days<input id="oa-followup-days" value="${esc((p.followupDelaysDays||[3,7]).join(','))}"></label><label>Reply polling, minutes<input id="oa-reply-poll" type="number" min="60" value="${esc(p.replyPollIntervalMinutes||60)}"></label></div>
    <div class="oa-card oa-status"><h4>Live status</h4><div><strong>${esc(usage.workspaceSentToday||0)} / ${esc(usage.workspaceLimit||p.workspaceDailyLimit||20)}</strong><span>Sent today${Number(usage.workspaceReservedToday)>0?` · ${esc(usage.workspaceReservedToday)} reserved or unconfirmed`:''}</span></div><div><strong>${esc(q.queued||0)}</strong><span>Queue</span></div><div><strong>${esc(q.nextEligibleSendAt||'—')}</strong><span>Next send</span></div><div><strong>${esc(q.blockedByLimit||0)}</strong><span>Blocked reason: daily limit</span></div></div>
  </div>
  <div class="oa-actions"><button id="oa-save" class="oa-primary">Save settings</button><button id="oa-pause">${p.paused?'Resume automation':'Pause automation'}</button><button id="oa-stop" class="oa-danger">${p.emergencyStop?'Clear emergency stop':'Emergency stop'}</button><button id="oa-refresh">Refresh status</button></div>
  <div class="oa-activity" aria-label="Automatic delivery outcomes"><div><strong>${esc(activity.sent||0)}</strong><span>Sent</span></div><div><strong>${esc(activity.failed||0)}</strong><span>Failed</span></div><div><strong>${esc(activity.replies||0)}</strong><span>Replies</span></div><div><strong>${esc(activity.interested||0)}</strong><span>Interested replies</span></div><div><strong>${esc(activity.meetingRequests||0)}</strong><span>Meeting requests</span></div></div>
  <div class="oa-queue-preview"><div><h4>Queue preview</h4><p>${q.queued?`${esc(q.queued)} approved message(s) waiting.`:'No approved messages waiting.'} ${q.blockedByLimit?`${esc(q.blockedByLimit)} blocked by limit.`:''}</p></div><button id="oa-enqueue" ${queueEligibility()?'':'disabled'}>Add approved contact to automatic queue</button><button id="oa-enqueue-all" ${owner&&p.mode==='automatic'&&p.enabled&&!busy?'':'disabled'}>Queue approved verified contacts</button></div>
  <p id="oa-package-note" class="oa-note">${approvedPackage?`Approved package ready for ${esc(approvedPackage.recipient||approvedPackage.domain||'contact')}.`:'Automatic queueing matches each approved message to its selected verified CRM contact. Missing matches stay for review.'}</p>
  <p id="oa-message" class="oa-message" aria-live="polite"></p>`;
  el.querySelectorAll('input,select,button').forEach(node=>{if(!owner&&node.id!=='oa-refresh')node.disabled=true;});
  const limit=el.querySelector('#oa-workspace-limit');if(limit)limit.value=custom?'custom':String(p.workspaceDailyLimit||20);limit?.addEventListener('change',()=>{el.querySelector('#oa-custom-limit').hidden=limit.value!=='custom';});
  for(const id of ['oa-pause','oa-stop']){const button=el.querySelector('#'+id);if(button&&busy&&queueOperationOwner!==operationOwner)button.disabled=true;}
  bind(el);
}
function message(text,error=false){const el=document.getElementById('oa-message');if(el){el.textContent=text||'';el.dataset.error=error?'1':'0';}}
function readPolicy(){const el=document.getElementById(ID);const limitChoice=el.querySelector('#oa-workspace-limit').value;const limit=limitChoice==='custom'?Number(el.querySelector('#oa-custom-limit').value):Number(limitChoice);return {mode:el.querySelector('#oa-mode').value,enabled:el.querySelector('#oa-enabled').checked,paused:Boolean(serverPolicy().paused),emergencyStop:Boolean(serverPolicy().emergencyStop),workspaceDailyLimit:limit,mailboxDailyLimit:Number(el.querySelector('#oa-mailbox-limit').value),workingDays:[...el.querySelectorAll('[data-oa-day]:checked')].map(x=>Number(x.dataset.oaDay)),timezone:el.querySelector('#oa-timezone').value.trim(),sendWindowStart:el.querySelector('#oa-window-start').value,sendWindowEnd:el.querySelector('#oa-window-end').value,minDelayMinutes:Number(el.querySelector('#oa-delay-min').value),maxDelayMinutes:Number(el.querySelector('#oa-delay-max').value),maxFollowups:Number(el.querySelector('#oa-followups').value),followupDelaysDays:el.querySelector('#oa-followup-days').value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite),replyPollIntervalMinutes:Number(el.querySelector('#oa-reply-poll').value)};}
async function refresh(){
  const owned=authority(),b=owned.bridge,workspace=b?.workspace?.id,request=++refreshRequest;
  if(!b?.session?.authenticated||!workspace){policy=null;status=null;policyWorkspace='';policyLoadError='';suppressedContacts=null;suppressionLoadError='';render();return;}
  if(policyWorkspace!==workspace){policy=null;status=null;suppressedContacts=null;suppressionLoadError='';policyWorkspace='';}
  if(!b.getOutreachAutomationPolicy||!b.getOutreachAutomationStatus){policyLoadError='Delivery settings connection is not ready. Retry in a moment.';render();return;}
  policyLoadError='';render();
  const results=await Promise.allSettled([()=>b.getOutreachAutomationPolicy(),()=>b.getOutreachAutomationStatus(),()=>b.listSuppressedContacts?.()||{ok:false}].map(load=>{try{return owned.current()?load():{ok:false};}catch(error){return Promise.reject(error);}}));
  if(request!==refreshRequest||!owned.current()){syncOwner();render();return;}
  const [p,s,blocked]=results.map(result=>result.status==='fulfilled'?result.value:{ok:false,error:String(result.reason?.message||'Delivery settings request failed')});
  if(blocked?.ok){suppressedContacts=blocked.contacts||[];suppressionLoadError='';}else {suppressionLoadError=blocked?.error||'Blocked contacts could not load. Retry to verify the list.';}
  if(!p?.ok||!p.policy||typeof p.policy!=='object'||Array.isArray(p.policy)){policy=null;status=null;policyOwner='';policyLoadError=p?.error||'Delivery settings could not load. Retry to reconnect.';render();message(policyLoadError,true);return;}
  policy=p;policyOwner=owned.key;policyWorkspace=workspace;status=s?.ok?s:null;if(blocked?.ok)suppressedContacts=blocked.contacts||[];render();if(!s?.ok)message(s?.error||'Live delivery status unavailable; saved preferences loaded.',true);
}
async function mutate(next,success,owned=authority({withPolicy:true})){
 const b=owned.bridge;if(busy||!owned.current()||!isOwner()||!b?.saveOutreachAutomationPolicy)return false;
 const wasAutomatic=activeAutomatic(),token=++operationOwner;busy=true;render();
 try{const result=await b.saveOutreachAutomationPolicy(next);if(token!==operationOwner||!owned.current()){syncOwner();return false;}if(!result?.ok){message(result?.error||'Settings were not saved',true);return false;}busy=false;await refresh();if(token!==operationOwner||!owned.accountCurrent()||!isOwner())return false;if(!wasAutomatic&&next.mode==='automatic'&&next.enabled)await queueApprovedPackages();if(owned.accountCurrent())message(success||'Automation settings saved.');return true;}
 catch(error){if(owned.current())message(error.message||'Settings were not saved',true);return false;}finally{if(token===operationOwner){busy=false;render();}}
}
async function save(){const owned=authority({withPolicy:true});if(busy||!owned.current()||!isOwner())return;const next=readPolicy();if(next.mode==='automatic'&&next.enabled){const token=++operationOwner;busy=true;let confirmed=false;try{const ok=(await (window.LeadIntelDialogs?.confirm('Activate Automatic outreach? Approved contacts may be emailed without per-message confirmation. Server limits, send windows, pause, emergency stop, suppression and reply-stop rules remain enforced.')??false));if(!ok)return;confirmed=true;}catch{}finally{if(token===operationOwner)busy=false;}if(!confirmed)return;if(token!==operationOwner||!owned.current()){syncOwner();render();return;}}await mutate(next,'Automation settings saved.',owned);}
async function safetyControl(next,success){
 const trace=deliveryTrace('delivery_pause');trace.checkpoint('request','pending');
 if(busy&&queueOperationOwner===operationOwner&&(next.paused===true||next.emergencyStop===true)){operationOwner++;queueOperationOwner=0;busy=false;}
 try{const result=await mutate(next,success);trace.finish(result?'pass':'blocked');return result;}catch(error){trace.finish('fail');throw error;}
}
function bind(el){
  el.querySelector('#oa-save')?.addEventListener('click',save);
  el.querySelector('#oa-refresh')?.addEventListener('click',refresh);
  el.querySelector('#oa-pause')?.addEventListener('click',()=>safetyControl({...serverPolicy(),paused:!serverPolicy().paused},serverPolicy().paused?'Automation resumed.':'Automation paused.'));
  el.querySelector('#oa-stop')?.addEventListener('click',()=>safetyControl({...serverPolicy(),emergencyStop:!serverPolicy().emergencyStop},serverPolicy().emergencyStop?'Emergency stop cleared.':'Emergency stop activated.'));
  el.querySelector('#oa-enqueue')?.addEventListener('click',enqueueApproved);
  el.querySelector('#oa-enqueue-all')?.addEventListener('click',()=>queueApprovedPackages());
}
async function enqueueApproved(){const trace=deliveryTrace('delivery_queue');trace.checkpoint('persistence','pending');try{const result=await enqueueApprovedOperation();trace.finish(result?'pass':'blocked');return result;}catch(error){trace.finish('fail');throw error;}}
async function enqueueApprovedOperation(){
 const owned=authority({withPolicy:true}),b=owned.bridge,proposal=approvedPackage;if(busy||!owned.current()||!activeAutomatic()||!proposal||!b?.enqueueOutreachAutomation)return false;
 const item=canonicalItems().find(row=>root.LeadIntelOutreach?.approvalCurrent?.(row)&&JSON.stringify(root.LeadIntelOutreachAutomationDeliveryHandoff?.buildApprovedAutomationPackage?.(row,proposal.recipient))===JSON.stringify(proposal));if(!item||!sourceCurrent(item)){approvedPackage=null;render();message('The approved message or recipient changed. Review the exact message again.',true);return false;}
 const token=++operationOwner;queueOperationOwner=token;busy=true;render();try{const result=await b.enqueueOutreachAutomation(proposal);if(token!==operationOwner||!owned.current()||!canonicalItem(item))return false;if(!result?.ok){message(result?.error||'Approved contact was not queued',true);return false;}approvedPackage=null;busy=false;await refresh();if(owned.current())message('Approved contact added to automatic queue.');return true;}catch(error){if(owned.current())message(error.message||'Approved contact was not queued',true);return false;}finally{if(token===operationOwner){busy=false;render();}}
}
function receivePackage(event){syncOwner();const value=event?.detail;if(!value||typeof value!=='object')return;const item=canonicalItems().find(row=>root.LeadIntelOutreach?.approvalCurrent?.(row)&&JSON.stringify(root.LeadIntelOutreachAutomationDeliveryHandoff?.buildApprovedAutomationPackage?.(row,value.recipient))===JSON.stringify(value));approvedPackage=item?JSON.parse(JSON.stringify(value)):null;render();}
function init(){if(typeof document==='undefined')return;css();root.addEventListener?.('leadintel:approved-outreach-package',receivePackage);root.addEventListener?.('leadintel:outreach-approved',event=>{if(event.detail?.domain)void queueApprovedPackages(String(event.detail.domain));});for(const name of ['leadintel:server-ready','leadintel:workspace-changed','leadintel:server-conflict','leadintel:sync-resolving','leadintel:sync-settled'])root.addEventListener?.(name,()=>{syncOwner();void refresh();});root.addEventListener?.('leadintel:module-opened',()=>{if(!document.getElementById(ID))render();});render();setTimeout(refresh,0);}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
root.LeadIntelOutreachAutomationUI={getPolicy:serverPolicy,refresh,receivePackage,enqueueApproved,queueApprovedPackages,setupBadge,cancelQueuedSequence};
})(typeof window!=='undefined'?window:globalThis);
