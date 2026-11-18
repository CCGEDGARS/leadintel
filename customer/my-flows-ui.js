(function(root){
 'use strict';if(root.LeadIntelMyFlows)return;
 const F=root.LeadIntelFlowState,API='https://leadintel-api.edgars-7e7.workers.dev';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bridge=()=>root.LeadIntelServerBridge;
 let dialog,data=null,busy=false,workspace='',requestId=0,summaryRequestId=0,summary=null,summaryWorkspace='',summaryTimer;
 const accountContext=()=>bridge()?.session?.authenticated?`${bridge()?.session?.user?.id||''}:${bridge()?.workspace?.id||''}`:'';
 const status={automatic:'Active',paused:'Paused',manual:'Manual',stopped:'Stopped',needs_review:'Review required'};
 function notice(text){dialog?.querySelector('[data-flows-notice]')?.replaceChildren(document.createTextNode(text));}
 async function api(id='',body,view=''){
  const captured=accountContext(),ws=bridge()?.workspace?.id;if(!bridge()?.session?.authenticated||!ws)throw Error('Sign in to save and manage your flows.');
  if(body&&workspace!==ws)throw Error('Workspace changed. Refresh My Flows.');
  const path='/api/flows'+(id?'/'+encodeURIComponent(id):'')+'?workspace_id='+encodeURIComponent(ws)+(view?'&view='+encodeURIComponent(view):''),url=root.LeadIntelApiTransport?.firstPartyUrl?.(API+path)||API+path;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(url,{credentials:'include',method:body?'POST':'GET',headers:{Accept:'application/json','Content-Type':'application/json'},signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(accountContext()!==captured||bridge()?.workspace?.id!==ws)throw Error('Workspace changed. Refresh My Flows.');if(!response.ok)throw Error(result.error||'Could not update flow');return result;}finally{clearTimeout(timeout);}
 }
 function entrySummary(text){for(const node of document.querySelectorAll('.wf-open [data-flow-summary]'))node.textContent=text;}
 function showSummary(value){++summaryRequestId;summary=value;summaryWorkspace=accountContext();entrySummary(value.activeCount+' active · '+value.flows.length+' saved');root.dispatchEvent(new root.CustomEvent('leadintel:flows-changed'));}
 async function refreshSummary(){
  if(summaryWorkspace&&summaryWorkspace!==accountContext())clear();
  const token=++summaryRequestId,ws=bridge()?.workspace?.id;
  if(!accountContext()){summary=null;summaryWorkspace='';root.dispatchEvent(new root.CustomEvent('leadintel:flows-changed'));}
  entrySummary('Loading flow counts…');
  if(!bridge()?.session?.authenticated||!ws){entrySummary('Sign in to manage flows');return;}
  try{const next=await api('',undefined,'selector');if(token!==summaryRequestId)return;if(bridge()?.workspace?.id!==ws||!bridge()?.session?.authenticated){entrySummary('Sign in to manage flows');return;}showSummary(next);}
  catch{if(token===summaryRequestId)entrySummary('Flow counts unavailable');}
 }
 function render(){
  showSummary(data);
  const owner=data.role==='owner',content=dialog.querySelector('[data-flows-content]');
  let html='<div class="mf-overview"><strong>'+data.flows.length+' / 10 saved flows</strong><strong>'+data.activeCount+' / 2 active</strong><span>Manual work is available in every flow.</span></div>';
  html+='<p>Protected workflows keep their own business settings, scripts and targeting. Connections and CRM remain shared. Working progress saves automatically; protected versions change only when you save a new version.</p>';
  html+='<form data-flows-create><label>Save the current seven-step setup as a flow<input name="name" maxlength="100" required placeholder="Business — country — audience"></label><button '+(!owner||data.flows.length>=10?'disabled':'')+'>Save current setup</button></form><div data-flows-editor hidden></div><div class="mf-cards">';
  for(const flow of data.flows){const s=flow.summary,m=flow.metrics||{},current=flow.id===data.currentId;
   html+='<article class="mf-card '+(current?'mf-current':'')+'"><div class="mf-card-header"><h3>'+esc(flow.name)+'</h3><span class="mf-badge '+(flow.status==='automatic'?'mf-active':'')+'">'+esc(status[flow.status]||flow.status)+'</span></div><p class="mf-market">'+esc(s.markets.join(' · ')||'Market not selected')+(current?' · Open workspace':'')+'</p>';
   html+='<dl><div><dt>Triggers</dt><dd>'+esc(s.triggers.join(', ')||'None selected')+'</dd></div><div><dt>Template</dt><dd>'+esc(s.template)+' · '+esc(s.language)+'</dd></div><div><dt>Buyer roles</dt><dd>'+esc(s.roles.join(', ')||'Not selected')+'</dd></div><div><dt>Websites to scan</dt><dd>'+esc(s.sources.join(', ')||'Use the flow’s research sources')+'</dd></div><div><dt>Saved progress</dt><dd>'+s.companies+' companies · '+s.buyers+' buyers</dd></div><div><dt>Sending limit</dt><dd>'+(s.dailyLimit?esc(s.dailyLimit)+' / day · shared mailbox limit':'Set in automation settings')+'</dd></div></dl>';
   html+='<div class="mf-metrics" aria-label="Flow performance"><span><b>'+esc(m.providerConfirmedSent??0)+'</b>Provider-confirmed sends</span><span><b>Not tracked</b>Opening rate</span><span><b>'+esc(m.replies??0)+'</b>Human replies</span><span><b>'+esc(m.meetings??0)+'</b>Booked meetings</span><span><b>Not tracked</b>Reply / meeting rates</span><span><b>Not tracked</b>Flow spending</span></div><p class="mf-hint">'+esc(m.period||'Last 30 days · email')+'. Delivery-based conversion rates are unavailable until delivery is measured. Manual outreach is not yet attributed to these counters.</p>';
   if(flow.review.length){html+='<details class="mf-review" open><summary>'+flow.review.length+' adjustments to confirm</summary><form data-flows-review="'+esc(flow.id)+'">';for(const item of flow.review)html+='<label><input type="checkbox" name="confirmed" value="'+esc(item.id)+'">'+esc(item.label)+'</label>';html+='<button '+(!owner?'disabled':'')+'>Confirm reviewed adjustments</button><p>Open this flow to make changes. Market strategy must be approved before confirmation.</p></form></details>';}
   html+='<p class="mf-hint">'+(flow.snapshotPolicy==='pinned'?'Protected version '+flow.savedVersion+' · settings and scripts retained':'Legacy shared settings · open and save a protected version to keep this setup independent')+'</p><div class="mf-actions">'+(current?'<button data-flow-checkpoint="'+esc(flow.id)+'" '+(!owner?'disabled':'')+'>Save protected version</button>':'')+'<button data-flow-versions="'+esc(flow.id)+'">Version history</button><button data-flow-open="'+esc(flow.id)+'" '+(!owner?'disabled':'')+'>Open flow · manual work</button><button data-flow-automation="'+esc(flow.id)+'">Automation settings</button><button data-flow-duplicate="'+esc(flow.id)+'" '+(!owner||data.flows.length>=10?'disabled':'')+'>Duplicate</button><button data-flow-rename="'+esc(flow.id)+'" '+(!owner?'disabled':'')+'>Rename</button>'+(flow.status==='automatic'?'<button data-flow-pause="'+esc(flow.id)+'" '+(!owner?'disabled':'')+'>Pause</button>':'')+'</div><p class="mf-hint">'+esc(flow.readiness)+' · Updated '+esc(new Date(flow.updatedAt).toLocaleString())+(flow.nextRunAt?' · Next run '+esc(new Date(flow.nextRunAt).toLocaleString()):'')+'</p></article>';
  }
  html+='</div>';if(!data.flows.length)html+='<div class="mf-empty">Your current setup is safe. Save it above to create your first reusable flow.</div>';
  content.innerHTML=html;
  content.querySelector('[data-flows-create]').addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.target);await mutate('',{action:'create',name:form.get('name')},{flush:true});});
  for(const b of content.querySelectorAll('[data-flow-checkpoint]'))b.addEventListener('click',()=>mutate(b.dataset.flowCheckpoint,{action:'checkpoint'},{flush:true}));
  for(const b of content.querySelectorAll('[data-flow-versions]'))b.addEventListener('click',()=>versions(b.dataset.flowVersions));
  for(const b of content.querySelectorAll('[data-flow-open]'))b.addEventListener('click',()=>{void openFlow(b.dataset.flowOpen).catch(()=>{});});
  for(const b of content.querySelectorAll('[data-flow-automation]'))b.addEventListener('click',()=>{if(busy)return;dialog.close();root.LeadIntelApprovedWorkflow?.openAutomation?.(b.dataset.flowAutomation);});
  for(const b of content.querySelectorAll('[data-flow-duplicate]'))b.addEventListener('click',()=>editor(b.dataset.flowDuplicate,'duplicate'));
  for(const b of content.querySelectorAll('[data-flow-rename]'))b.addEventListener('click',()=>editor(b.dataset.flowRename,'rename'));
  for(const b of content.querySelectorAll('[data-flow-pause]'))b.addEventListener('click',()=>mutate(b.dataset.flowPause,{action:'pause'}));
  for(const form of content.querySelectorAll('[data-flows-review]'))form.addEventListener('submit',event=>{event.preventDefault();mutate(form.dataset.flowsReview,{action:'review',confirmed:new FormData(form).getAll('confirmed')});});
 }
 async function load(){if(busy)return;if(workspace!==bridge()?.workspace?.id||!bridge()?.session?.authenticated){data=null;dialog?.querySelector('[data-flows-content]')?.replaceChildren();}busy=true;const token=++requestId;notice('Loading saved flows…');try{const next=await api();if(token!==requestId)return;workspace=bridge().workspace.id;data=next;render();notice('');}catch(error){if(token===requestId)notice(error.message);}finally{if(token===requestId)busy=false;}}
 async function mutate(id,body,{flush=false}={}){
  if(busy||!data)return;const ws=workspace,own=accountContext(),token=++requestId,flow=data.flows.find(f=>f.id===id);busy=true;notice('Saving…');
  try{if(flush){const result=await bridge().saveNow({saveIntent:true});if(!result.saved)throw Error('Current work could not be saved. Your local work is preserved.');body.workspaceVersion=bridge().stateVersion;}
   if(workspace!==ws||bridge().workspace.id!==ws)throw Error('Workspace changed. Refresh My Flows.');
   if(id){body.revision=flow.revision;if(flush){const latest=await api(id);body.revision=latest.revision;}}
   if(body.action==='duplicate'&&id===data.currentId&&typeof bridge().saveNow==='function'){const saved=await bridge().saveNow({saveIntent:true});if(!saved.saved)throw Error('Current work could not be saved. Your local work is preserved.');const latest=await api(id);body.revision=latest.revision;}
   if(token!==requestId||accountContext()!==own)return;const result=await api(id,body),next=await api();if(token!==requestId||accountContext()!==own)return;data=next;render();if(body.action==='create'&&result.id){notice('Workflow saved. Opening it…');await bridge().openSavedFlow(result.id,data.flows.find(f=>f.id===result.id)?.revision||1);return;}notice(body.action==='checkpoint'?'Protected version saved. Working progress remains available.':body.action==='restore-version'?'Version copied into a separate paused workflow.':body.action==='duplicate'?'Copy saved and paused. Open it, adjust the highlighted settings, then confirm review.':'Saved.');
  }catch(error){if(token===requestId&&accountContext()===own)notice(error.message);}finally{if(token===requestId)busy=false;}
 }
 async function openFlow(id){if(busy)return;const flow=data.flows.find(f=>f.id===id);if(!flow)throw Error('Workflow unavailable. Refresh the list.');busy=true;const token=++requestId,own=accountContext();notice('Saving current work and opening '+flow.name+'…');try{await bridge().openSavedFlow(id,flow.revision);}catch(error){if(token===requestId&&accountContext()===own)notice(error.message);throw error;}finally{if(token===requestId)busy=false;}}
 function editor(id,action){if(busy)return;const flow=data.flows.find(f=>f.id===id),host=dialog.querySelector('[data-flows-editor]');host.hidden=false;host.innerHTML='<form data-flow-editor><h3>'+(action==='duplicate'?'Duplicate flow':'Rename flow')+'</h3><label>Flow name<input name="name" maxlength="100" required value="'+esc(action==='duplicate'?flow.name.slice(0,90)+' — copy':flow.name)+'"></label>'+(action==='duplicate'?'<label>Target markets (optional, comma-separated)<input name="markets" value="'+esc(flow.summary.markets.join(', '))+'"></label><p>The copy starts paused with no buyer drafts, outreach queue or inherited performance. Your original flow stays saved.</p>':'')+'<button>Save</button><button type="button" data-editor-cancel>Cancel</button></form>';host.querySelector('[data-editor-cancel]').addEventListener('click',()=>host.hidden=true);host.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.target);mutate(id,{action,name:form.get('name'),...(action==='duplicate'?{markets:String(form.get('markets')).split(',').map(s=>s.trim()).filter(Boolean)}:{})});});host.querySelector('input').focus();host.scrollIntoView?.({block:'nearest'});}
 function open(){if(!dialog){dialog=document.createElement('dialog');dialog.className='wf-dialog mf-dialog';dialog.innerHTML='<header><div><span class="eyebrow">Saved settings and automation</span><h2>My Flows</h2></div><button data-flows-refresh>Refresh</button><button data-flows-close>Close</button></header><p data-flows-notice role="status" aria-live="polite"></p><div data-flows-content></div>';document.body.append(dialog);dialog.querySelector('[data-flows-close]').addEventListener('click',()=>dialog.close());dialog.querySelector('[data-flows-refresh]').addEventListener('click',load);}if(!dialog.open)dialog.showModal();load();}
 async function versions(id){
  if(busy)return;busy=true;const own=accountContext(),token=++requestId;notice('Loading protected versions…');
  try{const value=await api(id);if(accountContext()!==own||token!==requestId)return;const host=dialog.querySelector('[data-flows-editor]');host.hidden=false;
   host.innerHTML='<h3>Protected versions · '+esc(value.name)+'</h3><p>Opening a version creates a separate paused copy. It never rewinds sent messages or changes the original workflow.</p>'+(value.versions?.length?value.versions.map(v=>'<div class="mf-version"><strong>Version '+v.version+'</strong> · '+esc(v.created_at)+' <button type="button" data-flow-version="'+v.version+'" '+(data.role!=='owner'?'disabled':'')+'>Create copy from this version</button></div>').join(''):'<p>No protected versions yet. Open this workflow and save a protected version.</p>');
   for(const button of host.querySelectorAll('[data-flow-version]'))button.addEventListener('click',()=>mutate(id,{action:'restore-version',version:Number(button.dataset.flowVersion),name:value.name.slice(0,75)+' — v'+button.dataset.flowVersion+' copy'}));notice('');
  }catch(e){if(accountContext()===own&&token===requestId)notice(e.message);}finally{if(token===requestId)busy=false;}
 }
 async function selectFlow(id){
  if(busy)return;busy=true;const token=++requestId,own=accountContext();try{const next=await api();if(token!==requestId||accountContext()!==own)return;showSummary(next);data=next;workspace=bridge().workspace.id;busy=false;return await openFlow(id);}finally{if(token===requestId)busy=false;}
 }
 function current(){if(!accountContext()||summaryWorkspace!==accountContext())return null;return summary?.flows?.find(f=>f.id===summary.currentId)||null;}
 function listSummary(){return accountContext()&&summaryWorkspace===accountContext()?summary:null;}
 function clear(){++requestId;++summaryRequestId;busy=false;data=null;summary=null;workspace='';summaryWorkspace='';dialog?.close();dialog?.querySelector('[data-flows-content]')?.replaceChildren();root.dispatchEvent(new root.CustomEvent('leadintel:flows-changed'));}
 root.LeadIntelMyFlows={open,refresh:load,refreshSummary,current,listSummary,selectFlow,currentId:()=>current()?.id||null};
 root.addEventListener('leadintel:workspace-changed',clear);
 root.addEventListener('leadintel:server-ready',()=>{void refreshSummary();});
 root.addEventListener('leadintel:server-synced',()=>{clearTimeout(summaryTimer);summaryTimer=setTimeout(()=>void refreshSummary(),750);});
 root.addEventListener('focus',()=>{void refreshSummary();});
 if(bridge()?.ready===true)void refreshSummary();
})(window);
