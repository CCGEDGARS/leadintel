const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20260824-ai-providers';
const PROVIDERS=Object.freeze([
  {provider:'openai',name:'OpenAI',model:'gpt-5.6',placeholder:'sk-…',hint:'Responses API'},
  {provider:'anthropic',name:'Anthropic',model:'claude-sonnet-4-6',placeholder:'sk-ant-…',hint:'Messages API'},
  {provider:'gemini',name:'Google Gemini',model:'gemini-3.7-flash',placeholder:'AIza…',hint:'GenerateContent API'}
]);
let status={role:'',providers:[]};
let busy='';
const providerErrors=Object.create(null);

function bridge(){return window.LeadIntelServerBridge||null;}
function workspace(){return bridge()?.workspace||null;}
function signedIn(){return Boolean(bridge()?.session?.authenticated&&workspace()?.id);}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function apiUrl(path){const ws=workspace();const join=path.includes('?')?'&':'?';return `${API_BASE}${path}${join}workspace_id=${encodeURIComponent(ws?.id||'')}`;}
async function api(path,options={}){
  const response=await fetch(apiUrl(path),{credentials:'include',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},...options});
  const payload=await response.json().catch(()=>({}));return {response,payload};
}
function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2800);}
function injectCss(){
  if(document.querySelector('link[data-leadintel-asset="ai-settings-css"]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=`ai-settings.css?v=${SETTINGS_VERSION}`;link.dataset.leadintelAsset='ai-settings-css';document.head.appendChild(link);
}
function injectUi(){
  injectCss();
  const actions=document.querySelector('.top-actions');
  if(actions&&!document.getElementById('open-settings'))actions.insertAdjacentHTML('beforeend','<button class="ghost-btn ai-settings-open ai-settings-btn" id="open-settings" type="button" aria-haspopup="dialog" aria-controls="ai-settings-drawer">Settings</button>');
  if(!document.getElementById('ai-settings-drawer'))document.body.insertAdjacentHTML('beforeend',`<div class="ai-settings-backdrop" id="ai-settings-backdrop" hidden></div>
    <aside class="ai-settings-drawer" id="ai-settings-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" hidden>
      <div class="ai-settings-head">
        <div><span class="eyebrow">Workspace settings</span><h2 id="ai-settings-title">Integrations & API Keys</h2><p>LeadIntel stores encrypted credentials for this workspace. Provider usage is billed directly to your own account.</p></div>
        <button class="ai-settings-icon ai-settings-btn" id="close-settings" type="button" aria-label="Close settings">×</button>
      </div>
      <div class="ai-engine-summary" id="ai-engine-summary"><span>AI engine</span><strong>No provider configured</strong><small>Connect one of the three supported providers below.</small></div>
      <section class="ai-settings-section" aria-labelledby="ai-provider-heading">
        <div class="ai-section-title"><div><span class="eyebrow">AI provider</span><h3 id="ai-provider-heading">Choose your intelligence engine</h3><p>Use your own API key. You control the provider account, model access and all usage charges.</p></div></div>
        <div class="ai-provider-grid" id="ai-provider-grid"></div>
      </section>
      <div class="ai-security-note"><strong>Credential security</strong><span>Keys are sent directly to LeadIntel's authenticated backend, encrypted before database storage and never added to browser workspace data.</span></div>
    </aside>`);
  document.getElementById('open-settings')?.addEventListener('click',openDrawer);
  document.getElementById('close-settings')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-settings-backdrop')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-provider-grid')?.addEventListener('click',handleProviderAction);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});
  render();
}
function providerState(id){return status.providers.find(item=>item.provider===id)||null;}
function isOwner(){return status.role==='owner'||workspace()?.role==='owner';}
function render(){
  const grid=document.getElementById('ai-provider-grid');if(!grid)return;
  const active=status.providers.find(item=>item.active);
  const summary=document.getElementById('ai-engine-summary');
  if(summary){
    if(!signedIn())summary.innerHTML='<span>AI engine</span><strong>Sign in to configure workspace AI</strong><small>Your keys belong to an authenticated LeadIntel workspace.</small>';
    else if(active)summary.innerHTML=`<span>AI engine</span><strong>${esc(active.name)} · ${esc(active.model)}</strong><small>Verified ${active.verified_at?esc(formatDate(active.verified_at)):'provider connection'}.</small>`;
    else summary.innerHTML='<span>AI engine</span><strong>No active provider</strong><small>Test and save a provider below to activate AI generation.</small>';
  }
  grid.innerHTML=PROVIDERS.map(config=>providerCard(config,providerState(config.provider))).join('');
}
function providerCard(config,current){
  const configured=Boolean(current?.configured);const active=Boolean(current?.active);const owner=isOwner();const disabled=!signedIn()||!owner;
  const stateLabel=active?'Active':configured?'Verified':'Not connected';
  const model=current?.model||config.model;const providerError=providerErrors[config.provider]||'';
  return `<article class="ai-provider-card ${active?'active':''}" data-provider-card="${config.provider}">
    <div class="ai-provider-head"><div><span class="ai-provider-name">${esc(config.name)}</span><small>${esc(config.hint)} · Your API key · billed by provider</small></div><span class="ai-provider-status ${active?'active':configured?'verified':''}">${stateLabel}</span></div>
    <label class="ai-settings-field">API key<input data-ai-key="${config.provider}" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    <label class="ai-settings-field">Model<input data-ai-model="${config.provider}" type="text" value="${esc(model)}" autocomplete="off" ${disabled?'disabled':''}></label>
    <div class="ai-key-meta">${configured?`Saved key ${esc(current.key_hint||'')} · verified ${esc(formatDate(current.verified_at))}`:'No credential stored yet.'}</div>
    <div class="ai-provider-error" data-ai-error="${config.provider}" role="alert" ${providerError?'':'hidden'}>${esc(providerError)}</div>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-ai-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':'Test & save'}</button>
      <button class="ai-settings-btn" data-ai-action="activate" data-provider="${config.provider}" type="button" ${disabled||!configured||active||busy===config.provider?'disabled':''}>${active?'Active ✓':'Use this provider'}</button>
      <button class="ai-settings-btn danger" data-ai-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
  </article>`;
}
function formatDate(value){
  if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(date);
}
function setProviderSaveBusy(provider,isBusy){
  const button=document.querySelector(`[data-ai-action="save"][data-provider="${provider}"]`);if(!button)return;
  button.disabled=isBusy;button.textContent=isBusy?'Testing…':'Test & save';
}
function clearProviderError(provider){
  providerErrors[provider]='';const node=document.querySelector(`[data-ai-error="${provider}"]`);if(node){node.textContent='';node.hidden=true;}
}
function openDrawer(){
  injectUi();const drawer=document.getElementById('ai-settings-drawer'),backdrop=document.getElementById('ai-settings-backdrop');
  if(drawer)drawer.hidden=false;if(backdrop)backdrop.hidden=false;document.body.classList.add('ai-settings-opened');
  refreshStatus();setTimeout(()=>document.getElementById('close-settings')?.focus(),0);
}
function closeDrawer(){const drawer=document.getElementById('ai-settings-drawer'),backdrop=document.getElementById('ai-settings-backdrop');if(drawer)drawer.hidden=true;if(backdrop)backdrop.hidden=true;document.body.classList.remove('ai-settings-opened');}
async function refreshStatus(){
  if(!signedIn()){status={role:'',providers:[]};render();return status;}
  try{
    const {response,payload}=await api('/api/integrations/ai/status');
    if(!response.ok)throw new Error(payload.error||'Unable to load AI settings');status=payload;render();return status;
  }catch(error){status={role:workspace()?.role||'',providers:[]};render();toast(error.message);return status;}
}
async function handleProviderAction(event){
  const button=event.target.closest('[data-ai-action]');if(!button||button.disabled)return;
  const provider=button.dataset.provider;const action=button.dataset.aiAction;
  if(action==='save')return saveProvider(provider);
  if(action==='activate')return activateProvider(provider);
  if(action==='disconnect')return disconnectProvider(provider);
}
async function saveProvider(provider){
  const input=document.querySelector(`[data-ai-key="${provider}"]`);const modelInput=document.querySelector(`[data-ai-model="${provider}"]`);
  const apiKey=String(input?.value||'').trim();const model=String(modelInput?.value||'').trim();if(!apiKey){toast('Enter your provider API key first');input?.focus();return;}
  clearProviderError(provider);busy=provider;setProviderSaveBusy(provider,true);
  try{
    const {response,payload}=await api('/api/integrations/ai/provider',{method:'PUT',body:JSON.stringify({provider,api_key:apiKey,model,make_active:true})});
    if(!response.ok)throw new Error(payload.error||'Provider verification failed');
    input.value='';providerErrors[provider]='';busy='';
    toast(`${payload.provider==='gemini'?'Google Gemini':payload.provider==='anthropic'?'Anthropic':'OpenAI'} verified and active`);
    await refreshStatus();window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){
    providerErrors[provider]=error.message;
    const errorNode=document.querySelector(`[data-ai-error="${provider}"]`);if(errorNode){errorNode.textContent=error.message;errorNode.hidden=false;}
    toast(error.message);
  }finally{if(busy===provider)busy='';setProviderSaveBusy(provider,false);}
}
async function activateProvider(provider){
  busy=provider;render();try{
    const {response,payload}=await api('/api/integrations/ai/activate',{method:'POST',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to activate provider');
    await refreshStatus();toast('AI provider activated');window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){toast(error.message);}finally{busy='';render();}
}
async function disconnectProvider(provider){
  busy=provider;render();try{
    const {response,payload}=await api('/api/integrations/ai/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');
    await refreshStatus();toast('AI provider disconnected');window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider,disconnected:true}}));
  }catch(error){toast(error.message);}finally{busy='';render();}
}

injectUi();
window.addEventListener('leadintel:server-ready',()=>refreshStatus());
window.addEventListener('leadintel:workspace-changed',()=>refreshStatus());
if(signedIn())refreshStatus();