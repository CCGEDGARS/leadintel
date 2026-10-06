(function(root){
 'use strict';if(!root.document)return;
 let instance=null,workspace='',host=null,pollAt=0,processing=false,activeNames=[],referenceRevision=null;
 function indicator(){const el=root.document.getElementById('writing-reference-indicator');if(!el)return;const mode=root.document.getElementById('message-mode')?.value;el.textContent=mode==='original'&&activeNames.length?'Using '+activeNames.length+' writing reference'+(activeNames.length===1?'':'s')+': '+activeNames.join(', '):'Writing references apply only to AI Generated messages.';}
 function sync(){
  const bridge=root.LeadIntelServerBridge,studio=root.document.getElementById('message-studio'),next=bridge?.session?.authenticated?bridge.workspace?.id:'';
  if(!studio||!next){if(instance)instance.destroy();instance=null;host?.remove();host=null;workspace='';return;}
  if(workspace!==next||!host?.isConnected){instance?.destroy();host?.remove();host=root.document.createElement('div');host.id='writing-reference-cards';const details=studio.querySelector('details');details.append(host);workspace=next;processing=false;activeNames=[];referenceRevision=null;
   const captured=next;const api=root.LeadIntelWritingReferencesApi.createWritingReferencesApi({workspaceId:next,onResult:data=>{if(workspace!==captured||!Array.isArray(data.cards)||!Number.isInteger(data.referenceRevision))return;if(referenceRevision!==data.referenceRevision){referenceRevision=data.referenceRevision;root.dispatchEvent(new root.CustomEvent('leadintel:writing-references-changed',{detail:{workspaceId:captured,referenceRevision}}));}processing=(data.cards||[]).some(c=>['Processing','Deleting'].includes(c.status));activeNames=(data.cards||[]).filter(c=>c.active&&c.status==='Ready').map(c=>c.filename);indicator();}});
   instance=root.LeadIntelWritingReferences.mountWritingReferences({root:host,api,onChange:()=>indicator()});instance.refresh();pollAt=Date.now();
   if(!root.document.getElementById('writing-reference-indicator')){const p=root.document.createElement('p');p.id='writing-reference-indicator';p.setAttribute('role','status');studio.querySelector('#message-mode-label')?.after(p);}
  }else if(processing&&!host.contains(root.document.activeElement)&&Date.now()-pollAt>5000){pollAt=Date.now();instance.refresh();}
  indicator();
 }
 root.setInterval(sync,2500);root.addEventListener('focus',()=>{instance?.refresh();});root.document.addEventListener('change',indicator);sync();
})(window);
