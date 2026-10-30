(function(root){
 'use strict';
 const maxBytes=15*1024*1024;
 function createApi(workspace,fetchImpl=root.fetch.bind(root),isCurrent=()=>true){
  const check=()=>{if(!isCurrent())throw Error('Account or workspace changed. Retry company materials in the current context.');};
  async function request(path='',method='GET',body){check();const response=await fetchImpl('/api/company-materials'+path+'?workspace_id='+encodeURIComponent(workspace),{method,credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)}),data=await response.json();check();if(!response.ok)throw Error(data.error||'Could not load company materials. Retry.');return data;}
  return {list:()=>request(),extracted:id=>request('/'+encodeURIComponent(id)+'/extracted'),originalUrl:id=>'/api/company-materials/'+encodeURIComponent(id)+'/original?workspace_id='+encodeURIComponent(workspace),remove:card=>request('/'+encodeURIComponent(card.id),'DELETE',{expectedRevision:card.revision}),retry:card=>request('/'+encodeURIComponent(card.id)+'/retry','POST',{expectedRevision:card.revision}),upload:async file=>{
   const operation=root.LeadIntelSetupTrace?.begin('material_upload');try{
   if(file.size>maxBytes)throw Error(file.name+': maximum file size is 15 MB');
   operation?.checkpoint('request','pending');
   const authorization=await request('/upload-ticket','POST',{}),url=new URL(authorization.uploadUrl);if(url.origin!=='https://leadintel-api.edgars-7e7.workers.dev'||url.pathname!=='/company-material-upload')throw Error('Invalid private upload endpoint');
   check();operation?.checkpoint('response','pass');const form=new FormData();form.set('ticket',authorization.ticket);form.set('file',file);operation?.checkpoint('persistence','pending');const response=await fetchImpl(url.href,{method:'POST',credentials:'omit',body:form,signal:AbortSignal.timeout(120000)}),data=await response.json();check();if(!response.ok)throw Error(data.error||'Upload failed. Select the file again.');operation?.checkpoint('persistence','pass');operation?.finish('pass');return data;
   }catch(error){operation?.finish(isCurrent()?'fail':'stale');throw error;}
  }};
 }
 function mount({document,currentWorkspace,currentUser=()=>root.LeadIntelServerBridge?.session?.user?.id||'',fetchImpl=root.fetch?.bind(root),confirm=message=>root.LeadIntelDialogs?.confirm({title:'Delete material?',message,confirmLabel:'Delete material',danger:true})}={}){
  const host=document.getElementById('company-material-list'),status=document.getElementById('company-material-status'),input=document.getElementById('pdf-input');if(!host||!status)return null;
  const runtime=document.defaultView||root;
  const ticket=()=>{try{return runtime.localStorage?.getItem('leadintel_account_context_v1')||'';}catch{return '';}};
  const accountReady=()=>!runtime.LeadIntelAccountCache||runtime.LeadIntelAccountCache.current();
  let workspace='',user='',accountTicket='',api=null,cards=[],generation=0,busy=false,alive=true,loaded=false,lastPoll=0;
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  const valid=(owner,token)=>alive&&accountReady()&&accountTicket===ticket()&&workspace===owner&&currentWorkspace()===owner&&currentUser()===user&&generation===token;
  const say=text=>{status.textContent=text;};
  function paint(){
   host.replaceChildren();if(input)input.disabled=!workspace||busy;
   if(!workspace){say('Sign in to upload and reuse company materials.');return;}
   const pdfs=cards.filter(c=>c.kind==='pdf').length,images=cards.filter(c=>c.kind==='image').length;
   if(!cards.length){host.append(node('p',loaded?'No saved materials yet. Upload files to prepare them automatically.':'Loading saved materials…','field-help'));return;}
   host.append(node('p',pdfs+'/5 PDFs · '+images+'/10 images','field-help'));
   for(const card of cards){
    const article=node('article',null,'company-material-card'),heading=node('div',null,'company-material-heading');heading.append(node('strong',card.filename),node('span',card.status,'doc-status'));article.append(heading);
    if(card.analysis?.summary)article.append(node('p',card.analysis.summary));
    if(card.status==='Processing'||card.status==='Uploading')article.append(node('p','Reading and analyzing automatically. This can take a few minutes.','field-help'));
    if(card.error)article.append(node('p',card.error,'inline-error'));
    if(card.analysis?.analysisPartial||card.analysis?.coverage?.unreadable)article.append(node('p','Some source content could not be fully analyzed. Review before use.','field-help'));
    const controls=node('div',null,'company-material-controls'),download=node('a','Download original','secondary-btn small');download.href=api.originalUrl(card.id);download.download=card.filename;controls.append(download);
    const button=(label,attribute,handler)=>{const b=node('button',label,'secondary-btn small');b.type='button';b.setAttribute(attribute,'');b.disabled=busy;b.onclick=handler;controls.append(b);};
    if(card.status==='Ready')button('Review text','data-material-review',async()=>{const owner=workspace,token=generation;try{const data=await api.extracted(card.id);if(!valid(owner,token)||!article.isConnected)return;article.querySelector('details')?.remove();const details=node('details'),summary=node('summary','Extracted source text');details.open=true;details.append(summary);for(const section of data.sections||[]){details.append(node('small',section.location.replace(':',' ')),node('pre',section.text));}article.append(details);}catch(e){if(valid(owner,token))say(e.message);}});
    if(card.status==='Needs attention')button('Retry analysis','data-material-retry',()=>mutate(()=>api.retry(card),'Queued for automatic analysis.'));
    if(card.status!=='Deleting')button('Delete','data-material-delete',async()=>{const owner=workspace,token=generation;if(await confirm('Delete '+card.filename+' and its saved analysis?')&&valid(owner,token))await mutate(()=>api.remove(card),'Material deleted.');});
    article.append(controls);host.append(article);
   }
  }
  async function mutate(run,message){if(busy||!workspace)return;const owner=workspace,token=generation;busy=true;paint();try{const data=await run();if(!valid(owner,token))return;cards=data.cards;loaded=true;paint();say(message);}catch(e){if(valid(owner,token))say(e.message);}finally{if(valid(owner,token)){busy=false;paint();}}}
  async function sync({refresh=false}={}){
   if(!alive)return;const next=accountReady()?currentWorkspace()||'':'',nextUser=currentUser(),nextTicket=ticket();if(next!==workspace||nextUser!==user||nextTicket!==accountTicket){generation++;workspace=next;user=nextUser;accountTicket=nextTicket;api=next?createApi(next,fetchImpl,()=>alive&&accountReady()&&ticket()===nextTicket&&currentWorkspace()===next&&currentUser()===nextUser):null;cards=[];busy=false;loaded=false;paint();}else if(!refresh&&(loaded&&!cards.some(c=>['Processing','Uploading','Deleting'].includes(c.status))||Date.now()-lastPoll<5000))return;
   if(!workspace){paint();return;}if(busy)return;const owner=workspace,token=++generation;lastPoll=Date.now();try{const data=await api.list();if(!valid(owner,token))return;cards=data.cards;loaded=true;paint();say(cards.some(c=>c.status==='Processing')?'Analysis runs automatically. Ready references will be chosen when relevant.':'Ready references are selected automatically when relevant to your message.');}catch(e){if(valid(owner,token))say(e.message);}
  }
  async function upload(files){
   if(!workspace||busy){say(workspace?'Wait for the current upload to finish.':'Sign in before uploading materials.');return;}
   const owner=workspace,token=++generation;busy=true;paint();let rejected=0,succeeded=0;const errors=[];
   try{for(const file of [...files]){if(!valid(owner,token))break;const kind=/\.pdf$/i.test(file.name)?'pdf':/\.(jpe?g|png)$/i.test(file.name)?'image':'';
     if(!kind){errors.push(file.name+': use PDF, JPG or PNG');rejected++;continue;}
     if(cards.filter(c=>c.kind===kind).length>=(kind==='pdf'?5:10)){errors.push(kind==='pdf'?'Maximum 5 PDFs reached':'Maximum 10 images reached');rejected++;continue;}
     say('Uploading '+file.name+'…');try{const data=await api.upload(file);if(!valid(owner,token))break;cards=data.cards;succeeded++;loaded=true;paint();}catch(e){errors.push(file.name+': '+e.message);rejected++;}
    }}finally{if(valid(owner,token)){busy=false;paint();say((succeeded?succeeded+' file(s) saved. Analysis starts automatically. ':'')+(rejected?errors.join(' · '):''));if(input)input.value='';}}
  }
  return {sync,upload,destroy(){alive=false;generation++;}};
 }
 const api={createApi,mount};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.LeadIntelCompanyMaterials=api;
 if(root.document){const currentWorkspace=()=>root.LeadIntelServerBridge?.session?.authenticated?root.LeadIntelServerBridge.workspace?.id||'':'';const boot=()=>{const ui=mount({document:root.document,currentWorkspace});if(!ui)return;root.LeadIntelCompanyMaterials.upload=files=>ui.upload(files);ui.sync();root.setInterval(()=>ui.sync(),5000);root.addEventListener('focus',()=>ui.sync({refresh:true}));};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window==='object'?window:globalThis);
