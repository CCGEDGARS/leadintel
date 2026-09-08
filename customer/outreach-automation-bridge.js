(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelOutreachAutomationBridge=api;api.attach(root);if(typeof root.addEventListener==='function')root.addEventListener('leadintel:server-ready',()=>api.attach(root));}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  'use strict';
  const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
  function workspaceId(bridge){return String(bridge?.workspace?.id||'').trim();}
  function ready(bridge){return Boolean(bridge?.session?.authenticated&&workspaceId(bridge));}
  async function call(root,bridge,path,options={}){
    if(!ready(bridge))return {ok:false,status:401,error:'Sign in and select a workspace to use outreach automation'};
    const join=path.includes('?')?'&':'?';const url=`${API_BASE}${path}${join}workspace_id=${encodeURIComponent(workspaceId(bridge))}`;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await root.fetch(url,{credentials:'include',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},...options,signal:controller.signal});
      const payload=await response.json().catch(()=>({}));return response.ok?{ok:true,status:response.status,...payload}:{ok:false,status:response.status,...payload};
    }catch(error){return {ok:false,status:0,error:error?.name==='AbortError'?'Outreach automation request timed out':String(error?.message||'Outreach automation request failed')};}
    finally{clearTimeout(timer);}
  }
  function attach(root){
    const bridge=root?.LeadIntelServerBridge;if(!bridge)return false;
    bridge.getOutreachAutomationPolicy=()=>call(root,bridge,'/api/outreach-automation/policy');
    bridge.saveOutreachAutomationPolicy=policy=>call(root,bridge,'/api/outreach-automation/policy',{method:'PUT',body:JSON.stringify(policy||{})});
    bridge.getOutreachAutomationStatus=()=>call(root,bridge,'/api/outreach-automation/status');
    bridge.enqueueOutreachAutomation=payload=>call(root,bridge,'/api/outreach-automation/sequences',{method:'POST',body:JSON.stringify(payload||{})});
    return true;
  }
  return {attach};
});
