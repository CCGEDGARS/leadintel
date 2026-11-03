(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelBuyerResearchJobs=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const ACTIVE=new Set(['queued','running']),TERMINAL=new Set(['needs_review','complete','failed','canceled']);
  const text=value=>String(value??'').trim(),fold=value=>text(value).replace(/\s+/g,' ').toLowerCase();
  const domain=value=>{try{return new URL(/^https?:\/\//i.test(text(value))?value:'https://'+text(value)).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  const personIdentity=p=>stable([text(p?.id),fold(p?.publicName||p?.name),fold(p?.title),fold(p?.organization)]);
  const roster=c=>(c.people||[]).map(personIdentity).sort().join('\n');
  const companyIdentity=c=>stable([domain(c.domain||c.website),fold(c.company||c.companyName),domain(c.website||c.domain),c.crmId||'']);
  const roles=value=>(root.LeadIntelDiscovery?.buyerSelectionRoles?.({decisionMakers:value})||['Executive leadership','Procurement Director',...(Array.isArray(value)?value:text(value).split(/[;,\n]+/))]).map(fold).filter(Boolean).filter((value,index,rows)=>rows.indexOf(value)===index).sort();
  // Only research inputs cross this boundary. Credentials, workspace snapshots,
  // enrichment approvals and delivery actions never belong to a public job.
  const PROFILE=['companyName','website','priorityOffers','idealCustomer','targetMarkets','currentMarkets','exclusions','decisionMakers','products','services','industry','description','valueProposition','buyerRoles','companyDomain'];
  const CANDIDATE=['id','crmId','company','companyName','domain','website','market','buyerRoles','buyerRolesSource','buyerRolesChanged','buyerSearchMode','buyerFit','fitDescription','qualification','qualified','needsRecheck','strategyFingerprint','evidence','matchedSignals','people','peopleStatus','buyerDiscovery','publicContacts','publicResearch','publicContactStatus','publicContactVersion'];
  const LOCAL_PERSON=['kept','keptAt','flowSelected','flowConfirmEmail','flowConfirmPhone','flowEmailCompletedFor','flowPhoneCompletedFor','linkedinConfirmedUrl','linkedinConfirmedAt','phoneEnrichment','contactData','hunterChecks','hunterFound'];
  function bounded(value,depth=0){
    if(value==null||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value==='string')return value.slice(0,12000);
    if(depth>=12)return null;
    if(Array.isArray(value))return value.slice(0,120).map(v=>bounded(v,depth+1));
    if(typeof value!=='object')return undefined;
    return Object.fromEntries(Object.entries(value).filter(([k])=>!/^(__|.*(?:token|secret|password|credential|apiKey)$)/i.test(k)&&!['__proto__','constructor','prototype'].includes(k)).slice(0,100).map(([k,v])=>[k,bounded(v,depth+1)]));
  }
  function pick(value,keys){return Object.fromEntries(keys.filter(k=>value?.[k]!==undefined).map(k=>[k,bounded(value[k])]));}
  function requestInput(owner,profile={}){
    const candidate=pick(owner,CANDIDATE);candidate.domain=domain(owner.domain||owner.website);candidate.people=(candidate.people||[]).slice(0,10);
    for(const person of candidate.people)for(const key of ['flowConfirmEmail','flowConfirmPhone','autoConfirm','autoConfirmEmail','autoConfirmPhone','paidOnly','phoneLookup','dataLookup','contactResearch','emailResearch','publicEmailEvidence','publicPhoneEvidence','publicEmailSourceCheck','publicPhoneSourceCheck','patternFindings','gmailMatches','contactVerification'])delete person[key];
    delete candidate.publicResearch;delete candidate.publicContacts;
    if(candidate.buyerDiscovery)candidate.buyerDiscovery=pick(candidate.buyerDiscovery,['opportunityRoles','pool','companyContacts','resultDiagnostics']);
    const result={candidate,profile:pick(profile,PROFILE)};
    if(new TextEncoder().encode(stable(result)).byteLength>240000)throw Error('Buyer research snapshot is too large. Save and review the company research first.');
    return result;
  }
  function inputKey(owner,profile){return stable([companyIdentity(owner),roles(owner.buyerRoles||profile.decisionMakers),pick(profile,PROFILE)]);}
  const abortError=()=>Object.assign(Error('Buyer research observation stopped; saved research can be reopened.'),{name:'AbortError',code:'BUYER_OBSERVATION_STOPPED'});
  function createClient({fetchImpl=(...args)=>root.fetch(...args),getBridge=()=>root.LeadIntelServerBridge,apiBase='https://leadintel-api.edgars-7e7.workers.dev',pollMs=2500,requestTimeoutMs=15000,observationTimeoutMs=1800000}={}){
    const active=new Map(),references=new WeakMap();
    function capture(owner,options){
      const bridge=getBridge(),workspaceId=bridge?.workspace?.id,userId=bridge?.session?.user?.id;
      if(!workspaceId||!bridge?.session?.authenticated)throw Error('Sign in to read buyer research.');
      const profile=options.profile||{},key=inputKey(owner,profile),company=companyIdentity(owner),protectedPeople=new Map();let expectedRoster=roster(owner),expectedPeople=new Map((owner.people||[]).map(p=>[String(p.id),bounded(p)]));
      return {owner,bridge,workspaceId,userId,key,profile,personIds:options.personIds?.map(String).slice(0,10),localEdits:person=>{const id=String(person.id),prior=expectedPeople.get(id)||{},local=protectedPeople.get(id)||{};for(const key of new Set([...Object.keys(prior),...Object.keys(person)]))if(stable(person[key])!==stable(prior[key]))local[key]=bounded(person[key]);protectedPeople.set(id,local);return local;},current:()=>!options.signal?.aborted&&getBridge()===bridge&&bridge.session?.authenticated&&bridge.workspace?.id===workspaceId&&bridge.session?.user?.id===userId&&companyIdentity(owner)===company&&inputKey(owner,profile)===key&&roster(owner)===expectedRoster&&(!options.isCurrent||options.isCurrent()===true),acceptRoster:()=>{expectedRoster=roster(owner);expectedPeople=new Map((owner.people||[]).map(p=>[String(p.id),bounded(p)]));}};
    }
    async function request(scope,method,body,jobId,controller){
      if(!scope.current())throw abortError();
      const transport=new AbortController();let stop,timer;
      let contextTimer;
      const canceled=new Promise((_,reject)=>{stop=()=>{transport.abort();reject(abortError());};contextTimer=setInterval(()=>{if(!scope.current())stop();},100);controller.signal.addEventListener('abort',stop,{once:true});timer=setTimeout(()=>{transport.abort();reject(Object.assign(Error('Buyer research status request timed out. Reopen the company to read saved progress.'),{code:'BUYER_JOB_REQUEST_TIMEOUT'}));},requestTimeoutMs);});
      const query=new URLSearchParams({workspace_id:scope.workspaceId,...(jobId?{job_id:jobId}:{domain:domain(scope.owner.domain||scope.owner.website)})});
      try{
        const operation=(async()=>{const response=await fetchImpl(`${apiBase}/api/buyers/research?${query}`,{method,credentials:'include',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:transport.signal});const payload=await response.json();if(!response.ok)throw Object.assign(Error(typeof payload.error==='string'?payload.error:payload.error?.message||'Buyer research request failed.'),{status:response.status,code:payload.error?.code});return payload.job||null;})();
        const job=await Promise.race([operation,canceled]);if(!scope.current()||controller.signal.aborted)throw abortError();return job;
      }finally{clearTimeout(timer);clearInterval(contextTimer);controller.signal.removeEventListener('abort',stop);transport.abort();}
    }
    function matching(scope,job){
      if(!job||domain(job.domain||job.candidate?.domain)!==domain(scope.owner.domain)||!job.id||!ACTIVE.has(job.status)&&!TERMINAL.has(job.status))return false;
      const c=job.candidate;if(c&&fold(c.company||c.companyName)!==fold(scope.owner.company||scope.owner.companyName))return false;
      if(c?.buyerRoles&&stable(roles(c.buyerRoles))!==stable(roles(scope.owner.buyerRoles||scope.profile.decisionMakers)))return false;
      const ref=references.get(scope.owner);
      if(ref?.id===job.id&&ref.contextKey&&job.contextKey!==ref.contextKey)return false;
      const input=job.input||job.request;
      if(input?.profile){const fit=root.LeadIntelDiscovery?.buyerFitContext||((p={})=>stable({offers:text(p.priorityOffers),buyers:text(p.idealCustomer),markets:text(p.targetMarkets),exclusions:text(p.exclusions),website:domain(p.website)}));if(fit(input.profile)!==fit(scope.profile))return false;}
      if(input?.roles&&stable(roles(input.roles))!==stable(roles(scope.owner.buyerRoles||scope.profile.decisionMakers)))return false;
      return true;
    }
    function apply(scope,job,options){
      if(!scope.current()||!matching(scope,job))return false;
      const previous=references.get(scope.owner);if(previous?.id===job.id&&Number(job.revision)<Number(previous.revision))return false;
      const unchanged=previous?.id===job.id&&Number(job.revision)===Number(previous.revision)&&previous.status===job.status;
      const source=job.candidate||{},owner=scope.owner,jobIds=job.input?.personIds||job.progress?.personIds,selectedIds=scope.personIds?.length?scope.personIds:Array.isArray(jobIds)&&jobIds.length?jobIds:null,selected=selectedIds&&new Set(selectedIds.map(String)),byId=new Map((owner.people||[]).map(p=>[String(p.id),p]));
      for(const person of (unchanged?[]:source.people||[]).slice(0,10)){
        const existing=byId.get(String(person.id));if(selected&&!selected.has(String(person.id)))continue;
        if(existing){
          if(personIdentity(existing)!==personIdentity(person))continue;
          const local={...pick(existing,LOCAL_PERSON),...scope.localEdits(existing)},next=bounded(person);
          // Sparse checkpoints must not discard accepted, sourced channels.
          for(const field of ['publicEmail','publicEmailUrl','publicEmailSourceCheck','publicPhone','publicPhoneUrl','publicLinkedinUrl','publicNameUrl'])if(!next[field]&&existing[field])next[field]=existing[field];
          Object.assign(existing,next,local);
        }else if(!selected&&(owner.people||[]).length<10&&text(person.id)&&!byId.has(String(person.id))){
          const next=bounded(person);for(const field of LOCAL_PERSON)delete next[field];owner.people=owner.people||[];owner.people.push(next);byId.set(String(next.id),next);
        }
      }
      for(const field of ['publicContacts','publicContactVersion','publicResearch','buyerDiscovery']){
        if(unchanged||source[field]===undefined)continue;
        if(Array.isArray(source[field])){if(source[field].length)owner[field]=bounded(source[field]);}
        else{
          const next=bounded(source[field]);
          if(field==='buyerDiscovery'&&owner[field]?.companyDossier?.status==='complete'&&next.companyDossier?.status!=='complete')next.companyDossier={...owner[field].companyDossier,lastAttempt:next.companyDossier?.lastAttempt||{status:'failed',reason:'Latest research remains incomplete',research:next.companyDossier}};
          owner[field]={...(owner[field]||{}),...next};
        }
      }
      // Old job snapshots can retain a role hold after reading the named official
      // contact. Reassess the merged current evidence, never the terminal label.
      if(owner.buyerRolesChanged&&root.LeadIntelDiscovery?.canReassessSavedBuyerRoles?.(owner,owner.people||[],scope.profile))owner.buyerRolesChanged=false;
      const running=ACTIVE.has(job.status);owner.peopleStatus=running?'loading':owner.people?.length?'complete':job.status==='complete'?'empty':'error';
      owner.publicContactStatus=running?'loading':job.status==='complete'?'complete':'error';
      owner.buyerDiscovery={...(owner.buyerDiscovery||{}),researchIncomplete:job.status!=='complete'};
      const ref={id:job.id,contextKey:job.contextKey||'',revision:Number(job.revision)||0,status:job.status,updatedAt:job.updatedAt||''};references.set(owner,ref);owner.buyerResearchJob=ref;
      owner.buyerResearchProgress={phase:running?job.phase||'company':job.status==='complete'?'complete':'error',label:job.progress?.label||'Buyer research needs review',step:({dossier:1,company:1,roles:2,people:3,identity:4,contacts:5,review:5})[job.phase]||1,total:5,checkpointAt:job.updatedAt,jobId:job.id,diagnostics:(job.diagnostics||[]).slice(-10),...options.progressFields};
      scope.acceptRoster();options.onProgress?.({...job.progress,phase:job.phase,job,status:job.status});options.persist?.(owner,job);return true;
    }
    async function observe(scope,job,options,controller){
      const started=Date.now();
      while(job){
        if(!scope.current()||controller.signal.aborted)throw abortError();
        if(!apply(scope,job,options))return null;
        if(!ACTIVE.has(job.status))return job;
        if(Date.now()-started>=observationTimeoutMs)throw Error('Buyer research continues on the server. Reopen this company to read its progress.');
        await new Promise((resolve,reject)=>{let timer;const stop=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);reject(abortError());};timer=setTimeout(()=>{controller.signal.removeEventListener('abort',stop);resolve();},pollMs);controller.signal.addEventListener('abort',stop,{once:true});});
        job=await request(scope,'GET',null,job.id,controller);
      }
      return null;
    }
    async function execute(owner,options,readOnly){
      const scope=capture(owner,options),key=`${scope.workspaceId}|${domain(owner.domain)}`,old=active.get(key);
      if(old&&old.scope.owner===owner&&old.scope.current()&&(readOnly||!old.readOnly))return old.promise;
      old?.controller.abort();const controller=new AbortController();let stop;
      stop=()=>controller.abort();options.signal?.addEventListener('abort',stop,{once:true});
      const entry={scope,controller,promise:null,readOnly};
      entry.promise=(async()=>{
        const observedJob=await request(scope,'GET',null,null,controller);
        let job=observedJob;
        if(job&&!matching(scope,job))job=null;
        if(!readOnly){
          if(scope.bridge.conflict)throw Error('Resolve the workspace synchronization conflict before starting or resuming buyer research.');
          const jobIds=job?.input?.personIds||job?.progress?.personIds,selected=scope.personIds?.length?new Set(scope.personIds):null;
          const jobSelected=job?.input?.scope==='selected_buyers'||Boolean(jobIds?.length),scopeCovered=selected?jobSelected&&scope.personIds.every(id=>jobIds?.map(String).includes(id)):!jobSelected;
          const selectedRoster=value=>roster({people:(value?.people||[]).filter(person=>!selected||selected.has(String(person.id)))});
          const covered=scopeCovered&&selectedRoster(owner)===selectedRoster(job?.candidate);
          if(job&&!covered)job=null;
          if(!job||!ACTIVE.has(job.status)&&(options.force||job.status!=='complete'||!covered)){
            const resume=job&&covered&&(!options.force||options.resumeIncomplete===true&&job.resumePhase&&job.resumePhase!=='done')&&TERMINAL.has(job.status)&&job.status!=='complete';
            const observed=observedJob?.id&&domain(observedJob.domain||observedJob.candidate?.domain)===domain(owner.domain)?observedJob:null;
            job=await request(scope,'POST',{action:resume?'resume':'start',...requestInput(owner,scope.profile),...(scope.personIds?{personIds:scope.personIds}:{}),force:options.force===true,...(observed?{jobId:observed.id,expectedRevision:observed.revision}:{})},null,controller);
          }
        }
        return observe(scope,job,options,controller);
      })();active.set(key,entry);
      try{return await entry.promise;}finally{options.signal?.removeEventListener('abort',stop);if(active.get(key)===entry)active.delete(key);controller.abort();}
    }
    async function cancel(owner,options={}){
      const scope=capture(owner,options),key=`${scope.workspaceId}|${domain(owner.domain)}`,entry=active.get(key),controller=new AbortController();
      if(scope.bridge.conflict)throw Error('Resolve the workspace synchronization conflict before canceling buyer research.');
      const ref=references.get(owner)||owner.buyerResearchJob;
      const job=ref?.id?await request(scope,'GET',null,ref.id,controller):await request(scope,'GET',null,null,controller);
      if(!job||!matching(scope,job))return null;
      const result=await request(scope,'POST',{action:'cancel',jobId:job.id,expectedRevision:job.revision},null,controller);
      entry?.controller.abort();apply(scope,result,options);return result;
    }
    return {research:(owner,options={})=>execute(owner,options,false),restore:(owner,options={})=>execute(owner,options,true),cancel};
  }
  return {...createClient(),createClient,requestInput};
});
