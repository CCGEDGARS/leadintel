(function(root){
 'use strict';
 const completed=new Set(),inflight=new Set();let timer=null,attempts=0,replays=0;
 const read=key=>{try{return JSON.parse(root.localStorage.getItem(key)||'{}');}catch{return {};}};
 const fulfilled=choice=>(read('leadintel_customer_v2_outreach').items||[]).some(item=>item.domain===choice.domain&&String(item.selectedPersonId)===String(choice.personId)&&item.channel===choice.channel&&item.dossier&&item.messageStudioDraft);
 function consumeFulfilled(){const b=root.LeadIntelServerBridge,meta=read('leadintel_customer_v2_discovery_meta'),choice=meta.scriptBuyer;if(!b?.ready||b.conflict||b.resolvingSync||!b.session?.authenticated||choice?.workspaceId!==b.workspace?.id||meta.pendingMessageHandoff?.version!==1||JSON.stringify(meta.pendingMessageHandoff.choice)!==JSON.stringify(choice)||!fulfilled(choice))return;delete meta.pendingMessageHandoff;root.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify(meta));}
 async function resume(){
  timer=null;const b=root.LeadIntelServerBridge;
  if(!b?.ready||!b.session?.authenticated||!b.workspace?.id||b.conflict||b.resolvingSync)return;
  const meta=read('leadintel_customer_v2_discovery_meta'),choice=meta.scriptBuyer;
  if(meta.pendingMessageHandoff?.version!==1||JSON.stringify(meta.pendingMessageHandoff.choice)!==JSON.stringify(choice)||choice?.workspaceId!==b.workspace.id||choice.channel!=='email'||!choice.personId||!choice.contactId||!choice.email||choice.recipientIdentity?.version!==1)return;
  if(fulfilled(choice)){consumeFulfilled();return;}
  const recover=root.LeadIntelDiscoveryUI?.resumeSavedMessageHandoff;
  if(typeof recover!=='function'){if(attempts++<200)timer=root.setTimeout(resume,100);return;}
  const key=JSON.stringify([b.workspace.id,b.session.user?.id,choice]);if(completed.has(key)||inflight.has(key))return;inflight.add(key);
  // The original save may have reconciled another session and reloaded before
  // Messages could create its first item. Replay only the saved intent through
  // the normal exact identity and accepted CRM recipient checks.
  try{if(await recover(choice)===true){completed.add(key);consumeFulfilled();}else if(replays++<5)timer=root.setTimeout(resume,300);}catch{if(replays++<5)timer=root.setTimeout(resume,300);}finally{inflight.delete(key);}
 }
 root.addEventListener('leadintel:server-ready',()=>{attempts=0;if(timer!==null)root.clearTimeout(timer);void resume();});
 root.addEventListener('leadintel:server-synced',consumeFulfilled);
 void resume();
})(window);
