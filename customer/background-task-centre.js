(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.LeadIntelTaskCentre=api.createTaskCentre({storage:root.localStorage});
    if(root.document)api.mountTaskCentre(root.LeadIntelTaskCentre,root.document);
  }
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const STORAGE_KEY='leadintel_customer_v2_background_tasks_v1';
  const ACTIVE=new Set(['running','queued']);
  const FINAL=new Set(['complete','partial','error','canceled','interrupted']);
  const MAX_TASKS=30;

  function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback;}
  function cleanText(value,max=240){return String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'').replace(/\s+/g,' ').trim().slice(0,max);}
  function normalizeTask(raw,now){
    const total=Math.max(0,Math.round(finite(raw.total)));
    const completed=Math.min(total||Number.MAX_SAFE_INTEGER,Math.max(0,Math.round(finite(raw.completed))));
    const progress=total?Math.round((completed/total)*100):Math.min(100,Math.max(0,Math.round(finite(raw.progress))));
    return {
      id:cleanText(raw.id,160),type:cleanText(raw.type||'background-task',80),title:cleanText(raw.title||'Background task',120),
      stage:cleanText(raw.stage||'Preparing',180),status:FINAL.has(raw.status)||ACTIVE.has(raw.status)?raw.status:'queued',
      completed,total,progress,resultCount:Math.max(0,Math.round(finite(raw.resultCount))),etaSeconds:raw.etaSeconds==null?null:Math.max(0,Math.round(finite(raw.etaSeconds))),
      error:cleanText(raw.error||'',240),startedAt:finite(raw.startedAt,now),updatedAt:finite(raw.updatedAt,now),finishedAt:raw.finishedAt?finite(raw.finishedAt):null,
      metadata:raw.metadata&&typeof raw.metadata==='object'?raw.metadata:{},canCancel:Boolean(raw.canCancel),canRetry:Boolean(raw.canRetry),canResume:Boolean(raw.canResume)
    };
  }
  function createTaskCentre(options={}){
    const storage=options.storage||null,now=typeof options.now==='function'?options.now:Date.now,recoverInterrupted=options.recoverInterrupted!==false;
    const actions=new Map();let tasks=[];let listeners=[];
    try{const parsed=JSON.parse(storage?.getItem(STORAGE_KEY)||'[]');tasks=Array.isArray(parsed)?parsed.map(item=>normalizeTask(item,now())).filter(item=>item.id):[];}catch{tasks=[];}
    if(recoverInterrupted){let changed=false;tasks=tasks.map(task=>{if(!ACTIVE.has(task.status))return task;changed=true;return {...task,status:'interrupted',stage:'Interrupted by page reload',error:'This task stopped before it finished.',canCancel:false,canRetry:true,updatedAt:now(),finishedAt:now()};});if(changed)persist();}
    function persist(){try{storage?.setItem(STORAGE_KEY,JSON.stringify(tasks.slice(0,MAX_TASKS)));}catch{/* best-effort local history */}}
    function emit(){const snapshot=list();listeners.forEach(listener=>listener(snapshot));if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('leadintel:tasks-changed',{detail:{tasks:snapshot}}));}
    function save(task){tasks=[task,...tasks.filter(item=>item.id!==task.id)].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_TASKS);persist();emit();return task;}
    function get(id){const found=tasks.find(task=>task.id===id);return found?JSON.parse(JSON.stringify(found)):null;}
    function list(){return tasks.map(task=>JSON.parse(JSON.stringify(task)));}
    function start(input){
      const timestamp=now(),previous=get(input.id);const task=normalizeTask({...previous,...input,status:'running',error:'',startedAt:timestamp,updatedAt:timestamp,finishedAt:null,canCancel:Boolean(actions.get(input.id)?.cancel||input.canCancel),canRetry:Boolean(actions.get(input.id)?.retry||input.canRetry),canResume:Boolean(actions.get(input.id)?.resume||input.canResume)},timestamp);return save(task);
    }
    function update(id,patch={}){
      const current=get(id);if(!current)return null;const timestamp=now();let etaSeconds=current.etaSeconds;
      const completed=Math.max(0,finite(patch.completed,current.completed));const total=Math.max(0,finite(patch.total,current.total));
      if(total>0&&completed>0&&completed<total&&timestamp>current.startedAt)etaSeconds=Math.round(((timestamp-current.startedAt)/1000/completed)*(total-completed));
      if(completed>=total&&total>0)etaSeconds=0;
      return save(normalizeTask({...current,...patch,completed,total,etaSeconds,updatedAt:timestamp},timestamp));
    }
    function complete(id,patch={}){const current=get(id);if(!current)return null;const status=patch.status==='partial'?'partial':'complete';return save(normalizeTask({...current,...patch,status,stage:patch.stage||(status==='partial'?'Completed with warnings':'Complete'),completed:current.total||patch.completed||current.completed,progress:100,etaSeconds:0,error:'',canCancel:false,updatedAt:now(),finishedAt:now()},now()));}
    function fail(id,error,patch={}){const current=get(id);if(!current)return null;return save(normalizeTask({...current,...patch,status:'error',stage:patch.stage||'Needs attention',error:cleanText(error?.message||error||'Task failed'),canCancel:false,canRetry:Boolean(actions.get(id)?.retry||patch.canRetry),updatedAt:now(),finishedAt:now()},now()));}
    function registerActions(id,handlers={}){actions.set(id,handlers);const current=get(id);if(current)update(id,{canCancel:typeof handlers.cancel==='function',canRetry:typeof handlers.retry==='function',canResume:typeof handlers.resume==='function'});return()=>actions.delete(id);}
    async function cancel(id){const current=get(id),handler=actions.get(id)?.cancel;if(!current||typeof handler!=='function')return false;await handler();save(normalizeTask({...current,status:'canceled',stage:'Canceled',error:'',canCancel:false,updatedAt:now(),finishedAt:now()},now()));return true;}
    async function retry(id){const current=get(id),handler=actions.get(id)?.retry;if(!current||typeof handler!=='function')return false;start({...current,id,status:'running',stage:'Restarting',completed:0,progress:0,resultCount:0});await handler();return true;}
    async function resume(id){const current=get(id),handler=actions.get(id)?.resume;if(!current||typeof handler!=='function')return false;start({...current,id,status:'running',stage:'Resuming'});await handler();return true;}
    function remove(id){actions.delete(id);tasks=tasks.filter(task=>task.id!==id);persist();emit();}
    function clearFinished(){tasks=tasks.filter(task=>ACTIVE.has(task.status));persist();emit();}
    function clearAll(){actions.clear();tasks=[];persist();emit();}
    function subscribe(listener){listeners.push(listener);listener(list());return()=>{listeners=listeners.filter(item=>item!==listener);};}
    return {start,update,complete,fail,cancel,retry,resume,get,list,remove,clearFinished,clearAll,registerActions,subscribe,storageKey:STORAGE_KEY};
  }

  function mountTaskCentre(centre,document){
    const onReady=()=>{
      if(document.getElementById('background-task-centre'))return;
      const host=document.createElement('section');host.id='background-task-centre';host.className='task-centre';host.innerHTML='<button class="task-centre-trigger" type="button" aria-expanded="false" aria-controls="task-centre-drawer"><span class="task-centre-pulse" aria-hidden="true"></span><span><strong>Background tasks</strong><small data-task-summary>No tasks yet</small></span><b data-task-count hidden>0</b></button><div class="task-centre-drawer" id="task-centre-drawer" hidden><header><div><span class="eyebrow">Workspace activity</span><h2>Background Task Centre</h2></div><button class="task-centre-close" type="button" aria-label="Close background tasks">×</button></header><p class="task-centre-intro">Research and enrichment continue while you work in this page. Progress and completed results are preserved.</p><div class="task-centre-list" role="status" aria-live="polite"></div><button class="task-centre-clear" type="button">Clear finished tasks</button></div>';
      (document.querySelector('[data-utility-tasks]')||document.querySelector('.progress-panel')||document.body).appendChild(host);
      const trigger=host.querySelector('.task-centre-trigger'),drawer=host.querySelector('.task-centre-drawer');
      const close=()=>{drawer.hidden=true;trigger.setAttribute('aria-expanded','false');};
      trigger.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;trigger.setAttribute('aria-expanded',String(!drawer.hidden));});
      host.querySelector('.task-centre-close').addEventListener('click',close);
      host.querySelector('.task-centre-clear').addEventListener('click',()=>centre.clearFinished());
      host.addEventListener('click',event=>{const button=event.target.closest('[data-task-action]');if(!button)return;const action=button.dataset.taskAction,id=button.dataset.taskId;if(action==='cancel')centre.cancel(id);if(action==='retry')centre.retry(id);if(action==='resume')centre.resume(id);if(action==='remove')centre.remove(id);});
      centre.subscribe(tasks=>renderTaskCentre(host,tasks));
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady,{once:true});else onReady();
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function duration(seconds){if(seconds==null)return'';if(seconds<60)return'about 1 min';const minutes=Math.ceil(seconds/60);return minutes<60?`about ${minutes} min`:`about ${Math.ceil(minutes/60)} hr`;}
  function renderTaskCentre(host,tasks){
    const active=tasks.filter(task=>ACTIVE.has(task.status)),summary=host.querySelector('[data-task-summary]'),count=host.querySelector('[data-task-count]'),pulse=host.querySelector('.task-centre-pulse'),list=host.querySelector('.task-centre-list');
    summary.textContent=active.length?`${active.length} active · ${active[0].stage}`:tasks.length?`${tasks.filter(task=>task.status==='complete').length} completed`:'No tasks yet';count.hidden=!active.length;count.textContent=String(active.length);pulse.classList.toggle('active',Boolean(active.length));
    if(!tasks.length){list.innerHTML='<div class="task-centre-empty"><strong>Nothing running</strong><span>Research, discovery and enrichment activity will appear here.</span></div>';return;}
    list.innerHTML=tasks.map(task=>{const counter=task.total?`${task.completed}/${task.total}`:'';const results=task.resultCount?`${task.resultCount} result${task.resultCount===1?'':'s'} preserved`:'';const eta=ACTIVE.has(task.status)&&duration(task.etaSeconds)?`${duration(task.etaSeconds)} remaining`:'';const actions=[task.canResume?`<button type="button" data-task-action="resume" data-task-id="${escapeHtml(task.id)}">Resume</button>`:'',task.canRetry?`<button type="button" data-task-action="retry" data-task-id="${escapeHtml(task.id)}">Retry</button>`:'',task.canCancel&&ACTIVE.has(task.status)?`<button type="button" data-task-action="cancel" data-task-id="${escapeHtml(task.id)}">Cancel</button>`:'',!ACTIVE.has(task.status)?`<button type="button" data-task-action="remove" data-task-id="${escapeHtml(task.id)}">Dismiss</button>`:''].filter(Boolean).join('');return `<article class="task-card task-${task.status}"><div class="task-card-head"><div><span>${escapeHtml(task.type.replace(/-/g,' '))}</span><strong>${escapeHtml(task.title)}</strong></div><b>${task.progress}%</b></div><p>${escapeHtml(task.stage)}</p><div class="task-progress" role="progressbar" aria-label="${escapeHtml(task.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${task.progress}"><i style="width:${task.progress}%"></i></div><small>${[counter,results,eta].filter(Boolean).map(escapeHtml).join(' · ')||escapeHtml(task.status)}</small>${task.error?`<em>${escapeHtml(task.error)}</em>`:''}${actions?`<div class="task-actions">${actions}</div>`:''}</article>`;}).join('');
  }
  return {createTaskCentre,mountTaskCentre,STORAGE_KEY};
});
