(function(root){
 'use strict';
 if(root.LeadIntelSetupTrace)return;
 const actions=new Set(['website_activation','material_upload','material_change','service_settings','ai_settings','paid_preferences']);
 const phases=new Set(['start','request','response','provider','persistence','complete','context']);
 const outcomes=new Set(['started','pending','pass','fail','blocked','canceled','stale','partial']);
 const records=[];let sequence=0;
 const accountTicket=()=>{try{return root.localStorage?.getItem('leadintel_account_context_v1')||'';}catch{return 'unavailable';}};
 const context=()=>JSON.stringify([root.LeadIntelServerBridge?.workspace?.id||'',root.LeadIntelServerBridge?.session?.user?.id||'',root.LeadIntelServerBridge?.session?.authenticated,accountTicket(),!root.LeadIntelAccountCache||root.LeadIntelAccountCache.current()]);
 let owner=context();
 const reset=()=>{const next=context();if(next!==owner){records.length=0;owner=next;}};
 function begin(action){
  if(!actions.has(action))throw Error('Unsupported Setup trace action');
  reset();const captured=owner,workspaceId=root.LeadIntelServerBridge?.workspace?.id||'';
  const id='setup-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++sequence));
  let finished=false;
  function checkpoint(phase,outcome){
   if(!phases.has(phase))throw Error('Unsupported Setup trace phase');
   if(!outcomes.has(outcome))throw Error('Unsupported Setup trace outcome');
   reset();if(captured!==owner||finished)return;
   const record={operationId:id,stage:1,action,phase,outcome,workspaceId,at:new Date().toISOString(),version:'20261030-v1'};
   records.push(record);if(records.length>100)records.shift();
   try{root.dispatchEvent?.(new root.CustomEvent('leadintel:setup-operation',{detail:{...record}}));}catch{}
  }
  checkpoint('start','started');
  return {id,checkpoint,finish(outcome){checkpoint('complete',outcome);finished=true;}};
 }
 root.LeadIntelSetupTrace={begin,snapshot(){reset();return records.map(record=>({...record}));}};
 for(const name of ['leadintel:server-ready','leadintel:workspace-reset','leadintel:workspace-changed'])root.addEventListener?.(name,reset);
})(typeof window==='object'?window:globalThis);
