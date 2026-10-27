(function(root){
 'use strict';if(!root.document)return;
 let instance=null,workspace='',host=null,pollAt=0,processing=false,activeNames=[],referenceRevision=null,bookCards=[],bookBusy=false,loadGeneration=0;
 const sessionIds=new Set(),sessionSkillIds=new Set();let skillCards=[];
 function currentWorkspace(){return root.LeadIntelServerBridge?.session?.authenticated?root.LeadIntelServerBridge.workspace?.id||'':'';}
 function validWorkspace(){return Boolean(workspace)&&currentWorkspace()===workspace;}
 function changed(){root.dispatchEvent(new root.CustomEvent('leadintel:writing-references-changed',{detail:{workspaceId:workspace,referenceRevision}}));}
 function resetSession(){if(sessionIds.size||sessionSkillIds.size){sessionIds.clear();sessionSkillIds.clear();changed();}return true;}
 function pruneSession(){let pruned=false;for(const id of sessionIds){if(!bookCards.some(c=>c.id===id&&c.status==='Ready')){sessionIds.delete(id);pruned=true;}}return pruned;}
 function renderBookSwitches(){
  // Book choices belong to the current assistant session, never setup settings.
  root.document.getElementById('mw-book-toggles')?.replaceChildren();
  const status=root.document.getElementById('mw-book-status');if(status)status.textContent='Choose books for your current conversation in the Writing Assistant.';
 }
 function indicator(){const el=root.document.getElementById('writing-reference-indicator');if(!el)return;const mode=root.document.getElementById('message-mode')?.value;el.textContent=mode==='original'&&activeNames.length?'Using '+activeNames.length+' writing reference'+(activeNames.length===1?'':'s')+': '+activeNames.join(', '):'Choose writing references in the Writing Assistant. Core scripts stay protected.';}
 function sync(){
  const studio=root.document.getElementById('message-studio'),next=currentWorkspace();
  if(!studio||!next){if(instance)instance.destroy();instance=null;host?.remove();host=null;loadGeneration++;sessionIds.clear();sessionSkillIds.clear();skillCards=[];workspace='';bookCards=[];activeNames=[];referenceRevision=null;renderBookSwitches();indicator();return;}
  if(workspace!==next||!host?.isConnected){
   instance?.destroy();host?.remove();host=root.document.createElement('div');host.id='writing-reference-cards';const details=root.document.getElementById('mw-writing-reference-host')||studio.querySelector('details');details.append(host);workspace=next;bookBusy=false;bookCards=[];processing=false;activeNames=[];referenceRevision=null;sessionIds.clear();sessionSkillIds.clear();skillCards=[];
   const captured=next,generation=++loadGeneration;
   const api=root.LeadIntelWritingReferencesApi.createWritingReferencesApi({workspaceId:next,onResult:data=>{
    if(loadGeneration!==generation||workspace!==captured||currentWorkspace()!==captured||!Array.isArray(data.cards)||!Number.isInteger(data.referenceRevision)||referenceRevision!==null&&data.referenceRevision<referenceRevision)return;
    const revisionChanged=referenceRevision!==data.referenceRevision;referenceRevision=data.referenceRevision;bookCards=data.cards;const selectionChanged=pruneSession();
    if(revisionChanged||selectionChanged)changed();renderBookSwitches();processing=bookCards.some(c=>['Processing','Deleting'].includes(c.status))||skillCards.some(s=>['Preparing','Processing'].includes(s.status));activeNames=bookCards.filter(c=>c.active&&c.status==='Ready').map(c=>c.presentation?.title||c.filename);indicator();
   }});
   renderBookSwitches();instance=root.LeadIntelWritingReferences.mountWritingReferences({root:host,api,onChange:data=>{if(data.skills){skillCards=data.skills;for(const id of sessionSkillIds)if(!skillCards.some(s=>s.id===id&&s.enabled&&s.status==='Ready'))sessionSkillIds.delete(id);processing=bookCards.some(c=>['Processing','Deleting'].includes(c.status))||Boolean(data.skillsProcessing);changed();}indicator();}});instance.refresh();pollAt=Date.now();
   if(!root.document.getElementById('writing-reference-indicator')){const p=root.document.createElement('p');p.id='writing-reference-indicator';p.setAttribute('role','status');studio.querySelector('#message-mode-label')?.after(p);}
  }else if(processing&&!host.contains(root.document.activeElement)&&Date.now()-pollAt>5000){pollAt=Date.now();instance.refresh();}
  const summary=root.document.getElementById('mw-reference-count');if(summary)summary.textContent=bookCards.length+' of 3 files';indicator();
 }
 function snapshot(session=false){
  const rows=validWorkspace()?bookCards:[];
  return {skillRefs:validWorkspace()?skillCards.filter(s=>sessionSkillIds.has(s.id)&&s.enabled&&s.status==='Ready').map(s=>({id:s.id,revision:s.revision})):[],skills:validWorkspace()?skillCards.map(s=>({...s,selected:sessionSkillIds.has(s.id)})):[],workspaceId:validWorkspace()?workspace:'',referenceRevision:validWorkspace()?referenceRevision:null,sourceRefs:rows.filter(c=>(session?sessionIds.has(c.id):c.active)&&c.status==='Ready').map(c=>({id:c.id,revision:c.revision})),cards:rows.map(c=>({id:c.id,slot:c.slot,filename:c.filename,presentation:c.presentation,summary:c.summary,techniques:c.techniques,coverage:c.coverage,active:session?sessionIds.has(c.id)&&c.status==='Ready':c.active,status:c.status}))};
 }
 root.LeadIntelWritingReferenceSelection={
  activate:async id=>{if(bookBusy||!instance||!validWorkspace())return false;const captured=workspace,generation=loadGeneration;bookBusy=true;try{return await instance.setActive(id,true);}finally{if(workspace===captured&&loadGeneration===generation)bookBusy=false;}},
  snapshot:()=>snapshot(),
  sessionSnapshot:()=>snapshot(true),
  resetSession,
  toggleSkillSession:id=>{if(!validWorkspace()||!skillCards.some(s=>s.id===id&&s.status==='Ready'&&s.enabled))return false;if(sessionSkillIds.has(id))sessionSkillIds.delete(id);else{if(sessionSkillIds.size>=3)return false;sessionSkillIds.add(id);}changed();return true;},
  toggleSession:id=>{if(!validWorkspace()||!bookCards.some(c=>c.id===id&&c.status==='Ready'))return false;if(sessionIds.has(id))sessionIds.delete(id);else{if(sessionIds.size>=3)return false;sessionIds.add(id);}changed();return true;}
 };
 root.setInterval(sync,2500);root.addEventListener('focus',()=>{if(validWorkspace())instance?.refresh();else sync();});root.document.addEventListener('change',indicator);sync();
})(window);
