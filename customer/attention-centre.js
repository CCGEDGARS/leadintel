(function(root){
  'use strict';
  if(!root?.document)return;
  const document=root.document;
  let runtimeErrors=[];
  let refreshTimer=0;
  let lastItems=[];
  let providerIssues=[];
  let connectionIssues=[];
  let providerStatusError='';
  let checkedWorkspace='';
  let lastProviderCheck=0;
  let providerCheckBusy=false;
  const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
  const OPENAI_BILLING_URL='https://platform.openai.com/settings/organization/billing/overview';
  const clean=value=>String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'[protected]').replace(/\s+/g,' ').trim().slice(0,240);
  function createDrawer(){
    let drawer=document.getElementById('workspace-attention-drawer');if(drawer)return drawer;
    drawer=document.createElement('aside');drawer.id='workspace-attention-drawer';drawer.className='attention-drawer';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','attention-title');
    drawer.innerHTML='<header><div><span class="eyebrow">Workspace status</span><h2 id="attention-title">Workspace status</h2></div><button class="attention-close" type="button" aria-label="Close Attention">×</button></header><p class="attention-intro">Red means billing action is required. Yellow means something needs attention. Green means no current issues were detected.</p><button type="button" class="attention-action" data-recheck-providers>Recheck tools</button><p data-provider-check-message role="status"></p><div class="attention-list" aria-live="polite"></div>';
    document.documentElement.appendChild(drawer);drawer.querySelector('.attention-close').addEventListener('click',close);drawer.querySelector('[data-recheck-providers]')?.addEventListener('click',()=>void refreshProviderCredits({force:true}));return drawer;
  }
  function collect(){const persistence=root.LeadIntelWorkspacePersistence;let state={},researchMeta={},discovery={};try{state=JSON.parse(root.localStorage?.getItem('leadintel_customer_v2_state')||'null')||{};researchMeta=JSON.parse(root.localStorage?.getItem('leadintel_customer_v2_research_meta_v1')||'null')||{};discovery=JSON.parse(root.localStorage?.getItem('leadintel_customer_v2_discovery')||'null')||{};}catch{}const model=root.LeadIntelAttentionModel;const providerStatusCurrent=checkedWorkspace===root.LeadIntelServerBridge?.workspace?.id&&lastProviderCheck>0;const aiProviderIssue=providerStatusCurrent?null:model?.aiProviderIssueFromResearch?.({state,researchMeta})||null;const scopedProviderIssues=checkedWorkspace===root.LeadIntelServerBridge?.workspace?.id?providerIssues:[];const firecrawlBlocked=[...(discovery.searchFailures||[]),...(discovery.providerFallbacks||[])].some(item=>Number(item.status)===402);const issues=firecrawlBlocked&&!providerStatusCurrent&&!scopedProviderIssues.some(item=>item.provider==='firecrawl')?[...scopedProviderIssues,{provider:'firecrawl',name:'Firecrawl',source:'unknown'}]:scopedProviderIssues;return model?.buildAttentionItems?.({model:root.LeadIntelJourney?.getModel?.()||[],tasks:root.LeadIntelTaskCentre?.list?.()||[],workspaceStarted:Boolean(persistence?.hasMeaningfulWorkspaceData?.()),unsaved:Boolean(persistence?.hasUnsavedChanges?.()),runtimeErrors,aiProviderIssue,providerIssues:issues,connectionIssues:checkedWorkspace!==root.LeadIntelServerBridge?.workspace?.id?[]:providerStatusError?[...connectionIssues,{id:'provider-status-unavailable',severity:'recommendation',title:'Tool status needs a recheck',detail:providerStatusError,target:{type:'settings'}}]:connectionIssues})||[];}
  async function refreshProviderCredits({force=false}={}){
    const workspaceId=root.LeadIntelServerBridge?.workspace?.id;
    if(!workspaceId||!root.LeadIntelServerBridge?.session?.authenticated||!root.fetch){providerIssues=[];connectionIssues=[];providerStatusError='';checkedWorkspace='';lastProviderCheck=0;render();return;}
    if(providerCheckBusy||!force&&checkedWorkspace===workspaceId&&Date.now()-lastProviderCheck<30000)return;
    if(checkedWorkspace!==workspaceId){providerIssues=[];connectionIssues=[];lastProviderCheck=0;}
    providerCheckBusy=true;checkedWorkspace=workspaceId;providerStatusError='';
    try{
      const url=path=>`${API_BASE}${path}?workspace_id=${encodeURIComponent(workspaceId)}`;
      const [aiResponse,serviceResponse]=await Promise.all([root.fetch(url('/api/integrations/ai/status'),{credentials:'include'}),root.fetch(url('/api/integrations/services/status')+(force?'&verify=1':''),{credentials:'include'})]);
      if(!aiResponse.ok||!serviceResponse.ok)throw new Error('Provider status unavailable');
      const [ai,services]=await Promise.all([aiResponse.json(),serviceResponse.json()]);
      if(root.LeadIntelServerBridge?.workspace?.id!==workspaceId)return;
      providerIssues=root.LeadIntelAttentionModel?.providerCreditIssues?.({ai,services})||[];connectionIssues=root.LeadIntelAttentionModel?.providerConnectionIssues?.({ai,services,requiredProviders:services?.providers?.find(row=>row.provider==='hunter')?.metadata?.additional_verification_enabled===true?['hunter']:[]})||[];lastProviderCheck=Date.now();render();
    }catch{if(root.LeadIntelServerBridge?.workspace?.id===workspaceId){providerStatusError='Tool status could not be checked. The last confirmed billing alerts are retained.';render();}}
    finally{providerCheckBusy=false;const message=document.querySelector('[data-provider-check-message]');if(message)message.textContent=providerStatusError||'Tool status checked. Research tasks may still need retrying.';}
  }
  function actionLabel(item){if(item.target.type==='stage')return 'Open stage';if(item.target.type==='tasks')return 'Review task';if(item.target.type==='save')return 'Save workspace';if(item.target.type==='settings')return 'Open AI & Tools';if(item.target.type==='ai-billing')return 'Open OpenAI billing';return 'Reload workspace';}
  function render(){
    const trigger=document.getElementById('workspace-attention');if(!trigger)return;
    lastItems=collect();const actionableItems=lastItems.filter(item=>item.severity==='error'||item.severity==='recommendation');const errors=actionableItems.filter(item=>item.severity==='error');const recommendations=actionableItems.filter(item=>item.severity==='recommendation');const count=trigger.querySelector('[data-attention-count]'),summary=trigger.querySelector('[data-attention-summary]');
    const health=root.LeadIntelAttentionModel.healthSummary(actionableItems);trigger.dataset.healthStatus=health.status;
    if(count){count.textContent=String(actionableItems.length);count.hidden=!actionableItems.length;}
    if(summary)summary.textContent=health.text;
    const list=createDrawer().querySelector('.attention-list');list.replaceChildren();
    if(!actionableItems.length){const empty=document.createElement('div');empty.className='attention-empty is-healthy';empty.innerHTML='<strong>Workspace healthy</strong><span>No current billing issues or attention items were detected.</span>';list.appendChild(empty);return;}
    actionableItems.forEach(item=>{const card=document.createElement('article');card.className=`attention-item is-${item.severity}`;const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const detail=document.createElement('p');detail.textContent=item.detail;copy.append(title,detail);const button=document.createElement('button');button.type='button';button.className='attention-action';button.textContent=actionLabel(item);button.addEventListener('click',()=>activate(item));card.append(copy,button);list.appendChild(card);});
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(render,50);}
  function open(){const drawer=createDrawer(),trigger=document.getElementById('workspace-attention');render();drawer.hidden=false;trigger?.setAttribute('aria-expanded','true');drawer.querySelector('.attention-close')?.focus();}
  function close(){const drawer=document.getElementById('workspace-attention-drawer'),trigger=document.getElementById('workspace-attention');if(drawer)drawer.hidden=true;trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
  function activate(item){close();if(item.target.type==='stage')root.LeadIntelJourney?.open?.(item.target.id);else if(item.target.type==='tasks')document.querySelector('.task-centre-trigger')?.click();else if(item.target.type==='save')document.getElementById('save-workspace')?.click();else if(item.target.type==='settings')document.getElementById('open-settings')?.click();else if(item.target.type==='ai-billing')root.open?.(OPENAI_BILLING_URL,'_blank','noopener,noreferrer');else root.location.reload();}
  function rememberError(message){const text=clean(message);if(!text)return;runtimeErrors=[...runtimeErrors,{id:`${Date.now()}-${runtimeErrors.length}`,message:text}].slice(-3);schedule();}
  function mount(){
    const trigger=document.getElementById('workspace-attention');if(!trigger||trigger.dataset.attentionBound==='1')return;trigger.dataset.attentionBound='1';trigger.addEventListener('click',()=>{const drawer=createDrawer();if(drawer.hidden)open();else close();});
    ['leadintel:tasks-changed','leadintel:workspace-changed','leadintel:journey-changed','leadintel:website-activated','leadintel:server-ready','leadintel:company-research-updated'].forEach(name=>root.addEventListener(name,()=>{schedule();if(name==='leadintel:server-ready'||name==='leadintel:tasks-changed'||name==='leadintel:company-research-updated')void refreshProviderCredits();}));
    root.addEventListener('leadintel:workspace-reset',()=>{runtimeErrors=[];providerIssues=[];connectionIssues=[];providerStatusError='';checkedWorkspace='';lastProviderCheck=0;root.LeadIntelJourney?.refresh?.();render();});
    root.addEventListener('storage',schedule);root.addEventListener('error',event=>rememberError(event.message||event.error?.message));root.addEventListener('unhandledrejection',event=>rememberError(event.reason?.message||event.reason));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!createDrawer().hidden)close();});document.addEventListener('input',schedule);document.addEventListener('change',schedule);
    render();void refreshProviderCredits();root.setInterval(()=>{render();void refreshProviderCredits();},30000);root.LeadIntelAttention={refresh:render,recheck:()=>refreshProviderCredits({force:true}),list:()=>lastItems.slice(),open};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:null);
