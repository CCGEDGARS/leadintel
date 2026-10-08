(function(root){
 'use strict';if(!root.document)return;
 let instance=null,workspace='',host=null,pollAt=0,processing=false,activeNames=[],referenceRevision=null,bookCards=[],bookApi=null,bookBusy=false;
 function renderBookSwitches(){
  const host=root.document.getElementById('mw-book-toggles'),status=root.document.getElementById('mw-book-status');if(!host)return;
  host.replaceChildren();
  for(let slot=1;slot<=3;slot++){
   const card=bookCards.find(c=>c.slot===slot),ready=card?.status==='Ready';
   const label=root.document.createElement('label');label.className='mw-book-toggle';
   const check=root.document.createElement('input');check.type='checkbox';check.dataset.bookSlot=String(slot);check.checked=ready&&Boolean(card.active);check.disabled=!ready||bookBusy;
   const txt=root.document.createElement('span');txt.textContent=card?.filename||'Book '+slot+' · Not uploaded';label.append(check,txt);host.append(label);
  }
  if(status)status.textContent=bookCards.filter(c=>c.active&&c.status==='Ready').length+' active writing reference(s). Only active books influence AI Generated.';
 }
 async function changeBook(event){
  const slot=Number(event.target.dataset.bookSlot);if(!slot||bookBusy||!bookApi)return;
  const card=bookCards.find(c=>c.slot===slot);if(!card||card.status!=='Ready')return;
  bookBusy=true;renderBookSwitches();try{
   const data=await bookApi.patch(card.id,{expectedRevision:card.revision,active:event.target.checked});
   if(Array.isArray(data.cards)){bookCards=data.cards;referenceRevision=data.referenceRevision;}
  }catch(error){const status=root.document.getElementById('mw-book-status');if(status)status.textContent='Activation failed: '+error.message;}finally{bookBusy=false;renderBookSwitches();}
 }
 root.document.addEventListener('change',e=>{if(e.target.matches('[data-book-slot]'))void changeBook(e);});
 function indicator(){const el=root.document.getElementById('writing-reference-indicator');if(!el)return;const mode=root.document.getElementById('message-mode')?.value;el.textContent=mode==='original'&&activeNames.length?'Using '+activeNames.length+' writing reference'+(activeNames.length===1?'':'s')+': '+activeNames.join(', '):'Writing references apply only to AI Generated messages.';}
 function sync(){
  const bridge=root.LeadIntelServerBridge,studio=root.document.getElementById('message-studio'),next=bridge?.session?.authenticated?bridge.workspace?.id:'';
  if(!studio||!next){if(instance)instance.destroy();instance=null;host?.remove();host=null;workspace='';bookCards=[];bookApi=null;renderBookSwitches();return;}
  if(workspace!==next||!host?.isConnected){instance?.destroy();host?.remove();host=root.document.createElement('div');host.id='writing-reference-cards';const details=root.document.getElementById('mw-writing-reference-host')||studio.querySelector('details');details.append(host);workspace=next;processing=false;activeNames=[];referenceRevision=null;
   const captured=next;const api=root.LeadIntelWritingReferencesApi.createWritingReferencesApi({workspaceId:next,onResult:data=>{if(workspace!==captured||!Array.isArray(data.cards)||!Number.isInteger(data.referenceRevision))return;if(referenceRevision!==data.referenceRevision){referenceRevision=data.referenceRevision;root.dispatchEvent(new root.CustomEvent('leadintel:writing-references-changed',{detail:{workspaceId:captured,referenceRevision}}));}bookCards=data.cards||[];renderBookSwitches();processing=(data.cards||[]).some(c=>['Processing','Deleting'].includes(c.status));activeNames=(data.cards||[]).filter(c=>c.active&&c.status==='Ready').map(c=>c.filename);indicator();}});
   bookApi=api;renderBookSwitches();instance=root.LeadIntelWritingReferences.mountWritingReferences({root:host,api,onChange:()=>indicator()});instance.refresh();pollAt=Date.now();
   if(!root.document.getElementById('writing-reference-indicator')){const p=root.document.createElement('p');p.id='writing-reference-indicator';p.setAttribute('role','status');studio.querySelector('#message-mode-label')?.after(p);}
  }else if(processing&&!host.contains(root.document.activeElement)&&Date.now()-pollAt>5000){pollAt=Date.now();instance.refresh();}
  const summary=root.document.getElementById('mw-reference-count');if(summary)summary.textContent=activeNames.length?activeNames.length+' active':'Optional · 3 slots';indicator();
 }
 root.setInterval(sync,2500);root.addEventListener('focus',()=>{instance?.refresh();});root.document.addEventListener('change',indicator);sync();
})(window);
