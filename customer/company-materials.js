(function(root){
 'use strict';
 const maxBytes=15*1024*1024;
 const materialStates=new Set(['Uploading','Processing','Ready','Needs attention','Deleting']);
 function checkedCards(data){
  const invalid=()=>{throw Error('Saved material response was invalid. Your displayed originals are preserved; refresh and retry.');};
  if(!data||!Array.isArray(data.cards))invalid();
  const ids=new Set();for(const card of data.cards){
   if(!card||typeof card.id!=='string'||!card.id||ids.has(card.id)||typeof card.filename!=='string'||!card.filename||!['pdf','image'].includes(card.kind)||!materialStates.has(card.status)||!Number.isSafeInteger(card.revision)||card.revision<1)invalid();
   if(card.analysis!=null&&(typeof card.analysis!=='object'||Array.isArray(card.analysis)||card.analysis.summary!=null&&typeof card.analysis.summary!=='string')||card.error!=null&&typeof card.error!=='string')invalid();
   ids.add(card.id);
  }
  return data;
 }
 function checkedExtracted(data){if(!data||typeof data.id!=='string'||!Number.isSafeInteger(data.revision)||!Array.isArray(data.sections)||!data.sections.length||data.sections.some(section=>!section||typeof section.location!=='string'||!section.location||typeof section.text!=='string'))throw Error('Extracted source response was invalid. Refresh and review the saved material again.');return data;}
 function createApi(workspace,fetchImpl=root.fetch.bind(root),isCurrent=()=>true,isWritable=()=>true){
  const check=(write=false)=>{if(!isCurrent())throw Error('Account or workspace changed. Retry company materials in the current context.');if(write&&!isWritable())throw Error('Resolve the workspace synchronization conflict before changing company materials.');};
  async function read(response,write=false){let data;try{data=await response.json();}catch{check(write);throw Error('Material response was invalid. Refresh saved materials and retry.');}check(write);if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'Could not load company materials. Retry.');return data;}
  async function request(path='',method='GET',body){const write=method!=='GET';check(write);const response=await fetchImpl('/api/company-materials'+path+'?workspace_id='+encodeURIComponent(workspace),{method,credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});return read(response,write);}
  return {list:async()=>checkedCards(await request()),profileDocuments:async()=>{const data=await request('/profile-context');if(!Array.isArray(data?.documents))throw Error('Saved material context was invalid. Refresh and retry profile preparation.');return data.documents;},extracted:async id=>checkedExtracted(await request('/'+encodeURIComponent(id)+'/extracted')),originalUrl:id=>'/api/company-materials/'+encodeURIComponent(id)+'/original?workspace_id='+encodeURIComponent(workspace),remove:async card=>checkedCards(await request('/'+encodeURIComponent(card.id),'DELETE',{expectedRevision:card.revision})),retry:async card=>checkedCards(await request('/'+encodeURIComponent(card.id)+'/retry','POST',{expectedRevision:card.revision})),upload:async file=>{
   const operation=root.LeadIntelSetupTrace?.begin('material_upload');try{
   if(file.size>maxBytes)throw Error(file.name+': maximum file size is 15 MB');
   operation?.checkpoint('request','pending');
   const authorization=await request('/upload-ticket','POST',{}),url=new URL(authorization?.uploadUrl);if(url.origin!=='https://leadintel-api.edgars-7e7.workers.dev'||url.pathname!=='/company-material-upload'||typeof authorization?.ticket!=='string'||!authorization.ticket)throw Error('Invalid private upload endpoint');
   check(true);operation?.checkpoint('response','pass');const form=new FormData();form.set('ticket',authorization.ticket);form.set('file',file);operation?.checkpoint('persistence','pending');const response=await fetchImpl(url.href,{method:'POST',credentials:'omit',body:form,signal:AbortSignal.timeout(120000)}),data=checkedCards(await read(response,true));operation?.checkpoint('persistence','pass');operation?.finish('pass');return data;
   }catch(error){operation?.finish(isCurrent()?'fail':'stale');throw error;}
  }};
 }
 function mount({document,currentWorkspace,currentUser=()=>root.LeadIntelServerBridge?.session?.user?.id||'',fetchImpl=root.fetch?.bind(root),confirm}={}){
  const host=document.getElementById('company-material-list'),status=document.getElementById('company-material-status'),input=document.getElementById('pdf-input');if(!host||!status)return null;
  const runtime=document.defaultView||root;
  const confirmMaterial=confirm||((message)=>runtime.LeadIntelDialogs?.confirm(message,{title:'Delete material?',action:'Delete material',danger:true}));
  const ticket=()=>{try{return runtime.localStorage?.getItem('leadintel_account_context_v1')||'';}catch{return '';}};
  const accountReady=()=>runtime.LeadIntelServerBridge?.ready!==false&&runtime.LeadIntelServerBridge?.session?.authenticated!==false&&!document.documentElement?.hasAttribute('data-account-check')&&(!runtime.LeadIntelAccountCache||runtime.LeadIntelAccountCache.current());
  const conflict=()=>Boolean(runtime.LeadIntelServerBridge?.conflict);
  const blocked=()=>!accountReady()?'Wait for the signed-in workspace to finish loading before changing company materials.':conflict()?'Resolve the workspace synchronization conflict before changing company materials.':'';
  let workspace='',user='',accountTicket='',api=null,cards=[],generation=0,busy=false,confirming=false,alive=true,loaded=false,lastPoll=0,pendingList=null;
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const owns=(owner,token)=>alive&&accountTicket===ticket()&&workspace===owner&&currentWorkspace()===owner&&currentUser()===user&&generation===token;
  const valid=(owner,token)=>accountReady()&&owns(owner,token);
  const say=text=>{status.textContent=text;};
  function paint(){
   host.replaceChildren();if(input)input.disabled=!workspace||busy||Boolean(blocked());
   if(!workspace){say(blocked()||'Sign in to upload and reuse company materials.');return;}
   const pdfs=cards.filter(c=>c.kind==='pdf').length,images=cards.filter(c=>c.kind==='image').length;
   if(!cards.length){host.append(node('p',loaded?'No saved materials yet. Upload files to prepare them automatically.':'Loading saved materials…','field-help'));return;}
   host.append(node('p',pdfs+'/5 PDFs · '+images+'/10 images','field-help'));
   for(const card of cards){
    const article=node('article',null,'company-material-card'),heading=node('div',null,'company-material-heading');heading.append(node('strong',card.filename),node('span',card.status,'doc-status'));article.append(heading);
    if(card.analysis?.summary)article.append(node('p',card.analysis.summary));
    if(card.analysis?.analysisMode==='source-excerpts')article.append(node('p','Source text is ready for Profile and relevant messages. AI summary is unavailable; only extracted passages will be used.','field-help'));
    if(card.status==='Processing'||card.status==='Uploading')article.append(node('p','Reading and analyzing automatically. This can take a few minutes.','field-help'));
    if(card.error)article.append(node('p',card.error,'inline-error'));
    if(card.analysis?.analysisPartial||card.analysis?.coverage?.unreadable)article.append(node('p','Partial analysis: only the readable source passages are available. Review extracted text before use.','field-help'));
    const controls=node('div',null,'company-material-controls'),download=node('a','Download original','secondary-btn small');download.href=api.originalUrl(card.id);download.download=card.filename;controls.append(download);
    const button=(label,attribute,handler)=>{const b=node('button',label,'secondary-btn small');b.type='button';b.setAttribute(attribute,'');b.disabled=busy||Boolean(blocked());b.onclick=handler;controls.append(b);};
    let reviewing=false;
    if(card.status==='Ready')button('Review text','data-material-review',async event=>{if(reviewing||blocked())return;const owner=workspace,token=generation;reviewing=true;event.currentTarget.disabled=true;try{const data=await api.extracted(card.id);if(!valid(owner,token)||!article.isConnected)return;if(data.id!==card.id||data.revision!==card.revision)throw Error('Material changed. Refresh saved materials and review its current text.');const details=node('details'),summary=node('summary','Extracted source text');details.open=true;details.append(summary);for(const section of data.sections){details.append(node('small',section.location.replace(':',' ')),node('pre',section.text));}article.querySelector('details')?.remove();article.append(details);}catch(e){if(valid(owner,token))say(e.message);}finally{reviewing=false;const review=article.querySelector('[data-material-review]');if(review)review.disabled=busy||Boolean(blocked());}});
    if(card.status==='Needs attention')button('Retry analysis','data-material-retry',()=>mutate(()=>api.retry(card),'Queued for automatic analysis.'));
    if(card.status!=='Deleting')button('Delete','data-material-delete',async()=>{if(confirming||busy||blocked()){if(blocked())say(blocked());return;}const owner=workspace,token=generation;confirming=true;try{if(await confirmMaterial('Delete '+card.filename+' and its saved analysis?')===true&&valid(owner,token)&&!blocked())await mutate(()=>api.remove(card),'Material deleted.');}catch(e){if(valid(owner,token))say(e.message);}finally{confirming=false;}});
    article.append(controls);host.append(article);
   }
  }
  async function mutate(run,message){if(!alive||busy||!workspace||blocked()){if(alive&&blocked())say(blocked());return;}const owner=workspace,token=++generation;busy=true;paint();try{const data=await run();if(!valid(owner,token))return;cards=data.cards;loaded=true;paint();say(message);}catch(e){if(valid(owner,token)){loaded=false;say(e.message);}}finally{if(owns(owner,token)){busy=false;paint();}}}
  async function sync({refresh=false}={}){
   if(!alive)return;const next=accountReady()?currentWorkspace()||'':'',nextUser=currentUser(),nextTicket=ticket();if(next!==workspace||nextUser!==user||nextTicket!==accountTicket){generation++;workspace=next;user=nextUser;accountTicket=nextTicket;api=next?createApi(next,fetchImpl,()=>alive&&accountReady()&&ticket()===nextTicket&&currentWorkspace()===next&&currentUser()===nextUser,()=>!conflict()):null;cards=[];busy=false;loaded=false;paint();}else if(!refresh&&(loaded&&!cards.some(c=>['Processing','Uploading','Deleting'].includes(c.status))||Date.now()-lastPoll<5000))return;
   if(!workspace){paint();return;}if(busy)return;if(pendingList&&owns(pendingList.owner,pendingList.token))return pendingList.promise;
   const owner=workspace,token=++generation,operation={owner,token,promise:null};lastPoll=Date.now();pendingList=operation;
   operation.promise=(async()=>{try{const data=await api.list();if(!valid(owner,token))return;cards=data.cards;loaded=true;paint();say(cards.some(c=>c.status==='Processing')?'Analysis runs automatically. Ready references will be chosen when relevant.':'Ready references are selected automatically when relevant to your message.');}catch(e){if(valid(owner,token))say(e.message);}finally{if(pendingList===operation)pendingList=null;}})();return operation.promise;
  }
  async function upload(files){
   if(!alive)return;const selectedFiles=[...files];
   if(busy||blocked()){say(blocked()||'Wait for the current upload to finish.');return;}
   // Controls can be used before the first poll, or immediately after a workspace
   // switch. Capture the FileList first and bind it to the verified current owner.
   const selectedWorkspace=currentWorkspace(),selectedUser=currentUser(),selectedTicket=ticket();
   if(!loaded||workspace!==selectedWorkspace||user!==selectedUser||accountTicket!==selectedTicket)await sync({refresh:true});
   if(!alive||!accountReady()||currentWorkspace()!==selectedWorkspace||currentUser()!==selectedUser||ticket()!==selectedTicket)return;
   if(!workspace||busy||blocked()||!loaded){say(blocked()||(busy?'Wait for the current upload to finish.':workspace?'Saved materials could not be loaded. Refresh before uploading files.':'Sign in before uploading materials.'));return;}
   const owner=workspace,token=++generation;busy=true;paint();let rejected=0,succeeded=0;const errors=[];
   try{for(const file of selectedFiles){if(!valid(owner,token)||blocked())break;const kind=/\.pdf$/i.test(file.name)?'pdf':/\.(jpe?g|png)$/i.test(file.name)?'image':'';
     if(!kind){errors.push(file.name+': use PDF, JPG or PNG');rejected++;continue;}
     if(cards.filter(c=>c.kind===kind).length>=(kind==='pdf'?5:10)){errors.push(kind==='pdf'?'Maximum 5 PDFs reached':'Maximum 10 images reached');rejected++;continue;}
     say('Uploading '+file.name+'…');try{const data=await api.upload(file);if(!valid(owner,token))break;cards=data.cards;succeeded++;loaded=true;paint();}catch(e){if(!valid(owner,token))break;errors.push(file.name+': '+e.message);rejected++;if(blocked())break;
      // The server may have saved an original even if its response was lost. Read
      // its current list before using quotas for any later file; never resend it.
      try{const data=await api.list();if(!valid(owner,token))break;cards=data.cards;loaded=true;paint();}catch{if(valid(owner,token)){loaded=false;errors.push('Upload result could not be confirmed. Refresh saved materials before uploading again.');}break;}
     }
    }}finally{if(owns(owner,token)){busy=false;paint();if(valid(owner,token))say(blocked()||((succeeded?succeeded+' file(s) saved. Analysis starts automatically. ':'')+(rejected?errors.join(' · '):'')));if(input)input.value='';}}
  }
  // Own the upload controls even while the large app module is still starting.
  // Capture prevents the legacy app listeners from submitting the same files twice.
  const selected=event=>{event.stopImmediatePropagation();void upload(event.target.files||[]);};
  const dropped=event=>{event.preventDefault();event.stopImmediatePropagation();zone?.classList.remove('dragging');void upload(event.dataTransfer?.files||[]);};
  const zone=document.getElementById('upload-zone');
  const drag=event=>{event.preventDefault();zone?.classList.add('dragging');};
  const leave=()=>zone?.classList.remove('dragging');
  zone?.addEventListener('dragenter',drag);zone?.addEventListener('dragover',drag);zone?.addEventListener('dragleave',leave);
  input?.addEventListener('change',selected,true);zone?.addEventListener('drop',dropped,true);
  const contextChanged=()=>void sync({refresh:true});
  runtime.addEventListener?.('leadintel:server-ready',contextChanged);runtime.addEventListener?.('leadintel:workspace-changed',contextChanged);
  return {sync,upload,destroy(){alive=false;generation++;runtime.removeEventListener?.('leadintel:server-ready',contextChanged);runtime.removeEventListener?.('leadintel:workspace-changed',contextChanged);input?.removeEventListener('change',selected,true);zone?.removeEventListener('drop',dropped,true);zone?.removeEventListener('dragenter',drag);zone?.removeEventListener('dragover',drag);zone?.removeEventListener('dragleave',leave);}};
 }
 async function profileDocuments(){
  const bridge=root.LeadIntelServerBridge,workspace=bridge?.session?.authenticated?bridge.workspace?.id:'',user=bridge?.session?.user?.id;
  if(!workspace||bridge.ready!==true||root.document?.documentElement?.hasAttribute('data-account-check')||root.LeadIntelAccountCache&&!root.LeadIntelAccountCache.current())throw Error('Sign in and wait for the workspace to load before reading company materials.');
  if(bridge.conflict)throw Error('Resolve the workspace synchronization conflict before reading company material context.');
  const account=root.localStorage?.getItem('leadintel_account_context_v1');
  return createApi(workspace,root.fetch.bind(root),()=>Boolean(root.LeadIntelServerBridge?.session?.authenticated)&&root.LeadIntelServerBridge?.ready===true&&!root.LeadIntelServerBridge?.conflict&&!root.document?.documentElement?.hasAttribute('data-account-check')&&(!root.LeadIntelAccountCache||root.LeadIntelAccountCache.current())&&root.LeadIntelServerBridge?.workspace?.id===workspace&&root.LeadIntelServerBridge?.session?.user?.id===user&&root.localStorage?.getItem('leadintel_account_context_v1')===account).profileDocuments();
 }
 const api={createApi,mount,profileDocuments};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.LeadIntelCompanyMaterials=api;
 if(root.document){const currentWorkspace=()=>root.LeadIntelServerBridge?.session?.authenticated?root.LeadIntelServerBridge.workspace?.id||'':'';const boot=()=>{const ui=mount({document:root.document,currentWorkspace});if(!ui)return;root.LeadIntelCompanyMaterials.upload=files=>ui.upload(files);ui.sync();root.setInterval(()=>ui.sync(),5000);root.addEventListener('focus',()=>ui.sync({refresh:true}));};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window==='object'?window:globalThis);
