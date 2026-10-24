(function(root){
  'use strict';
  const VERSION='20261024-crm-action-safety-v1';
  const state={open:false,view:'today',q:'',companies:[],selectedId:'',detail:null,loading:false,error:'',activityCursor:null,activityLoading:false,activityError:'',buyerSearching:false,buyerError:'',actionPending:false,actionError:'',detailLoading:false,detailMessage:''};
  let loadedWorkspace='';
  function qualityContext(){const Q=root.LeadIntelPageQuality,make=Q.check,b=bridge();return {loaded:Boolean(q('crm-workspace')),busy:state.loading||state.activityLoading||state.buyerSearching||state.actionPending||state.detailLoading||companyWritePending(),inputs:{workspace:b?.workspace?.id,loadedWorkspace,view:state.view,query:state.q,company:state.detail?.company?.id,detail:state.detail,error:state.error},checks:[make('crm-loaded','CRM records loaded from the current workspace',loadedWorkspace===b?.workspace?.id&&!state.error,state.error||'Load the CRM records for this workspace.',{actions:['write'],state:state.error?'blocked':'preparing'}),make('crm-record','Selected CRM record loaded',Boolean(state.detail?.company?.id&&state.selectedId===state.detail.company.id),'Choose a company record before changing it.',{actions:['write'],target:{id:'crm-company-list'}})]};}
  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const bridge=()=>root.LeadIntelServerBridge;
  // Every read and approval belongs to one authenticated account/workspace revision.
  let observedScope=null,scopeRevision=0,recordRevision=0,activeMutation=null;
  const dispatchedWrites=new Map();
  function writeKey(context){return JSON.stringify([context.scope.workspaceId,context.scope.userId,context.id]);}
  function companyWritePending(id=state.detail?.company?.id){const scope=rawScope();return Boolean(id&&dispatchedWrites.has(writeKey({scope,id})));}
  function rawScope(){const b=bridge();return {bridge:b,workspace:b?.workspace,workspaceId:b?.workspace?.id,userId:b?.session?.user?.id,role:b?.workspace?.role,authenticated:Boolean(b?.session?.authenticated)};}
  function equalScope(a,b){return Boolean(a&&b&&a.bridge===b.bridge&&a.workspace===b.workspace&&a.workspaceId===b.workspaceId&&a.userId===b.userId&&a.role===b.role&&a.authenticated===b.authenticated);}
  function invalidateRecord(){++recordRevision;activeMutation=null;state.actionPending=false;state.actionError='';state.detailLoading=false;state.detailMessage='';state.buyerSearching=false;++buyerRequest;}
  function syncScope(force=false){
    const current=rawScope();
    if(force||(observedScope&&!equalScope(observedScope,current))){
      ++scopeRevision;++listRequest;++detailRequest;++activityRequest;invalidateRecord();
      loadedWorkspace='';nextCursor=null;priorities?.reset();state.companies=[];state.detail=null;state.selectedId='';state.loading=false;state.activityLoading=false;state.activityCursor=null;state.activityError='';state.buyerError='';state.error='';state.q='';
      if(q('crm-search'))q('crm-search').value='';
    }
    const changed=Boolean(observedScope&&!equalScope(observedScope,current))||force;observedScope=current;if(changed)render();return {...current,revision:scopeRevision};
  }
  function scopeCurrent(scope){if(scope?.revision===scopeRevision&&equalScope(scope,rawScope()))return true;syncScope();render();return false;}
  function recordCurrent(context){return scopeCurrent(context.scope)&&context.recordRevision===recordRevision&&state.selectedId===context.id&&state.detail?.company?.id===context.id;}
  function captureRecord(){return {scope:syncScope(),id:state.detail?.company?.id,recordRevision};}
  function canWrite(name,company=state.detail?.company){const r=role();return Boolean(bridge()?.session?.authenticated&&company&&['owner','researcher','sales'].includes(r)&&(name!=='delete-permanently'||r==='owner')&&(name!=='restore'||company.lifecycle_status!=='suppressed'||r==='owner'));}
  function toast(message){const el=q('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000);}
  function injectCss(){if(document.querySelector('link[data-leadintel-asset="crm-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=`crm.css?v=${VERSION}`;link.dataset.leadintelAsset='crm-css';document.head.appendChild(link);}
  function inject(){injectCss();const actions=document.querySelector('.top-actions');if(actions&&!q('open-crm'))actions.insertAdjacentHTML('afterbegin','<button class="ghost-btn crm-open-btn" id="open-crm" type="button">CRM</button>');if(q('crm-workspace'))return;document.body.insertAdjacentHTML('beforeend',`<div class="crm-workspace" id="crm-workspace" hidden aria-hidden="true"><div class="crm-backdrop" data-crm-close></div><section class="crm-shell" role="dialog" aria-modal="true" aria-labelledby="crm-title"><header class="crm-header"><div><span class="eyebrow">Master CRM</span><h2 id="crm-title">Commercial memory</h2><p>Companies, contacts, intelligence and activity history that survive the active pipeline.</p></div><button class="crm-close" type="button" data-crm-close aria-label="Close CRM">×</button></header><div class="crm-toolbar"><div class="crm-tabs" role="tablist" aria-label="CRM views"><button type="button" data-crm-view="today">Today</button><button class="active" type="button" data-crm-view="all">All Companies</button><button type="button" data-crm-view="pipeline">Active Pipeline</button><button type="button" data-crm-view="customer">Customers</button><button type="button" data-crm-view="archived">Archived</button><button type="button" data-crm-view="suppressed">Suppressed</button></div><label class="crm-search"><span>Search</span><input id="crm-search" type="search" placeholder="Company, domain, contact or email"></label></div><div id="crm-insights-slot"></div><div class="crm-status" id="crm-status" role="status" aria-live="polite">Sign in to load Master CRM.</div><div class="crm-body"><div class="crm-list" id="crm-company-list"></div><aside class="crm-detail" id="crm-company-detail"><div class="crm-empty-detail">Select a company to inspect intelligence, contacts and activity.</div></aside></div></section></div>`);bind();}
  function role(){return bridge()?.workspace?.role||'';}
  function filters(){if(state.view==='pipeline')return {q:state.q,pipeline_stage:'active',limit:100};if(['customer','archived','suppressed'].includes(state.view))return {q:state.q,lifecycle:state.view,limit:100};return {q:state.q,limit:100};}
  function topSignal(company){try{const rows=JSON.parse(company.matched_signals_json||'[]');return rows?.[0]?.name||'—';}catch{return '—';}}
  function formatDate(value){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString();}
  function renderList(){const target=q('crm-company-list');if(!target)return;if(state.view==='today'){renderPriorities();return;}if(state.loading){target.innerHTML='<div class="crm-empty">Loading CRM…</div>';return;}if(state.error){target.innerHTML=`<div class="crm-empty crm-error">${esc(state.error)}</div>`;return;}if(!state.companies.length){target.innerHTML='<div class="crm-empty">No companies match this view yet.</div>';return;}target.innerHTML=`<div class="crm-table"><div class="crm-row crm-row-head"><span>Company</span><span>Lifecycle</span><span>Pipeline</span><span>Score</span><span>Signal</span><span>Contacts</span><span>Last activity</span></div>${state.companies.map(company=>`<button class="crm-row ${company.id===state.selectedId?'selected':''}" type="button" data-crm-company-id="${esc(company.id)}"><span class="crm-company-cell"><strong>${esc(company.company_name)}</strong><small>${esc(company.normalized_domain||company.website||'No domain')}</small></span><span><i class="crm-pill lifecycle-${esc(company.lifecycle_status)}">${esc(root.LeadIntelCrm?.lifecycleLabel(company)||company.lifecycle_status)}</i></span><span>${esc(company.pipeline_stage||'—')}</span><span>${Number(company.opportunity_score)||0}</span><span>${esc(topSignal(company))}</span><span>${Number(company.contact_count)||0}</span><span>${esc(formatDate(company.last_activity_at||company.updated_at))}</span></button>`) .join('')}</div>${nextCursor?'<button type="button" class="secondary-btn" data-crm-load-more>Load more companies</button>':''}`;}
  function intelligenceHtml(intelligence){return root.LeadIntelCrmPresentation?.intelligenceHtml(intelligence)||'<div class="crm-detail-empty">Intelligence details are temporarily unavailable.</div>';}
  function contactsHtml(contacts=[]){return root.LeadIntelCrmPresentation?.contactsHtml(contacts,{canArchive:['owner','researcher','sales'].includes(role())})||'<div class="crm-detail-empty">Contact details are temporarily unavailable.</div>';}
  function activitiesHtml(activities=[],options={}){const rows=(Array.isArray(activities)?activities:[]).map(item=>`<div class="crm-activity"><span>${esc(item.activity_type)}</span><strong>${esc(item.summary||item.subject||item.activity_type)}</strong><small>${esc(formatDate(item.occurred_at))}</small></div>`).join('');const error=options.error?`<p class="crm-detail-empty crm-activity-error">${esc(options.error)}</p>`:'';const button=options.hasMore||options.error?`<button class="secondary-btn crm-load-activity" type="button" data-crm-load-activity ${options.loading?'disabled':''}>${options.loading?'Loading activity…':options.error?'Retry activity history':'Load older activity'}</button>`:'';return `${rows||(!error?'<div class="crm-detail-empty">No CRM activity yet.</div>':'')}${error}${button}`;}
  function renderDetailBody(){const target=q('crm-company-detail');if(!target)return;const detail=state.detail;if(!detail?.company){target.innerHTML=`<div class="crm-empty-detail" role="status">${esc(state.detailLoading?'Loading company record…':state.detailMessage||'Select a company to inspect intelligence, contacts and activity.')}${state.detailMessage&&state.selectedId?'<button class="secondary-btn small" type="button" data-crm-reload-record>Refresh record</button>':''}</div>`;return;}const c=detail.company;const suppressed=c.lifecycle_status==='suppressed',archived=c.lifecycle_status==='archived',owner=role()==='owner';const primaryActions=c.pipeline_stage?`<button type="button" data-crm-action="remove-pipeline">Remove from Pipeline</button>`:`<button type="button" data-crm-action="add-pipeline" ${suppressed||archived?'disabled':''}>Add to Pipeline</button>`;target.innerHTML=`<div class="crm-detail-head"><div><span class="eyebrow">Company record</span><h3>${esc(c.company_name)}</h3><a href="${esc(c.website||'#')}" target="_blank" rel="noopener">${esc(c.normalized_domain||c.website||'Website unavailable')}</a></div><button type="button" class="crm-detail-close" data-crm-detail-close aria-label="Close company record">×</button></div><div class="crm-detail-meta"><span>${esc(root.LeadIntelCrm?.lifecycleLabel(c)||c.lifecycle_status)}</span><span>${esc(c.pipeline_stage||'Not in pipeline')}</span><span>${Number(c.opportunity_score)||0}/100</span><span>${esc(c.confidence||'Unrated')}</span></div><div class="crm-detail-actions">${primaryActions}<button type="button" data-crm-action="mark-customer">Mark Customer</button><button type="button" data-crm-action="archive" ${archived?'disabled':''}>Archive</button><button type="button" data-crm-action="suppress" ${suppressed?'disabled':''}>Suppress</button><button type="button" data-crm-action="restore" ${!suppressed&&!archived?'disabled':''}>Restore</button>${owner?'<button class="danger" type="button" data-crm-action="delete-permanently">Delete permanently</button>':''}</div><section><h4>Intelligence</h4>${intelligenceHtml(detail.intelligence)}</section><section><h4>Contacts</h4>${contactsHtml(detail.contacts)}</section><section><h4>Activity</h4>${activitiesHtml(detail.activities,{hasMore:Boolean(state.activityCursor),loading:state.activityLoading,error:state.activityError})}</section>`;}
  function renderDetail(){renderDetailBody();const target=q('crm-company-detail'),company=state.detail?.company;if(!target||!company)return;const domain=root.LeadIntelCrm?.canonicalDomain(company.normalized_domain||company.website)||'';target.querySelector('.crm-detail-actions')?.insertAdjacentHTML('afterend',`<section class="crm-buyer-recovery"><h4>Decision-makers</h4><p>Search buyer roles for this saved company. This uses Apollo People Search; it does not repeat Firecrawl company discovery or reveal contact details.</p><button type="button" data-crm-action="find-buyers" ${!domain||state.buyerSearching||['suppressed','archived'].includes(company.lifecycle_status)?'disabled':''}>${state.buyerSearching?'Searching buyers…':(state.detail.contacts||[]).length?'Refresh decision-makers':'Find decision-makers'}</button>${state.buyerError?`<p role="alert">${esc(state.buyerError)}</p>`:''}</section>`);
    target.querySelectorAll('[data-crm-action], [data-crm-archive-contact]').forEach(button=>{if(state.actionPending||state.detailLoading||companyWritePending(company.id)||state.buyerSearching||!canWrite(button.dataset.crmAction,company))button.disabled=true;});
    target.querySelector('.crm-detail-actions')?.setAttribute('aria-busy',String(state.actionPending||companyWritePending(company.id)));
    if(state.actionPending||companyWritePending(company.id)||state.actionError)target.querySelector('.crm-detail-actions')?.insertAdjacentHTML('afterend',`<div class="crm-action-status ${state.actionError?'crm-error':''}" data-crm-action-status role="${state.actionError?'alert':'status'}"><p>${esc(state.actionError||'Saving CRM change…')}</p>${state.actionError?'<button class="secondary-btn small" type="button" data-crm-reload-record>Refresh record</button>':''}</div>`);
  }
  function renderStatus(){const el=q('crm-status');if(!el)return;const b=bridge();if(state.view==='today'){el.textContent=!b?.session?.authenticated?'Sign in to view saved daily priorities.':'Daily priorities · saved CRM and tracked Gmail conversations · refresh to update';return;}el.textContent=!b?.session?.authenticated?'Sign in with Google to use durable Master CRM.':state.error?state.error:`${state.companies.length} compan${state.companies.length===1?'y':'ies'} · ${state.view==='all'?'All Companies':state.view==='pipeline'?'Active Pipeline':root.LeadIntelCrm?.lifecycleLabel({lifecycle_status:state.view})||state.view}`;}
  function render(){q('crm-workspace')?.querySelectorAll('[data-crm-view]').forEach(button=>{const active=button.dataset.crmView===state.view;button.classList.toggle('active',active);button.setAttribute('role','tab');button.setAttribute('aria-selected',String(active));});const search=q('crm-search')?.closest('label');if(search)search.hidden=state.view==='today';renderStatus();renderList();renderDetail();if(state.open)root.LeadIntelPageQuality?.refresh('crm');}
  let listRequest=0,detailRequest=0,activityRequest=0,buyerRequest=0,nextCursor=null;
  async function loadCompanies(append=false){
    const scope=syncScope();
    if(state.view==='today'&&priorities){render();return priorities.refresh();}
    append=append===true;
    if(append&&(state.loading||!nextCursor))return;
    const request=++listRequest,b=bridge(),workspaceId=b?.workspace?.id,query=filters();
    state.error='';
    if(loadedWorkspace!==workspaceId){state.companies=[];state.detail=null;state.selectedId='';loadedWorkspace='';++detailRequest;++activityRequest;renderDetail();}
    if(!b?.session?.authenticated||!b.workspace){state.companies=[];state.detail=null;state.selectedId='';state.loading=false;nextCursor=null;render();return;}
    if(append)query.cursor=nextCursor;else nextCursor=null;
    state.loading=true;renderList();
    try{
      const result=await b.listCrmCompanies(query);
      if(!scopeCurrent(scope)||request!==listRequest)return;
      if(!result?.ok)throw Error(result?.error||'CRM unavailable');
      loadedWorkspace=workspaceId;
      const rows=Array.isArray(result.companies)?result.companies:[];
      state.companies=append?Array.from(new Map([...state.companies,...rows].map(row=>[row.id,row])).values()):rows;
      nextCursor=result.next_cursor&&result.next_cursor!==query.cursor?result.next_cursor:null;
      if(!append&&state.selectedId&&!state.companies.some(item=>item.id===state.selectedId)&&state.view!=='all'){state.selectedId='';state.detail=null;}
    }catch(error){if(scopeCurrent(scope)&&request===listRequest)state.error='Unable to load CRM. Please retry.';}
    finally{if(scopeCurrent(scope)&&request===listRequest){state.loading=false;render();}}
  }
  async function openCompany(id){
    const scope=syncScope(),b=bridge();if(!scope.authenticated||!scope.workspaceId)return;
    const previous=state.selectedId===id?state.detail:null,uncertain=Boolean(previous&&state.actionError);
    invalidateRecord();const request=++detailRequest;
    ++activityRequest;state.selectedId=id;state.detail=previous;state.detailLoading=true;state.activityCursor=null;state.activityLoading=false;state.activityError='';state.buyerError='';
    if(uncertain)state.actionError='The previous CRM change is still unconfirmed. Refreshing the saved record…';
    renderList();renderDetail();
    try{
      const result=await b?.getCrmCompany(id);
      if(!scopeCurrent(scope)||request!==detailRequest||state.selectedId!==id)return;
      if(!result?.ok){
        if(result?.status===404){state.companies=state.companies.filter(row=>row.id!==id);state.selectedId='';state.detail=null;state.actionError='';state.detailMessage='This record is no longer available. The company list has been refreshed.';await loadCompanies();return;}
        throw Error('Record read was not confirmed');
      }
      let activityPage=Object.prototype.hasOwnProperty.call(result,'activity_next_cursor')?{ok:true,activities:result.activities,next_cursor:result.activity_next_cursor}:null;
      if(!activityPage&&typeof b?.getCrmActivities==='function'){try{activityPage=await b.getCrmActivities(id,{limit:40});}catch{activityPage={ok:false};}}
      if(!scopeCurrent(scope)||request!==detailRequest||state.selectedId!==id)return;
      const fallbackLimit=activityPage?40:100;
      const activities=activityPage?.ok&&Array.isArray(activityPage.activities)?activityPage.activities:Array.isArray(result.activities)?result.activities.slice(0,fallbackLimit):[];
      state.detail={...result,activities};state.actionError='';state.detailMessage='';state.activityCursor=activityPage?.ok?activityPage.next_cursor||null:null;state.activityError=activityPage?.ok||!activityPage?'':'Activity history could not load. Please retry.';
      if(state.open)root.LeadIntelPageQuality?.refresh('crm');
    }catch{
      if(scopeCurrent(scope)&&request===detailRequest){
        const message=uncertain?'We could not refresh this record. The previous CRM change is still unconfirmed. Refresh again to check its status.':'We could not refresh this record. Refresh again to load the saved details.';
        if(previous)state.actionError=message;else state.detailMessage=message;
      }
    }finally{if(scopeCurrent(scope)&&request===detailRequest){state.detailLoading=false;renderList();renderDetail();}}
  }

  async function loadMoreActivities(){
    const context=captureRecord(),id=context.id,b=context.scope.bridge;
    if(!id||state.activityLoading||(!state.activityCursor&&!state.activityError)||typeof b?.getCrmActivities!=='function')return;
    const request=++activityRequest,cursor=state.activityCursor||'';state.activityLoading=true;state.activityError='';renderDetail();
    try{const result=await b.getCrmActivities(id,{limit:40,cursor});if(!recordCurrent(context)||request!==activityRequest)return;if(!result?.ok)throw Error('Activity history unavailable');const existing=state.detail.activities||[],known=new Set(existing.map(item=>item.id));state.detail.activities=[...existing,...(Array.isArray(result.activities)?result.activities:[]).filter(item=>!known.has(item.id))];state.activityCursor=result.next_cursor||null;}
    catch{if(recordCurrent(context)&&request===activityRequest)state.activityError='Activity history could not load. Please retry.';}
    finally{if(recordCurrent(context)&&request===activityRequest){state.activityLoading=false;renderDetail();}}
  }

  function changed(company){root.dispatchEvent(new CustomEvent('leadintel:crm-changed',{detail:{company}}));}
  async function findBuyersForSavedCompany(){
    const context=captureRecord(),b=context.scope.bridge,company=state.detail?.company,id=context.id;
    if(!id||state.buyerSearching||state.actionPending||state.detailLoading||companyWritePending(id)||!canWrite('find-buyers',company)||company.lifecycle_status==='suppressed'||company.lifecycle_status==='archived')return false;
    const engine=root.LeadIntelDiscovery,domain=root.LeadIntelCrm?.canonicalDomain(company.normalized_domain||company.website);
    let profile={};try{profile=JSON.parse(root.localStorage?.getItem('leadintel_customer_v2_state')||'{}').profile||{};}catch{}
    if(!engine||!domain){state.buyerError='A verified company domain is required.';renderDetail();return false;}
    const payload=engine.buildApolloPeopleSearchPayload({domain},profile);
    if(!payload.person_titles?.length){state.buyerError='Add decision-maker roles to your company profile first.';renderDetail();return false;}
    const request=++buyerRequest,operation={context};state.buyerSearching=true;state.buyerError='';renderDetail();
    try{
      const result=await b.searchApolloPeople(payload,{timeoutMs:25000});
      if(!recordCurrent(context)||request!==buyerRequest)return false;
      if(!result?.ok)throw Error(result?.error||'Apollo People Search is unavailable.');
      const people=engine.selectDecisionMakers(engine.normalizeApolloPeople(result),profile,4);
      if(!people.length){state.buyerError='No matching decision-makers found. Your saved company is still here.';return false;}
      const contacts=people.map(person=>({external_person_id:person.id,name:person.name,title:person.title,linkedin_url:person.linkedin_url||undefined,source:'apollo'}));
      dispatchedWrites.set(writeKey(context),operation);
      const saved=await b.saveCrmContacts(id,contacts);
      if(!saved?.ok)throw Error(saved?.error||'Buyer names could not be saved to CRM.');
      if(!recordCurrent(context)||request!==buyerRequest)return false;
      await loadCompanies();if(!recordCurrent(context))return false;await openCompany(id);if(scopeCurrent(context.scope)&&state.selectedId===id)toast(`${people.length} suggested decision-maker${people.length===1?'':'s'} saved in CRM`);
      return true;
    }catch(error){if(recordCurrent(context)&&request===buyerRequest)state.buyerError=String(error?.message||'Buyer search failed. Try again.');return false;}
    finally{if(dispatchedWrites.get(writeKey(context))===operation)dispatchedWrites.delete(writeKey(context));if(recordCurrent(context)&&request===buyerRequest){state.buyerSearching=false;renderDetail();}if(scopeCurrent(context.scope)&&state.detail?.company?.id===id)renderDetail();}
  }
  async function action(name){
    const context=captureRecord(),company=state.detail?.company,b=context.scope.bridge,id=context.id;
    if(!id||state.actionPending||state.detailLoading||companyWritePending(id)||state.buyerSearching||!canWrite(name,company))return false;
    if(root.LeadIntelPageQuality&&!root.LeadIntelPageQuality.require('crm','write')){toast(root.LeadIntelPageQuality.getReport('crm').message);return false;}
    if(name==='find-buyers')return findBuyersForSavedCompany();
    const methods={'add-pipeline':'addCrmToPipeline','remove-pipeline':'removeCrmFromPipeline','mark-customer':'markCrmCustomer',archive:'archiveCrmCompany',suppress:'suppressCrmCompany',restore:'restoreCrmCompany','delete-permanently':'deleteCrmCompany'},method=methods[name];
    if(!method||typeof b?.[method]!=='function')return false;
    const operation={context};activeMutation=operation;state.actionPending=true;state.actionError='';renderDetail();
    try{
      const companyName=company.company_name||'this company';
      const message=name==='suppress'?`Suppress ${companyName}? It will be blocked from normal rediscovery and outreach until restored.`:name==='delete-permanently'?`Permanently delete ${companyName} and its CRM history? This cannot be undone.`:'';
      if(message&&!(await (root.LeadIntelDialogs?.confirm(message)??false)))return false;
      if(!recordCurrent(context)||activeMutation!==operation||!canWrite(name,company))return false;
      dispatchedWrites.set(writeKey(context),operation);
      const result=await b[method](id,...(name==='add-pipeline'?['Discovered']:[]));
      if(!recordCurrent(context)||activeMutation!==operation)return false;
      if(!result?.ok){state.actionError=String(result?.error||'CRM change was not confirmed. Refresh the record before retrying.');return false;}
      changed(name==='delete-permanently'?null:result.company||company);
      // Event listeners may synchronously change the active context.
      if(!recordCurrent(context))return true;
      toast(name==='delete-permanently'?'CRM company permanently deleted':'CRM updated');
      if(name==='delete-permanently'){invalidateRecord();state.selectedId='';state.detail=null;renderDetail();await loadCompanies();return true;}
      await loadCompanies();if(recordCurrent(context))await openCompany(id);
      return true;
    }catch{
      if(recordCurrent(context)&&activeMutation===operation)state.actionError='We could not confirm this CRM change. Refresh the record to check its status before retrying.';
      return false;
    }finally{
      if(dispatchedWrites.get(writeKey(context))===operation)dispatchedWrites.delete(writeKey(context));
      if(activeMutation===operation){activeMutation=null;state.actionPending=false;if(recordCurrent(context))renderDetail();}
      if(scopeCurrent(context.scope)&&state.detail?.company?.id===id)renderDetail();
    }
  }
  const contactArchives=new Set();
  async function archiveContact(contactId){
    const context=captureRecord(),b=context.scope.bridge,companyId=context.id;
    if(root.LeadIntelPageQuality&&!root.LeadIntelPageQuality.require('crm','write'))return false;
    const contact=state.detail?.contacts?.find(row=>row.id===contactId);
    if(!companyId||!contact||!canWrite('archive-contact')||state.actionPending||state.detailLoading||companyWritePending(companyId)||state.buyerSearching||contactArchives.has(contactId))return false;
    const operation={context};activeMutation=operation;state.actionPending=true;state.actionError='';contactArchives.add(contactId);renderDetail();
    try{
      if(!(await (root.LeadIntelDialogs?.confirm(`Archive ${contact.name||'this contact'}? The company and activity history will be preserved.`)??false)))return false;
      if(!recordCurrent(context)||activeMutation!==operation||!canWrite('archive-contact'))return false;
      dispatchedWrites.set(writeKey(context),operation);
      const result=await b.archiveCrmContact(contactId);
      if(!recordCurrent(context)||activeMutation!==operation)return false;
      if(!result?.ok){state.actionError=String(result?.error||'Contact archive was not confirmed. Refresh before retrying.');return false;}
      changed(state.detail.company);if(!recordCurrent(context))return true;
      toast('Contact archived · activity history preserved');await loadCompanies();
      if(recordCurrent(context))await openCompany(companyId);return true;
    }catch{if(recordCurrent(context)&&activeMutation===operation)state.actionError='We could not confirm this CRM change. Refresh the record to check its status before retrying.';return false;}
    finally{contactArchives.delete(contactId);if(dispatchedWrites.get(writeKey(context))===operation)dispatchedWrites.delete(writeKey(context));if(activeMutation===operation){activeMutation=null;state.actionPending=false;if(recordCurrent(context))renderDetail();}if(scopeCurrent(context.scope)&&state.detail?.company?.id===companyId)renderDetail();}
  }

  function open(){syncScope();state.open=true;const el=q('crm-workspace');if(el){el.hidden=false;el.setAttribute('aria-hidden','false');}document.body.classList.add('crm-open');root.dispatchEvent(new CustomEvent('leadintel:crm-opened'));if(root.LeadIntelPageQuality)void root.LeadIntelPageQuality.open('crm');else loadCompanies();}
  function close(){invalidateRecord();++detailRequest;++activityRequest;state.open=false;const el=q('crm-workspace');if(el){el.hidden=true;el.setAttribute('aria-hidden','true');}document.body.classList.remove('crm-open');root.dispatchEvent(new CustomEvent('leadintel:crm-closed'));}
  let searchTimer=null;
  function bind(){q('open-crm')?.addEventListener('click',open);q('crm-workspace')?.addEventListener('click',event=>{if(event.target.closest('[data-crm-priorities-refresh]')){void priorities?.refresh();return;}const priorityCompany=event.target.closest('[data-crm-priority-company]');if(priorityCompany){const id=priorityCompany.dataset.crmPriorityCompany,snapshot=priorities?.snapshot();if(snapshot&&Object.values(snapshot.priorities).some(rows=>rows.some(row=>row.companyId===id)))void openCompany(id);return;}const priorityConversation=event.target.closest('[data-crm-priority-conversation]');if(priorityConversation){const row=priorities?.snapshot().conversations.find(c=>c.id===priorityConversation.dataset.crmPriorityConversation);if(row){close();root.dispatchEvent(new CustomEvent('leadintel:open-conversations',{detail:{domain:row.domain,recipient:row.recipient}}));}return;}if(event.target.closest('[data-crm-reload-record]')){syncScope();if(state.selectedId)void openCompany(state.selectedId);return;}if(event.target.closest('[data-crm-load-more]')){loadCompanies(true);return;}if(event.target.closest('[data-crm-load-activity]')){loadMoreActivities();return;}const closeTarget=event.target.closest('[data-crm-close]');if(closeTarget){close();return;}const view=event.target.closest('[data-crm-view]');if(view){invalidateRecord();++listRequest;priorities?.reset();state.view=view.dataset.crmView;state.detail=null;state.selectedId='';++detailRequest;++activityRequest;state.loading=false;render();loadCompanies();return;}const row=event.target.closest('[data-crm-company-id]');if(row){openCompany(row.dataset.crmCompanyId);return;}if(event.target.closest('[data-crm-detail-close]')){invalidateRecord();++detailRequest;++activityRequest;state.selectedId='';state.detail=null;state.activityCursor=null;state.activityError='';renderDetail();return;}const archiveButton=event.target.closest('[data-crm-archive-contact]');if(archiveButton&&!archiveButton.disabled){void archiveContact(archiveButton.dataset.crmArchiveContact);return;}const actionButton=event.target.closest('[data-crm-action]');if(actionButton&&!actionButton.disabled)action(actionButton.dataset.crmAction);});q('crm-search')?.addEventListener('input',event=>{state.q=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(loadCompanies,250);});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.open)close();const tab=event.target.closest?.('[data-crm-view]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=Array.from(q('crm-workspace').querySelectorAll('[data-crm-view]')),index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();}});root.addEventListener('leadintel:server-ready',()=>{syncScope();render();if(state.open)loadCompanies();});root.addEventListener('leadintel:workspace-changed',()=>{syncScope(true);render();if(state.open)loadCompanies();});root.addEventListener('leadintel:crm-migrated',()=>{if(state.open)loadCompanies();});root.addEventListener('leadintel:company-removed',event=>{if(event.detail?.workspaceId!==bridge()?.workspace?.id)return;if(state.detail?.company?.id===event.detail.companyId){invalidateRecord();++detailRequest;++activityRequest;state.selectedId='';state.detail=null;state.activityCursor=null;renderDetail();}if(state.open)loadCompanies();});}

  let priorities=null;
  function capturePriorities(){const b=bridge();return {authenticated:Boolean(b?.session?.authenticated),workspaceId:b?.workspace?.id,userId:b?.session?.user?.id};}
  async function readConversations(){
    const b=bridge();if(typeof b?.listConversations==='function')return b.listConversations();
    const scope=capturePriorities();if(!scope.authenticated||!scope.workspaceId||!scope.userId)throw Error('Sign in to the active workspace.');
    const url=new URL('/api/conversations',root.location.origin);url.searchParams.set('workspace_id',scope.workspaceId);
    const response=await root.fetch(url.href,{method:'GET',credentials:'include',headers:{Accept:'application/json'},signal:root.AbortSignal.timeout(30000)});
    const result=await response.json();if(!response.ok)throw Error('Conversations unavailable');return result;
  }
  function initPriorities(){if(priorities||!root.LeadIntelCrmPriorities)return;priorities=root.LeadIntelCrmPriorities.createController({capture:capturePriorities,listCompanies:query=>bridge().listCrmCompanies(query),listConversations:readConversations,getCompany:id=>bridge().getCrmCompany(id),onChange:snapshot=>{if(snapshot.loaded&&!snapshot.errors.companies)loadedWorkspace=bridge()?.workspace?.id||'';if(state.view==='today')renderPriorities();}});}
  function priorityWhen(value,timezone){if(!value||!Number.isFinite(Date.parse(value)))return '';try{return new Intl.DateTimeFormat(undefined,{timeZone:timezone||'UTC',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' · '+(timezone||'UTC');}catch{return new Date(value).toISOString();}}
  function priorityRow(item){return `<article class="crm-priority-row"><div class="crm-priority-label"><span>${esc(item.label)}</span>${item.timing?`<span class="crm-priority-timing">${esc(item.timing==='overdue'?'Past due':item.timing==='today'?'Today':'Upcoming')}</span>`:''}</div><h4>${esc(item.title)}</h4>${item.recipient?`<p class="crm-priority-recipient">${esc(item.recipient)}</p>`:''}${item.dueAt?`<p>${esc(priorityWhen(item.dueAt,item.timezone))}</p>`:''}${item.reason?`<p>${esc(item.reason)}</p>`:''}<p class="crm-priority-next">${esc(item.nextAction)}</p><div class="crm-priority-actions">${item.conversationId?`<button class="secondary-btn small" type="button" data-crm-priority-conversation="${esc(item.conversationId)}">Review conversation</button>`:''}${item.companyId?`<button class="secondary-btn small" type="button" data-crm-priority-company="${esc(item.companyId)}">Open company</button>`:''}</div></article>`;}
  function renderPriorities(){
    const target=q('crm-company-list');if(!target)return;const snapshot=priorities?.snapshot(),scope=capturePriorities();
    if(!scope.authenticated||!scope.workspaceId){target.innerHTML='<div class="crm-empty">Sign in and choose a workspace to view daily priorities.</div>';return;}
    if(!priorities){target.innerHTML='<div class="crm-empty crm-error">Daily priorities could not load. Reopen CRM after refreshing the page.</div>';return;}
    if(snapshot.loading){target.innerHTML='<div class="crm-empty" role="status" aria-live="polite">Loading saved daily priorities…</div>';return;}
    if(!snapshot.loaded){target.innerHTML='<div class="crm-empty">Choose Today or refresh to load saved priorities.</div>';return;}
    const p=snapshot.priorities,failed=snapshot.errors.conversations;
    const section=(title,rows,empty)=>`<section class="crm-priority-section"><div class="crm-priority-section-head"><h3>${esc(title)}</h3><span>${rows.length}</span></div>${rows.length?rows.map(priorityRow).join(''):`<p class="crm-priority-empty">${esc(empty)}</p>`}</section>`;
    const companyCoverage=snapshot.errors.companies?'Companies could not load. Company blockers are unknown.':snapshot.companyHasMore?'Company coverage: first 100 saved companies. More companies are available in All Companies.':`Company coverage: ${snapshot.companies.length} saved companies.`;
    target.innerHTML=`<div class="crm-priorities"><header class="crm-priorities-head"><div><span class="eyebrow">Your daily review</span><h3>What needs your attention?</h3><p>Stored tasks, replies and contact gaps. Open the original record to choose the next action.</p></div><button class="secondary-btn small" type="button" data-crm-priorities-refresh>Refresh priorities</button></header><div class="crm-priority-coverage" role="status"><p>${esc(companyCoverage)}</p><p>${failed?'Conversations could not load. Reply and reminder coverage is unavailable.':`Conversation coverage: ${snapshot.conversations.length} tracked Gmail threads (latest 500 maximum). Other mailbox threads are outside this view.`}</p><p>Contact coverage: ${snapshot.contactChecked} of ${snapshot.contactEligible} active opportunities in the loaded company page checked${snapshot.contactFailed?`; ${snapshot.contactFailed} checks failed`:''}. Up to 20 checked per refresh. Email presence does not confirm sending eligibility.</p><p>Refreshed ${esc(priorityWhen(snapshot.updatedAt,'UTC'))}. This view never sends messages or changes a task status.</p></div><div class="crm-priority-grid">${section('Due review & approved schedules',p.due,failed?'Due items are unknown until conversations can load.':'No due items in the loaded records.')}${section('Replies & next actions to review',p.review,failed?'Reply review is unknown until conversations can load.':'No undated review tasks in the loaded conversations.')}${section('Blocked or held opportunities',p.blocked,snapshot.errors.companies||failed?'Some blocker checks are unavailable. Refresh to retry.':'No blockers found in the checked records.')}</div>${p.upcoming.length?`<details class="crm-priority-upcoming"><summary>Upcoming saved reminders & schedules · ${p.upcoming.length}</summary>${p.upcoming.map(priorityRow).join('')}</details>`:''}</div>`;
  }

  function init(){syncScope();inject();initPriorities();render();root.LeadIntelPageQuality?.register('crm',{read:qualityContext,prepare:()=>loadCompanies()});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
