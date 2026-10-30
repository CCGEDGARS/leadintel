import './workspace-storage-ui.js?v=20261012-v1&active-tools-order=20261012-v1&rescue=20261013-v1';
import './personal-linkedin.js?v=20261009-personal-profile-v1';
import './tool-account-links.js?v=20261011-v1&workspace-auth=20261012-v1';
const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const SETTINGS_VERSION='20261014-microsoft-all-entrypoints-v5';
const PROVIDERS=Object.freeze([
  // LeadIntel curates the models a workspace may use (CTO, 2026-10-25): the strongest, the balanced one (recommended)
  // and the best low-cost option per provider. Prices are USD per 1M tokens, input / output, standard tier, read
  // from the providers' pricing pages on 2026-10-25.
  {provider:'openai',name:'OpenAI',model:'gpt-6.1-sol',placeholder:'sk-…',hint:'Recommended for commercial reasoning and controlled writing',models:[
    {id:'gpt-6-astra',label:'GPT-6 Astra',role:'strongest',input:'10.00',output:'50.00'},
    {id:'gpt-6.1-sol',label:'GPT-6.1 Sol',role:'balanced · recommended',input:'2.00',output:'10.00'},
    {id:'gpt-6-luna',label:'GPT-6 Luna',role:'low cost',input:'0.10',output:'0.50'}]},
  {provider:'anthropic',name:'Anthropic',model:'claude-sonnet-5-5',placeholder:'sk-ant-…',hint:'Recommended Claude balance for reasoning and writing',models:[
    {id:'claude-fable-5-1',label:'Claude Fable 5.1',role:'strongest',input:'10.00',output:'50.00'},
    {id:'claude-opus-5-5',label:'Claude Opus 5.5',role:'deep work',input:'4.00',output:'20.00'},
    {id:'claude-sonnet-5-5',label:'Claude Sonnet 5.5',role:'balanced · recommended',input:'2.00',output:'10.00'},
    {id:'claude-haiku-5-5',label:'Claude Haiku 5.5',role:'low cost',input:'0.10',output:'0.50'}]},
  {provider:'gemini',name:'Google Gemini',model:'gemini-3.8-flash',placeholder:'AIza…',hint:'Recommended for grounded research and native PDF recovery',models:[
    {id:'gemini-3.1-pro-preview',label:'Gemini 3.1 Pro (preview)',role:'strongest',input:'2.00',output:'12.00'},
    {id:'gemini-3.8-flash',label:'Gemini 3.8 Flash',role:'balanced · recommended',input:'0.75',output:'3.75'},
    {id:'gemini-2.5-flash-lite',label:'Gemini 2.5 Flash-Lite',role:'low cost',input:'0.10',output:'0.40'}]}
]);
function modelOptionLabel(entry){return `${entry.label} · ${entry.role} · $${entry.input} / $${entry.output} per 1M tokens`;}
let status={role:'',providers:[]};
// Unknown is not 'not connected': statusKnown turns true with the first status answer; statusUnavailable keeps the last failure.
let statusKnown=false,statusUnavailable='';
let integrationStatus={checkedAt:null,checking:false,apollo:null,firecrawl:null,account:null,gmail:null,microsoftMail:null};
let busy='',busyOperation=null,settingsEpoch=0,observedContext='';
function settingsContext(){return JSON.stringify([workspace()?.id||'',bridge()?.session?.user?.id||'',signedIn(),settingsEpoch]);}
function settingsCurrent(context){return context===settingsContext()&&signedIn();}
function prepareSettingsContext(){const context=settingsContext();if(observedContext&&observedContext!==context){++aiStatusGeneration;++integrationStatusGeneration;status={role:'',providers:[]};statusKnown=false;statusUnavailable='';integrationStatus={checkedAt:null,checking:false,apollo:null,firecrawl:null,account:null,gmail:null,microsoftMail:null};window.LeadIntelIntegrationHealth={apollo:null,firecrawl:null};for(const provider of Object.keys(providerErrors))delete providerErrors[provider];busy='';busyOperation=null;unmountCredentialControls();}observedContext=context;return context;}
function beginSettingsOperation(provider){const operation={context:settingsContext(),provider};busyOperation=operation;busy=provider;return operation;}
function finishSettingsOperation(operation,renderUi){if(busyOperation!==operation)return;busyOperation=null;busy='';if(settingsCurrent(operation.context))renderUi();}
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
  const originContext=settingsContext(),trace=window.LeadIntelSetupTrace?.begin('ai_settings');trace?.checkpoint('request','pending');
  try{
    const response=await fetch(apiUrl(path),{credentials:'include',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{}),...(trace?.id?{'X-LeadIntel-Operation-Id':trace.id}:{})}});
    const payload=await response.json().catch(()=>({}));trace?.checkpoint('response',response.ok?'pass':'fail');trace?.finish(!settingsCurrent(originContext)?'stale':response.ok?'pass':'fail');return {response,payload};
  }catch(error){trace?.finish(settingsCurrent(originContext)?'fail':'stale');throw error;}
}
function providerSaveConfirmation({name,model,configured,hasMain}){
  const request=`LeadIntel sends one tiny test request to ${name} with ${model}: a few tokens, billed to your key, well under a cent.`;
  const outcome=configured
    ?'The saved model changes only if the test succeeds.'
    :hasMain
      ?`Your current main engine stays selected; you can switch to ${name} in this card afterwards.`
      :`No main engine is set yet, so ${name} becomes your main engine for AI generation.`;
  return {message:`${request} ${outcome}`,options:{title:`Test & save ${name}`,action:'Test & save'}};
}
function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2800);}
function injectCss(){
  if(document.querySelector('link[data-leadintel-asset="ai-settings-css"]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=`ai-settings.css?v=${SETTINGS_VERSION}&tool-links=20261011-v1&alert-colours=20261011-v1&uniform-actions=20261012-v1&account-layout=20261012-v1`;link.dataset.leadintelAsset='ai-settings-css';document.head.appendChild(link);
}
function injectUi(){
  injectCss();
  const actions=document.querySelector('.top-actions');
  if(actions&&!document.getElementById('open-settings'))actions.insertAdjacentHTML('beforeend','<button class="ghost-btn ai-settings-open ai-settings-btn" id="open-settings" type="button" aria-haspopup="dialog" aria-controls="ai-settings-drawer">Settings</button>');
  if(!document.getElementById('ai-settings-drawer'))document.body.insertAdjacentHTML('beforeend',`<div class="ai-settings-backdrop" id="ai-settings-backdrop" hidden></div>
    <aside class="ai-settings-drawer" id="ai-settings-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" hidden>
      <div class="ai-settings-head">
        <div><span class="eyebrow">Workspace settings</span><h2 id="ai-settings-title">Integration Control Centre</h2><p>Monitor every LeadIntel integration in one place. Each user connects and pays their own providers. Saved credentials are encrypted.</p></div>
        <button class="ai-settings-icon ai-settings-btn" id="close-settings" type="button" aria-label="Close settings">×</button>
      </div>
      <div class="integration-health-summary" id="integration-health-summary">
        <div class="integration-summary-copy"><span>System health</span><strong>Checking integrations…</strong><small>Connection checks do not run paid research or enrichment.</small></div>
        <button class="ai-settings-btn primary" id="test-all-integrations" type="button">Test all integrations</button>
      </div>
      <div class="ai-engine-summary" id="ai-engine-summary"><span>AI engine</span><strong>No provider configured</strong><small>Connect one of the three supported providers below.</small></div>
      <section class="ai-settings-section" aria-labelledby="communication-integration-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Communication</span><h3 id="communication-integration-heading">Account & delivery connections</h3><p>Your sign-in account only identifies you — it gives LeadIntel no access to your mail. To send approved messages, connect a sending mailbox separately below.</p></div></div>
        <div class="integration-grid" id="integration-communication-grid"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="ai-provider-heading">
        <div class="ai-section-title"><div><span class="eyebrow">AI providers</span><h3 id="ai-provider-heading">Customer-owned intelligence engines</h3><p>Add your own API key and choose the model. Connected means the API key is verified. Main engine means LeadIntel uses that provider for normal AI generation. Connected Gemini can separately review research/contact evidence, supply grounded search when primary evidence is missing, and read sparse or scanned source PDFs. Specialist use consumes that provider’s API credits.</p></div></div>
        <div id="company-research-settings"></div><div class="ai-provider-grid" id="ai-provider-grid"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="platform-integration-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Data & intelligence</span><h3 id="platform-integration-heading">Platform integrations</h3><p>Connect your own research and enrichment accounts. Each user pays their provider directly.</p></div></div>
        <div class="integration-grid" id="integration-platform-grid"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="meeting-platform-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Meetings</span><h3 id="meeting-platform-heading">Meeting platform</h3><p>Choose the platform named in your invitations.</p></div></div>
        <label class="ai-settings-field" for="meeting-platform">Video meeting platform<select id="meeting-platform"><option value="zoom">Zoom</option><option value="teams">Microsoft Teams</option><option value="google_meet">Google Meet</option></select></label>
        <p id="meeting-platform-status" role="status" aria-live="polite"></p>
        <p class="meeting-platform-note" id="meeting-platform-note">Set the same platform as the location of your Calendly event. Calendly generates the meeting link after booking. This preference updates future drafts; approved originals stay unchanged.</p>
        <a class="ai-settings-btn" href="https://calendly.com/integrations" target="_blank" rel="noopener noreferrer">Configure conferencing in Calendly ↗</a>
        <div id="meeting-platform-links"></div>
      </section>
      <section class="ai-settings-section" aria-labelledby="personal-linkedin-heading">
        <div class="ai-section-title"><div><span class="eyebrow">Your professional profile</span><h3 id="personal-linkedin-heading">Personal LinkedIn</h3><p>Save your profile for sender identity and open LinkedIn directly from LeadIntel.</p></div></div>
        <article class="integration-card" data-integration="personal-linkedin">
          <div class="integration-card-head"><strong>Your LinkedIn profile</strong><span class="integration-status neutral" id="personal-linkedin-status">No profile saved</span></div>
          <label class="ai-settings-field" for="personal-linkedin-url">Personal profile URL<input id="personal-linkedin-url" type="text" inputmode="url" maxlength="2048" autocomplete="url" placeholder="https://www.linkedin.com/in/your-name/" aria-describedby="personal-linkedin-error personal-linkedin-note"></label>
          <div class="ai-provider-actions"><button class="ai-settings-btn primary" id="personal-linkedin-save" type="button">Save profile</button><a class="ai-settings-btn" id="personal-linkedin-open" target="_blank" rel="noopener noreferrer" hidden>Open my LinkedIn</a><button class="ai-settings-btn danger" id="personal-linkedin-remove" type="button" hidden>Remove profile</button></div>
          <p id="personal-linkedin-error" role="status" aria-live="polite"></p>
          <small id="personal-linkedin-note">Profile link only. No LinkedIn sign-in or automatic sending. LinkedIn opens in a new tab.</small>
          ${globalThis.LeadIntelToolAccountLinks?.html('personal-linkedin')||''}
        </article>
      </section>
      <div class="ai-security-note"><strong>Credential security</strong><span>Customer API keys are sent directly to LeadIntel's authenticated backend, encrypted before database storage and never added to browser workspace data. No platform provider credentials are used for customer requests.</span></div>
    </aside>`);
  const settingsDrawer=document.getElementById('ai-settings-drawer');if(settingsDrawer.dataset.eventsBound)return;settingsDrawer.dataset.eventsBound='true';
  document.getElementById('open-settings')?.addEventListener('click',openDrawer);
  document.getElementById('close-settings')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-settings-backdrop')?.addEventListener('click',closeDrawer);
  document.getElementById('ai-provider-grid')?.addEventListener('click',handleProviderAction);
  document.getElementById('ai-provider-grid')?.addEventListener('change',handleModelModeChange);
  document.getElementById('ai-settings-drawer')?.addEventListener('click',handleCommunicationAction);
  document.getElementById('meeting-platform')?.addEventListener('change',saveMeetingPlatform);
  document.getElementById('personal-linkedin-save')?.addEventListener('click',()=>savePersonalLinkedIn(false));
  document.getElementById('personal-linkedin-remove')?.addEventListener('click',()=>savePersonalLinkedIn(true));
  document.getElementById('test-all-integrations')?.addEventListener('click',testAllIntegrations);
  settingsDrawer.addEventListener('click',saveDossierSettings);
  document.addEventListener('keydown',event=>{const help=document.getElementById('microsoft-connection-help');if(help&&!help.hidden){if(event.key==='Escape'){event.preventDefault();closeMicrosoftHelp();}else if(event.key==='Tab'){const controls=[...help.querySelectorAll('summary,button:not(:disabled),textarea,a[href]')],index=controls.indexOf(document.activeElement);if(event.shiftKey&&index<=0){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0]?.focus();}}return;}if(event.key==='Escape')closeDrawer();});
  render();
}
function renderMeetingPlatform(){
  const select=document.getElementById('meeting-platform');if(!select)return;
  select.value=window.LeadIntelSenderIdentity?.get?.().meetingPlatform||'zoom';
  document.getElementById('meeting-platform-status').textContent='';
  renderMeetingToolLinks();
}
function renderMeetingToolLinks(){const host=document.getElementById('meeting-platform-links');if(host)host.innerHTML=globalThis.LeadIntelToolAccountLinks?.html(document.getElementById('meeting-platform')?.value)||'';}
function saveMeetingPlatform(){
  try{if(!window.LeadIntelSenderIdentity?.setMeetingPlatform)throw Error('Sender profile is still loading. Please retry.');window.LeadIntelSenderIdentity.setMeetingPlatform(document.getElementById('meeting-platform').value);document.getElementById('meeting-platform-status').textContent='Saved. Match this platform in your Calendly event settings.';}
  catch(error){renderMeetingPlatform();document.getElementById('meeting-platform-status').textContent=error.message;}
  renderMeetingToolLinks();
}
function renderPersonalLinkedIn(){
  const input=document.getElementById('personal-linkedin-url');if(!input)return;
  const raw=window.LeadIntelSenderIdentity?.get?.().linkedinUrl||'';
  const url=window.LeadIntelPersonalLinkedIn.normalize(raw);
  input.value=raw;
  const link=document.getElementById('personal-linkedin-open');link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');
  document.getElementById('personal-linkedin-remove').hidden=!raw;
  const badge=document.getElementById('personal-linkedin-status');badge.textContent=url?'Profile linked':'No personal profile saved';badge.className='integration-status '+(url?'good':'neutral');
  input.setAttribute('aria-invalid','false');document.getElementById('personal-linkedin-error').textContent='';
}
function savePersonalLinkedIn(remove){
  const input=document.getElementById('personal-linkedin-url'),message=document.getElementById('personal-linkedin-error');
  try{window.LeadIntelPersonalLinkedIn.save(window.LeadIntelSenderIdentity,remove?'':input.value);renderPersonalLinkedIn();message.textContent=remove?'Profile removed.':'Profile saved to your sender identity.';}
  catch(error){message.textContent=error.message;input.setAttribute('aria-invalid','true');}
}
window.addEventListener('leadintel:sender-identity-changed',()=>{if(settingsDrawerOpen()){renderPersonalLinkedIn();renderMeetingPlatform();}});
window.addEventListener('leadintel:workspace-changed',()=>{renderPersonalLinkedIn();renderMeetingPlatform();});
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
  if(selected===provider)return {state:'good',label:'Signed in',detail:`Signed in as ${identity}`};
  if(selected)return {state:'neutral',label:'Available',detail:`Use ${providerLabel(provider)} instead if that is the account you want for this workspace.`};
  return {state:'good',label:'Signed in',detail:`Signed in as ${identity}. Sign out below, or use ${providerLabel(provider)} if that is the account you want.`};
}
function workspaceProviderAction(provider){
  if(!signedIn())return `<div class="workspace-provider-actions"><button class="ai-settings-btn primary ${provider==='microsoft'?'microsoft':''}" data-settings-signin="${provider}" type="button">${provider==='microsoft'?'Sign in with Microsoft':'Continue with Google'}</button></div>`;
  const selected=authProvider();
  if(selected===provider)return '<div class="workspace-provider-actions"><button class="ai-settings-btn danger" data-settings-signout type="button">Sign out</button></div>';
  if(selected)return `<div class="workspace-provider-actions"><button class="ai-settings-btn" data-settings-switch="${provider}" type="button">Use ${providerLabel(provider)} instead</button></div>`;
  return `<div class="workspace-provider-actions"><button class="ai-settings-btn" data-settings-switch="${provider}" type="button">Use ${providerLabel(provider)} instead</button><button class="ai-settings-btn danger" data-settings-signout type="button">Sign out</button></div>`;
}
// Every customer-owned tool that is ready, in journey order. The fast status rows (loaded with the page) feed the list
// at once; a completed verification wins over the cached row for Firecrawl, so a failed check hides it.
function activeToolItemsFrom({active,integrations={},serviceRows=[],calendly=null}){
  const items=[];
  const row=provider=>serviceRows.find(item=>item.provider===provider)||null;
  const customerGood=item=>Boolean(item&&item.configured&&item.source==='customer'&&item.state==='good');
  if(active)items.push({name:active.name,detail:`AI · ${active.model}`,state:'ACTIVE'});
  const firecrawl=integrations.firecrawl;
  if(firecrawl?firecrawl.source==='customer'&&firecrawl.state==='good':customerGood(row('firecrawl')))items.push({name:'Firecrawl',detail:'Research · your connection',state:'READY'});
  if(customerGood(row('treg')))items.push({name:'Treg',detail:'Buyer e-mails · your connection',state:'READY'});
  if(customerGood(row('apollo')))items.push({name:'Apollo.io',detail:'Enrichment · your connection',state:'READY'});
  if(calendly?.connected)items.push({name:'Calendly',detail:'Meeting bookings',state:'CONNECTED'});
  if(integrations.gmail?.state==='good')items.push({name:'Gmail',detail:'Mail delivery',state:'CONNECTED'});
  if(integrations.microsoftMail?.state==='good')items.push({name:'Microsoft 365',detail:'Mail delivery',state:'CONNECTED'});
  return items;
}
// One definition of critical: the four things a workspace cannot run without. The health line, the Test all toast and
// the readiness note all read this list, so the numbers agree. Optional tools (Treg, Hunter, Apollo, Calendly) are counted separately.
function criticalChecksFrom({activeAi,identity,deliveryReady,firecrawlGood}){
  return [
    {key:'ai',label:'Main AI engine',ok:Boolean(activeAi)},
    {key:'identity',label:'Workspace sign-in',ok:Boolean(identity)},
    {key:'delivery',label:'Sending mailbox',ok:Boolean(deliveryReady)},
    {key:'firecrawl',label:'Firecrawl research',ok:Boolean(firecrawlGood)}
  ];
}
function criticalChecks(){
  const activeAi=Boolean(status.providers.find(item=>item.active&&item.configured));
  const deliveryReady=integrationStatus.gmail?.state==='good'||integrationStatus.microsoftMail?.state==='good';
  const observed=integrationStatus.firecrawl;
  const services=window.LeadIntelServiceIntegrationStatus;
  const row=services&&services.workspace_id===workspace()?.id?(services.providers||[]).find(item=>item.provider==='firecrawl'):null;
  const firecrawlGood=observed?observed.source==='customer'&&observed.state==='good':Boolean(row&&row.configured&&row.source==='customer'&&row.state==='good');
  return criticalChecksFrom({activeAi,identity:signedIn(),deliveryReady,firecrawlGood});
}
function activeToolItems(active){
  const services=window.LeadIntelServiceIntegrationStatus;
  const serviceRows=services&&services.workspace_id===workspace()?.id?(services.providers||[]):[];
  const calendly=window.LeadIntelCalendlyStatus&&window.LeadIntelCalendlyStatus.workspace_id===workspace()?.id?window.LeadIntelCalendlyStatus:null;
  return activeToolItemsFrom({active,integrations:integrationStatus,serviceRows,calendly});
}
function activeToolsSummary(active){
  const items=activeToolItems(active);
  if(!items.length)return '<div class="active-tools-empty">No active tools are ready yet.</div>';
  return `<div class="active-tools-list" role="list" aria-label="Active LeadIntel tools">${items.map(item=>`<div class="active-tool-chip" role="listitem"><div><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></div><span>${esc(item.state)}</span></div>`).join('')}</div>`;
}
function statusNotice(){
  if(statusUnavailable)return 'AI engine status could not be checked just now (network). Showing the last known state. ';
  if(!statusKnown)return 'The first status check is still running. ';
  return '';
}
function renderActiveToolsSummary(){
  if(!settingsDrawerOpen())return;
  const active=status.providers.find(item=>item.active);const connectedCount=status.providers.filter(item=>item.configured).length;
  const summary=document.getElementById('ai-engine-summary');
  if(summary){
    if(!signedIn()){
      summary.innerHTML='<span>Workspace access</span><strong>Sign in to configure LeadIntel</strong><small>Use your existing Google or Microsoft account. Mailbox permissions are connected separately.</small><div class="workspace-signin-options" id="ai-settings-signin"><button class="ai-settings-btn primary" data-settings-signin="google" type="button">Continue with Google</button><button class="ai-settings-btn microsoft" data-settings-signin="microsoft" type="button">Sign in with Microsoft</button></div>';
    }
    else if(active)summary.innerHTML=`<span>Active tools</span><strong class="ai-engine-active-line"><span>Main engine · ${esc(active.name)} · ${esc(active.model)}</span><span class="ai-active-badge" role="status">MAIN ENGINE</span></strong>${activeToolsSummary(active)}<small>${esc(statusNotice())}${connectedCount} AI provider${connectedCount===1?'':'s'} connected · API key verified ${active.verified_at?esc(formatDate(active.verified_at)):'successfully'}${active.last_used_at?` · last used ${esc(formatDateTime(active.last_used_at))}`:''}. Manage every connection in its card below.</small>`;
    else summary.innerHTML=`<span>Active tools</span><strong>${statusKnown||connectedCount?'No main AI engine':statusUnavailable?'AI engine status unavailable':'Checking AI engines…'}</strong>${activeToolsSummary(null)}<small>${esc(statusNotice())}${connectedCount?`${connectedCount} AI provider${connectedCount===1?' is':'s are'} connected. Choose one as the main engine below.`:'Test and save an AI provider below to activate AI generation.'} Manage every connection in its card below.</small>`;
  }
}
function render(){
  const grid=document.getElementById('ai-provider-grid');if(!grid)return;
  if(!settingsDrawerOpen()){unmountCredentialControls();return;}
  renderActiveToolsSummary();
  const researchHost=document.getElementById('company-research-settings');if(researchHost)researchHost.innerHTML=window.LeadIntelCompanyDossierUi?.settingsHtml(status.providers,status.research_settings||{},!signedIn()||!isOwner())||'';
  grid.innerHTML=PROVIDERS.map(config=>providerCard(config,providerState(config.provider)||(statusKnown?null:{pending:true}))).join('');
  renderIntegrationMonitoring();
}
async function saveDossierSettings(event){
 const button=event.target.closest('#save-dossier-settings');if(!button||button.disabled)return;
 const originContext=settingsContext(),primary=document.getElementById('dossier-main-provider')?.value||'',secondary=document.getElementById('dossier-second-provider')?.value||'';
 if(primary&&primary===secondary){toast('Choose a different second researcher.');return;}button.disabled=true;
 try{const {response,payload}=await api('/api/integrations/ai/research-settings',{method:'PUT',body:JSON.stringify({primary,secondary})});if(!settingsCurrent(originContext))return;if(!response.ok)throw Error(payload.error||'Research settings could not be saved');status.research_settings=payload;render();toast('Company research settings saved');}catch(error){if(settingsCurrent(originContext)){toast(error.message);button.disabled=false;}}
}
function handleModelModeChange(event){
  // Model choice is a curated list now; nothing to reveal or hide on change.
  if(!event.target.closest('[data-ai-model-choice]'))return;
}
function integrationTone(check={}){return check.creditIssue?'bad':check.state==='bad'?'warn':check.state||'neutral';}
function paymentError(value=''){return /(?:\b402\b|insufficient_quota|credit_balance_exhausted|billing_hard_limit_reached|payment_required|not_enough_credits|out_of_credits|credits_exhausted|(?:insufficient|exhausted|no|out of|zero)\s+(?:available\s+)?(?:credits?|quota|balance)|(?:credits?|quota|balance)\s+(?:is\s+)?(?:exhausted|depleted)|(?:payment|billing)\s+(?:failed|required|declined|limit)|subscription\s+(?:expired|unpaid))/i.test(String(value));}
function providerCard(config,current){
  const configured=Boolean(current?.configured);const active=Boolean(current?.active);const owner=isOwner();const disabled=!signedIn()||!owner;
  const providerError=providerErrors[config.provider]||'';const paymentIssue=paymentError(providerError);
  const outOfCredits=configured&&current?.credit_issue?.code==='credits_exhausted';
  let stateLabel=providerStateLabel({current,paymentIssue,provider:config.provider});
  const model=current?.model||config.model;const choices=Array.isArray(config.models)?config.models:[];
  // A model saved before the curated list (or removed from it) stays selectable until the owner picks a listed one.
  const options=choices.map(entry=>`<option value="${esc(entry.id)}" ${entry.id===model?'selected':''}>${esc(modelOptionLabel(entry))}</option>`).join('')+(choices.some(entry=>entry.id===model)?'':`<option value="${esc(model)}" selected>${esc(model)} · saved earlier</option>`);
  const usageMeta=current?.last_used_at?` · last used ${esc(formatDateTime(current.last_used_at))}`:'';
  return `<article class="ai-provider-card ${active?'active':''} ${outOfCredits||paymentIssue?'credit-alert':''}" data-provider-card="${config.provider}">
    <div class="ai-provider-head"><div><span class="ai-provider-name">${esc(config.name)}</span><small>${esc(config.hint)} · Your API key · billed by provider</small></div><span class="ai-provider-status ${outOfCredits||paymentIssue?'credit-alert':active?'active':configured?'connected':''}">${stateLabel}</span></div>
    ${outOfCredits?`<div class="ai-credit-warning" role="alert">${esc(config.name)} reported exhausted credits or a billing limit during a real request. Check your ${esc(config.name)} balance and spending limit, then retry. A successful request clears this alert.</div>`:''}
    <label class="ai-settings-field">API key<input data-ai-key="${config.provider}" type="password" autocomplete="new-password" spellcheck="false" data-form-type="other" data-lpignore="true" data-1p-ignore="true" autocapitalize="none" placeholder="${esc(config.placeholder)}" ${disabled?'disabled':''}></label>
    ${globalThis.LeadIntelToolAccountLinks?.html(config.provider)||''}
    <label class="ai-settings-field">Model<select data-ai-model-choice="${config.provider}" ${disabled?'disabled':''}>${options}</select></label>
    <div class="ai-model-note">Three ways to run ${esc(config.name)}: the strongest model, the balanced one we recommend, and the best low-cost option. Prices are per 1M tokens (input / output) and are billed by ${esc(config.name)} to your key. The saved model changes only when you Test &amp; save.</div><div class="ai-model-confirmed" role="status">${configured?`Confirmed model: <strong>${esc(model)}</strong> · tested ${esc(formatDate(current.verified_at))}`:'No model confirmed. Test &amp; save before use.'}</div>${config.provider==='gemini'?'<p class="ai-model-note">Specialist when connected: research/contact evidence review, grounded search fallback and native source-PDF extraction (up to 8 MiB / 60 pages). Main-engine tasks use the provider selected above.</p>':''}
    <div class="ai-key-meta">${configured?`Saved key ${esc(current.key_hint||'')} · API key verified ${esc(formatDate(current.verified_at))}${usageMeta}`:'No credential stored yet.'}</div>
    <div class="ai-provider-error" data-payment-error="${paymentError(providerError)}" data-ai-error="${config.provider}" role="alert" ${providerError?'':'hidden'}>${esc(providerError)}</div>
    <div class="ai-provider-actions">
      <button class="ai-settings-btn primary" data-ai-action="save" data-provider="${config.provider}" type="button" ${disabled||busy===config.provider?'disabled':''}>${busy===config.provider?'Testing…':configured?'Save & test model':'Test & save'}</button>
      <button class="ai-settings-btn" data-ai-action="activate" data-provider="${config.provider}" type="button" ${disabled||!configured||active||busy===config.provider?'disabled':''}>${active?'Main engine ✓':'Make main engine'}</button>
      <button class="ai-settings-btn danger" data-ai-action="disconnect" data-provider="${config.provider}" type="button" ${disabled||!configured||busy===config.provider?'disabled':''}>Disconnect</button>
    </div>
  </article>`;
}
// Badge text for a provider card. Until the first status answer the renderer passes {pending:true} instead of a missing
// row, so the badge says Checking…, not Not connected; a failed re-check keeps whatever was last known.
function providerStateLabel({current,paymentIssue=false,provider=''}){
  const configured=Boolean(current?.configured);const active=Boolean(current?.active);
  const outOfCredits=configured&&current?.credit_issue?.code==='credits_exhausted';
  let label=outOfCredits?'Credits exhausted':active?'Main engine':configured?'Connected · inactive':'Not connected';
  if(paymentIssue)label='Payment required';
  if(provider==='gemini'&&configured&&!active&&!outOfCredits&&!paymentIssue)label='Connected · specialist';
  if(current?.pending&&!paymentIssue)label='Checking…';
  return label;
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
function gmailMailStatus(row=bridge()?.gmail||{}){
  const current={configured:Boolean(row.configured),connected:Boolean(row.connected),email:String(row.email||''),role:row.role||workspace()?.role||''};
  if(!signedIn())return {state:'neutral',label:'Sign in first',detail:'Sign in before connecting your Gmail mailbox.',...current,connected:false};
  if(current.connected)return {state:'good',label:'Connected',detail:`${current.email||'Gmail connected'}${row.connected_at?` · connected ${formatDate(row.connected_at)}`:''}`,...current};
  if(current.configured)return {state:'warn',label:'Not connected',detail:'Connect your existing Gmail mailbox to send approved messages and synchronize replies.',...current};
  return {state:'bad',label:'Unavailable',detail:'Gmail integration is not configured on the LeadIntel platform.',...current};
}
function gmailMailActions(mail){
  if(!signedIn())return '';
  if(mail.connected&&mail.role==='owner')return '<div class="gmail-mail-actions"><button class="ai-settings-btn primary" data-gmail-action="connect" data-gmail-choose="1" type="button">Change Gmail account</button><button class="ai-settings-btn danger" data-gmail-action="disconnect" type="button">Disconnect Gmail</button></div>';
  if(mail.connected)return '';
  const account=authProvider()==='google'?String(bridge()?.session?.user?.email||'').trim():'';
  return `<div class="gmail-mail-actions"><button class="ai-settings-btn primary" data-gmail-action="connect" type="button" ${mail.configured?'':'disabled'}>${account?`Connect Gmail for ${esc(account)}`:'Connect Gmail'}</button><small class="mail-note">${account?'One more Google permission (send and read replies) for the account you signed in with. A different mailbox? Use the account chooser on the next screen.':'One Google permission (send and read replies) for the mailbox you choose on the next screen.'}</small></div>`;
}
function microsoftMailStatus(){
  const row=bridge()?.microsoftMail||{};
  if(!signedIn())return {state:'neutral',label:'Sign in first',detail:'Workspace sign-in is required before connecting Microsoft 365 mail.',configured:Boolean(row.configured),connected:false,email:'',role:''};
  if(row.connected)return {state:'good',label:'Connected',detail:`${row.email||'Microsoft mailbox connected'} · ready for human-approved sending`,...row};
  if(row.configured)return {state:'warn',label:'Not connected',detail:'Microsoft 365 mail is available and ready to connect.',...row};
  return {state:'bad',label:'Unavailable',detail:'Microsoft mail credentials are not configured on the LeadIntel backend.',...row};
}
function microsoftMailActions(mail){
  if(!signedIn())return '';
  if(mail.connected&&mail.role==='owner')return '<div class="microsoft-mail-actions"><button class="ai-settings-btn primary microsoft" data-microsoft-mail-action="connect" type="button">Change Microsoft account</button><button class="ai-settings-btn danger" data-microsoft-mail-action="disconnect" type="button">Disconnect Microsoft</button></div>';
  if(mail.connected)return '';
  return `<div class="microsoft-mail-actions"><button class="ai-settings-btn primary microsoft" data-microsoft-mail-action="connect" type="button" ${mail.configured?'':'disabled'}>Connect Microsoft 365</button><small class="mail-note">One Microsoft permission (send only) for the account you choose on the next screen. LeadIntel never reads that inbox.</small></div>`;
}
function renderIntegrationMonitoring(){
  const platform=document.getElementById('integration-platform-grid');const communication=document.getElementById('integration-communication-grid');const health=document.getElementById('integration-health-summary');
  if(!platform||!communication||!health)return;
  const firecrawl=integrationState(integrationStatus.firecrawl),googleAccount=workspaceProviderStatus('google'),microsoftAccount=workspaceProviderStatus('microsoft'),gmail=integrationState(integrationStatus.gmail),microsoftMail=integrationState(integrationStatus.microsoftMail);
  const checkedSuffix=integrationStatus.checkedAt?` · checked ${formatDateTime(integrationStatus.checkedAt)}`:'';
  platform.innerHTML=`<article class="integration-card" data-integration="firecrawl"><div class="integration-card-head"><div><strong>Firecrawl</strong><small>Website research and evidence verification</small></div><span class="integration-status ${esc(integrationTone(firecrawl))}">${esc(firecrawl.label)}</span></div><p class="integration-purpose">${firecrawl.source==='customer'?'Your Firecrawl key':'Connect your own Firecrawl key. Each user pays their provider directly.'}</p><div class="integration-meta">${esc(firecrawl.detail+checkedSuffix)}</div></article>`;
  const providerCardClass=provider=>signedIn()&&authProvider()?(authProvider()===provider?'is-active':'is-alternate'):'';
  communication.innerHTML=`<article class="integration-card workspace-provider-card ${providerCardClass('google')}" data-integration="google"><div class="integration-card-head"><div><strong>Google Account</strong><small>Workspace sign-in</small></div><span class="integration-status ${esc(integrationTone(googleAccount))}">${esc(googleAccount.label)}</span></div><p class="integration-purpose">The Google account you sign in to LeadIntel with. Gmail for sending is connected separately below.</p><div class="integration-meta">${esc(googleAccount.detail+checkedSuffix)}</div>${workspaceProviderAction('google')}</article>
    <article class="integration-card workspace-provider-card ${providerCardClass('microsoft')}" data-integration="microsoft-account"><div class="integration-card-head"><div><strong>Microsoft Account</strong><small>Workspace sign-in</small></div><span class="integration-status ${esc(integrationTone(microsoftAccount))}">${esc(microsoftAccount.label)}</span></div><p class="integration-purpose">The Microsoft account you sign in to LeadIntel with. Microsoft 365 Mail for sending is connected separately below.</p><div class="integration-meta">${esc(microsoftAccount.detail+checkedSuffix)}</div>${workspaceProviderAction('microsoft')}</article>
    <div class="integration-subheading" role="heading" aria-level="4"><strong>Sending mailbox</strong><span>A separate permission: LeadIntel asks for send and reply access only when you connect a mailbox here. Connect one — Gmail or Microsoft 365.</span></div>
    <article class="integration-card" data-integration="gmail"><div class="integration-card-head"><div><strong>Gmail</strong><small>Sends approved messages and reads replies</small></div><span class="integration-status ${esc(integrationTone(gmail))}">${esc(gmail.label)}</span></div><p class="integration-purpose">Uses your own Gmail account. Nothing is sent without your approval in Delivery.</p><div class="integration-meta">${esc(gmail.detail+checkedSuffix)}</div>${gmailMailActions(gmail)}</article>
    <article class="integration-card microsoft-mail-card" data-integration="microsoft-mail"><div class="integration-card-head"><div><strong>Microsoft 365 Mail</strong><small>Sends approved messages (send-only)</small></div><span class="integration-status ${esc(integrationTone(microsoftMail))}">${esc(microsoftMail.label)}</span></div><p class="integration-purpose">Microsoft Graph · send-only access. LeadIntel cannot read your inbox.</p><div class="integration-meta">${esc(microsoftMail.detail+checkedSuffix)}</div>${microsoftMailActions(microsoftMail)}</article>`;
  for(const card of [...platform.querySelectorAll('[data-integration]'),...communication.querySelectorAll('[data-integration]')]){if(['gmail','microsoft-mail'].includes(card.dataset.integration)||(signedIn()&&card.classList.contains('workspace-provider-card')))continue;card.insertAdjacentHTML('beforeend',globalThis.LeadIntelToolAccountLinks?.html(card.dataset.integration)||'');}
  const activeAi=Boolean(status.providers.find(item=>item.active&&item.configured));
  const deliveryReady=gmail.state==='good'||microsoftMail.state==='good';
  const critical=criticalChecks().map(check=>check.ok);const healthy=critical.filter(Boolean).length;
  const serviceRows=signedIn()&&window.LeadIntelServiceIntegrationStatus?.workspace_id===workspace()?.id?(window.LeadIntelServiceIntegrationStatus?.providers||[]).filter(row=>row.provider==='firecrawl'):[];
  const creditAlerts=[...new Set([...status.providers.filter(item=>item.configured&&item.credit_issue?.code==='credits_exhausted').map(item=>item.name),...PROVIDERS.filter(item=>paymentError(providerErrors[item.provider])).map(item=>item.name)]),...(firecrawl.creditIssue?['Firecrawl']:[])];
  const checked=integrationStatus.checkedAt?`Last checked ${formatDateTime(integrationStatus.checkedAt)}`:'Run diagnostics to check all critical integrations.';
  const connectionAlerts=[firecrawl,gmail,microsoftMail].some(check=>check.state==='bad'&&!check.creditIssue)||serviceRows.some(row=>row.state==='bad'&&row.credit_issue?.code!=='credits_exhausted');
  health.classList.toggle('credit-alert',creditAlerts.length>0);health.classList.toggle('connection-alert',creditAlerts.length===0&&connectionAlerts);
  health.querySelector('.integration-summary-copy').innerHTML=`<span>System health</span><strong>${creditAlerts.length?`Payment alert: ${esc(creditAlerts.join(', '))}`:signedIn()?`${connectionAlerts?'Connection needs attention · ':''}${healthy}/${critical.length} critical checks passing`:'Sign in to run workspace diagnostics'}</strong><small>${esc(checked)}</small>`;
  const button=document.getElementById('test-all-integrations');if(button){button.disabled=!signedIn()||integrationStatus.checking;button.textContent=integrationStatus.checking?'Testing…':'Test all integrations';}
}
let microsoftHelpTrigger=null,microsoftHelpAction=null;
function openMicrosoftHelp(trigger,action){
  microsoftHelpTrigger=trigger;microsoftHelpAction={action,workspaceId:workspace()?.id||'',userId:bridge()?.session?.user?.id||'',authenticated:signedIn()};
  let help=document.getElementById('microsoft-connection-help');
  if(!help){document.getElementById('ai-settings-drawer').insertAdjacentHTML('beforeend',`<div class="microsoft-help-overlay" id="microsoft-connection-help" role="dialog" aria-modal="true" aria-labelledby="microsoft-help-title" hidden><section class="microsoft-help-panel"><h3 id="microsoft-help-title">Connect your Microsoft account</h3>
  <p>Use your existing Microsoft work, school or personal account. You do not need to create an app registration, buy API credits or enter a client secret.</p>
  <p id="microsoft-help-purpose"></p><h4>Complete the connection</h4><ol id="microsoft-help-steps"></ol><details class="microsoft-other-flow"><summary id="microsoft-help-other-title"></summary><ol id="microsoft-help-other-steps"></ol></details>
  <details><summary>Trouble signing in?</summary>
  <h4>Microsoft says approval is required</h4><ol><li>If Microsoft shows <strong>Request approval</strong>, enter: “I need LeadIntel for B2B customer research and approved outreach.” Submit the request.</li><li>If that option is missing, send the message below to your company's IT administrator with a screenshot of the approval page.</li><li>Company approval cannot be bypassed. Wait for your company's decision. Once approved, return here, click <strong>Continue to Microsoft</strong> and use the same account.</li></ol>
  <label for="microsoft-admin-request">Message for your IT administrator</label><textarea id="microsoft-admin-request" readonly rows="4">I am connecting my work account to LeadIntel (https://leadintel.ccgroup.lv). Microsoft requires administrator approval. Please review the requested permissions and approve access if permitted by our company policy. Workspace sign-in and mailbox sending are separate connections; mailbox access is send-only. I have attached the approval screen.</textarea><button class="ai-settings-btn" data-select-microsoft-message="microsoft-admin-request" type="button">Select message to copy</button>
  <h4>Error AADSTS700016: application not found</h4><ol><li>On Microsoft's error page, expand <strong>Troubleshooting details</strong> and click <strong>Copy to clipboard</strong>. If that button is unavailable, take a screenshot showing the error and its details.</li><li>Send those details to LeadIntel support using the email button below. Include the account email you tried and whether you were signing in or connecting a mailbox.</li><li>Wait for confirmation that the registration issue is resolved, then return here and try the same account again.</li></ol><p>LeadIntel support must check the application's configuration and availability. This error cannot be repaired in your Settings. Your IT administrator may also need to review company approval.</p>
  <a class="ai-settings-btn" data-microsoft-support-email href="mailto:edgars@ccgroup.lv?subject=LeadIntel%20Microsoft%20connection%20-%20AADSTS700016&amp;body=Hello%2C%0A%0AI%20cannot%20connect%20Microsoft%20to%20LeadIntel.%0AError%3A%20AADSTS700016%0AAccount%20email%3A%20%5Benter%20email%5D%0AAction%3A%20%5Bworkspace%20sign-in%20or%20mailbox%20connection%5D%0A%0AMicrosoft%20troubleshooting%20details%3A%0A%5Bpaste%20the%20copied%20details%20here%5D%0A">Email LeadIntel support</a><small>Your email app opens a draft. Add the details and send it yourself.</small>
  <h4>Wrong account or forgotten password?</h4><p>If Microsoft shows the wrong email, choose <strong>Use another account</strong>. For a forgotten password, open the correct recovery link:</p><ul><li><a href="https://account.live.com/ResetPassword.aspx" target="_blank" rel="noopener noreferrer">Reset a personal Microsoft account password</a></li><li><a href="https://passwordreset.microsoftonline.com/" target="_blank" rel="noopener noreferrer">Reset a work or school account password</a></li></ul><p>Enter your account email, follow Microsoft's identity-verification prompts and create a new password if recovery is available. Work-account self-service recovery must be enabled by your organisation. If Microsoft blocks recovery or requires company approval, LeadIntel cannot bypass that restriction. Once recovered, return to this popup and use the same account.</p>
  <p>Do not share passwords, client secrets or access tokens. Clearing browser history does not repair an app registration.</p>
  </details><div class="microsoft-help-actions"><button class="ai-settings-btn" data-close-microsoft-help type="button">Cancel</button><button class="ai-settings-btn primary microsoft" data-continue-microsoft type="button">Continue to Microsoft</button></div></section></div>`);help=document.getElementById('microsoft-connection-help');}
  help.querySelector('#microsoft-help-title').textContent=action==='mail'?'Connect Microsoft 365':'Sign in with Microsoft';
  help.querySelector('#microsoft-help-purpose').textContent=action==='mail'?'Connect your mailbox for approved outreach. This requests send permission, not inbox-read permission.':'Sign in to create or open your private LeadIntel workspace. Mailbox connection is separate. A different account may open a different workspace.';
  const signinSteps=['Click Continue to Microsoft below.','Enter the Microsoft email you want to use for LeadIntel. If the wrong account is shown, choose Use another account.','Enter your password and complete any verification prompt.','Review the requested sign-in permissions. Click Accept if you agree. If approval is required, follow the troubleshooting instructions below.','After Microsoft returns you to LeadIntel, reopen Settings.','Check that Microsoft Account says Selected and shows your email address.'];
  const mailSteps=['In Settings, under Microsoft 365 Mail, click Connect Microsoft 365, then Continue to Microsoft.','Select the mailbox you want to send from. Review the send permission and click Accept if you agree. LeadIntel does not request inbox-read permission.','When you return to LeadIntel, open Settings and check that Microsoft 365 Mail says Connected and shows the correct email address.'];
  const mail=action==='mail',steps=mail?mailSteps:signinSteps,otherSteps=mail?signinSteps:mailSteps;
  help.querySelector('#microsoft-help-steps').innerHTML=steps.map(step=>`<li>${esc(step)}</li>`).join('');
  help.querySelector('#microsoft-help-steps').start=mail?7:1;
  help.querySelector('#microsoft-help-other-title').textContent=mail?'Workspace sign-in steps':'Next: connect your sending mailbox';
  help.querySelector('#microsoft-help-other-steps').innerHTML=otherSteps.map(step=>`<li>${esc(step)}</li>`).join('');
  help.querySelector('#microsoft-help-other-steps').start=mail?1:7;
  help.querySelector('.microsoft-other-flow').open=false;
  help.querySelectorAll('details').forEach(section=>{section.open=false;});help.hidden=false;help.querySelector('[data-continue-microsoft]').focus();
}
function closeMicrosoftHelp(){const help=document.getElementById('microsoft-connection-help');if(help)help.hidden=true;if(microsoftHelpTrigger?.isConnected)microsoftHelpTrigger.focus();microsoftHelpTrigger=null;microsoftHelpAction=null;}
async function handleCommunicationAction(event){
  const selectMessage=event.target.closest('[data-select-microsoft-message]');if(selectMessage){const field=document.getElementById(selectMessage.dataset.selectMicrosoftMessage);field?.focus();field?.select();return;}
  if(event.target.closest('[data-continue-microsoft]')){const pending=microsoftHelpAction;if(!pending)return;closeMicrosoftHelp();if(pending.workspaceId!==(workspace()?.id||'')||pending.userId!==(bridge()?.session?.user?.id||'')||pending.authenticated!==signedIn()){toast('Your account changed. Open the Microsoft connection again.');return;}if(pending.action==='mail')bridge()?.connectMicrosoftMail?.();else if(pending.action==='switch')bridge()?.switchProvider?.('microsoft');else signInFromSettings('microsoft');return;}
  if(event.target.closest('[data-close-microsoft-help]')){closeMicrosoftHelp();return;}
  const signInButton=event.target.closest('[data-settings-signin]');
  if(signInButton){if(signInButton.dataset.settingsSignin==='microsoft')openMicrosoftHelp(signInButton,'signin');else signInFromSettings(signInButton.dataset.settingsSignin);return;}
  const signOutButton=event.target.closest('[data-settings-signout]');
  if(signOutButton){bridge()?.signOut?.();return;}
  const switchButton=event.target.closest('[data-settings-switch]');
  if(switchButton){if(switchButton.dataset.settingsSwitch==='microsoft'){openMicrosoftHelp(switchButton,'switch');return;}switchButton.disabled=true;bridge()?.switchProvider?.(switchButton.dataset.settingsSwitch);return;}
  const gmailButton=event.target.closest('[data-gmail-action]');
  const microsoftButton=event.target.closest('[data-microsoft-mail-action]');
  const mailButton=gmailButton||microsoftButton;if(!mailButton||mailButton.disabled)return;
  const provider=gmailButton?'gmail':'microsoft',action=gmailButton?mailButton.dataset.gmailAction:mailButton.dataset.microsoftMailAction,label=provider==='gmail'?'Gmail':'Microsoft 365 mail';
  if(action==='connect'){if(provider==='gmail')bridge()?.connectGmail?.({choose:mailButton.dataset.gmailChoose==='1'});else openMicrosoftHelp(mailButton,'mail');return;}
  const originContext=settingsContext();
  if(action!=='disconnect'||!(await (window.LeadIntelDialogs?.confirm(`Disconnect ${label} from this LeadIntel workspace?`)??false)))return;
  if(!settingsCurrent(originContext))return;mailButton.disabled=true;
  try{
    const result=provider==='gmail'?await bridge()?.disconnectGmail?.():await bridge()?.disconnectMicrosoftMail?.();
    if(!settingsCurrent(originContext))return;
    if(!result?.ok)throw new Error(result?.error||`Unable to disconnect ${label}`);
    if(provider==='gmail')integrationStatus.gmail=gmailMailStatus();else integrationStatus.microsoftMail=microsoftMailStatus();
    renderActiveToolsSummary();renderIntegrationMonitoring();toast(`${label} disconnected`);
  }catch(error){if(settingsCurrent(originContext))toast(error.message);}finally{mailButton.disabled=false;}
}
function setProviderSaveBusy(provider,isBusy){
  const button=document.querySelector(`[data-ai-action="save"][data-provider="${provider}"]`);if(!button)return;
  button.disabled=isBusy;button.textContent=isBusy?'Testing…':'Test & save';
}
function updateProviderErrorUi(provider){
  const message=providerErrors[provider]||'';const paymentIssue=paymentError(message);const current=providerState(provider);
  const node=document.querySelector(`[data-ai-error="${provider}"]`);if(node){node.textContent=message;node.dataset.paymentError=String(paymentIssue);node.hidden=!message;}
  const card=document.querySelector(`[data-provider-card="${provider}"]`);const badge=card?.querySelector('.ai-provider-status');
  const creditAlert=paymentIssue||Boolean(current?.configured&&current?.credit_issue?.code==='credits_exhausted');
  card?.classList.toggle('credit-alert',creditAlert);badge?.classList.toggle('credit-alert',creditAlert);
  if(badge)badge.textContent=paymentIssue?'Payment required':creditAlert?'Credits exhausted':current?.active?'Main engine':current?.configured?(provider==='gemini'?'Connected · specialist':'Connected · inactive'):'Not connected';
  renderIntegrationMonitoring();
}
function clearProviderError(provider){
  providerErrors[provider]='';updateProviderErrorUi(provider);
}
function openDrawer(){
  prepareSettingsContext();injectUi();const drawer=document.getElementById('ai-settings-drawer'),backdrop=document.getElementById('ai-settings-backdrop');
  // Slide in from the right like Ask LeadIntel: unhide first, then add is-open on the next frames so the transition runs.
  if(drawer)drawer.hidden=false;if(backdrop)backdrop.hidden=false;document.body.classList.add('ai-settings-opened');
  const reveal=()=>{drawer?.classList.add('is-open');backdrop?.classList.add('is-open');};if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(()=>window.requestAnimationFrame(reveal));else reveal();
  render();renderPersonalLinkedIn();renderMeetingPlatform();window.dispatchEvent(new CustomEvent('leadintel:settings-opened'));refreshAllStatus();setTimeout(()=>{if(!document.getElementById('microsoft-connection-help')?.hidden&&document.getElementById('microsoft-connection-help'))return;document.getElementById('close-settings')?.focus();},0);
}
function closeDrawer(){
  closeMicrosoftHelp();const drawer=document.getElementById('ai-settings-drawer'),backdrop=document.getElementById('ai-settings-backdrop');
  drawer?.classList.remove('is-open');backdrop?.classList.remove('is-open');
  const finish=()=>{if(drawer&&!drawer.classList.contains('is-open'))drawer.hidden=true;if(backdrop&&!backdrop.classList.contains('is-open'))backdrop.hidden=true;};
  let animated=false;try{animated=typeof drawer?.getAnimations==='function'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{animated=false;}
  if(animated)window.setTimeout(finish,300);else finish();
  unmountCredentialControls();document.body.classList.remove('ai-settings-opened');}
function shouldOpenSettingsFromUrl(){return new URLSearchParams(window.location.search).get('settings')==='ai';}
let aiStatusGeneration=0;
async function refreshStatus(){
  const originContext=prepareSettingsContext(),generation=++aiStatusGeneration;
  if(!signedIn()){status={role:'',providers:[]};render();return status;}
  try{
    const {response,payload}=await api('/api/integrations/ai/status');
    if(!settingsCurrent(originContext)||generation!==aiStatusGeneration)return status;
    if(!response.ok)throw new Error(payload.error||'Unable to load AI settings');status=payload;statusKnown=true;statusUnavailable='';render();return status;
  }catch(error){if(!settingsCurrent(originContext)||generation!==aiStatusGeneration)return status;statusUnavailable=String(error.message||error);render();toast(error.message);return status;}
}
async function checkApolloStatus(){
  const originContext=settingsContext();
  try{
    const {response,payload}=await api('/api/enrichment-policy');
    if(!settingsCurrent(originContext))return null;
    if(!response.ok)throw new Error(payload.error||`Status ${response.status}`);
    const daily=Number(payload.usage?.daily)||0;const monthly=Number(payload.usage?.monthly)||0;const dailyLimit=Number(payload.policy?.daily_credit_limit)||0;const monthlyLimit=Number(payload.policy?.monthly_credit_limit)||0;
    const service=await api('/api/integrations/services/status');
    const apollo=(service.payload?.providers||[]).find(row=>row.provider==='apollo');
    const source=apollo?.source||'none';
    const configured=Boolean(apollo?.configured&&source==='customer');
    if(!configured)return {state:'neutral',source:'none',label:'Not connected',detail:'Connect your own Apollo API key in Settings. Each user pays their provider directly.'};
    if(configured&&((dailyLimit>0&&daily>=dailyLimit)||(monthlyLimit>0&&monthly>=monthlyLimit)))return {state:'bad',label:'Credit limit reached',creditIssue:true,detail:`Workspace Apollo credit limit reached: ${daily}/${dailyLimit} today · ${monthly}/${monthlyLimit} this month. Ask the workspace owner to review the enrichment policy.`};
    if(apollo?.credit_issue?.code==='credits_exhausted'&&apollo.credit_issue.source===apollo.source)return {state:'bad',label:'Credits exhausted',creditIssue:true,detail:'Your Apollo account reported exhausted credits or a billing limit. Check your Apollo plan and billing.'};
    if(!service.response.ok||apollo?.state==='bad')return {state:'bad',label:'Connection error',detail:apollo?.metadata?.error||service.payload?.error||'Apollo connection could not be verified.'};
    return configured?{state:'good',source,label:'Connected',detail:`Your Apollo key · usage ${daily}${dailyLimit?`/${dailyLimit}`:''} today · ${monthly}${monthlyLimit?`/${monthlyLimit}`:''} this month`}:{state:'neutral',source:'none',label:'Not connected',detail:'Connect your Apollo key to enable enrichment.'};
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Apollo status check failed · ${String(error.message||error).slice(0,120)}`};}
}
async function checkFirecrawlStatus(){
  try{
    const {response,payload}=await api('/api/integrations/services/status?verify=1');
    if(!response.ok)throw new Error(payload.error||`Service status returned ${response.status}`);
    const provider=(payload.providers||[]).find(row=>row.provider==='firecrawl');
    if(!provider)throw new Error('Firecrawl service status is missing');
    if(provider.source!=='customer'||!provider.configured)return {state:'neutral',source:'none',label:'Not connected',detail:'Connect your own Firecrawl API key in Settings. Each user pays their provider directly.'};
    const source='customer',owner='Your Firecrawl key';
    if(provider.credit_issue?.code==='credits_exhausted'&&provider.credit_issue.source===source)return {state:'bad',label:'Credits exhausted',creditIssue:true,source,detail:'Your Firecrawl account reported exhausted credits or a billing limit. Check your plan and billing.'};
    const observed=window.LeadIntelDiscoveryUI?.firecrawlHealth?.()||{};
    const latest=observed.lastRunAt?`Last company search ${formatDateTime(observed.lastRunAt)}. `:'';
    if(provider.state==='bad')return {state:'bad',label:'Connection error',source,detail:`${owner}: ${provider.metadata?.error||provider.label||'Credential verification failed'}`};
    if(source==='customer'){
      const rawCredits=provider.metadata?.remaining_credits;
      const credits=rawCredits==null||String(rawCredits).trim()===''?NaN:Number(rawCredits);
      if(Number.isFinite(credits)&&credits<=0)return {state:'bad',label:'No Firecrawl credits',creditIssue:true,source,detail:'Your Firecrawl account reports zero remaining credits. Check your plan, billing or spending limit.'};
      if(Number.isFinite(credits))return {state:'good',label:'Credits available',source,detail:`Your Firecrawl account reports ${credits} remaining credits. This checks the balance, not a paid search.`};
      return {state:'warn',label:'Balance unknown',source,detail:'Your Firecrawl key is connected, but the remaining credit balance could not be confirmed.'};
    }
    return {state:'neutral',source:'none',label:'Not connected',detail:'Connect your own Firecrawl API key in Settings.'};
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Research status check failed · ${String(error.message||error).slice(0,120)}`};}
}
async function checkGmailStatus(){
  try{
    const {response,payload}=await api('/api/integrations/gmail/status');
    if(!response.ok)throw new Error(payload.error||`Status ${response.status}`);
    return gmailMailStatus(payload);
  }catch(error){return {state:'bad',label:'Unavailable',detail:`Gmail status check failed · ${String(error.message||error).slice(0,120)}`};}
}
let integrationStatusGeneration=0;
async function refreshIntegrationStatus(){
  const originContext=prepareSettingsContext(),generation=++integrationStatusGeneration;
  integrationStatus.checking=true;integrationStatus.account=workspaceAccountStatus();integrationStatus.microsoftMail=microsoftMailStatus();renderIntegrationMonitoring();
  if(!signedIn()){integrationStatus={...integrationStatus,checkedAt:new Date().toISOString(),checking:false,apollo:null,firecrawl:null,gmail:null,microsoftMail:microsoftMailStatus()};renderIntegrationMonitoring();return integrationStatus;}
  const checkedAt=new Date().toISOString();
  const refreshMicrosoft=Promise.resolve(bridge()?.refreshMicrosoftMailStatus?.()).catch(()=>null);
  const [apollo,firecrawl,gmail]=await Promise.all([checkApolloStatus(),checkFirecrawlStatus(),checkGmailStatus(),refreshMicrosoft]);
  if(!signedIn()||!settingsCurrent(originContext)||generation!==integrationStatusGeneration)return integrationStatus;
  integrationStatus={checkedAt,checking:false,apollo,firecrawl,account:workspaceAccountStatus(),gmail,microsoftMail:microsoftMailStatus()};window.LeadIntelIntegrationHealth={apollo,firecrawl};window.dispatchEvent(new CustomEvent('leadintel:integration-health'));renderActiveToolsSummary();renderIntegrationMonitoring();return integrationStatus;
}
async function refreshAllStatus(){
  const originContext=settingsContext();await refreshStatus();if(!settingsCurrent(originContext))return {ai:status,integrations:integrationStatus};await refreshIntegrationStatus();return {ai:status,integrations:integrationStatus};
}
async function testAllIntegrations(){
  if(!signedIn()){toast('Sign in with Google or Microsoft to test workspace integrations');return;}
  const originContext=settingsContext();integrationStatus.checking=true;renderIntegrationMonitoring();
  await refreshAllStatus();if(!settingsCurrent(originContext))return;
  const checks=criticalChecks();toast(`${checks.filter(check=>check.ok).length}/${checks.length} critical checks passing`);
}
async function handleProviderAction(event){
  const button=event.target.closest('[data-ai-action]');if(!button||button.disabled)return;
  const provider=button.dataset.provider;const action=button.dataset.aiAction;
  if(action==='save')return saveProvider(provider);
  if(action==='activate')return activateProvider(provider);
  if(action==='disconnect')return disconnectProvider(provider);
}
async function saveProvider(provider){
  prepareSettingsContext();if(!signedIn()||!isOwner()||busy)return;
  const input=document.querySelector(`[data-ai-key="${provider}"]`);const choiceInput=document.querySelector(`[data-ai-model-choice="${provider}"]`);
  const config=PROVIDERS.find(item=>item.provider===provider);const configured=Boolean(providerState(provider)?.configured);
  const apiKey=String(input?.value||'').trim();const model=String(choiceInput?.value||config?.model||'').trim();
  if(!model){toast('Choose a model');choiceInput?.focus();return;}
  if(!apiKey&&!configured){toast('Enter your provider API key first');input?.focus();return;}
  const hasMain=status.providers.some(p=>p.active);
  const confirmation=providerSaveConfirmation({name:config.name,model,configured,hasMain});
  const originContext=settingsContext();
  if(!(await (window.LeadIntelDialogs?.confirm(confirmation.message,confirmation.options)??false)))return;
  if(!settingsCurrent(originContext)||busy)return;
  const operation=beginSettingsOperation(provider);clearProviderError(provider);setProviderSaveBusy(provider,true);
  try{
    const updatingModel=configured&&!apiKey;
    const {response,payload}=await api('/api/integrations/ai/provider',{method:updatingModel?'PATCH':'PUT',body:JSON.stringify(updatingModel?{provider,model}:{provider,api_key:apiKey,model,make_active:Boolean(providerState(provider)?.active)||!status.providers.some(p=>p.active)})});
    if(!response.ok)throw new Error(payload.error||'Provider verification failed');
    if(!settingsCurrent(originContext))return;
    if(input)input.value='';providerErrors[provider]='';
    toast(`${config.name} · ${payload.model} confirmed${payload.active?' · Main engine':''}`);
    await refreshAllStatus();if(!settingsCurrent(originContext))return;window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){
    if(!settingsCurrent(originContext))return;
    providerErrors[provider]=error.message;
    updateProviderErrorUi(provider);
    toast(error.message);
  }finally{finishSettingsOperation(operation,()=>setProviderSaveBusy(provider,false));}
}
async function activateProvider(provider){
  prepareSettingsContext();if(!signedIn()||!isOwner()||busy)return;
  const current=providerState(provider);if(!current?.configured)return;const originContext=settingsContext();
  if(!(await (window.LeadIntelDialogs?.confirm(`Make ${current.name} · ${current.model} the main AI engine? Normal profile, strategy, extraction and writing tasks will use this model. Connected specialists keep their separate research/document roles.`)??false)))return;
  if(!settingsCurrent(originContext)||busy)return;
  const operation=beginSettingsOperation(provider);render();try{
    const {response,payload}=await api('/api/integrations/ai/activate',{method:'POST',body:JSON.stringify({provider,confirmed_model:current.model})});if(!response.ok)throw new Error(payload.error||'Unable to activate provider');
    if(!settingsCurrent(originContext))return;
    await refreshAllStatus();if(!settingsCurrent(originContext))return;toast(`${payload.model} confirmed as main engine`);window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider:payload.provider,model:payload.model}}));
  }catch(error){if(settingsCurrent(originContext))toast(error.message);}finally{finishSettingsOperation(operation,render);}
}
async function disconnectProvider(provider){
  prepareSettingsContext();if(!signedIn()||!isOwner()||busy)return;
  const originContext=settingsContext();if(!settingsCurrent(originContext)||busy)return;
  const operation=beginSettingsOperation(provider);render();try{
    const {response,payload}=await api('/api/integrations/ai/provider',{method:'DELETE',body:JSON.stringify({provider})});if(!response.ok)throw new Error(payload.error||'Unable to disconnect provider');
    if(!settingsCurrent(originContext))return;await refreshAllStatus();if(!settingsCurrent(originContext))return;toast('AI provider disconnected');window.dispatchEvent(new CustomEvent('leadintel:ai-provider-changed',{detail:{provider,disconnected:true}}));
  }catch(error){if(settingsCurrent(originContext))toast(error.message);}finally{finishSettingsOperation(operation,render);}
}

window.LeadIntelMicrosoftConnection={version:SETTINGS_VERSION,openSignIn(trigger){openDrawer();openMicrosoftHelp(trigger,'signin');}};
window.LeadIntelIntegrationAlertTone=integrationTone;window.LeadIntelPaymentError=paymentError;
injectUi();
window.addEventListener('leadintel:service-status',()=>{renderIntegrationMonitoring();renderActiveToolsSummary();});
window.addEventListener('leadintel:calendly-status',()=>renderActiveToolsSummary());
window.addEventListener('leadintel:server-ready',()=>refreshAllStatus());
addEventListener('leadintel:service-credential-changed',()=>{if(signedIn())void refreshIntegrationStatus();});
window.addEventListener('leadintel:workspace-changed',()=>{++settingsEpoch;++aiStatusGeneration;++integrationStatusGeneration;status={role:'',providers:[]};statusKnown=false;statusUnavailable='';integrationStatus={checkedAt:null,checking:false,apollo:null,firecrawl:null,account:null,gmail:null,microsoftMail:null};window.LeadIntelIntegrationHealth={apollo:null,firecrawl:null};for(const provider of Object.keys(providerErrors))delete providerErrors[provider];busy='';busyOperation=null;unmountCredentialControls();refreshAllStatus();});
window.addEventListener('leadintel:gmail-status',()=>{integrationStatus.gmail=gmailMailStatus();renderActiveToolsSummary();renderIntegrationMonitoring();});
window.addEventListener('leadintel:microsoft-mail-status',()=>{integrationStatus.microsoftMail=microsoftMailStatus();renderActiveToolsSummary();renderIntegrationMonitoring();});
if(shouldOpenSettingsFromUrl())openDrawer();
else if(signedIn())refreshAllStatus();
