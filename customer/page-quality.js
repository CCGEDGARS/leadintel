(function(root,factory){
  'use strict';
  const api=root?.LeadIntelPageQuality||factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.LeadIntelPageQuality=api;if(root.document)api.install(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const VERSION='page-procedures-20261010-v1';
  const PAGES=['setup','profile','strategy','companies','buyers','messages','delivery','crm'];
  const LABELS={ready:'Ready',preparing:'Preparing',review:'Needs review',blocked:'Blocked'};
  const reportKeys=new WeakMap();
  const ACTIONS={setup:['prepare','advance'],profile:['prepare','research','approve','advance'],strategy:['prepare','research','approve','advance'],companies:['prepare','research','target-research','advance'],buyers:['prepare','research','advance'],messages:['prepare','generate','save','library','approve','flow','send'],delivery:['prepare','send','advance'],crm:['prepare','read','write']};
  function check(id,label,passed,message,{actions=['*'],state='review',target=null}={}){
    return {id,label,status:passed===true?'pass':passed===null?'pending':'fail',message,actions,state,target};
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value??null;
  }
  // A change detector, not a security token or proof of external factual truth.
  function fingerprint(value){let hash=2166136261;for(const char of JSON.stringify(stable(value))){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
  function inspect(page,context={}){
    const checks=[];
    const session=context.session||{};
    checks.push(check('workspace-loaded','Workspace loaded',context.storageValid!==false&&session.ready===true,context.storageValid===false?'Workspace data could not be read. Reopen the page; your saved work is preserved.':'Wait for the workspace to load.',{state:context.storageValid===false?'blocked':session.ready?'blocked':'preparing'}));
    checks.push(check('workspace-sync','Workspace synchronized',!session.conflict&&!session.resolvingSync,'Resolve workspace synchronization. Your local work is preserved.',{state:session.resolvingSync?'preparing':'blocked',target:{id:'server-conflict-actions'}}));
    if(['messages','delivery','crm'].includes(page))checks.push(check('workspace-auth','Workspace signed in',session.authenticated===true&&Boolean(session.workspaceId),'Sign in to use your saved workspace.',{state:'blocked',target:{id:'server-sign-in'}}));
    checks.push(check('page-loaded','Page controls loaded',context.loaded===true,'This page could not finish loading. Reopen it to retry.',{state:'blocked'}));
    if(context.busy)checks.push(check('procedure-running','Current procedure finished',null,context.busyMessage||'Wait for the current procedure to finish.',{state:'preparing'}));
    for(const row of context.checks||[])checks.push(row);
    const failed=checks.filter(row=>row.status!=='pass');
    const primary=failed.find(row=>row.state==='blocked')||failed.find(row=>row.state==='preparing')||failed[0];
    const state=primary?.state||'ready';
    const receipt={version:VERSION,page,workspaceId:session.workspaceId||'',fingerprint:fingerprint([VERSION,page,session.workspaceId,context.inputs||{},checks.map(row=>[row.id,row.status])]),state,label:LABELS[state],message:primary?.message||'Current inputs checked. Existing approvals and send controls still apply.',target:primary?.target||null,checks,checkedAt:new Date().toISOString()};
    reportKeys.set(receipt,JSON.stringify(stable([VERSION,page,session,context.inputs||{},checks])));
    return receipt;
  }
  function allowed(report,action){return Boolean(report)&&Boolean(ACTIONS[report.page]?.includes(action))&&!report.checks.some(row=>row.status!=='pass'&&(row.actions?.includes('*')||row.actions?.includes(action)));}
  function createCoordinator({session,notify=()=>{}}){
    const adapters=new Map(),receipts=new Map(),openingFailures=new Map(),tickets=new WeakMap(),trail=[];let generation=0,active='setup',workspace='';
    function resetIfChanged(){const current=session()?.workspaceId||'';if(current!==workspace){workspace=current;generation++;receipts.clear();openingFailures.clear();trail.length=0;}}
    function refresh(page=active){
      resetIfChanged();let context;try{context=adapters.get(page)?.read()||{};}catch{context={loaded:false,storageValid:false};}
      if(openingFailures.has(page))context={...context,checks:[openingFailures.get(page),...(context.checks||[])]};
      const report=inspect(page,{...context,session:session()});
      const previous=receipts.get(page);receipts.set(page,report);
      if(!previous||previous.fingerprint!==report.fingerprint){trail.push({page,workspaceId:workspace,version:VERSION,fingerprint:report.fingerprint,state:report.state,checks:report.checks.map(row=>({id:row.id,status:row.status})),checkedAt:report.checkedAt});if(trail.length>30)trail.shift();}
      if(page===active)notify(report);return report;
    }
    async function open(page){
      if(!PAGES.includes(page))return null;resetIfChanged();active=page;openingFailures.delete(page);const token=++generation,owner=workspace;
      const before=refresh(page),adapter=adapters.get(page);
      // Preparation is an existing page operation; it never runs under an unsafe workspace.
      if(adapter?.prepare&&allowed(before,'prepare')){
        let timer;
        try{await Promise.race([Promise.resolve(adapter.prepare()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000);})]);}
        catch{if(token===generation&&owner===(session()?.workspaceId||'')){openingFailures.set(page,check('opening-failed','Opening procedure completed',false,'The page check could not finish. Reopen this page to retry.',{state:'blocked'}));return refresh(page);}}
        finally{clearTimeout(timer);}
      }
      if(token!==generation||owner!==(session()?.workspaceId||''))return null;
      return refresh(page);
    }
    return {register(page,adapter){if(!PAGES.includes(page)||typeof adapter?.read!=='function')throw Error('Invalid page procedure');adapters.set(page,adapter);return refresh(page);},refresh,open,require(page,action){return allowed(refresh(page),action);},capture(page,action){const report=refresh(page);if(!allowed(report,action))return null;const ticket=Object.freeze({page,action,workspaceId:report.workspaceId,fingerprint:report.fingerprint});tickets.set(ticket,reportKeys.get(report));return ticket;},current(ticket){if(!ticket||!tickets.has(ticket))return false;const report=refresh(ticket.page);return allowed(report,ticket.action)&&report.workspaceId===ticket.workspaceId&&reportKeys.get(report)===tickets.get(ticket);},getReport:page=>refresh(page),getAuditTrail:()=>trail.map(row=>({...row,checks:row.checks.map(check=>({...check}))})),clear(){generation++;receipts.clear();openingFailures.clear();trail.length=0;},get active(){return active;}};
  }
  let runtime=null,installed=false;
  function install(root){
    if(installed)return;installed=true;
    const session=()=>{const b=root.LeadIntelServerBridge;return {ready:b?.ready===true,authenticated:b?.session?.authenticated===true,workspaceId:b?.workspace?.id||'',conflict:Boolean(b?.conflict),resolvingSync:Boolean(b?.resolvingSync)};};
    runtime=createCoordinator({session,notify:report=>root.dispatchEvent(new root.CustomEvent('leadintel:page-quality',{detail:report}))});
    const current=()=>{if(root.document.getElementById('crm-workspace')?.hidden===false)return 'crm';const step=Number(root.document.querySelector('.step-view.active')?.dataset.step)||1;if(step===5){try{return JSON.parse(root.localStorage.getItem('leadintel_customer_v2_discovery_meta')||'{}').activeJourneyStage===5?'buyers':'companies';}catch{return 'companies';}}return ({1:'setup',2:'profile',3:'profile',4:'strategy',6:'messages',7:'delivery'})[step]||'setup';};
    let scheduled=false;
    const schedule=()=>{if(scheduled)return;scheduled=true;root.queueMicrotask(()=>{scheduled=false;runtime.refresh(runtime.active==='crm'&&root.document.getElementById('crm-workspace')?.hidden===false?'crm':current());});};
    for(const event of ['leadintel:server-ready','leadintel:server-synced','leadintel:workspace-changed','leadintel:workspace-dirty','leadintel:commercial-context-changed','leadintel:sender-identity-changed','leadintel:sync-resolving','leadintel:sync-settled','leadintel:crm-changed','leadintel:support-modules-ready','leadintel:outreach-approved','leadintel:outreach-sent','storage'])root.addEventListener(event,schedule);
    root.addEventListener('leadintel:server-ready',()=>{void runtime.open(current());});
    root.addEventListener('leadintel:sync-settled',()=>{void runtime.open(current());});
    root.addEventListener('leadintel:module-opened',()=>{void runtime.open(current());});
    root.addEventListener('leadintel:crm-closed',()=>{void runtime.open(current());});
    root.addEventListener('leadintel:journey-focus-changed',()=>{void runtime.open(current());});
    root.addEventListener('leadintel:workspace-reset',()=>{runtime.clear();schedule();});
    root.document.addEventListener('change',schedule);
    root.document.addEventListener('input',schedule);
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>void runtime.open(current()),{once:true});else void runtime.open(current());
  }
  return {VERSION,PAGES,LABELS,check,fingerprint,inspect,allowed,createCoordinator,install,register:(page,adapter)=>runtime?.register(page,adapter),refresh:page=>runtime?.refresh(page),open:page=>runtime?.open(page),require:(page,action)=>runtime?runtime.require(page,action):false,capture:(page,action)=>runtime?.capture(page,action),current:ticket=>runtime?runtime.current(ticket):false,getReport:page=>runtime?.getReport(page),getAuditTrail:()=>runtime?.getAuditTrail()||[]};
});
