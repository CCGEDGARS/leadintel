(function(root){
  'use strict';
  if(!root?.document)return;
  const document=root.document;
  let runtimeErrors=[];
  let refreshTimer=0;
  let lastItems=[];
  const clean=value=>String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'[protected]').replace(/\s+/g,' ').trim().slice(0,240);
  function createDrawer(){
    let drawer=document.getElementById('workspace-attention-drawer');if(drawer)return drawer;
    drawer=document.createElement('aside');drawer.id='workspace-attention-drawer';drawer.className='attention-drawer';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','attention-title');
    drawer.innerHTML='<header><div><span class="eyebrow">Workspace health</span><h2 id="attention-title">Attention</h2></div><button class="attention-close" type="button" aria-label="Close Attention">×</button></header><p class="attention-intro">Only items that need action now appear here. Future-stage work stays out of the way.</p><div class="attention-list" aria-live="polite"></div>';
    document.documentElement.appendChild(drawer);drawer.querySelector('.attention-close').addEventListener('click',close);return drawer;
  }
  function collect(){return root.LeadIntelAttentionModel?.buildAttentionItems?.({model:root.LeadIntelJourney?.getModel?.()||[],tasks:root.LeadIntelTaskCentre?.list?.()||[],unsaved:Boolean(root.LeadIntelWorkspacePersistence?.hasUnsavedChanges?.()),runtimeErrors})||[];}
  function actionLabel(item){if(item.target.type==='stage')return 'Open stage';if(item.target.type==='tasks')return 'Review task';if(item.target.type==='save')return 'Save workspace';return 'Reload workspace';}
  function render(){
    const trigger=document.getElementById('workspace-attention');if(!trigger)return;
    lastItems=collect();const count=trigger.querySelector('[data-attention-count]'),summary=trigger.querySelector('[data-attention-summary]');
    if(count){count.textContent=String(lastItems.length);count.hidden=!lastItems.length;}if(summary)summary.textContent=lastItems.length?`${lastItems.length} item${lastItems.length===1?'':'s'} need review`:'All clear';
    const list=createDrawer().querySelector('.attention-list');list.replaceChildren();
    if(!lastItems.length){const empty=document.createElement('div');empty.className='attention-empty';empty.innerHTML='<strong>Everything looks clear</strong><span>No current blockers or failed tasks were detected.</span>';list.appendChild(empty);return;}
    lastItems.forEach(item=>{const card=document.createElement('article');card.className=`attention-item is-${item.severity}`;const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const detail=document.createElement('p');detail.textContent=item.detail;copy.append(title,detail);const button=document.createElement('button');button.type='button';button.className='attention-action';button.textContent=actionLabel(item);button.addEventListener('click',()=>activate(item));card.append(copy,button);list.appendChild(card);});
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(render,50);}
  function open(){const drawer=createDrawer(),trigger=document.getElementById('workspace-attention');render();drawer.hidden=false;trigger?.setAttribute('aria-expanded','true');drawer.querySelector('.attention-close')?.focus();}
  function close(){const drawer=document.getElementById('workspace-attention-drawer'),trigger=document.getElementById('workspace-attention');if(drawer)drawer.hidden=true;trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
  function activate(item){close();if(item.target.type==='stage')root.LeadIntelJourney?.open?.(item.target.id);else if(item.target.type==='tasks')document.querySelector('.task-centre-trigger')?.click();else if(item.target.type==='save')document.getElementById('save-workspace')?.click();else root.location.reload();}
  function rememberError(message){const text=clean(message);if(!text)return;runtimeErrors=[...runtimeErrors,{id:`${Date.now()}-${runtimeErrors.length}`,message:text}].slice(-3);schedule();}
  function mount(){
    const trigger=document.getElementById('workspace-attention');if(!trigger||trigger.dataset.attentionBound==='1')return;trigger.dataset.attentionBound='1';trigger.addEventListener('click',()=>{const drawer=createDrawer();if(drawer.hidden)open();else close();});
    ['leadintel:tasks-changed','leadintel:workspace-changed','leadintel:journey-changed','leadintel:website-activated','leadintel:server-ready'].forEach(name=>root.addEventListener(name,schedule));
    root.addEventListener('storage',schedule);root.addEventListener('error',event=>rememberError(event.message||event.error?.message));root.addEventListener('unhandledrejection',event=>rememberError(event.reason?.message||event.reason));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!createDrawer().hidden)close();});document.addEventListener('input',schedule);document.addEventListener('change',schedule);
    render();root.setInterval(render,30000);root.LeadIntelAttention={refresh:render,list:()=>lastItems.slice(),open};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:null);
