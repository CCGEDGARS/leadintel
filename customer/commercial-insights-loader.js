import './research-costs.js?v=20261024-finish-core-v1';
(function(root){
 'use strict';
 let holder=null,view=null;
 const bridge=()=>root.LeadIntelServerBridge;
 function session(){return bridge()?.session||{authenticated:false};}
 function workspace(){const b=bridge();return b?.session?.authenticated&&b.workspace?{id:b.workspace.id,viewerId:b.session.user?.id||''}:null;}
 async function request(path,options={}){
  const url=new URL(path,root.location.origin),b=bridge(),selected=workspace();
  if(url.pathname!=='/api/research/costs'||(options.method||'GET')!=='GET')throw Error('Only research-cost reads are supported');
  if(!selected||url.searchParams.get('workspace_id')!==selected.id||typeof b?.getResearchCosts!=='function')throw Error('Workspace research costs are unavailable');
  const result=await b.getResearchCosts({workspaceId:selected.id,start:url.searchParams.get('start'),end:url.searchParams.get('end'),signal:options.signal});
  if(!result?.ok)throw Error(result?.error||'Research costs are unavailable');
  return result;
 }
 function dispose(){view?.destroy();view=null;}
 function ensure(){
  const slot=root.document.getElementById('crm-insights-slot');if(!slot)return;
  if(holder?.parentNode===slot)return;
  dispose();holder=root.document.createElement('details');holder.className='commercial-insights';
  const summary=root.document.createElement('summary');summary.textContent='Research costs and saved limits';
  const help=root.document.createElement('small');help.textContent='Recorded spend, provider coverage and lookup limits. Opening this view never starts paid research.';summary.append(help);
  const host=root.document.createElement('div');holder.append(summary,host);slot.append(holder);
  holder.addEventListener('toggle',()=>{if(holder.open){if(!view&&root.LeadIntelResearchCosts)view=root.LeadIntelResearchCosts.mount(host,{request,getWorkspace:workspace,getSession:session});}else dispose();});
 }
 root.addEventListener('leadintel:crm-opened',ensure);
 root.addEventListener('leadintel:workspace-changed',()=>{dispose();if(holder){holder.open=false;holder.querySelector('div')?.replaceChildren();}});
 root.LeadIntelCommercialInsights={ensure};
})(window);
