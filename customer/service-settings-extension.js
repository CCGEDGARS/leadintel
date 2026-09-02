const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20260902-customer-owned-integrations-v2';
const SERVICE_PROVIDERS=Object.freeze([
  {provider:'apollo',name:'Apollo.io',placeholder:'Apollo API key',purpose:'Company, decision-maker, email and phone enrichment'},
  {provider:'firecrawl',name:'Firecrawl',placeholder:'fc-…',purpose:'Website scraping, public research and evidence collection'}
]);
let serviceStatus={role:'',providers:[],checked_at:null};
let busy='';
let installed=false;
let renderQueued=false;
const errors=Object.create(null);

function bridge(){return window.LeadIntelServerBridge||null;}
function workspace(){return bridge()?.workspace||null;}
function signedIn(){return Boolean(bridge()?.session?.authenticated&&workspace()?.id);}
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
    <label class="ai-settings-field">API key<input data-service-key="${config.provider}" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    <div class="ai-provider-error" data-service-error="${config.provider}" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-service-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':configured?'Replace key':'Test & save'}</button>
      <button class="ai-settings-btn danger" data-service-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
  </div>`;
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
  const grid=document.getElementById('integration-platform-grid');if(!grid)return false;
  for(const config of SERVICE_PROVIDERS){const card=grid.querySelector(`[data-integration="${config.provider}"]`);if(card&&!card.querySelector('[data-service-extension="1"]'))return true;}
  const health=document.getElementById('integration-health-summary');if(health&&!health.querySelector('.service-readiness-note'))return true;
  const signin=document.getElementById('ai-settings-signin');if(signin&&signin.textContent!=='Connect with Google')return true;
  const google=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!signedIn()&&google&&!google.querySelector('[data-service-action="google-signin"]'))return true;
  return false;
}
function decorateReadiness(){
  const health=document.getElementById('integration-health-summary');if(!health)return;
  if(!health.querySelector('.service-readiness-note'))health.insertAdjacentHTML('beforeend','<div class="service-readiness-note"><strong>LeadIntel readiness</strong><span>Google identity + customer-owned provider controls</span></div>');
  const summary=health.querySelector('.integration-summary-copy strong');if(!summary)return;
  if(!signedIn()){summary.textContent='Connect with Google to configure LeadIntel';return;}
  const aiReady=Boolean(document.querySelector('.ai-provider-card.active'));
  const gmailReady=Boolean(document.querySelector('#integration-communication-grid [data-integration="gmail"] .integration-status.good'));
  const serviceReady=SERVICE_PROVIDERS.filter(config=>providerState(config.provider)?.state==='good').length;
  summary.textContent=`LeadIntel readiness: ${Number(aiReady)+1+Number(gmailReady)+serviceReady}/5 connected`;
}
function decorateGoogleCard(){
  const card=document.querySelector('#integration-communication-grid [data-integration="google"]');if(!card)return;
  card.querySelector('[data-google-connect-extension="1"]')?.remove();
  if(signedIn())return;
  card.insertAdjacentHTML('beforeend','<div class="google-connect-panel" data-google-connect-extension="1"><button class="ai-settings-btn primary" data-service-action="google-signin" type="button">Connect with Google</button><small>Creates or opens your private LeadIntel workspace.</small></div>');
}
function decorateCards(){
  const grid=document.getElementById('integration-platform-grid');if(!grid)return;
  const section=document.getElementById('platform-integration-heading')?.closest('.ai-settings-section');
  if(section){const heading=section.querySelector('#platform-integration-heading');if(heading)heading.textContent='Data & intelligence integrations';const intro=section.querySelector('.ai-section-title p');if(intro)intro.textContent='Add your own Apollo and Firecrawl API keys, or use LeadIntel managed fallback where available. Your saved secrets stay encrypted on the backend.';}
  for(const config of SERVICE_PROVIDERS){
    const card=grid.querySelector(`[data-integration="${config.provider}"]`);if(!card)continue;
    const row=providerState(config.provider);
    card.classList.add('customer-service-card');
    const purpose=card.querySelector('.integration-purpose');if(purpose)purpose.textContent=`${config.purpose}. Add your own key or use the managed fallback.`;
    const badge=card.querySelector('.integration-status');if(badge){badge.textContent=statusLabel(row);badge.className=`integration-status ${row?.state==='bad'?'bad':row?.source?'good':'neutral'}`;}
    const meta=card.querySelector('.integration-meta');if(meta)meta.textContent=serviceDetail(config,row,meta.textContent);
    const existing=card.querySelector('[data-service-extension="1"]');const html=serviceControls(config,row);if(existing)existing.outerHTML=html;else card.insertAdjacentHTML('beforeend',html);
  }
  decorateGoogleCard();decorateReadiness();
  const signin=document.getElementById('ai-settings-signin');if(signin){signin.textContent='Connect with Google';signin.title='Google is your LeadIntel workspace identity. Gmail permissions are connected separately.';}
}
function queueDecorate(force=false){if(!force&&!needsDecoration())return;if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;decorateCards();});}
async function refreshServiceStatus(verify=false){
  if(!signedIn()){serviceStatus={role:'',providers:[],checked_at:null};queueDecorate(true);return serviceStatus;}
  try{
    const {response,payload}=await api(`/api/integrations/services/status${verify?'?verify=1':''}`);
    if(!response.ok)throw new Error(payload.error||'Unable to load service integrations');serviceStatus=payload;queueDecorate(true);return payload;
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
async function disconnectService(provider){
  if(!window.confirm(`Disconnect your ${SERVICE_PROVIDERS.find(row=>row.provider===provider)?.name||provider} key? LeadIntel will return to the managed fallback when available.`))return;
  busy=provider;queueDecorate(true);
  try{const {response,payload}=await api('/api/integrations/services/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');errors[provider]='';await refreshServiceStatus(false);}catch(cause){errors[provider]=String(cause?.message||cause);}finally{busy='';queueDecorate(true);}
}
function handleClick(event){
  const button=event.target.closest('[data-service-action]');if(!button)return;
  if(button.dataset.serviceAction==='google-signin'){connectGoogle();return;}
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
export {SERVICE_PROVIDERS,refreshServiceStatus,needsDecoration,connectGoogle};
