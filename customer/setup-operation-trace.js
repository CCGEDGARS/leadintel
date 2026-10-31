(function(root){
 'use strict';
 // Extends prior stages; records remain bounded, copied and free of customer content.
 if(root.LeadIntelSetupTrace?.version==='20261031-delivery-v1')return;
 const actions=new Set(['website_activation','material_upload','material_change','service_settings','ai_settings','paid_preferences','profile_research','profile_synthesis','profile_approval','profile_edit','strategy_activation','strategy_research','strategy_edit','strategy_monitoring','company_selection','company_save','company_discovery','buyer_selection','buyer_contact','buyer_research','buyer_review','buyer_save','message_save','message_delivery','message_generation','message_translation','message_reopen','message_approval','delivery_send','delivery_manual','delivery_queue','delivery_recovery','delivery_pause']);
 const phases=new Set(['start','request','response','provider','persistence','complete','context']);
 const outcomes=new Set(['started','pending','pass','fail','blocked','canceled','stale','partial','uncertain','timeout','retry','resumed','duplicate_hold']);
 const records=[];let sequence=0;
 const accountTicket=()=>{try{return root.localStorage?.getItem('leadintel_account_context_v1')||'';}catch{return 'unavailable';}};
 const context=()=>JSON.stringify([root.LeadIntelServerBridge?.workspace?.id||'',root.LeadIntelServerBridge?.session?.user?.id||'',root.LeadIntelServerBridge?.session?.authenticated,accountTicket(),!root.LeadIntelAccountCache||root.LeadIntelAccountCache.current()]);
 let owner=context();
 const reset=()=>{const next=context();if(next!==owner){records.length=0;owner=next;}};
 const randomId=()=>{let value;try{value=root.crypto?.randomUUID?.();}catch{}return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():Date.now().toString(36)+'-'+(++sequence);};
 function begin(action){
  if(!actions.has(action))throw Error('Unsupported Setup trace action');
  reset();const captured=owner,workspaceId=root.LeadIntelServerBridge?.workspace?.id||'',stage=action.startsWith('delivery_')?7:action.startsWith('message_')?6:action.startsWith('buyer_')?5:action.startsWith('company_')?4:action.startsWith('strategy_')?3:action.startsWith('profile_')?2:1;
  const id=(stage===7?'delivery-':stage===6?'messages-':stage===5?'buyers-':stage===4?'companies-':stage===3?'strategy-':stage===2?'profile-':'setup-')+randomId();
  const started=Date.now();
  let finished=false;
  function checkpoint(phase,outcome){
   if(!phases.has(phase))throw Error('Unsupported Setup trace phase');
   if(!outcomes.has(outcome))throw Error('Unsupported Setup trace outcome');
   reset();if(captured!==owner||finished)return;
   const record={operationId:id,stage,action,phase,outcome,workspaceId,at:new Date().toISOString(),version:'20261031-delivery-v1',elapsedMs:Date.now()-started>86400000?null:Math.max(0,Date.now()-started)};
   records.push(record);if(records.length>100)records.shift();
   try{root.dispatchEvent?.(new root.CustomEvent(stage===1?'leadintel:setup-operation':stage===2?'leadintel:profile-operation':stage===3?'leadintel:strategy-operation':stage===4?'leadintel:companies-operation':stage===5?'leadintel:buyers-operation':stage===6?'leadintel:messages-operation':'leadintel:delivery-operation',{detail:{...record}}));}catch{}
  }
  checkpoint('start','started');
  return {id,checkpoint,finish(outcome){checkpoint('complete',outcome);finished=true;}};
 }
 root.LeadIntelReliabilityTrace=root.LeadIntelSetupTrace={version:'20261031-delivery-v1',begin,snapshot(){reset();return records.map(record=>({...record}));}};
 for(const name of ['leadintel:server-ready','leadintel:workspace-reset','leadintel:workspace-changed'])root.addEventListener?.(name,reset);
})(typeof window==='object'?window:globalThis);
