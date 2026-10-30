import './tool-account-links.js?v=20261011-v1&workspace-auth=20261012-v1';
const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20261012-visible-apollo-key-v1';
const DEFAULT_CALENDLY_URL='';
const SERVICE_PROVIDERS=Object.freeze([
  {provider:'apollo',name:'Apollo.io',placeholder:'Apollo API key',purpose:'Company, decision-maker, email and phone enrichment'},
  {provider:'treg',name:'Treg',placeholder:'Treg team token',purpose:'Finds and verifies work e-mails and researches business phones, with separate paid-search permissions and a prepaid Treg balance. Open Treg, sign in, and paste your team token here'},
  {provider:'firecrawl',name:'Firecrawl',placeholder:'fc-…',purpose:'Website scraping, public research and evidence collection'}
]);
// Treg is the customer-facing paid contact provider; saved legacy provider evidence remains available.
const SETTINGS_PROVIDERS=SERVICE_PROVIDERS.filter(config=>['firecrawl','treg'].includes(config.provider));
let serviceStatus={role:'',providers:[],checked_at:null};
let calendlyStatus={role:'',configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};
let confirmationLevel='provider_verified',apolloBudget={daily_credit_limit:3,monthly_credit_limit:30},apolloUsage={daily:0,monthly:0};
let busy='',busyOperation=null,serviceRequest=0,serviceEpoch=0,loadedContext='',observedContext='';
function settingsContext(){return JSON.stringify([workspace()?.id||'',bridge()?.session?.user?.id||'',signedIn(),serviceEpoch]);}
function settingsCurrent(context){return context===settingsContext()&&signedIn();}
function beginOperation(provider){const operation={context:settingsContext(),provider};busyOperation=operation;busy=provider;return operation;}
function finishOperation(operation,decorate=true){if(busyOperation!==operation)return;busyOperation=null;busy='';if(decorate&&settingsCurrent(operation.context))queueDecorate(true);}
function prepareServiceContext(){const context=settingsContext();if(observedContext&&observedContext!==context)resetServiceContext();observedContext=context;return context;}
function resetServiceContext(){++serviceRequest;busy='';busyOperation=null;loadedContext='';serviceStatus={role:'',providers:[],checked_at:null};calendlyStatus={role:'',configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};confirmationLevel='provider_verified';apolloBudget={daily_credit_limit:3,monthly_credit_limit:30};apolloUsage={daily:0,monthly:0};for(const provider of Object.keys(errors))delete errors[provider];window.LeadIntelServiceIntegrationStatus=null;document.querySelectorAll('[data-service-extension="1"]').forEach(node=>node.remove());publishCalendly();queueDecorate(true);}
let installed=false;
let renderQueued=false;
const errors=Object.create(null);

function bridge(){return window.LeadIntelServerBridge||null;}
function workspace(){return bridge()?.workspace||null;}
function signedIn(){return Boolean(bridge()?.session?.authenticated&&workspace()?.id);}
function settingsDrawerOpen(){const drawer=document.getElementById('ai-settings-drawer');return Boolean(drawer&&!drawer.hidden);}
function isOwner(){return serviceStatus.role==='owner'||workspace()?.role==='owner';}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function apiUrl(path){const join=path.includes('?')?'&':'?';return `${API_BASE}${path}${join}workspace_id=${encodeURIComponent(workspace()?.id||'')}`;}
async function api(path,options={}){
  const originContext=settingsContext(),trace=window.LeadIntelSetupTrace?.begin('service_settings');trace?.checkpoint('request','pending');
  try{
    const response=await fetch(apiUrl(path),{credentials:'include',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{}),...(trace?.id?{'X-LeadIntel-Operation-Id':trace.id}:{})}});
    const payload=await response.json().catch(()=>({}));trace?.checkpoint('response',response.ok?'pass':'fail');trace?.finish(!settingsCurrent(originContext)?'stale':response.ok?'pass':'fail');return {response,payload};
  }catch(error){trace?.finish(settingsCurrent(originContext)?'fail':'stale');throw error;}
}
function publishCalendly(){window.LeadIntelCalendlyStatus={...calendlyStatus,workspace_id:workspace()?.id||''};window.dispatchEvent(new CustomEvent('leadintel:calendly-status'));}
function providerState(provider){return serviceStatus.providers.find(row=>row.provider===provider)||null;}
function sourceLabel(row){return row?.source==='customer'?'Your account · billed by provider':'Not connected';}
function statusLabel(row){if(row?.state==='bad')return row.label||'Connection error';if(row?.source==='customer')return 'Connected';return 'Not connected';}
function shortDate(value){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(date);}
function injectCss(){
  if(document.querySelector('link[data-leadintel-asset="service-settings-css"]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=`service-settings-extension.css?v=${SETTINGS_VERSION}`;link.dataset.leadintelAsset='service-settings-css';document.head.appendChild(link);
}
function serviceControls(config,row){
  const disabled=!signedIn()||!isOwner();const configured=Boolean(row?.configured&&row?.source==='customer');const error=errors[config.provider]||'';
  const meta=configured?`Saved key ${esc(row.key_hint||'')} · ${sourceLabel(row)}`:'';
  return `<div class="service-provider-controls service-provider-card" data-service-extension="1" data-service-provider="${config.provider}">
    <div class="service-source-row"><span class="service-source ${row?.source==='customer'?'customer':'managed'}">${esc(sourceLabel(row))}</span><span>${esc(meta)}</span></div>
    ${config.provider==='treg'?'<section data-paid-contact-settings><strong>Paid contact research</strong><div data-paid-settings-controls></div><small>Email and phone have separate permissions. Phone OFF prevents new paid phone requests. Saving preferences does not send messages.</small></section>':''}
    <label class="ai-settings-field">${config.provider==='treg'?'Team token':'API key'}<input data-service-key="${config.provider}" type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" autocapitalize="none" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-service-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':configured?'Replace key':'Test & save'}</button>
      <button class="ai-settings-btn danger" data-service-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
    ${config.provider==='apollo'?'<details class="apollo-settings-details" data-apollo-settings><summary>Apollo settings</summary><div class="apollo-settings-body">':''}
    ${config.provider==='apollo'?`<div data-apollo-capabilities><label><input type="checkbox" data-apollo-discovery ${row?.metadata?.discovery_enabled!==false?'checked':''} ${disabled||!configured?'disabled':''}>People discovery · 0 API credits</label><label><input type="checkbox" data-apollo-email ${row?.metadata?.email_enrichment_enabled===true?'checked':''} ${disabled||!configured?'disabled':''}>Enable email enrichment · uses Apollo credits</label><label><input type="checkbox" data-apollo-phone ${row?.metadata?.phone_enrichment_enabled===true?'checked':''} ${disabled||!configured?'disabled':''}>Enable phone enrichment · uses Apollo credits</label><label>Daily Apollo credit limit<input type="number" min="0" max="1000" data-apollo-daily value="${Number(apolloBudget.daily_credit_limit)||0}" ${disabled?'disabled':''}></label><label>Monthly Apollo credit limit<input type="number" min="0" max="10000" data-apollo-monthly value="${Number(apolloBudget.monthly_credit_limit)||0}" ${disabled?'disabled':''}></label><button type="button" class="ai-settings-btn" data-service-action="apollo-policy" ${disabled||!configured||busy==='apollo'?'disabled':''}>Save Apollo permissions & limits</button><small>Connecting a key does not enable credit-consuming enrichment. Automatic use also requires workflow approval. A phone request can reserve up to 9 credits.</small></div>`:''}
    ${config.provider==='apollo'?'</div></details>':''}
    <div class="ai-provider-error" data-payment-error="${Boolean(window.LeadIntelPaymentError?.(error))}" data-service-error="${config.provider}" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
  </div>`;
}
function calendlyCard(){
  const disabled=!signedIn()||!isOwner();const configured=Boolean(calendlyStatus.configured&&calendlyStatus.connected);const error=errors.calendly||'';
  return `<article class="integration-card customer-service-card" data-integration="calendly"><div class="integration-card-head"><div><strong>Calendly</strong><small>Strategy-call booking conversion</small></div><span class="integration-status ${configured?'good':'neutral'}">${configured?'Connected':'Not connected'}</span></div><p class="integration-purpose">A confirmed booking stops follow-ups and advances the matching CRM company to Meeting.</p><div class="integration-meta">${configured?`Webhook active · token ${esc(calendlyStatus.token_hint||'saved')}${calendlyStatus.last_event_at?` · last event ${shortDate(calendlyStatus.last_event_at)}`:''}`:'Connect a Calendly personal access token once to activate booking detection.'}</div><div class="service-provider-controls service-provider-card" data-service-extension="1">
    <label class="ai-settings-field">Strategy-call URL<input data-calendly-url type="url" autocomplete="url" spellcheck="false" placeholder="https://calendly.com/your-business/meeting" value="${esc(calendlyStatus.scheduling_url||DEFAULT_CALENDLY_URL)}" ${disabled?'disabled':''}></label>
    <label class="ai-settings-field">Personal access token<input data-calendly-token type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" placeholder="${configured?'Enter a new token only to reconnect':'Calendly personal access token'}" ${disabled?'disabled':''}></label>
    <div class="ai-provider-error" data-payment-error="${Boolean(window.LeadIntelPaymentError?.(error))}" data-service-error="calendly" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
    <div class="ai-provider-actions"><button class="ai-settings-btn primary" data-service-action="calendly-save" type="button" ${disabled||busy==='calendly'?'disabled':''}>${busy==='calendly'?'Connecting…':configured?'Reconnect':'Connect Calendly'}</button><button class="ai-settings-btn danger" data-service-action="calendly-disconnect" type="button" ${disabled||!configured||busy==='calendly'?'disabled':''}>Disconnect</button></div>
  </div>${window.LeadIntelToolAccountLinks?.html('calendly')||''}</article>`;
}
function serviceDetail(config,row,current){
  if(config.provider==='apollo')return `${row?.source==='customer'?'Your Apollo account':'Connect your own Apollo key'} · credit reservations ${apolloUsage.daily}/${Number(apolloBudget.daily_credit_limit)||0} today · ${apolloUsage.monthly}/${Number(apolloBudget.monthly_credit_limit)||0} this month`;
  if(row?.source!=='customer')return current;
  if(config.provider==='firecrawl'&&Number.isFinite(Number(row?.metadata?.remaining_credits)))return `Customer-owned credential · ${Number(row.metadata.remaining_credits)} Firecrawl credits remaining${row.last_used_at?` · last used ${shortDate(row.last_used_at)}`:''}`;
  if(config.provider==='treg')return 'Team '+(row.metadata?.team||'connected')+' · '+(Number.isFinite(row.metadata?.balance_usd)?'$'+Number(row.metadata.balance_usd).toFixed(4)+' prepaid balance':'Pay per use')+(row.last_used_at?' · last used '+shortDate(row.last_used_at):'');
  return `Customer-owned credential${row.verified_at?` · verified ${shortDate(row.verified_at)}`:''}${row.last_used_at?` · last used ${shortDate(row.last_used_at)}`:''}`;
}
function connectGoogle(){
  const url=new URL(window.location.href);url.searchParams.set('settings','ai');window.history.replaceState(null,'',url);bridge()?.signIn?.();
}
function needsDecoration(){
  if(!settingsDrawerOpen())return false;
  const grid=document.getElementById('integration-platform-grid');if(!grid)return false;
  for(const config of SETTINGS_PROVIDERS){const card=grid.querySelector(`[data-integration="${config.provider}"]`);if(card&&!card.querySelector('[data-service-extension="1"]'))return true;}
  const health=document.getElementById('integration-health-summary');if(health&&!health.querySelector('.service-readiness-note'))return true;
  const google=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!signedIn()&&google&&!google.querySelector('[data-service-action="google-signin"]')&&!google.querySelector('[data-settings-signin="google"]'))return true;
  const communication=document.getElementById('integration-communication-grid');if(communication&&!communication.querySelector('[data-integration="calendly"]'))return true;
  return false;
}
function decorateReadiness(){
  const health=document.getElementById('integration-health-summary');if(!health)return;
  if(!health.querySelector('.service-readiness-note'))health.insertAdjacentHTML('beforeend','<div class="service-readiness-note"><strong>LeadIntel readiness</strong><span>Google or Microsoft identity + customer-owned provider controls</span></div>');
  const summary=health.querySelector('.integration-summary-copy strong');if(!summary)return;
  if(health.classList.contains('credit-alert')||health.classList.contains('connection-alert'))return;
  if(!signedIn()){summary.textContent='Connect with Google or Microsoft to configure LeadIntel';return;}
  // The critical line (four checks) is written by AI Settings; this note appends the optional tools so both numbers stay honest.
  const optional=[...SETTINGS_PROVIDERS.filter(config=>config.provider!=='firecrawl').map(config=>providerState(config.provider)?.state==='good'),Boolean(calendlyStatus.connected)];
  const observedFirecrawl=window.LeadIntelIntegrationHealth?.firecrawl;
  const base=summary.textContent.replace(/\s*·\s*\d+\/\d+ optional tools connected(\s*·\s*Firecrawl needs attention)?$/,'').trim();
  summary.textContent=`${base} · ${optional.filter(Boolean).length}/${optional.length} optional tools connected${observedFirecrawl?.state==='bad'?' · Firecrawl needs attention':''}`;
}
function decorateGoogleCard(){
  const card=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!card)return;
  card.querySelector('[data-google-connect-extension="1"]')?.remove();
  if(signedIn()||card.querySelector('[data-settings-signin="google"]'))return;
  card.insertAdjacentHTML('beforeend','<div class="google-connect-panel" data-google-connect-extension="1"><button class="ai-settings-btn primary" data-service-action="google-signin" type="button">Connect with Google</button><small>Creates or opens your private LeadIntel workspace.</small></div>');
}
function decorateCards(){
  prepareServiceContext();if(!settingsDrawerOpen())return;
  const grid=document.getElementById('integration-platform-grid');if(!grid)return;
  grid.querySelector('[data-integration="hunter"]')?.remove();
  const section=document.getElementById('platform-integration-heading')?.closest('.ai-settings-section');
  if(section){const heading=section.querySelector('#platform-integration-heading');if(heading)heading.textContent='Data & intelligence integrations';const intro=section.querySelector('.ai-section-title p');if(intro)intro.textContent='Firecrawl reads public websites for research; Treg finds and verifies buyer work e-mails and researches phone numbers with separate permissions. Each user pays their provider directly. No shared paid-service fallback is available. Saved keys are encrypted on the backend.';}
  for(const config of SETTINGS_PROVIDERS){
    let card=grid.querySelector(`[data-integration="${config.provider}"]`);if(!card&&config.provider==='treg'){card=document.createElement('article');card.className='integration-card';card.dataset.integration=config.provider;card.innerHTML=`<div class="integration-card-head"><div><strong>${esc(config.name)}</strong><small>Buyer work e-mail and phone research</small></div><span class="integration-status">Not connected</span></div><p class="integration-purpose"></p><div class="integration-meta"></div>${window.LeadIntelToolAccountLinks?.html(config.provider)||''}`;grid.appendChild(card);}if(!card)continue;
    const row=providerState(config.provider);
    const observed=window.LeadIntelIntegrationHealth?.[config.provider];
    card.classList.add('customer-service-card');
    const purpose=card.querySelector('.integration-purpose');if(purpose)purpose.textContent=config.provider==='treg'?`${config.purpose}.`:`${config.purpose}. Connect your own key. Each user pays their provider directly.`;
    const payment=Boolean(observed?.creditIssue||(row?.credit_issue?.code==='credits_exhausted'&&row.credit_issue.source===row.source));
    const tone=payment?'bad':observed?.state==='bad'||row?.state==='bad'?'warn':observed?.state|| (row?.source&&row.source!=='none'?'good':'neutral');
    const badge=card.querySelector('.integration-status');if(badge){badge.textContent=payment?'Credits exhausted':observed?.label||statusLabel(row);badge.className=`integration-status ${tone}`;}
    const meta=card.querySelector('.integration-meta');if(meta)meta.textContent=observed?.detail||serviceDetail(config,row,meta.textContent);if(meta&&config.provider==='apollo')meta.textContent=serviceDetail(config,row,meta.textContent);
    const existing=card.querySelector('[data-service-extension="1"]');const html=serviceControls(config,row);if(existing){const expanded=Boolean(existing.querySelector('[data-apollo-settings]')?.open);existing.outerHTML=html;if(expanded)card.querySelector('[data-apollo-settings]')?.setAttribute('open','');}else card.insertAdjacentHTML('beforeend',html);
  }
  const communication=document.getElementById('integration-communication-grid');if(communication){const current=communication.querySelector('[data-integration="calendly"]');const html=calendlyCard();if(current)current.outerHTML=html;else communication.insertAdjacentHTML('beforeend',html);}
  window.LeadIntelAdditionalContacts?.mountSettings?.();decorateGoogleCard();decorateReadiness();
}
function queueDecorate(force=false){if(!settingsDrawerOpen())return;if(!force&&!needsDecoration())return;if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;decorateCards();});}
async function refreshServiceStatus(verify=false){
  const requestedWorkspace=workspace()?.id,originContext=prepareServiceContext(),serial=++serviceRequest;
  if(!signedIn()){serviceStatus={role:'',providers:[],checked_at:null};calendlyStatus={role:'',configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};window.LeadIntelServiceIntegrationStatus=null;publishCalendly();queueDecorate(true);return serviceStatus;}
  try{
    const [services,calendly,workflow,budget]=await Promise.all([api(`/api/integrations/services/status${verify?'?verify=1':''}`),api('/api/integrations/calendly/status'),api('/api/approved-workflow'),api('/api/enrichment-policy')]);
    if(!settingsCurrent(originContext)||serial!==serviceRequest)return serviceStatus;if(!services.response.ok)throw new Error(services.payload.error||'Unable to load service integrations');loadedContext=originContext;serviceStatus={...services.payload,workspace_id:requestedWorkspace};window.LeadIntelServiceIntegrationStatus=serviceStatus;window.dispatchEvent(new CustomEvent('leadintel:service-status'));
    if(workflow.response.ok)confirmationLevel=workflow.payload.config?.buyers?.confirmationLevel||'public_confirmed';
    if(budget.response.ok&&budget.payload.policy){apolloBudget=budget.payload.policy;apolloUsage=budget.payload.usage||{daily:0,monthly:0};}
    window.dispatchEvent(new CustomEvent('leadintel:contact-policy-changed'));
    if(calendly.response.ok)calendlyStatus=calendly.payload;else errors.calendly=calendly.payload.error||'Unable to load Calendly status';publishCalendly();
    queueDecorate(true);return serviceStatus;
  }catch(cause){if(!settingsCurrent(originContext)||serial!==serviceRequest)return serviceStatus;console.warn('LeadIntel service integrations:',cause);queueDecorate(true);return serviceStatus;}
}
// A saved or removed key makes the cached health observation stale: drop it so the fresh row renders now, and ask for a re-check.
function credentialChanged(provider){if(window.LeadIntelIntegrationHealth&&provider in window.LeadIntelIntegrationHealth)window.LeadIntelIntegrationHealth[provider]=null;window.dispatchEvent(new CustomEvent('leadintel:service-credential-changed',{detail:{provider}}));}
async function saveService(provider,button){
  prepareServiceContext();
  if(busy||!signedIn()||!isOwner())return;
  const input=document.querySelector(`[data-service-key="${provider}"]`);const apiKey=String(input?.value||'').trim();if(!apiKey){errors[provider]='Enter an API key first.';queueDecorate(true);return;}
  const operation=beginOperation(provider);let failed=false;errors[provider]='';if(button){button.disabled=true;button.textContent='Testing…';}
  try{
    const {response,payload}=await api('/api/integrations/services/provider',{method:'PUT',body:JSON.stringify({provider,api_key:apiKey})});
    if(!settingsCurrent(operation.context))return;
    if(!response.ok)throw new Error(payload.error||'Provider verification failed');if(input)input.value='';credentialChanged(provider);await refreshServiceStatus(false);
  }catch(cause){if(!settingsCurrent(operation.context))return;failed=true;errors[provider]=String(cause?.message||cause);if(button){button.disabled=false;button.textContent=providerState(provider)?.configured?'Replace key':'Test & save';}const node=document.querySelector(`[data-service-error="${provider}"]`);if(node){node.hidden=false;node.dataset.paymentError=String(Boolean(window.LeadIntelPaymentError?.(errors[provider])));node.textContent=errors[provider];}}
  finally{finishOperation(operation,!failed);}
}
async function saveCalendly(button){
  prepareServiceContext();
  if(busy||!signedIn()||!isOwner())return;
  const token=String(document.querySelector('[data-calendly-token]')?.value||'').trim();const schedulingUrl=String(document.querySelector('[data-calendly-url]')?.value||'').trim();
  if(!token){errors.calendly='Enter a Calendly personal access token first.';queueDecorate(true);return;}
  const operation=beginOperation('calendly');errors.calendly='';if(button){button.disabled=true;button.textContent='Connecting…';}
  try{const {response,payload}=await api('/api/integrations/calendly/connect',{method:'PUT',body:JSON.stringify({personal_access_token:token,scheduling_url:schedulingUrl})});if(!settingsCurrent(operation.context))return;if(!response.ok)throw new Error(payload.error||'Calendly connection failed');calendlyStatus=payload;publishCalendly();queueDecorate(true);}
  catch(cause){if(!settingsCurrent(operation.context))return;errors.calendly=String(cause?.message||cause);const node=document.querySelector('[data-service-error="calendly"]');if(node){node.hidden=false;node.dataset.paymentError=String(Boolean(window.LeadIntelPaymentError?.(errors.calendly)));node.textContent=errors.calendly;}}
  finally{finishOperation(operation);}
}
async function disconnectCalendly(){
  prepareServiceContext();
  if(busy||!signedIn()||!isOwner())return;const originContext=settingsContext();
  if(!(await (window.LeadIntelDialogs?.confirm('Disconnect Calendly booking detection from this workspace?')??false))||!settingsCurrent(originContext)||busy)return;
  const operation=beginOperation('calendly');queueDecorate(true);
  try{const {response,payload}=await api('/api/integrations/calendly/disconnect',{method:'DELETE'});if(!settingsCurrent(originContext))return;if(!response.ok)throw new Error(payload.error||'Unable to disconnect Calendly');calendlyStatus={role:serviceStatus.role,configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};publishCalendly();errors.calendly='';}
  catch(cause){if(settingsCurrent(originContext))errors.calendly=String(cause?.message||cause);}finally{finishOperation(operation);}
}
async function disconnectService(provider){
  prepareServiceContext();
  if(busy||!signedIn()||!isOwner())return;const originContext=settingsContext();
  if(!(await (window.LeadIntelDialogs?.confirm(`Disconnect your ${SERVICE_PROVIDERS.find(row=>row.provider===provider)?.name||provider} key? This provider will be unavailable until you connect your own key again.`)??false))||!settingsCurrent(originContext)||busy)return;
  const operation=beginOperation(provider);queueDecorate(true);
  try{const {response,payload}=await api('/api/integrations/services/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!settingsCurrent(originContext))return;if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');errors[provider]='';credentialChanged(provider);await refreshServiceStatus(false);}catch(cause){if(settingsCurrent(originContext))errors[provider]=String(cause?.message||cause);}finally{finishOperation(operation);}
}
window.LeadIntelServiceSettings={refresh:refreshServiceStatus,confirmationLevel:()=>loadedContext===settingsContext()?confirmationLevel:'provider_verified',apolloEnabled:kind=>loadedContext===settingsContext()&&providerState('apollo')?.metadata?.[kind==='phone'?'phone_enrichment_enabled':'email_enrichment_enabled']===true,hunterEnabled:()=>false};
function handleClick(event){
  const button=event.target.closest('[data-service-action]');if(!button||button.disabled)return;
  if(button.dataset.serviceAction==='apollo-policy'){
    prepareServiceContext();
    if(busy||!signedIn()||!isOwner())return;const operation=beginOperation('apollo');const card=button.closest('[data-service-provider="apollo"]');button.disabled=true;
    void api('/api/integrations/services/apollo/settings',{method:'PUT',body:JSON.stringify({discovery:card.querySelector('[data-apollo-discovery]').checked,email:card.querySelector('[data-apollo-email]').checked,phone:card.querySelector('[data-apollo-phone]').checked,daily_limit:Number(card.querySelector('[data-apollo-daily]').value),monthly_limit:Number(card.querySelector('[data-apollo-monthly]').value)})}).then(async({response,payload})=>{if(!settingsCurrent(operation.context))return;if(!response.ok)throw new Error(payload.error);await refreshServiceStatus(false);if(settingsCurrent(operation.context))window.dispatchEvent(new CustomEvent('leadintel:service-settings-changed'));}).catch(error=>{if(settingsCurrent(operation.context))errors.apollo=error.message;}).finally(()=>finishOperation(operation));return;
  }
  if(button.dataset.serviceAction==='google-signin'){connectGoogle();return;}
  if(button.dataset.serviceAction==='calendly-save'){saveCalendly(button);return;}
  if(button.dataset.serviceAction==='calendly-disconnect'){disconnectCalendly();return;}
  const provider=button.dataset.provider;if(!SERVICE_PROVIDERS.some(row=>row.provider===provider))return;
  if(button.dataset.serviceAction==='save')saveService(provider,button);else if(button.dataset.serviceAction==='disconnect')disconnectService(provider);
}
function bind(){
  if(installed)return;installed=true;injectCss();document.addEventListener('click',handleClick);
  const observer=new MutationObserver(()=>{if(needsDecoration())queueDecorate();});observer.observe(document.body,{childList:true,subtree:true});
  for(const event of ['leadintel:workspace-changed','leadintel:workspace-reset'])window.addEventListener(event,()=>{++serviceEpoch;resetServiceContext();void refreshServiceStatus(false);});
  window.addEventListener('leadintel:server-ready',()=>refreshServiceStatus(false));window.addEventListener('leadintel:integration-health',()=>queueDecorate(true));
  document.addEventListener('click',event=>{if(event.target.closest('#open-settings'))setTimeout(()=>refreshServiceStatus(false),0);if(event.target.closest('#test-all-integrations'))setTimeout(()=>refreshServiceStatus(true),0);});
  if(signedIn())refreshServiceStatus(false);else queueDecorate(true);
}

bind();
export {SERVICE_PROVIDERS,refreshServiceStatus,needsDecoration,connectGoogle,DEFAULT_CALENDLY_URL};
