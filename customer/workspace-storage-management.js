(function(root){
 'use strict';
 const base='https://leadintel-api.edgars-7e7.workers.dev',d=root.document;
 const bridge=()=>root.LeadIntelServerBridge;
 const context=()=>bridge()?.session?.authenticated&&bridge()?.ready!==false?`${bridge().session.user?.id||''}:${bridge().workspace?.id||''}:${bridge().workspace?.role||''}`:'';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytes=value=>{const n=Number(value||0);return n<1000?n+' B':n<1e6?+(n/1000).toFixed(2)+' KB':+(n/1e6).toFixed(2)+' MB';};
 let dialog,owner='',generation=0,accountEpoch=0,files=[],preferences=null,busy=false,focusBefore;
 let filesLoaded=false,reports=[],groups=[],usage=null,selected='',rows=[],more=false;
 const deletion={
  writing_workspace_records:['storage/draft','this archived writing draft'],
  content_materials:['content-materials','its saved content'],
  workspace_skills:['workspace-skills','its saved methods and package'],
  copilot_conversations:['copilot/conversations','its messages and linked research tasks'],
  crm_companies:['crm/companies','its CRM contacts, activities and history'],
  company_lists:['company-lists','its saved list and list evidence'],
  customer_brand_assets:['customer/brand-assets','the uploaded brand asset'],
  saved_flow_versions:['storage/version','this workflow version and any data used only by that version'],
  snapshots:['storage/backup','this older workspace backup']
 };
 function current(token){return owner&&owner===context()&&token===generation&&dialog?.open;}
 function path(kind,id){return `/api/${kind==='book'?'writing-references':'company-materials'}/${encodeURIComponent(id)}`;}
 async function api(pathname,{method='GET',body,workspace=bridge()?.workspace?.id}={}){
  const response=await root.fetch(`${base}${pathname}${pathname.includes('?')?'&':'?'}workspace_id=${encodeURIComponent(workspace||'')}`,{method,credentials:'include',signal:root.AbortSignal?.timeout?.(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok)throw Error((result.retained?'This asset is still used by the workspace. Remove the reference first.':'')||result.error?.message||result.error||'Storage could not be loaded. Retry.');return result;
 }
 function say(message,error=false){const node=dialog.querySelector('[data-storage-message]');node.textContent=message;node.dataset.error=String(error);}
 function breakdown(){
  const section=(meter,title)=>{const list=groups.filter(g=>g.meter===meter);return list.length?`<h3>${title}</h3>${list.map(g=>`<button type="button" class="storage-group" data-group="${esc(g.key)}" aria-expanded="${selected===g.key}">${esc(g.label)} · ${bytes(g.bytes)} (${g.count})</button>${selected===g.key?itemList(g):''}`).join('')}`:'';};
  const reportRows=reports.length?`<details><summary>Saved research reports (${reports.length})</summary>${reports.map((r,i)=>`<article class="storage-file"><div><strong>${esc(r.name)}</strong><small>${esc(r.date||'')} · ${bytes(r.bytes)} report content</small></div><button type="button" data-delete-report="${i}" class="ai-settings-btn storage-delete" ${bridge()?.workspace?.role==='owner'&&!busy?'':'disabled'}>Delete report</button></article>`).join('')}</details>`:'';
  return section('records_bytes','CRM &amp; workspace data')+reportRows+section('files_bytes','Files');
 }
 function itemList(group){
  const canDelete=bridge()?.workspace?.role==='owner'&&!busy;
  const parentNote={workspace_payload_records:'Shared by the workspace or saved workflows.',writing_reference_chunks:'Delete the associated book below to remove its analysis.',workspace_storage_objects:'File parts are removed with the corresponding upload, book or skill.',copilot_messages:'Delete the conversation to remove its messages.',company_list_evidence:'Delete the company list to remove its evidence.'};
  return '<section aria-label="'+esc(group.label)+'">'+(rows.length?rows.map((r,i)=>{
   const removable=Object.hasOwn(deletion,group.key)&&r.id!=null&&!['Deleted','Deleting'].includes(r.status)&&(group.key!=='writing_workspace_records'||r.archived)&&(group.key!=='snapshots'||r.old_backup)&&(group.key!=='saved_flow_versions'||r.old_version);
   const fileIndex=['writing_reference_sources','company_materials'].includes(group.key)?files.findIndex(f=>f.id===r.id&&f.kind===(group.key==='company_materials'?'material':'book')):-1;
   const retained=group.key==='snapshots'&&!r.old_backup?'Current backup':group.key==='saved_flow_versions'&&!r.old_version?'Current workflow version':'';
   const action=removable?`<button class="ai-settings-btn storage-delete" type="button" data-delete-item="${i}" ${canDelete?'':'disabled'}>Delete</button>`:fileIndex>=0?`<button class="ai-settings-btn storage-delete" type="button" data-delete-file="${fileIndex}" ${canDelete?'':'disabled'}>Delete</button>`:'';
   return `<article class="storage-file"><div><strong>${esc(r.name||group.label+' · '+r.id)}</strong><small>${bytes(r.bytes)} ${retained?' · '+esc(retained):''} ${r.date?' · '+esc(r.date):''}</small></div>${action}</article>`;
  }).join(''):'<p>Loading items…</p>')+(more?'<button type="button" data-more>Show more</button>':'')+(!deletion[group.key]?'<small>'+esc(parentNote[group.key]||'Managed with its owning workspace record.')+'</small>':'')+'</section>';
 }
 async function inspect(key,append=false){
  if(busy)return;
  if(!append&&selected===key){selected='';render();return;}
  const token=generation;selected=key;if(!append)rows=[];busy=true;render();
  try{const list=await api('/api/storage/files?group='+encodeURIComponent(key)+'&offset='+rows.length);
   if(!current(token)||list.workspace_id!==bridge().workspace.id)return;
   rows=rows.concat(list.items);more=list.more;
  }catch(e){if(current(token)){selected='';say(e.message,true);}}
  finally{if(current(token)){busy=false;render();}}
 }
 async function removeItem(index){
  const item=rows[index],key=selected,token=generation,workspace=bridge()?.workspace?.id;
  if(busy||!current(token)||!item||bridge()?.workspace?.role!=='owner'||!Object.hasOwn(deletion,key))return;
  busy=true;render();
  try{
   const [route,scope]=deletion[key];
   if(!await root.LeadIntelDialogs?.confirm('Delete '+(item.name||groupName(key)+' '+item.id)+' and remove '+scope+'? This cannot be undone.',{title:'Delete item?',action:'Delete',danger:true})||!current(token))return;
   const isList=key==='company_lists',post=isList||['snapshots','saved_flow_versions','writing_workspace_records'].includes(key);
   await api('/api/'+route+(post?'':'/'+encodeURIComponent(item.id)),{workspace,method:post?'POST':'DELETE',body:isList?{action:'delete',id:item.id,revision:item.revision}:key==='saved_flow_versions'?{flow_id:item.flow_id,version:item.version}:key==='writing_workspace_records'?{id:item.id,revision:item.revision}:post?{id:item.id}:{expectedRevision:item.revision}});
   if(current(token))await afterDelete();
  }catch(e){if(current(token))say(e.message,true);}
  finally{if(current(token)){busy=false;render();}}
 }
 function groupName(key){return groups.find(g=>g.key===key)?.label||'Item';}
 async function removeReport(index){
  const token=generation,report=reports[index],flow=bridge()?.openSavedFlow;
  if(!report||busy||!current(token)||bridge()?.workspace?.role!=='owner')return;
  busy=true;render();
  try{
   if(!await root.LeadIntelDialogs?.confirm('Delete the saved report '+report.name+'? Its source research stays available.',{title:'Delete report?',action:'Delete report',danger:true})||!current(token)||bridge()?.openSavedFlow!==flow)return;
   await root.LeadIntelStorageReports.remove(report.id);
   if(current(token))await afterDelete();
  }catch(e){if(current(token))say(e.message,true);}
  finally{if(current(token)){busy=false;render();}}
 }
 async function afterDelete(){
  const previous=usage,expected=context(),token=generation;
  void root.LeadIntelStorage?.refresh();
  root.dispatchEvent(new root.CustomEvent('leadintel:storage-files-changed'));
  await load(false);
  if(owner===expected&&current(token+1)&&usage&&previous){
   const data=Math.max(0,previous.records-usage.records),file=Math.max(0,previous.files-usage.files);
   say(data||file?'Space freed · '+bytes(data)+' workspace data · '+bytes(file)+' files.':'Deletion accepted. Shared data or pending file cleanup may still count toward usage.');
   if(!data&&!file){root.setTimeout(()=>{if(current(token+1)&&!busy){void load(false);void root.LeadIntelStorage?.refresh();}},2500);}
  }
 }
 function render(){
  const canEdit=bridge()?.workspace?.role==='owner';
  dialog.querySelector('[data-storage-content]').innerHTML=`${breakdown()}<section class="storage-saving"><h3>Choose what to keep</h3><label><input type="checkbox" data-auto-reports ${preferences?.auto_report_copies?'checked':''} ${!canEdit||busy||!preferences?'disabled':''}> Save an extra report copy after research</label><p>Turn this off to save report copies only when you choose Save report. Research evidence, monitoring findings, CRM records and workflows remain saved.</p><p>Identical company-file uploads are reused. Abandoned book uploads expire automatically; saved books and files are never removed based on age or relevance.</p>${!canEdit?'<small>Only the workspace owner can change saving settings or delete files here.</small>':''}</section><h3>Uploaded files and books</h3><p>Largest files first. Download a copy before deleting. </p><div class="storage-file-list">${files.length?files.map((file,index)=>`<article class="storage-file"><div><strong>${esc(file.name)}</strong><small>${file.kind==='book'?'Book':'Company file'} · ${esc(file.status)} · ${file.measured?bytes(file.bytes):`${bytes(file.bytes)} accounted; total not yet confirmed`}</small></div><div class="storage-file-actions"><a class="ai-settings-btn" href="${path(file.kind,file.id)}/original?workspace_id=${encodeURIComponent(bridge()?.workspace?.id||'')}" target="_blank" rel="noopener">Download</a><button class="ai-settings-btn storage-delete" type="button" data-delete-file="${index}" ${!canEdit||busy||['Processing','Uploading','Deleting'].includes(file.status)?'disabled':''}>${file.kind==='book'?'Delete book':'Delete file'}</button></div></article>`).join(''):filesLoaded?'<p>No uploaded company files or books.</p>':busy?'<p>Loading saved files…</p>':'<p>File list unavailable. Refresh files to try again.</p>'}</div>`;
  dialog.querySelector('[data-auto-reports]').indeterminate=!preferences;
 }
 async function load(expand=true){
  const token=++generation;busy=true;filesLoaded=false;files=[];preferences=null;reports=[];groups=[];usage=null;selected='';rows=[];more=false;render();say('Loading files and saving preferences…');
  try{
   const [inventory,policy]=await Promise.allSettled([api('/api/storage/files'),api('/api/storage/preferences')]);
   if(!current(token))return;
   const workspace=bridge().workspace.id,errors=[];
   if([inventory,policy].some(response=>response.status==='fulfilled'&&response.value?.workspace_id!==workspace))throw Error('Workspace changed. Reopen storage.');
   if(policy.status==='fulfilled')preferences=policy.value.preferences;
   else errors.push('Saving preferences could not be loaded.');
   if(inventory.status==='fulfilled'){
    const list=inventory.value;
    files=list.files;filesLoaded=true;groups=list.groups||[];usage=list.usage;
    if(expand&&groups.length){
     const group=groups.find(g=>g.meter===list.priority)||groups[0];
     try{
      const page=await api('/api/storage/files?group='+encodeURIComponent(group.key)+'&offset=0');
      if(!current(token))return;
      if(page.workspace_id!==workspace)throw Error('Workspace changed.');
      selected=group.key;rows=page.items;more=page.more;
     }catch{errors.push('Category details could not be loaded. Select the category to retry.');}
    }
   }else errors.push('File list unavailable. Refresh files to try again.');
   if(!current(token))return;
   reports=root.LeadIntelStorageReports?.list()||[];
   say(errors.length?errors.join(' '):usage?bytes(usage.records)+' workspace data · '+bytes(usage.files)+' files':'',errors.length>0);
  }catch(error){if(current(token))say(error.message,true);}
  finally{if(current(token)){busy=false;render();}}
 }
 async function remove(index){
  const token=generation,file=files[index],workspace=bridge()?.workspace?.id;
  if(!file||['Processing','Uploading','Deleting'].includes(file.status)||busy||!current(token)||bridge()?.workspace?.role!=='owner')return;
  busy=true;render();
  try{
   const message=file.kind==='book'?`Delete ${file.name}, its original file and book analysis? Independently saved skills remain available. This cannot be undone.`:`Delete ${file.name}, its original file and extracted analysis? It will no longer be available for future profile preparation. Existing saved profile text remains. This cannot be undone.`;
   const yes=await root.LeadIntelDialogs?.confirm(message,{title:file.kind==='book'?'Delete book?':'Delete file?',action:file.kind==='book'?'Delete book':'Delete file',danger:true});
   if(yes!==true||!current(token))return;
   await api(path(file.kind,file.id),{method:'DELETE',body:{expectedRevision:file.revision},workspace});
   if(!current(token))return;
   await afterDelete();
  }catch(error){if(current(token))say(error.message,true);}
  finally{if(current(token)){busy=false;render();}}
 }
 async function savePreference(value){
  const token=generation;
  if(busy||!preferences||!current(token)||bridge()?.workspace?.role!=='owner')return;
  busy=true;render();
  try{const result=await api('/api/storage/preferences',{method:'POST',body:{auto_report_copies:value,revision:preferences.revision}});if(!current(token))return;preferences=result.preferences;say('Saving preference updated. Existing content is preserved.');}
  catch(error){if(current(token))say(error.message,true);}
  finally{if(current(token)){busy=false;render();}}
 }
 function open(){
  if(!context())return;
  if(!dialog){dialog=d.createElement('dialog');dialog.className='storage-management-dialog';dialog.setAttribute('aria-labelledby','storage-manager-title');dialog.innerHTML='<div class="storage-card-head"><h2 id="storage-manager-title">Manage storage</h2><button type="button" data-storage-close aria-label="Close storage">✕</button></div><p role="status" data-storage-message></p><div data-storage-content></div><button type="button" class="ai-settings-btn" data-storage-reload>Refresh files</button>';d.body.appendChild(dialog);dialog.querySelector('[data-storage-close]').onclick=()=>dialog.close();dialog.querySelector('[data-storage-reload]').onclick=()=>{if(!busy)void load();};dialog.addEventListener('click',event=>{const report=event.target.closest('[data-delete-report]');if(report)return void removeReport(Number(report.dataset.deleteReport));const group=event.target.closest('[data-group]'),item=event.target.closest('[data-delete-item]');if(group)return void inspect(group.dataset.group);if(item)return void removeItem(Number(item.dataset.deleteItem));if(event.target.closest('[data-more]'))return void inspect(selected,true);const button=event.target.closest('[data-delete-file]');if(button)void remove(Number(button.dataset.deleteFile));});dialog.addEventListener('change',event=>{if(event.target.matches('[data-auto-reports]'))void savePreference(event.target.checked);});dialog.addEventListener('close',()=>{generation++;owner='';files=[];preferences=null;groups=[];rows=[];reports=[];usage=null;busy=false;(focusBefore?.isConnected?focusBefore:d.querySelector('[data-storage-action="manage"]'))?.focus?.();});}
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
