(function(root){
 'use strict';
 const base='https://leadintel-api.edgars-7e7.workers.dev',d=root.document;
 const bridge=()=>root.LeadIntelServerBridge;
 const context=()=>bridge()?.session?.authenticated&&bridge()?.ready!==false?`${bridge().session.user?.id||''}:${bridge().workspace?.id||''}:${bridge().workspace?.role||''}`:'';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytes=value=>`${+(Number(value||0)/1e6).toFixed(2)} MB`;
 let dialog,owner='',generation=0,accountEpoch=0,files=[],preferences=null,busy=false,focusBefore;
 function current(token){return owner&&owner===context()&&token===generation&&dialog?.open;}
 function path(kind,id){return `/api/${kind==='book'?'writing-references':'company-materials'}/${encodeURIComponent(id)}`;}
 async function api(pathname,{method='GET',body,workspace=bridge()?.workspace?.id}={}){
  const response=await root.fetch(`${base}${pathname}?workspace_id=${encodeURIComponent(workspace||'')}`,{method,credentials:'include',signal:root.AbortSignal?.timeout?.(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Storage could not be loaded. Retry.');return result;
 }
 function say(message){dialog.querySelector('[data-storage-message]').textContent=message;}
 function render(){
  const canEdit=bridge()?.workspace?.role==='owner';
  dialog.querySelector('[data-storage-content]').innerHTML=`<section class="storage-saving"><h3>Choose what to keep</h3><label><input type="checkbox" data-auto-reports ${preferences?.auto_report_copies?'checked':''} ${!canEdit||busy||!preferences?'disabled':''}> Save an extra report copy after research</label><p>Turn this off to save report copies only when you choose Save report. Research evidence, monitoring findings, CRM records and workflows remain saved.</p><p>Identical company-file uploads are reused. Abandoned book uploads expire automatically; saved books and files are never removed based on age or relevance.</p>${!canEdit?'<small>Only the workspace owner can change saving settings or delete files here.</small>':''}</section><h3>Uploaded files and books</h3><p>Largest files first. Download a copy before deleting. Other content still counts toward the usage bars.</p><div class="storage-file-list">${files.length?files.map((file,index)=>`<article class="storage-file"><div><strong>${esc(file.name)}</strong><small>${file.kind==='book'?'Book':'Company file'} · ${esc(file.status)} · ${file.measured?bytes(file.bytes):`${bytes(file.bytes)} accounted; total not yet confirmed`}</small></div><div class="storage-file-actions"><a class="ai-settings-btn" href="${path(file.kind,file.id)}/original?workspace_id=${encodeURIComponent(bridge()?.workspace?.id||'')}" target="_blank" rel="noopener">Download</a><button class="ai-settings-btn storage-delete" type="button" data-delete-file="${index}" ${!canEdit||busy||['Processing','Uploading','Deleting'].includes(file.status)?'disabled':''}>${file.kind==='book'?'Delete book':'Delete file'}</button></div></article>`).join(''):'<p>No uploaded company files or books.</p>'}</div>`;
 }
 async function load(){
  const token=++generation;busy=true;files=[];preferences=null;render();say('Loading files and saving preferences…');
  try{
   const [list,policy]=await Promise.all([api('/api/storage/files'),api('/api/storage/preferences')]);
   if(!current(token))return;
   if(list.workspace_id!==bridge().workspace.id||policy.workspace_id!==bridge().workspace.id)throw Error('Workspace changed. Reopen storage.');
   files=list.files;preferences=policy.preferences;say('Usage includes original files and their extracted content.');
  }catch(error){if(current(token))say(error.message);}
  finally{if(current(token)){busy=false;render();}}
 }
 async function remove(index){
  const token=generation,file=files[index],workspace=bridge()?.workspace?.id;
  if(!file||busy||!current(token)||bridge()?.workspace?.role!=='owner')return;
  busy=true;render();
  try{
   const message=file.kind==='book'?`Delete ${file.name}, its original file and book analysis? Independently saved skills remain available. This cannot be undone.`:`Delete ${file.name}, its original file and extracted analysis? It will no longer be available for future profile preparation. Existing saved profile text remains. This cannot be undone.`;
   const yes=await root.LeadIntelDialogs?.confirm(message,{title:file.kind==='book'?'Delete book?':'Delete file?',action:file.kind==='book'?'Delete book':'Delete file',danger:true});
   if(yes!==true||!current(token))return;
   await api(path(file.kind,file.id),{method:'DELETE',body:{expectedRevision:file.revision},workspace});
   if(!current(token))return;
   await load();if(owner===context()){void root.LeadIntelStorage?.refresh();root.dispatchEvent(new root.CustomEvent('leadintel:storage-files-changed'));}
  }catch(error){if(current(token))say(error.message);}
  finally{if(current(token)){busy=false;render();}}
 }
 async function savePreference(value){
  const token=generation;
  if(busy||!preferences||!current(token)||bridge()?.workspace?.role!=='owner')return;
  busy=true;render();
  try{const result=await api('/api/storage/preferences',{method:'POST',body:{auto_report_copies:value,revision:preferences.revision}});if(!current(token))return;preferences=result.preferences;say('Saving preference updated. Existing content is preserved.');}
  catch(error){if(current(token))say(error.message);}
  finally{if(current(token)){busy=false;render();}}
 }
 function open(){
  if(!context())return;
  if(!dialog){dialog=d.createElement('dialog');dialog.className='storage-management-dialog';dialog.setAttribute('aria-labelledby','storage-manager-title');dialog.innerHTML='<div class="storage-card-head"><h2 id="storage-manager-title">Manage storage</h2><button type="button" data-storage-close aria-label="Close storage">✕</button></div><p role="status" data-storage-message></p><div data-storage-content></div><button type="button" class="ai-settings-btn" data-storage-reload>Refresh files</button>';d.body.appendChild(dialog);dialog.querySelector('[data-storage-close]').onclick=()=>dialog.close();dialog.querySelector('[data-storage-reload]').onclick=()=>{if(!busy)void load();};dialog.addEventListener('click',event=>{const button=event.target.closest('[data-delete-file]');if(button)void remove(Number(button.dataset.deleteFile));});dialog.addEventListener('change',event=>{if(event.target.matches('[data-auto-reports]'))void savePreference(event.target.checked);});dialog.addEventListener('close',()=>{generation++;owner='';files=[];preferences=null;busy=false;(focusBefore?.isConnected?focusBefore:d.querySelector('[data-storage-action="manage"]'))?.focus?.();});}
  if(dialog.open)return;owner=context();focusBefore=d.activeElement;dialog.showModal();void load();
 }
 async function reportCopiesAllowed(){
  const requested=context(),epoch=accountEpoch;if(!requested)return false;
  const result=await api('/api/storage/preferences');
  return epoch===accountEpoch&&requested===context()&&result.workspace_id===bridge()?.workspace?.id&&result.preferences.auto_report_copies===true;
 }
 root.addEventListener('leadintel:workspace-changed',()=>{accountEpoch++;if(dialog?.open)dialog.close();});
 root.LeadIntelStorageManagement={open,reportCopiesAllowed};
})(window);
