const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const FIRECRAWL_PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20260915-mail-choice-v2';
const PROVIDERS=Object.freeze([
  {provider:'openai',name:'OpenAI',model:'gpt-5.6',placeholder:'sk-…',hint:'Responses API'},
  {provider:'anthropic',name:'Anthropic',model:'claude-sonnet-4-6',placeholder:'sk-ant-…',hint:'Messages API'},
  {provider:'gemini',name:'Google Gemini',model:'gemini-3.7-flash',placeholder:'AIza…',hint:'GenerateContent API'}
]);
let status={role:'',providers:[]};
let integrationStatus={checkedAt:null,checking:false,apollo:null,firecrawl:null,account:null,gmail:null,microsoftMail:null};
let busy='';
const providerErrors=Object.create(null);

function bridge(){return window.LeadIntelServerBridge||null;}
function workspace(){return bridge()?.workspace||null;}
function signedIn(){return Boolean(bridge()?.session?.authenticated&&workspace()?.id);}
function settingsDrawerOpen(){const drawer=document.getElementById('ai-settings-drawer');return Boolean(drawer&&!drawer.hidden);}
function unmountCredentialControls(){
  document.getElementById('ai-provider-grid')?.replaceChildren();
  document.querySelectorAll('[data-service-extension="1"]').forEach(node=>node.remove());
}
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
        <div><span class="eyebrow">Workspace settings</span><h2 id="ai-settings-title">Integration Control Centre</h2><p>Monitor every LeadIntel integration in one place. Customer-owned credentials are encrypted; platform-managed secrets are never exposed.</p></div>
        <button class="ai-settings-icon ai-settings-btn" id="close-settings" type="button" aria-label="Close settings">×</button>
      </div>
      <div class="integration-health-summary" id="integration-health-summary">
        <div class="integration-summary-copy"><span>System health</span><strong>Checking integrations…</strong><small>Connection checks do not run paid research or enrichment.</small></div>
        <button class="ai-settings-btn primary" id="test-all-integrations" type="button">Test all integrations</button>
      </div>
      <div class="ai-engine-summary" id="ai-engine-summary"><span>AI engine</span><strong>No provider configured</strong><small>Connect one of the three supported providers below.</small></div>
      <section class="ai-settings-section" aria-labelledby="ai-provider-heading">
        <div class="ai-section-title"><div><span class="eyebrow">AI providers</span><h3 id="ai-provider-heading">Customer-owned intelligence engines</h3><p>Add your own API key and choose the model. Connected means the API key is verified. Active means LeadIntel is currently using that provider for normal AI generation.</p></div></div>
        <div class="ai-provider-grid" id="ai-provider-grid"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="platform-integration-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Data & intelligence</span><h3 id="platform-integration-heading">Platform integrations</h3><p>LeadIntel-managed research and enrichment services. You can monitor status and usage, but platform secrets never enter the browser.</p></div></div>
        <div class="integration-grid" id="integration-platform-grid"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="communication-integration-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Communication</span><h3 id="communication-integration-heading">Account & delivery connections</h3><p>Choose Google or Microsoft for workspace access, then connect the mailbox you want LeadIntel to use for approved outreach.</p></div></div>
        <div class="integration-grid" id="integration-communication-grid"></div>
      </section>
      <div class="ai-security-note"><strong>Credential security</strong><span>Customer API keys are sent directly to LeadIntel's authenticated backend, encrypted before database storage and never added to browser workspace data. Platform-managed credentials are not returned to the customer interface.</span></div>
    </aside>`);
  document.getElementById('open-settings')?.addEventListener('click',openDrawer);
  document.getElementById('close-settings')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-settings-backdrop')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-provider-grid')?.addEventListener('click',handleProviderAction);
  document.getElementById('ai-settings-drawer')?.addEventListener('click',handleCommunicationAction);
  document.getElementById('test-all-integrations')?.addEventListener('click',testAllIntegrations);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});
  render();
}
function providerState(id){return status.providers.find(item=>item.provider===id)||null;}
function isOwner(){return status.role==='owner'||workspace()?.role==='owner';}
function signInFromSettings(provider='google'){
  const url=new URL(window.location.href);url.searchParams.set('settings','ai');window.history.replaceState(null,'',url);
  bridge()?.signIn?.(provider);
}
function authProvider(){
  const value=bridge()?.authProvider||'';
  return value==='microsoft'||value==='google'?value:'';
}
function providerLabel(provider){return provider==='microsoft'?'Microsoft':'Google';}
function workspaceProviderStatus(provider){
  const selected=authProvider();
  const user=bridge()?.session?.user;
  const identity=user?.email||user?.name||'workspace user';
  if(!signedIn())return {state:'neutral',label:'Available',detail:`Sign in with ${providerLabel(provider)} to create or open your private LeadIntel workspace.`};
  if(selected===provider)return {state:'good',label:'Selected',detail:`Signed in as ${identity}`};
  if(selected)return {state:'neutral',label:'Available',detail:`Switch to ${providerLabel(provider)} if this is the account you want to use.`};
  return {state:'neutral',label:'Session active',detail:'A workspace session is active. The current sign-in provider is not identified.'};
}
function workspaceProviderAction(provider){
  if(!signedIn())return `<div class="workspace-provider-actions"><button class="ai-settings-btn primary ${provider==='microsoft'?'microsoft':''}" data-settings-signin="${provider}" type="button">Continue with ${providerLabel(provider)}</button></div>`;
  const selected=authProvider();
  if(selected===provider)return '<div class="workspace-provider-actions"><button class="ai-settings-btn danger" data-settings-signout type="button">Sign out</button></div>';
  if(selected)return `<div class="workspace-provider-actions"><button class="ai-settings-btn" data-settings-switch="${provider}" type="button">Switch to ${providerLabel(provider)}</button></div>`;
  return '';
}
function workspaceAccessControls(){
  const selected=authProvider();
  const account=selected?`${providerLabel(selected)} account selected`:'Active workspace session';
  return `<div class="workspace-access-controls"><small>Workspace access · ${esc(account)}</small><button class="ai-settings-btn danger" data-settings-signout type="button">Sign out</button></div>`;
}
function render(){
  const grid=document.getElementById('ai-provider-grid');if(!grid)return;
  if(!settingsDrawerOpen()){unmountCredentialControls();return;}
  const active=status.providers.find(item=>item.active);const connectedCount=status.providers.filter(item=>item.configured).length;
  const summary=document.getElementById('ai-engine-summary');
  if(summary){
    if(!signedIn()){
      summary.innerHTML='<span>Workspace access</span><strong>Sign in to configure LeadIntel</strong><small>Use your existing Google or Microsoft account. Mailbox permissions are connected separately.</small><div class="workspace-signin-options" id="ai-settings-signin"><button class="ai-settings-btn primary" data-settings-signin="google" type="button">Continue with Google</button><button class="ai-settings-btn microsoft" data-settings-signin="microsoft" type="button">Continue with Microsoft</button></div>';
    }
    else if(active)summary.innerHTML=`<span>AI engine</span><strong>Active provider · ${esc(active.name)} · ${esc(active.model)}</strong><small>${connectedCount} provider${connectedCount===1?'':'s'} connected · API key verified ${active.verified_at?esc(formatDate(active.verified_at)):'successfully'}${active.last_used_at?` · last used ${esc(formatDateTime(active.last_used_at))}`:''}.</small>${workspaceAccessControls()}`;
    else summary.innerHTML=`<span>AI engine</span><strong>No active provider</strong><small>${connectedCount?`${connectedCount} provider${connectedCount===1?' is':'s are'} connected. Set one as active to use AI generation.`:'Test and save a provider below to activate AI generation.'}</small>${workspaceAccessControls()}`;
  }
  grid.innerHTML=PROVIDERS.map(config=>providerCard(config,providerState(config.provider))).join('');
  renderIntegrationMonitoring();
}
function providerCard(config,current){
  const configured=Boolean(current?.configured);const active=Boolean(current?.active);const owner=isOwner();const disabled=!signedIn()||!owner;
  const stateLabel=active?'Active':configured?'Connected':'Not connected';
  const model=current?.model||config.model;const providerError=providerErrors[config.provider]||'';
  const usageMeta=current?.last_used_at?` · last used ${esc(formatDateTime(current.last_used_at))}`:'';
  return `<article class="ai-provider-card ${active?'active':''}" data-provider-card="${config.provider}">
    <div class="ai-provider-head"><div><span class="ai-provider-name">${esc(config.name)}</span><small>${esc(config.hint)} · Your API key · billed by provider</small></div><span class="ai-provider-status ${active?'active':configured?'connected':''}">${stateLabel}</span></div>
    <label class="ai-settings-field">API key<input data-ai-key="${config.provider}" type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" autocapitalize="none" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    <label class="ai-settings-field">Model<input data-ai-model="${config.provider}" type="text" value="${esc(model)}" autocomplete="off" ${disabled?'disabled':''}></label>
    <div class="ai-key-meta">${configured?`Saved key ${esc(current.key_hint||'')} · API key verified ${esc(formatDate(current.verified_at))}${usageMeta}`:'No credential stored yet.'}</div>
    <div class="ai-provider-error" data-ai-error="${config.provider}" role="alert" ${providerError?'':'hidden'}>${esc(providerError)}</div>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-ai-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':'Test & save'}</button>
      <button class="ai-settings-btn" data-ai-action="activate" data-provider="${config.provider}" type="button" ${disabled||!configured||active||busy===config.provider?'disabled':''}>${active?'Active provider ✓':'Set as active'}</button>
      <button class="ai-settings-btn danger" data-ai-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
  </article>`;
}
function formatDate(value){
  if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(date);
}
function formatDateTime(value){
  if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
}
function integrationState(value,fallbackLabel='Not checked'){
  return value||{state:'neutral',label:fallbackLabel,detail:'Run diagnostics to refresh this status.'};
}
function workspaceAccountStatus(){
  const user=bridge()?.session?.user;
  if(!signedIn())return {state:'neutral',label:'Available',detail:'Choose Google or Microsoft to create or open your private LeadIntel workspace.'};
  return {state:'good',label:'Workspace active',detail:`Signed in as ${user?.email||user?.name||'workspace user'}`};
}
function microsoftMailStatus(){
  const row=bridge()?.microsoftMail||{};
  if(!signedIn())return {state:'neutral',label:'Sign in first',detail:'Workspace sign-in is required before connecting Microsoft 365 mail.',configured:Boolean(row.configured),connected:false,email:'',role:''};
  if(row.connected)return {state:'good',label:'Connected',detail:`${row.email||'Microsoft mailbox connected'} · ready for human-approved sending`,...row};
  if(row.configured)return {state:'warn',label:'Not connected',detail:'Microsoft 365 mail is available and ready to connect.',...row};
  return {state:'bad',label:'Unavailable',detail:'Microsoft mail credentials are not configured on the LeadIntel backend.',...row};
}
function microsoftMailActions(mail){
  if(!signedIn()||!mail.configured)return '';
  if(mail.connected&&mail.role==='owner')return '<div class="microsoft-mail-actions"><button class="ai-settings-btn danger" data-microsoft-mail-action="disconnect" type="button">Disconnect Microsoft</button></div>';
  if(mail.connected)return '';
  return '<div class="microsoft-mail-actions"><button class="ai-settings-btn primary microsoft" data-microsoft-mail-action="connect" type="button">Connect Microsoft 365</button></div>';
}
function renderIntegrationMonitoring(){
  const platform=document.getElementById('integration-platform-grid');const communication=document.getElementById('integration-communication-grid');const health=document.getElementById('integration-health-summary');
  if(!platform||!communication||!health)return;
  const apollo=integrationState(integrationStatus.apollo),firecrawl=integrationState(integrationStatus.firecrawl),googleAccount=workspaceProviderStatus('google'),microsoftAccount=workspaceProviderStatus('microsoft'),gmail=integrationState(integrationStatus.gmail),microsoftMail=integrationState(integrationStatus.microsoftMail);
  const checkedSuffix=integrationStatus.checkedAt?` · checked ${formatDateTime(integrationStatus.checkedAt)}`:'';
  platform.innerHTML=`<article class="integration-card" data-integration="apollo"><div class="integration-card-head"><div><strong>Apollo.io</strong><small>Decision-maker and contact enrichment</small></div><span class="integration-status ${esc(apollo.state)}">${esc(apollo.label)}</span></div><p class="integration-purpose">Platform managed · LeadIntel never exposes the platform credential.</p><div class="integration-meta">${esc(apollo.detail+checkedSuffix)}</div></article>
    <article class="integration-card" data-integration="firecrawl"><div class="integration-card-head"><div><strong>Firecrawl</strong><small>Website research and evidence verification</small></div><span class="integration-status ${esc(firecrawl.state)}">${esc(firecrawl.label)}</span></div><p class="integration-purpose">Platform managed · secure research proxy.</p><div class="integration-meta">${esc(firecrawl.detail+checkedSuffix)}</div></article>`;
  communication.innerHTML=`<article class="integration-card workspace-provider-card" data-integration="google"><div class="integration-card-head"><div><strong>Google Account</strong><small>Optional workspace sign-in</small></div><span class="integration-status ${esc(googleAccount.state)}">${esc(googleAccount.label)}</span></div><p class="integration-purpose">Choose Google only if you want to use a Google account for LeadIntel workspace access. Gmail is connected separately.</p><div class="integration-meta">${esc(googleAccount.detail+checkedSuffix)}</div>${workspaceProviderAction('google')}</article>
    <article class="integration-card workspace-provider-card" data-integration="microsoft-account"><div class="integration-card-head"><div><strong>Microsoft Account</strong><small>Optional workspace sign-in</small></div><span class="integration-status ${esc(microsoftAccount.state)}">${esc(microsoftAccount.label)}</span></div><p class="integration-purpose">Choose Microsoft only if you want to use a Microsoft account for LeadIntel workspace access. Microsoft 365 Mail is connected separately.</p><div class="integration-meta">${esc(microsoftAccount.detail+checkedSuffix)}</div>${workspaceProviderAction('microsoft')}</article>
    <article class="integration-card" data-integration="gmail"><div class="integration-card-head"><div><strong>Gmail</strong><small>Optional outbound delivery and reply synchronization</small></div><span class="integration-status ${esc(gmail.state)}">${esc(gmail.label)}</span></div><p class="integration-purpose">Mailbox connection is optional and separate from workspace sign-in.</p><div class="integration-meta">${esc(gmail.detail+checkedSuffix)}</div></article>
    <article class="integration-card microsoft-mail-card" data-integration="microsoft-mail"><div class="integration-card-head"><div><strong>Microsoft 365 Mail</strong><small>Optional human-approved outbound delivery</small></div><span class="integration-status ${esc(microsoftMail.state)}">${esc(microsoftMail.label)}</span></div><p class="integration-purpose">Microsoft Graph · send-only access. LeadIntel cannot read your inbox.</p><div class="integration-meta">${esc(microsoftMail.detail+checkedSuffix)}</div>${microsoftMailActions(microsoftMail)}</article>`;
  const activeAi=Boolean(status.providers.find(item=>item.active&&item.configured));
  const deliveryReady=gmail.state==='good'||microsoftMail.state==='good';
  const critical=[activeAi,signedIn(),deliveryReady,apollo.state==='good',firecrawl.state==='good'];const healthy=critical.filter(Boolean).length;
  const checked=integrationStatus.checkedAt?`Last checked ${formatDateTime(integrationStatus.checkedAt)}`:'Run diagnostics to check all critical integrations.';
  health.querySelector('.integration-summary-copy').innerHTML=`<span>System health</span><strong>${signedIn()?`${healthy}/5 critical checks passing`:'Sign in to run workspace diagnostics'}</strong><small>${esc(checked)}</small>`;
  const button=document.getElementById('test-all-integrations');if(button){button.disabled=!signedIn()||integrationStatus.checking;button.textContent=integrationStatus.checking?'Testing…':'Test all integrations';}
}
async function handleCommunicationAction(event){
  const signInButton=event.target.closest('[data-settings-signin]');
  if(signInButton){signInFromSettings(signInButton.dataset.settingsSignin);return;}
  const signOutButton=event.target.closest('[data-settings-signout]');
  if(signOutButton){bridge()?.signOut?.();return;}
  const switchButton=event.target.closest('[data-settings-switch]');
  if(switchButton){switchButton.disabled=true;bridge()?.switchProvider?.(switchButton.dataset.settingsSwitch);return;}
  const mailButton=event.target.closest('[data-microsoft-mail-action]');if(!mailButton||mailButton.disabled)return;
  if(mailButton.dataset.microsoftMailAction==='connect'){bridge()?.connectMicrosoftMail?.();return;}
  if(mailButton.dataset.microsoftMailAction!=='disconnect'||!window.confirm('Disconnect Microsoft 365 mail from this LeadIntel workspace?'))return;
  mailButton.disabled=true;
  try{
    const result=await bridge()?.disconnectMicrosoftMail?.();
    if(!result?.ok)throw new Error(result?.error||'Unable to disconnect Microsoft mail');
    integrationStatus.microsoftMail=microsoftMailStatus();renderIntegrationMonitoring();toast('Microsoft 365 mail disconnected');
  }catch(error){toast(error.message);}finally{mailButton.disabled=false;}
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
  render();refreshAllStatus();setTimeout(()=>document.getElementById('close-settings')?.focus(),0);
}
function closeDrawer(){const drawer=document.getElementById('ai-settings-drawer'),backdrop=document.getElementById('ai-settings-backdrop');if(drawer)drawer.hidden=true;if(backdrop)backdrop.hidden=true;unmountCredentialControls();document.body.classList.remove('ai-settings-opened');}
function shouldOpenSettingsFromUrl(){return new URLSearchParams(window.location.search).get('settings')==='ai';}
async function refreshStatus(){
  if(!signedIn()){status={role:'',providers:[]};render();return status;}
  try{
    const {response,payload}=await api('/api/integrations/ai/status');
    if(!response.ok)throw new Error(payload.error||'Unable to load AI settings');status=payload;render();return status;
  }catch(error){status={role:workspace()?.role||'',providers:[]};render();toast(error.message);return status;}
}
async function checkApolloStatus(){
  try{
    const {response,payload}=await api('/api/enrichment-policy');
    if(!response.ok)throw new Error(payload.error||`Status ${response.status}`);
    const configured=Boolean(payload.configured);const daily=Number(payload.usage?.daily)||0;const monthly=Number(payload.usage?.monthly)||0;const dailyLimit=Number(payload.policy?.daily_credit_limit)||0;const monthlyLimit=Number(payload.policy?.monthly_credit_limit)||0;
    return configured?{state:'good',label:'Operational',detail:`Platform managed · usage ${daily}${dailyLimit?`/${dailyLimit}`:''} today · ${monthly}${monthlyLimit?`/${monthlyLimit}`:''} this month`}:{state:'bad',label:'Not configured',detail:'LeadIntel enrichment service is not configured.'};
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Apollo status check failed · ${String(error.message||error).slice(0,120)}`};}
}
async function checkFirecrawlStatus(){
  try{
    const response=await fetch(FIRECRAWL_PROXY,{method:'OPTIONS',mode:'cors',cache:'no-store'});
    return response.ok?{state:'good',label:'Reachable',detail:'Platform managed · secure proxy reachable. This no-cost check does not claim that the hidden provider credential was exercised.'}:{state:'bad',label:'Unavailable',detail:`Research proxy returned status ${response.status}.`};
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Research proxy reachability failed · ${String(error.message||error).slice(0,120)}`};}
}
async function checkGmailStatus(){
  try{
    const {response,payload}=await api('/api/integrations/gmail/status');
    if(!response.ok)throw new Error(payload.error||`Status ${response.status}`);
    if(payload.connected)return {state:'good',label:'Connected',detail:`${payload.email||'Gmail connected'}${payload.connected_at?` · connected ${formatDate(payload.connected_at)}`:''}`};
    if(payload.configured)return {state:'warn',label:'Not connected',detail:'Gmail is available for this workspace but has not been connected.'};
    return {state:'bad',label:'Unavailable',detail:'Gmail integration is not configured on the LeadIntel platform.'};
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Gmail status check failed · ${String(error.message||error).slice(0,120)}`};}
}
async function refreshIntegrationStatus(){
  integrationStatus.checking=true;integrationStatus.account=workspaceAccountStatus();integrationStatus.microsoftMail=microsoftMailStatus();renderIntegrationMonitoring();
  if(!signedIn()){integrationStatus={...integrationStatus,checkedAt:new Date().toISOString(),checking:false,apollo:null,firecrawl:null,gmail:null,microsoftMail:microsoftMailStatus()};renderIntegrationMonitoring();return integrationStatus;}
  const checkedAt=new Date().toISOString();
  const refreshMicrosoft=Promise.resolve(bridge()?.refreshMicrosoftMailStatus?.()).catch(()=>null);
  const [apollo,firecrawl,gmail]=await Promise.all([checkApolloStatus(),checkFirecrawlStatus(),checkGmailStatus(),refreshMicrosoft]);
  integrationStatus={checkedAt,checking:false,apollo,firecrawl,account:workspaceAccountStatus(),gmail,microsoftMail:microsoftMailStatus()};renderIntegrationMonitoring();return integrationStatus;
}
async function refreshAllStatus(){
  await refreshStatus();await refreshIntegrationStatus();return {ai:status,integrations:integrationStatus};
}
async function testAllIntegrations(){
  if(!signedIn()){toast('Sign in with Google or Microsoft to test workspace integrations');return;}
  integrationStatus.checking=true;renderIntegrationMonitoring();
  await refreshAllStatus();
  const activeAi=Boolean(status.providers.find(item=>item.active&&item.configured));const deliveryReady=integrationStatus.gmail?.state==='good'||integrationStatus.microsoftMail?.state==='good';const checks=[activeAi,integrationStatus.apollo?.state==='good',integrationStatus.firecrawl?.state==='good',integrationStatus.account?.state==='good',deliveryReady];
  toast(`${checks.filter(Boolean).length}/5 critical checks passing`);
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
    await refreshAllStatus();window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){
    providerErrors[provider]=error.message;
    const errorNode=document.querySelector(`[data-ai-error="${provider}"]`);if(errorNode){errorNode.textContent=error.message;errorNode.hidden=false;}
    toast(error.message);
  }finally{if(busy===provider)busy='';setProviderSaveBusy(provider,false);}
}
async function activateProvider(provider){
  busy=provider;render();try{
    const {response,payload}=await api('/api/integrations/ai/activate',{method:'POST',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to activate provider');
    await refreshAllStatus();toast('AI provider activated');window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){toast(error.message);}finally{busy='';render();}
}
async function disconnectProvider(provider){
  busy=provider;render();try{
    const {response,payload}=await api('/api/integrations/ai/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');
    await refreshAllStatus();toast('AI provider disconnected');window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider,disconnected:true}}));
  }catch(error){toast(error.message);}finally{busy='';render();}
}

injectUi();
window.addEventListener('leadintel:server-ready',()=>refreshAllStatus());
window.addEventListener('leadintel:workspace-changed',()=>refreshAllStatus());
window.addEventListener('leadintel:microsoft-mail-status',()=>{integrationStatus.microsoftMail=microsoftMailStatus();renderIntegrationMonitoring();});
if(shouldOpenSettingsFromUrl())openDrawer();
else if(signedIn())refreshAllStatus();
