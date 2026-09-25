const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20260919-calendly-v1';
const DEFAULT_CALENDLY_URL='https://calendly.com/edgars-7go/strategy-call-2';
const SERVICE_PROVIDERS=Object.freeze([
  {provider:'apollo',name:'Apollo.io',placeholder:'Apollo API key',purpose:'Company, decision-maker, email and phone enrichment'},
  {provider:'firecrawl',name:'Firecrawl',placeholder:'fc-…',purpose:'Website scraping, public research and evidence collection'}
]);
let serviceStatus={role:'',providers:[],checked_at:null};
let calendlyStatus={role:'',configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};
let busy='';
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
  const response=await fetch(apiUrl(path),{credentials:'include',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},...options});
  const payload=await response.json().catch(()=>({}));return {response,payload};
}
function providerState(provider){return serviceStatus.providers.find(row=>row.provider===provider)||null;}
function sourceLabel(row){return row?.source==='customer'?'Customer key':row?.source==='managed'?'LeadIntel managed fallback':'Not connected';}
function statusLabel(row){if(row?.state==='bad')return row.label||'Connection error';if(row?.source==='customer')return 'Connected';if(row?.source==='managed')return 'Fallback active';return 'Not connected';}
function shortDate(value){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(date);}
function injectCss(){
  if(document.querySelector('link[data-leadintel-asset="service-settings-css"]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=`service-settings-extension.css?v=${SETTINGS_VERSION}`;link.dataset.leadintelAsset='service-settings-css';document.head.appendChild(link);
}
function serviceControls(config,row){
  const disabled=!signedIn()||!isOwner();const configured=Boolean(row?.configured&&row?.source==='customer');const error=errors[config.provider]||'';
  const meta=configured?`Saved key ${esc(row.key_hint||'')} · ${sourceLabel(row)}`:sourceLabel(row);
  return `<div class="service-provider-controls service-provider-card" data-service-extension="1" data-service-provider="${config.provider}">
    <div class="service-source-row"><span class="service-source ${row?.source==='customer'?'customer':'managed'}">${esc(sourceLabel(row))}</span><span>${esc(meta)}</span></div>
    <label class="ai-settings-field">API key<input data-service-key="${config.provider}" type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" autocapitalize="none" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    <div class="ai-provider-error" data-service-error="${config.provider}" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-service-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':configured?'Replace key':'Test & save'}</button>
      <button class="ai-settings-btn danger" data-service-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
  </div>`;
}
function calendlyCard(){
  const disabled=!signedIn()||!isOwner();const configured=Boolean(calendlyStatus.configured&&calendlyStatus.connected);const error=errors.calendly||'';
  return `<article class="integration-card customer-service-card" data-integration="calendly"><div class="integration-card-head"><div><strong>Calendly</strong><small>Strategy-call booking conversion</small></div><span class="integration-status ${configured?'good':'neutral'}">${configured?'Connected':'Not connected'}</span></div><p class="integration-purpose">A confirmed booking stops follow-ups and advances the matching CRM company to Meeting.</p><div class="integration-meta">${configured?`Webhook active · token ${esc(calendlyStatus.token_hint||'saved')}${calendlyStatus.last_event_at?` · last event ${shortDate(calendlyStatus.last_event_at)}`:''}`:'Connect a Calendly personal access token once to activate booking detection.'}</div><div class="service-provider-controls service-provider-card" data-service-extension="1">
    <label class="ai-settings-field">Strategy-call URL<input data-calendly-url type="url" autocomplete="url" spellcheck="false" value="${esc(calendlyStatus.scheduling_url||DEFAULT_CALENDLY_URL)}" ${disabled?'disabled':''}></label>
    <label class="ai-settings-field">Personal access token<input data-calendly-token type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" placeholder="${configured?'Enter a new token only to reconnect':'Calendly personal access token'}" ${disabled?'disabled':''}></label>
    <div class="ai-provider-error" data-service-error="calendly" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
    <div class="ai-provider-actions"><button class="ai-settings-btn primary" data-service-action="calendly-save" type="button" ${disabled||busy==='calendly'?'disabled':''}>${busy==='calendly'?'Connecting…':configured?'Reconnect':'Connect Calendly'}</button><button class="ai-settings-btn danger" data-service-action="calendly-disconnect" type="button" ${disabled||!configured||busy==='calendly'?'disabled':''}>Disconnect</button></div>
  </div></article>`;
}
function serviceDetail(config,row,current){
  if(row?.source!=='customer')return current;
  if(config.provider==='firecrawl'&&Number.isFinite(Number(row?.metadata?.remaining_credits)))return `Customer-owned credential · ${Number(row.metadata.remaining_credits)} Firecrawl credits remaining${row.last_used_at?` · last used ${shortDate(row.last_used_at)}`:''}`;
  return `Customer-owned credential${row.verified_at?` · verified ${shortDate(row.verified_at)}`:''}${row.last_used_at?` · last used ${shortDate(row.last_used_at)}`:''}`;
}
function connectGoogle(){
  const url=new URL(window.location.href);url.searchParams.set('settings','ai');window.history.replaceState(null,'',url);bridge()?.signIn?.();
}
function needsDecoration(){
  if(!settingsDrawerOpen())return false;
  const grid=document.getElementById('integration-platform-grid');if(!grid)return false;
  for(const config of SERVICE_PROVIDERS){const card=grid.querySelector(`[data-integration="${config.provider}"]`);if(card&&!card.querySelector('[data-service-extension="1"]'))return true;}
  const health=document.getElementById('integration-health-summary');if(health&&!health.querySelector('.service-readiness-note'))return true;
  const google=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!signedIn()&&google&&!google.querySelector('[data-service-action="google-signin"]')&&!google.querySelector('[data-settings-signin="google"]'))return true;
  const communication=document.getElementById('integration-communication-grid');if(communication&&!communication.querySelector('[data-integration="calendly"]'))return true;
  return false;
}
function decorateReadiness(){
  const health=document.getElementById('integration-health-summary');if(!health)return;
  if(!health.querySelector('.service-readiness-note'))health.insertAdjacentHTML('beforeend','<div class="service-readiness-note"><strong>LeadIntel readiness</strong><span>Google or Microsoft identity + customer-owned provider controls</span></div>');
  const summary=health.querySelector('.integration-summary-copy strong');if(!summary)return;
  if(!signedIn()){summary.textContent='Connect with Google or Microsoft to configure LeadIntel';return;}
  const aiReady=Boolean(document.querySelector('.ai-provider-card.active'));
  const deliveryReady=Boolean(document.querySelector('#integration-communication-grid [data-integration="gmail"] .integration-status.good, #integration-communication-grid [data-integration="microsoft-mail"] .integration-status.good'));
  const observedFirecrawl=window.LeadIntelIntegrationHealth?.firecrawl;
  const serviceReady=SERVICE_PROVIDERS.filter(config=>providerState(config.provider)?.state==='good'&&(config.provider!=='firecrawl'||observedFirecrawl?.state==='good')).length;
  const calendlyReady=Boolean(calendlyStatus.connected);
  summary.textContent=`LeadIntel readiness: ${Number(aiReady)+1+Number(deliveryReady)+serviceReady+Number(calendlyReady)}/6 connected${observedFirecrawl?.state==='bad'?' · Firecrawl needs attention':''}`;
}
function decorateGoogleCard(){
  const card=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!card)return;
  card.querySelector('[data-google-connect-extension="1"]')?.remove();
  if(signedIn()||card.querySelector('[data-settings-signin="google"]'))return;
  card.insertAdjacentHTML('beforeend','<div class="google-connect-panel" data-google-connect-extension="1"><button class="ai-settings-btn primary" data-service-action="google-signin" type="button">Connect with Google</button><small>Creates or opens your private LeadIntel workspace.</small></div>');
}
function decorateCards(){
  if(!settingsDrawerOpen())return;
  const grid=document.getElementById('integration-platform-grid');if(!grid)return;
  const section=document.getElementById('platform-integration-heading')?.closest('.ai-settings-section');
  if(section){const heading=section.querySelector('#platform-integration-heading');if(heading)heading.textContent='Data & intelligence integrations';const intro=section.querySelector('.ai-section-title p');if(intro)intro.textContent='Add your own Apollo and Firecrawl API keys, or use LeadIntel managed fallback where available. Your saved secrets stay encrypted on the backend.';}
  for(const config of SERVICE_PROVIDERS){
    const card=grid.querySelector(`[data-integration="${config.provider}"]`);if(!card)continue;
    const row=providerState(config.provider);
    const observed=window.LeadIntelIntegrationHealth?.[config.provider];
    card.classList.add('customer-service-card');
    const purpose=card.querySelector('.integration-purpose');if(purpose)purpose.textContent=`${config.purpose}. Add your own key or use the managed fallback.`;
    const badge=card.querySelector('.integration-status');if(badge){badge.textContent=observed?.label||statusLabel(row);badge.className=`integration-status ${observed?.state|| (row?.state==='bad'?'bad':row?.source?'good':'neutral')}`;}
    const meta=card.querySelector('.integration-meta');if(meta)meta.textContent=observed?.detail||serviceDetail(config,row,meta.textContent);
    const existing=card.querySelector('[data-service-extension="1"]');const html=serviceControls(config,row);if(existing)existing.outerHTML=html;else card.insertAdjacentHTML('beforeend',html);
  }
  const communication=document.getElementById('integration-communication-grid');if(communication){const current=communication.querySelector('[data-integration="calendly"]');const html=calendlyCard();if(current)current.outerHTML=html;else communication.insertAdjacentHTML('beforeend',html);}
  decorateGoogleCard();decorateReadiness();
}
function queueDecorate(force=false){if(!settingsDrawerOpen())return;if(!force&&!needsDecoration())return;if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;decorateCards();});}
async function refreshServiceStatus(verify=false){
  if(!signedIn()){serviceStatus={role:'',providers:[],checked_at:null};calendlyStatus={role:'',configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};queueDecorate(true);return serviceStatus;}
  try{
    const [services,calendly]=await Promise.all([api(`/api/integrations/services/status${verify?'?verify=1':''}`),api('/api/integrations/calendly/status')]);
    if(!services.response.ok)throw new Error(services.payload.error||'Unable to load service integrations');serviceStatus=services.payload;
    if(calendly.response.ok)calendlyStatus=calendly.payload;else errors.calendly=calendly.payload.error||'Unable to load Calendly status';
    queueDecorate(true);return serviceStatus;
  }catch(cause){console.warn('LeadIntel service integrations:',cause);queueDecorate(true);return serviceStatus;}
}
async function saveService(provider,button){
  const input=document.querySelector(`[data-service-key="${provider}"]`);const apiKey=String(input?.value||'').trim();if(!apiKey){errors[provider]='Enter an API key first.';queueDecorate(true);return;}
  busy=provider;errors[provider]='';if(button){button.disabled=true;button.textContent='Testing…';}
  try{
    const {response,payload}=await api('/api/integrations/services/provider',{method:'PUT',body:JSON.stringify({provider,api_key:apiKey})});
    if(!response.ok)throw new Error(payload.error||'Provider verification failed');if(input)input.value='';await refreshServiceStatus(false);
  }catch(cause){errors[provider]=String(cause?.message||cause);busy='';if(button){button.disabled=false;button.textContent=providerState(provider)?.configured?'Replace key':'Test & save';}const node=document.querySelector(`[data-service-error="${provider}"]`);if(node){node.hidden=false;node.textContent=errors[provider];}return;}
  busy='';queueDecorate(true);
}
async function saveCalendly(button){
  const token=String(document.querySelector('[data-calendly-token]')?.value||'').trim();const schedulingUrl=String(document.querySelector('[data-calendly-url]')?.value||'').trim();
  if(!token){errors.calendly='Enter a Calendly personal access token first.';queueDecorate(true);return;}
  busy='calendly';errors.calendly='';if(button){button.disabled=true;button.textContent='Connecting…';}
  try{const {response,payload}=await api('/api/integrations/calendly/connect',{method:'PUT',body:JSON.stringify({personal_access_token:token,scheduling_url:schedulingUrl})});if(!response.ok)throw new Error(payload.error||'Calendly connection failed');calendlyStatus=payload;queueDecorate(true);}
  catch(cause){errors.calendly=String(cause?.message||cause);const node=document.querySelector('[data-service-error="calendly"]');if(node){node.hidden=false;node.textContent=errors.calendly;}}
  finally{busy='';queueDecorate(true);}
}
async function disconnectCalendly(){
  if(!window.confirm('Disconnect Calendly booking detection from this workspace?'))return;
  busy='calendly';queueDecorate(true);
  try{const {response,payload}=await api('/api/integrations/calendly/disconnect',{method:'DELETE'});if(!response.ok)throw new Error(payload.error||'Unable to disconnect Calendly');calendlyStatus={role:serviceStatus.role,configured:false,connected:false,scheduling_url:DEFAULT_CALENDLY_URL,status:'not_connected'};errors.calendly='';}
  catch(cause){errors.calendly=String(cause?.message||cause);}finally{busy='';queueDecorate(true);}
}
async function disconnectService(provider){
  if(!window.confirm(`Disconnect your ${SERVICE_PROVIDERS.find(row=>row.provider===provider)?.name||provider} key? LeadIntel will return to the managed fallback when available.`))return;
  busy=provider;queueDecorate(true);
  try{const {response,payload}=await api('/api/integrations/services/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');errors[provider]='';await refreshServiceStatus(false);}catch(cause){errors[provider]=String(cause?.message||cause);}finally{busy='';queueDecorate(true);}
}
function handleClick(event){
  const button=event.target.closest('[data-service-action]');if(!button)return;
  if(button.dataset.serviceAction==='google-signin'){connectGoogle();return;}
  if(button.dataset.serviceAction==='calendly-save'){saveCalendly(button);return;}
  if(button.dataset.serviceAction==='calendly-disconnect'){disconnectCalendly();return;}
  const provider=button.dataset.provider;if(!SERVICE_PROVIDERS.some(row=>row.provider===provider))return;
  if(button.dataset.serviceAction==='save')saveService(provider,button);else if(button.dataset.serviceAction==='disconnect')disconnectService(provider);
}
function bind(){
  if(installed)return;installed=true;injectCss();document.addEventListener('click',handleClick);
  const observer=new MutationObserver(()=>{if(needsDecoration())queueDecorate();});observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('leadintel:server-ready',()=>refreshServiceStatus(false));
  document.addEventListener('click',event=>{if(event.target.closest('#open-settings'))setTimeout(()=>refreshServiceStatus(false),0);if(event.target.closest('#test-all-integrations'))setTimeout(()=>refreshServiceStatus(true),0);});
  if(signedIn())refreshServiceStatus(false);else queueDecorate(true);
}

bind();
export {SERVICE_PROVIDERS,refreshServiceStatus,needsDecoration,connectGoogle,DEFAULT_CALENDLY_URL};
