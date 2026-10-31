/*
 * Deferred dependency-order contract. shell-support-loader.js executes this
 * established order after window.load so none of these optional features can
 * block the journey shell. These import signatures remain documented because
 * release tests audit their versions and ordering.
 * import './workspace-reset-hygiene.js?v=20260917-task-reset-v1';
 * import './workspace-persistence.js?v=20260928-sync-timeout-v1&refresh-protection=1&auto-save=1&research-sync=20261002-v1&sync-recovery=20261004-v2&nested-research-sync=20261005-v3&sync-baseline=20261005-v3&section-capability=20261009-v1&sync-contention=20261011-v1&capacity-diagnostics=20261011-v1&bundle-sync=20261011-v1&text-compression=20261011-v3&snapshot-quota=20261011-v1&indexed-snapshot=20261011-v1&snapshot-body=20261016-v1&sync-budget=20261019-v1&company-save=20261019-v1&research-recovery=20261020-v1&workspace-save=20261020-v1&finish-core=20261024-v1&sender-identity-save=20261025-v1';
 * import './state-budget.js?v=20261009-workspace-section-sync-v1&lossless-recovery=20261009-v1&my-flows=20261010-v1&capacity-diagnostics=20261011-v1&bundle-sync=20261011-v1&text-compression=20261011-v3&codec-loader=20261011-v1&snapshot-quota=20261011-v1&research-recovery=20261020-v1';
 * import './website-input-sync.js?v=20260901-saved-state-v2';
 * import './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5';
 * import './website-activation.js?v=20260916-ercon-context-v1';
 * import './crm-engine.js?v=20260828-master-crm-v1&commercial-evidence=20261002-v2';
 * import './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1';
 * import './server-bridge.js?v=20260925-apollo-buyer-search-v1&research-recovery=20261020-v1&workspace-save=20261020-v1&messages-reliability=20261031-v1&delivery-reliability=20261031-v1';
 * import './crm-presentation.js?v=20260924-crm-evidence-activity-v1';
 * import './crm-ui.js?v=20260928-crm-buyer-recovery-v1&app-dialogs=20261017-v1';
 * import './ai-settings.js?v=20260915-model-choice-v1&app-dialogs=20261017-v1&badge-refresh=20261024-v1&paid-controls=20261029-v1';
 * import './service-settings-extension.js?v=20260925-provider-credit-health-v1&optional-hunter=20261004-v1&app-dialogs=20261017-v1&badge-refresh=20261024-v1&paid-controls=20261029-v1';
 * import './step2-readiness-engine.js?v=20260924-friendly-workflow-labels-v1';
 * import './content-language.js?v=20260924-workspace-content-english-v1';
 * import './content-variants.js?v=20260929-public-first-email-v1&app-dialogs=20261017-v1';
 * import './business-identity.js?v=20260924-workspace-profile-english-v1';
 * import './company-brain.js?v=20260924-workspace-profile-english-v1';
 * import './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1';
 * import './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1&adaptive-evidence=1&research-pipeline=20260930-v1';
 * import './linkedin-signals.js?v=20260907-public-index-v1';
 * import './company-research-security.js?v=20260918-translation-fidelity-v3&messages-reliability=20261031-v1';
 * import './company-research-ui.js?v=20260926-guidance-status-v3&research-pipeline=20260930-v1&messages-reliability=20261031-v1';
 * import './company-profile-handoff.js?v=20260826-intelligence-autofill-v1&in-place-handoff=20261024-v1';
 * import './reference-customers.js?v=20260927-opportunity-map-durable-v1&reference-discovery=5&reference-similarity=20260930-v1';
 * import './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1';
 * import './reference-customer-smart-import.js?v=20260923-reference-interface-v1';
 * import './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1&reference-similarity=20260930-v1&research-pipeline=20260930-v1';
 * import './reference-customer-ui.js?v=20260927-opportunity-map-durable-v1&opportunity-context=1&reference-discovery=5&reference-similarity=20260930-v1';
 * import './reference-customer-clear-list.js?v=20260923-reference-interface-v1';
 * import './reference-customer-website-enrichment.js?v=20260923-reference-interface-v1&reference-discovery=5';
 * import './reference-customer-ai-runtime.js?v=20260927-opportunity-map-durable-v1&reference-discovery=5&reference-similarity=20260930-v1&research-pipeline=20260930-v1';
 * import './reference-customer-launcher.js?v=20260927-opportunity-map-durable-v1&reference-discovery=5&reference-similarity=20260930-v1';
 * import './lookalike-discovery.js?v=20260930-contact-suppression-v1&opportunity-context=1&reference-discovery=5&reference-similarity=20260930-v1&commercial-evidence=20261002-v2&qualification=20261003-qualified-v2';
 * import './intelligence-sources-ui.js?v=20260915-preferred-sources-v1&app-dialogs=20261017-v1';
 * import './profile-action-runtime.js?v=20260924-friendly-workflow-labels-v1';
 * import './outreach-automation-loader.js?v=20260930-contact-suppression-v1&qualification=20261003-qualified-v2&app-dialogs=20261017-v1&messages-reliability=20261031-v1&delivery-reliability=20261031-v1';
 * import './copilot-loader.js?v=20261011-business-research-v1&book-skills=20261027-v1';
 */

(()=>{
function initializeVerifiedProcessMap(){
const PROCESS_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const processMap=document.getElementById("commercial-process-map");
let expandedSidebarStage=0;

function readProcessState(){try{return JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY)||"{}");}catch{return {};}}
function ensureReferenceCustomerTool(){
  const step=document.getElementById("step-2");if(!step)return;const existing=step.querySelector("[data-reference-intelligence-card]"),home=document.getElementById("campaign-planning-host");if(existing){const next=document.getElementById("website-scanning-card")||home;if(next&&next.parentNode===step&&existing.nextElementSibling!==next)next.before(existing);return;}
  const actions=step.querySelector(".step-actions");if(!actions)return;
  const card=document.createElement("section");card.className="panel brand-identity-panel reference-customer-core-card planning-card";card.dataset.referenceIntelligenceCard="true";card.style.marginTop="16px";
  card.classList.add('feature-focus','reference-feature');
  card.innerHTML='<div class="brand-identity-summary"><div class="brand-identity-intro"><div class="planning-card-label"><span class="eyebrow">Companies &amp; Market Intelligence</span><span class="planning-optional">Optional</span></div><h3>Find more companies like your best customers.</h3><p class="reference-value-lead">Use customer examples and market research to improve your targeting. Find similar companies and spot relevant sales opportunities.</p></div><button class="brand-identity-toggle lookalike-build-btn planning-card-action" type="button" data-reference-customers-manage aria-haspopup="dialog" aria-controls="reference-customer-modal"><span>Explore companies &amp; market</span><span aria-hidden="true">→</span></button></div>';
  const scan=document.getElementById("website-scanning-card");actions.parentNode.insertBefore(card,scan&&scan.parentNode===step?scan:home&&home.parentNode===step?home:actions);
}
function patchMarketLookalikeIsolation(){
  const market=window.LeadIntelMarket;if(!market||market.__salesMotionIsolationPatched||typeof market.buildIcpCandidates!=="function")return;
  const original=market.buildIcpCandidates.bind(market);
  market.buildIcpCandidates=function(profile={},...args){return original({...profile,lookalikeCustomers:""},...args);};
  market.__salesMotionIsolationPatched=true;
}
function syncContextArchitecture(){ensureReferenceCustomerTool();patchMarketLookalikeIsolation();}
function contextReady(){
  const state=readProcessState();
  const input=document.getElementById("company-website");
  const candidate=String(input?.value||state.website||"").trim();
  const websiteReady=Boolean(candidate&&candidate.replace(/^https?:\/\//,"").replace(/^www\./,"").includes("."));
  const activated=Boolean(websiteReady&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
  const markets=Array.isArray(state.targetMarkets)?state.targetMarkets.filter(Boolean):[];
  return activated&&markets.length>0;
}
function readStageJson(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"{}");
    return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
function hasPipelineOpportunity(){
  const discovery=readStageJson("leadintel_customer_v2_discovery");
  return Array.isArray(discovery.pipeline)&&discovery.pipeline.length>0||Array.isArray(discovery.selectedProspects)&&discovery.selectedProspects.some(item=>item?.domain);
}
function hasOutreachContent(){
  const outreach=readStageJson("leadintel_customer_v2_outreach");
  return Array.isArray(outreach.items)&&outreach.items.some(item=>item&&(
    item.approved||item.dossier||item.email||item.linkedin||item.callOpener||item.followUp
  ));
}
function stageAvailability(){
  const state=readProcessState();
  window.LeadIntelWorkspaceIsolation?.reconcileLocalWorkspace?.(localStorage,state);
  const current=readProcessState();
  const ready=contextReady();
  const profile=Boolean(current.profile);
  const approved=Boolean(current.approved);
  const strategy=Boolean(current.market?.strategyApproved);
  const previousDiscovery=Boolean(window.LeadIntelWorkspaceIsolation?.hasPreviousDiscovery?.(localStorage,current));
  const savedTargets=Array.isArray(current.targetCompanies)&&current.targetCompanies.length>0;
  const pipeline=hasPipelineOpportunity();
  const content=hasOutreachContent();
  const handoff=Boolean(window.LeadIntelWorkspaceIsolation?.hasSavedMessageHandoff?.(localStorage,current,window.LeadIntelServerBridge?.workspace?.id));
  const approvedHandoff=Boolean(window.LeadIntelWorkspaceIsolation?.hasSavedMessageHandoff?.(localStorage,current,window.LeadIntelServerBridge?.workspace?.id,true));
  return {
    1:true,
    2:ready,
    3:ready,
    4:ready&&profile,
    5:ready&&(savedTargets||previousDiscovery||profile&&approved&&strategy),
    6:ready&&profile&&approved&&(strategy||handoff)&&pipeline||Boolean(window.LeadIntelEmailCampaignUI?.canWrite?.()||window.LeadIntelEmailCampaignUI?.hasRecipients?.()),
    7:ready&&profile&&approved&&(strategy||approvedHandoff)&&pipeline&&content||Boolean(window.LeadIntelEmailCampaignUI?.hasApproved?.())
  };
}
function currentProcessStep(){
  const visible=Number(document.querySelector('.step-view.active')?.dataset.step);
  if(visible>=1&&visible<=7)return visible;
  const state=readProcessState();
  return window.LeadIntelWorkspaceIsolation?.safeStep?.(localStorage,state,state.step)||Number(state.step)||1;
}
function readJourneyState(){
  const discovery=readStageJson(DISCOVERY_STORAGE_KEY),assess=window.LeadIntelDiscoveryUI?.assessCompany;
  discovery.candidates=typeof assess==='function'?(discovery.candidates||[]).map(candidate=>({...candidate,qualification:assess(candidate,{researchedAt:discovery.lastRunAt})})):[];
  return {
    main:readProcessState(),discovery,discoveryMeta:readStageJson(`${DISCOVERY_STORAGE_KEY}_meta`),outreach:readStageJson(OUTREACH_STORAGE_KEY),delivery:readStageJson(DELIVERY_STORAGE_KEY)
  };
}
function websiteActivated(main){
  const candidate=String(document.getElementById("company-website")?.value||main.website||"").trim();
  return Boolean(candidate&&window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive(candidate));
}
function journeyModel(availability,current){
  const state=readJourneyState();
  const journeyFocus=state.discoveryMeta.activeJourneyStage===5?'buyers':'companies';
  const quality=window.LeadIntelDiscoveryUI?.assessBuyerQuality;
  const buyerQualityPassed=typeof quality==='function'&&[...(state.discovery.selectedProspects||[]),...(state.discovery.pipeline||[])].some(candidate=>candidate.people?.length&&candidate.peopleStatus!=='loading'&&candidate.publicContactStatus!=='loading'&&quality(candidate).passed);
  return window.LeadIntelJourneyProgress?.buildJourneyModel?.({...state,currentStep:current,availability,journeyFocus,buyerQualityPassed,syncConflict:Boolean(window.LeadIntelServerBridge?.conflict),websiteActivated:websiteActivated(state.main)})||[];
}
const statusLabels={'in-progress':"In progress",'not-started':"Not started",complete:"Complete",locked:"Locked"};
function stageStatusLabel(stage){return window.LeadIntelJourneyProgress?.stageStatusLabel?.(stage)||statusLabels[stage?.status]||"Not started";}
function replaceJourneyChildren(parent,nodes){
  // Research/status events refresh these lists while customers use the keyboard.
  // Restore the same control only when focus belonged to the refreshed list.
  const focused=parent.contains(document.activeElement)?document.activeElement:null;
  const key=['stageMiniStep','sidebarSubstep','messageChannel'].find(name=>focused?.dataset[name]);
  const value=key&&focused.dataset[key];
  parent.replaceChildren(...nodes);
  if(key){const replacement=[...parent.querySelectorAll('button')].find(button=>button.dataset[key]===value);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
}
function stageMiniStepNode(stage,item){
  const row=document.createElement('li');row.className=item.complete?'complete':'pending';
  const button=document.createElement('button');button.type='button';button.className='stage-mini-step-link';button.dataset.stageMiniStep=item.id;button.dataset.stageId=stage.id;
  button.setAttribute('aria-label',`${item.complete?'Completed: ':'Review: '}${item.label}${item.optional?' (optional)':''}`);
  const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');marker.textContent=item.complete?'✓':'○';
  const label=document.createElement('strong');label.textContent=item.label;button.append(marker,label);
  if(item.optional){const badge=document.createElement('em');badge.textContent='Optional';button.append(badge);}
  row.append(button);return row;
}
function renderStageGuide(stage){
  const guide=document.getElementById("journey-stage-guide");if(!guide||!stage)return;
  const kicker=guide.querySelector("[data-stage-guide-kicker]"),title=guide.querySelector("[data-stage-guide-title]"),progress=guide.querySelector("[data-stage-guide-progress]"),list=guide.querySelector("[data-stage-mini-steps]");
  if(kicker)kicker.textContent=`Stage ${stage.id} · ${stageStatusLabel(stage)}`;
  if(title)title.textContent=stage.name;
  if(progress)progress.textContent=`${stage.requiredCompleted} of ${stage.requiredTotal} required steps`;
  let next=guide.querySelector('[data-stage-next-action]');
  if(next&&next.tagName!=='BUTTON'){const button=document.createElement('button');button.type='button';button.dataset.stageNextAction='true';button.className='journey-next-action';next.replaceWith(button);next=button;}
  if(next){
    next.textContent=stage.nextAction;next.hidden=!stage.nextTarget;
    if(stage.nextTarget){next.dataset.stageId=stage.nextTarget.stageId;next.dataset.stageMiniStep=stage.nextTarget.itemId;}
    else{delete next.dataset.stageId;delete next.dataset.stageMiniStep;}
    let summary=next.parentNode.querySelector('[data-stage-completion]');if(!summary){summary=document.createElement('span');summary.dataset.stageCompletion='true';next.after(summary);}
    summary.hidden=Boolean(stage.nextTarget);summary.textContent=stage.nextTarget?'':stage.nextAction;
    const heading=next.parentNode.querySelector('strong');if(heading)heading.textContent=stage.nextTarget?'Next action':'Status';
  }
  if(!list)return;
  list.setAttribute('aria-label','Required steps');
  replaceJourneyChildren(list,stage.steps.filter(item=>!item.optional).map(item=>stageMiniStepNode(stage,item)));
  let optional=guide.querySelector('[data-stage-optional]');
  if(!optional){optional=document.createElement('section');optional.className='journey-optional';optional.dataset.stageOptional='true';const heading=document.createElement('h4');heading.dataset.stageOptionalTitle='true';const items=document.createElement('ol');items.className='stage-mini-steps';items.dataset.stageOptionalSteps='true';items.setAttribute('aria-label','Optional improvements');optional.append(heading,items);list.after(optional);}
  optional.hidden=!stage.optionalTotal;
  optional.querySelector('[data-stage-optional-title]').textContent=`Optional improvements · ${stage.optionalCompleted} of ${stage.optionalTotal} complete`;
  replaceJourneyChildren(optional.querySelector('[data-stage-optional-steps]'),stage.steps.filter(item=>item.optional).map(item=>stageMiniStepNode(stage,item)));
}
function renderSidebarSteps(marker,stage,expanded){
  if(stage.id===6){
    let channels=marker.querySelector('[data-message-channels]');if(!channels){channels=document.createElement('ol');channels.className='sidebar-substeps message-channel-nav';channels.dataset.messageChannels='true';channels.setAttribute('aria-label','Message channels');marker.append(channels);}
    const choice=readStageJson(DISCOVERY_STORAGE_KEY+'_meta').scriptBuyer,workspace=window.LeadIntelServerBridge?.workspace?.id;
    const active=stage.active&&currentProcessStep()===6&&workspace&&choice?.workspaceId===workspace?(document.getElementById('step-6')?.dataset.scriptChannel==='phone'?'phone':choice.channel):'';
    replaceJourneyChildren(channels,['email','linkedin','phone'].map(channel=>{const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.messageChannel=channel;button.textContent={email:'Email',linkedin:'LinkedIn',phone:'Phone call'}[channel];button.disabled=!stage.available&&!stage.active;if(active===channel)button.setAttribute('aria-current','page');row.append(button);return row;}));
  }

  let nextAction=marker.querySelector('[data-sidebar-next-action]');
  if(!nextAction){nextAction=document.createElement('button');nextAction.type='button';nextAction.className='sidebar-expand sidebar-next-action';nextAction.dataset.sidebarNextAction='true';marker.append(nextAction);}
  nextAction.hidden=!stage.active||!stage.nextTarget;
  nextAction.textContent='Next: '+stage.nextAction;
  if(stage.nextTarget){nextAction.dataset.stageId=stage.nextTarget.stageId;nextAction.dataset.sidebarSubstep=stage.nextTarget.itemId;}
  else {delete nextAction.dataset.stageId;delete nextAction.dataset.sidebarSubstep;}
  let toggle=marker.querySelector('[data-sidebar-expand]');
  if(!toggle){
    toggle=document.createElement('button');toggle.type='button';toggle.className='sidebar-expand';toggle.dataset.sidebarExpand='true';
    marker.append(toggle);
  }
  toggle.textContent=expanded?'Hide steps ↑':'Show steps ↓';
  toggle.setAttribute('aria-label',`${expanded?'Hide':'Show'} ${stage.name} steps`);
  toggle.setAttribute('aria-expanded',String(expanded));
  let list=marker.querySelector('[data-sidebar-substeps]');
  if(!list){list=document.createElement('ol');list.className='sidebar-substeps';list.dataset.sidebarSubsteps='true';marker.append(list);}
  list.hidden=!expanded;
  const nodes=stage.steps.map(item=>{
    const row=document.createElement('li');
    const button=document.createElement('button');button.type='button';button.dataset.sidebarSubstep=item.id;button.dataset.stageId=stage.id;
    button.disabled=!stage.available&&!stage.active&&stage.status!=='complete';
    button.setAttribute('aria-label',`${item.complete?'Completed: ':'Review: '}${item.label}${item.optional?' (optional)':''}`);
    const symbol=document.createElement('span');symbol.textContent=item.complete?'✓':'○';symbol.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=`${item.label}${item.optional?' · Optional':''}`;
    button.append(symbol,label);row.append(button);return row;
  });
  replaceJourneyChildren(list,nodes);
}
function processToast(message){
  const toast=document.getElementById("toast");
  if(!toast)return;
  toast.textContent=message;toast.classList.add("show");
  clearTimeout(processToast.timer);processToast.timer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function syncProcessMap(){
  if(!processMap)return;
  const availability=stageAvailability();const current=currentProcessStep();
  const model=journeyModel(availability,current);
  const currentStage=model.find(stage=>stage.active)||model[0];
  const completed=model.reduce((sum,stage)=>sum+stage.requiredCompleted,0);
  const total=model.reduce((sum,stage)=>sum+stage.requiredTotal,0);
  const position=processMap.querySelector('[data-journey-position]');
  const title=processMap.querySelector('[data-journey-title]');
  const overall=processMap.querySelector('[data-journey-overall]');
  const overallBar=processMap.querySelector('[data-journey-overall-bar]');
  if(position&&currentStage)position.textContent=`Stage ${currentStage.id} of 7`;
  if(title&&currentStage)title.textContent=currentStage.name;
  if(overall)overall.textContent=`${completed} of ${total} required steps complete`;
  if(overallBar)overallBar.style.setProperty('--journey-progress',`${total?Math.round(completed/total*100):0}%`);
  processMap.querySelectorAll("[data-process-step]").forEach(button=>{
    const step=Number(button.dataset.processStep);const stage=model.find(item=>item.id===step);const available=Boolean(stage?.available);const status=stage?.status||'locked';
    button.classList.toggle("available",available);button.classList.toggle("active",Boolean(stage?.active));button.classList.toggle("complete",status==="complete");button.classList.remove('skipped');
    button.setAttribute("aria-disabled",available||stage?.active?'false':'true');
    if(step===currentStage?.id)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
    const stateLabel=button.querySelector("[data-stage-state]"),progress=button.querySelector("[data-stage-progress]");
    if(stateLabel)stateLabel.textContent=stageStatusLabel(stage);
    if(progress&&stage)progress.textContent=`${stage.requiredCompleted}/${stage.requiredTotal} required`;
    if(stage)button.setAttribute('aria-label',`Stage ${stage.id}: ${stage.name}. ${stageStatusLabel(stage)}. ${stage.requiredCompleted} of ${stage.requiredTotal} required steps complete.`);
  });
  document.querySelectorAll("[data-workflow-stage]").forEach(marker=>{
    const step=Number(marker.dataset.workflowStage),stage=model.find(item=>item.id===step);if(!stage)return;
    marker.hidden=false;
    marker.classList.toggle("available",stage.available);marker.classList.toggle("active",stage.active);marker.classList.toggle("complete",stage.status==="complete");marker.classList.remove('skipped');marker.setAttribute("aria-disabled",(stage.available||step<=currentStage?.id)?"false":"true");
    if(stage.active)marker.setAttribute("aria-current","step");else marker.removeAttribute("aria-current");
    const label=marker.querySelector("[data-sidebar-stage-state]");if(label)label.textContent=`${stageStatusLabel(stage)} · ${stage.requiredCompleted}/${stage.requiredTotal} required`;
    renderSidebarSteps(marker,stage,expandedSidebarStage===step);
  });
  renderStageGuide(currentStage);
}
function openProcessStep(stageId){
  const target=Math.min(7,Math.max(1,Number(stageId)||1));
  const availability=stageAvailability();const current=currentProcessStep();const model=journeyModel(availability,current);const stage=model.find(item=>item.id===target);
  const currentStageId=model.find(item=>item.active)?.id||1;
  if(!stage?.available&&!stage?.active&&target>currentStageId){
    const fallback=model.slice(0,target-1).reverse().find(item=>item.available||item.active)?.id||1;
    openProcessStep(fallback);
    const messages={5:'Find a matching company first, then identify its buyers.',6:'Save a company and identify at least one buyer before preparing messages.',7:'Approve a message package before opening Delivery.'};
    processToast(messages[target]||'Complete the previous stage before continuing.');syncProcessMap();return;
  }
  const route=window.LeadIntelJourneyProgress?.routeForJourneyStage?.(target,readProcessState())||{moduleStep:target,focus:''};
  if(target===2)syncContextArchitecture();
  if([4,5].includes(target)){
    const focus=target===5?'buyers':'companies';
    if(window.LeadIntelDiscoveryUI?.open){window.LeadIntelDiscoveryUI.open({focus});setTimeout(syncProcessMap,0);return;}
    window.dispatchEvent(new CustomEvent('leadintel:open-discovery',{detail:{focus}}));setTimeout(syncProcessMap,0);return;
  }
  window.dispatchEvent(new CustomEvent('leadintel:open-module',{detail:{step:target===2?2:route.moduleStep,journeyStage:target}}));
  if(target===2)setTimeout(syncContextArchitecture,0);
  setTimeout(syncProcessMap,0);
}
function reviewMiniStep(stageId,itemId){
  if(itemId==='sync-review'||window.LeadIntelServerBridge?.conflict){window.LeadIntelAttention?.open?.();return;}
  if(stageId===2&&itemId==='research'){void window.LeadIntelProfileMarket?.open?.();return;}
  const profileGroups={'offer-customer':'priority_offers','decision-fit':'buyer_roles','demand-signals':'buying_outcomes','message-proof':'value_proposition'};
  if(stageId===2&&profileGroups[itemId]){
    window.dispatchEvent(new CustomEvent('leadintel:open-module',{detail:{step:2,journeyStage:2}}));
    setTimeout(()=>{const field=document.querySelector(`[data-question="${profileGroups[itemId]}"]`);field?.scrollIntoView({behavior:'smooth',block:'center'});field?.focus({preventScroll:true});syncProcessMap();},80);
    return;
  }
  if(stageId===2&&['profile','review','approval'].includes(itemId)){
    window.dispatchEvent(new CustomEvent('leadintel:open-module',{detail:{step:3,journeyStage:2}}));
    setTimeout(syncProcessMap,80);
    return;
  }
  openProcessStep(stageId);
  const targets={
    1:{website:'#activate-website, #company-website',markets:'#custom-target-market',evidence:'#pdf-input'},
    3:{icps:'#icp-list',signals:'#signal-designer',opportunities:'#strategy-market-summary',strategy:'#activate-market-strategy'},
    4:{scope:'#discovery-target-count',companies:'#run-company-discovery',review:'#company-candidates',pipeline:'#company-candidates'},
    5:{'buyer-quality':'.buyer-quality-supervisor',people:'.selected-prospect-row'},
    6:{brand:'#brand-identity-toggle',scenario:'#step-6.message-workspace #message-offer, #step-6:not(.message-workspace) #core-scenario-summary',company:'#outreach-company-select',dossier:'#build-opportunity-dossier',scripts:'#outreach-email-body',approval:'#step-6.message-workspace #mw-flow-readiness, #step-6:not(.message-workspace) #approve-outreach'},
    7:{package:'#delivery-company-select',sent:'#confirm-delivery-sent',reply:'#reply-text',outcome:'#delivery-outcomes',learning:'#delivery-activity'}
  };
  const selector=targets[stageId]?.[itemId];
  if(selector)setTimeout(()=>{
    const target=document.querySelector(selector);if(!target||target.closest('[hidden]'))return;
    const view=target.closest('.step-view');if(view&&!view.classList.contains('active'))return;
    for(let details=target.closest('details');details;details=details.parentElement?.closest('details'))details.open=true;
    target.scrollIntoView({behavior:'smooth',block:'center'});
    if(!target.matches('button,input,select,textarea,a,[tabindex]'))target.setAttribute('tabindex','-1');
    target.focus({preventScroll:true});
  },80);
}
if(processMap){
  processMap.addEventListener("click",event=>{const substep=event.target.closest("[data-stage-mini-step]");if(substep){reviewMiniStep(Number(substep.dataset.stageId),substep.dataset.stageMiniStep);return;}const button=event.target.closest("[data-process-step]");if(button)openProcessStep(button.dataset.processStep);});
  const steps=document.querySelector(".steps");
  steps?.addEventListener('click',event=>{
    const channel=event.target.closest('[data-message-channel]');if(channel){event.preventDefault();event.stopPropagation();const open=window.LeadIntelDiscoveryUI?.openMessageChannel||window.LeadIntelOutreachUI?.openMessageChannel;if(open)void open(channel.dataset.messageChannel).catch(()=>processToast('Unable to reopen the message. Your drafts are preserved.'));else{openProcessStep(5);processToast('Select a recipient in Buyers first.');}return;}
    const toggle=event.target.closest('[data-sidebar-expand]');
    if(toggle){event.preventDefault();event.stopPropagation();const id=Number(toggle.closest('[data-workflow-stage]')?.dataset.workflowStage);expandedSidebarStage=expandedSidebarStage===id?0:id;syncProcessMap();return;}
    const substep=event.target.closest('[data-sidebar-substep]');
    if(substep){event.preventDefault();event.stopPropagation();reviewMiniStep(Number(substep.dataset.stageId),substep.dataset.sidebarSubstep);}
  },true);
  steps?.addEventListener("keydown",event=>{if(event.target.closest('[data-sidebar-expand],[data-sidebar-substep],[data-message-channel]'))return;const marker=event.target.closest("[data-workflow-stage]");if(!marker||!["Enter"," "].includes(event.key))return;event.preventDefault();openProcessStep(marker.dataset.workflowStage);});
  document.getElementById("company-website")?.addEventListener("input",()=>setTimeout(syncProcessMap,0));
  document.getElementById("target-market-selector")?.addEventListener("click",()=>setTimeout(syncProcessMap,0));
  window.addEventListener("leadintel:website-synced",syncProcessMap);
  window.addEventListener("leadintel:website-activated",syncProcessMap);
  window.addEventListener("leadintel:server-ready",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:workspace-changed",()=>{syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:journey-changed",syncProcessMap);
  for(const name of ['leadintel:server-conflict','leadintel:server-synced','leadintel:sync-settled'])window.addEventListener(name,syncProcessMap);
  window.addEventListener("leadintel:open-discovery",()=>setTimeout(syncProcessMap,120));
  window.addEventListener("leadintel:crm-changed",syncProcessMap);
  window.addEventListener("leadintel:outreach-approved",syncProcessMap);
  window.addEventListener("leadintel:company-research-updated",syncProcessMap);
  window.addEventListener("leadintel:module-opened",event=>{const step=Number(event.detail?.step);if(step===2)syncContextArchitecture();syncProcessMap();});
  window.addEventListener("leadintel:journey-focus-changed",syncProcessMap);
  window.addEventListener("storage",event=>{if(event.key===PROCESS_STORAGE_KEY)syncProcessMap();});
  syncContextArchitecture();syncProcessMap();
  window.LeadIntelJourney={refresh:syncProcessMap,open:openProcessStep,openWorkflowStage:openProcessStep,getModel:()=>journeyModel(stageAvailability(),currentProcessStep())};
}
}
if(window.LeadIntelAccountCache)window.LeadIntelAccountCache.afterVerification(initializeVerifiedProcessMap);else initializeVerifiedProcessMap();
})();
