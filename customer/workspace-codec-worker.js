'use strict';
// The worker receives only the value to encode. It has no workspace storage,
// authentication, or network operations beyond loading the shared codec.
importScripts('./state-budget.js?v=20261020-workspace-worker-v1&research-storage=20261101-v1');
self.onmessage=function(event){
  const {id,operation,value,options}=event.data||{};
  try{
    if(!['prepareForSync','packWorkspaceSnapshot','packRecoveryRecord'].includes(operation))throw new Error('Unsupported workspace encoding operation');
    const result=self.LeadIntelStateBudget[operation](value,options);
    self.postMessage({id,result});
  }catch(cause){self.postMessage({id,error:String(cause?.message||'Workspace encoding failed')});}
};
