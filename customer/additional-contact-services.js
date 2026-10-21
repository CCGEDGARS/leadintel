(function(root){
  'use strict';
  const API='https://leadintel-api.edgars-7e7.workers.dev',P=root.LeadIntelAdditionalContactPolicy;
  let adapter=null,loadedWorkspace='',policy=null,provider=null,hunter=null,busyPolicy=false;
  const publicChecking=new Map(),running=new Map(),automaticAttempts=new Set(),outcomes=new Map();
  const bridge=()=>root.LeadIntelServerBridge,workspace=()=>bridge()?.workspace?.id||'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=(candidate,person)=>[workspace(),candidate.domain,person.id].join('|');
  async function api(path,options={}){
    const id=workspace();if(!id||!bridge()?.session?.authenticated)throw Error('Sign in to configure additional services.');
    const response=await fetch(`${API}${path}${path.includes('?')?'&':'?'}workspace_id=${encodeURIComponent(id)}`,{credentials:'include',...options,headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(60000)});
    const result=await response.json();if(workspace()!==id)throw Error('Workspace changed; retry in the current workspace.');
    if(!response.ok)throw Error(result.error||'Additional services are unavailable.');return result;
  }
  function status(message){const node=document.getElementById('additional-contact-status');if(node)node.textContent=message;}
  function renderPolicy(){
    const form=document.getElementById('additional-contact-preferences');if(!form)return;
    const valid=loadedWorkspace===workspace()&&policy,owner=bridge()?.workspace?.role==='owner';
    for(const field of form.elements)field.disabled=!valid||!owner||busyPolicy;
    if(!valid){form.reset();status('Sign in to save optional research preferences.');return;}
    form.elements.enabled.checked=policy.enabled;
    for(const name of ['dailyLimit','monthlyLimit','maxPerCompany'])form.elements[name].value=String(policy[name]);
    status(policy.enabled?`Approved · up to ${policy.maxPerCompany} buyers per company, ${policy.dailyLimit} lookups per day and ${policy.monthlyLimit} per month.${provider?.configured?'':' Connect Apollo in Settings before use.'}`:'Public research first. Additional services require your approval when needed.');
  }
  async function load(){
    const id=workspace();if(!id||!bridge()?.session?.authenticated){loadedWorkspace='';policy=null;provider=null;renderPolicy();return;}
    if(loadedWorkspace!==id){loadedWorkspace='';policy=null;provider=null;renderPolicy();}
    try{
      const [value,services]=await Promise.all([api('/api/additional-contact-services/policy'),api('/api/integrations/services/status')]);
      if(workspace()!==id)return;
      policy=value.policy;loadedWorkspace=id;provider=services.providers?.find(p=>p.provider==='apollo');hunter=services.providers?.find(p=>p.provider==='hunter');renderPolicy();adapter?.render?.();
      if(policy.enabled)for(const candidate of adapter?.rows?.()||[])void auto(candidate);
    }catch(error){if(workspace()===id){loadedWorkspace='';policy=null;provider=null;renderPolicy();status(error.message);}}
  }
  function readiness(candidate,person,options={}){return P.readiness(candidate,person,{...options,companyAssessment:adapter?.assessment?.(candidate),confirmedEmail:adapter?.email?.(candidate,person)});}
  function record(candidate,person,message,{status='not_verified',append=false}={}){
    outcomes.set(key(candidate,person),message);
    person.contactVerification={status,checkedAt:new Date().toISOString(),issues:[...(append?person.contactVerification?.issues||[]:[]),message].slice(-12)};
    adapter?.saveOutcome?.(candidate,person);adapter?.render?.();
  }
  function card(candidate,person){
    if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return '<p class="additional-contact-note">Company email found. Complete the enabled Hunter verification before using the flow.</p>';
    const result=outcomes.get(key(candidate,person))||person.contactVerification?.issues?.join(' · ');
    if(!adapter||!readiness(candidate,person).eligible)return result?`<p class="additional-contact-note" role="status">${esc(result)}</p>`:'';
    return `<p class="additional-contact-note" role="status"><strong>Strong match. No confirmed public work email found.</strong>${result?` <span>${esc(result)}</span>`:''}</p>`;
  }
  function label(candidate,person){if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return 'Verify email with Hunter';return adapter&&readiness(candidate,person).eligible?'Find email with additional services':'';}
  function openSettings(){document.getElementById('open-settings')?.click();setTimeout(()=>document.querySelector('[data-integration="apollo"]')?.scrollIntoView?.({behavior:'smooth',block:'center'}),100);}
  async function confirm(candidate,person,{automatic=false,freeConfirm}={}){
    const identity=key(candidate,person);if(publicChecking.has(identity))return publicChecking.get(identity);
    const id=workspace(),personId=String(person.id),domain=candidate.domain;
    const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter?.rows?.()||[]).includes(candidate)&&candidate.domain===domain&&candidate.people?.some(p=>String(p.id)===personId);
    const task=(async()=>{try{
      if(!current())return false;
      if(adapter?.email?.(candidate,person))return true;
      // Every Find email action checks saved/public evidence before provider credits,
      // including people with no public address saved by an earlier research run.
      if(freeConfirm)await freeConfirm();
      if(!current())return false;
      person=candidate.people.find(p=>String(p.id)===personId);
      if(adapter?.email?.(candidate,person))return true;
      if(adapter?.baseEmail?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return automatic?false:verifyHunter(candidate,person);
      return run(candidate,person,{automatic});
    }catch(error){if(workspace()===id){record(candidate,person,error.message||'Public contact checks need attention.',{status:'error'});adapter?.toast?.(error.message);}return false;}})();
    publicChecking.set(identity,task);try{return await task;}finally{publicChecking.delete(identity);}
  }
  async function verifyHunter(candidate,person){
    const id=workspace(),email=adapter.baseEmail(candidate,person),identity=key(candidate,person)+'|hunter';
    if(!email||running.has(identity))return false;
    const personId=person.id;
    const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter.rows?.()||[]).includes(candidate)&&candidate.people?.some(p=>String(p.id)===String(personId))&&adapter.baseEmail(candidate,person)===email&&readiness(candidate,person).eligible;
    const task=(async()=>{
      const approved=await (root.LeadIntelDialogs?.confirm(`Verify ${email} with your enabled Hunter account. This may consume Hunter verification credits.`,{title:'Additional email verification',action:'Verify with Hunter'})??false);
      if(!approved||!current())return false;
      adapter.pending(candidate,person,true);adapter.render();
      try{const result=await api('/api/integrations/services/hunter/verify-email',{method:'POST',body:JSON.stringify({email})});if(!current())return false;
        if(result.email!==email||result.status!=='valid'||result.deliverability!=='deliverable')throw Error('Hunter did not confirm deliverability. The buyer stays pending.');
        await adapter.saveHunter(candidate,person,email,{status:result.status,deliverability:result.deliverability,checked_at:result.checked_at});return true;
      }catch(error){if(workspace()===id){outcomes.set(key(candidate,person),error.message);adapter.toast?.(error.message);}return false;}
      finally{if(workspace()===id){adapter.pending(candidate,person,false);adapter.render();}}
    })();running.set(identity,task);try{return await task;}finally{running.delete(identity);}
  }
  async function run(candidate,person,{automatic=false}={}){
    const identity=key(candidate,person);if(running.has(identity))return running.get(identity);
    const execute=(async()=>{
      const id=workspace(),domain=candidate.domain,personId=person.id;
      const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter?.rows?.()||[]).includes(candidate)&&candidate.domain===domain&&candidate.people?.some(p=>String(p.id)===String(personId));
      const check=()=>{if(!current())throw Error('Workspace or buyer changed. Retry in the current workspace.');const ready=readiness(candidate,person,{automatic});if(!ready.eligible)throw Error(ready.reason);};
      const receipts=[];
      try{
        check();
        if(loadedWorkspace!==id||!policy)await load();
        check();if(!policy||loadedWorkspace!==id)throw Error('Research preferences could not load. Retry or check Settings.');
        if(automatic&&!policy.enabled)throw Error('Automatic paid email research is off.');
        const apolloReady=provider?.configured&&provider.source==='customer'&&provider.metadata?.email_enrichment_enabled===true;
        const hunterReady=!automatic&&hunter?.configured&&hunter.source==='customer'&&hunter.metadata?.additional_verification_enabled===true;
        if(!apolloReady&&!hunterReady)throw Error('Connect Apollo and enable email enrichment, or connect and enable Hunter in Settings.');
        for(const service of [...(apolloReady?['apollo']:[]),...(hunterReady?['hunter']:[])]){
          check();const name=service==='apollo'?'Apollo':'Hunter';
          if(!automatic){
            const description=service==='apollo'?'Apollo email enrichment':'Hunter email finding and, if needed, one delivery verification';
            const approved=await (root.LeadIntelDialogs?.confirm(`${person.publicName||person.name} at ${candidate.company}: use ${description} with your provider credits. ${receipts.length?'Apollo has not confirmed an email. ':''}Limits: ${policy.maxPerCompany} buyers per company, ${policy.dailyLimit} provider lookups per day, ${policy.monthlyLimit} per month. A lookup can return no confirmed email.`,{title:'Find email with additional services',action:service==='hunter'?'Find with Hunter':'Find work email'})??false);
            if(!current())return false;
            if(!approved){record(candidate,person,[...receipts,`${name} · skipped: not approved`].join(' · '));return false;}
          }
          check();adapter.pending(candidate,person,true);adapter.render();
          try{
            const company=await adapter.prepare(candidate);check();
            const result=await api('/api/additional-contact-services/email',{method:'POST',body:JSON.stringify({company_id:company.id,person_id:personId,provider:service,automatic,approved:!automatic,hunter_approved:service==='hunter'&&!automatic})});
            if(!current())return false;
            if(result.error)throw Error(result.error);
            const outcome=result.research?.status||result.request?.status||(result.contact?'verified':'not_found');
            receipts.push(`${name} · ${outcome}${result.cached?' (saved result; no new lookup)':''}${result.reason?': '+result.reason:''}`);
            if(result.contact){
              await adapter.accept(candidate,person,result);
              if(!current())return false;
              record(candidate,person,receipts.join(' · '),{status:'verified'});
              if(service==='hunter'&&result.verification)await adapter.saveHunter?.(candidate,person,result.contact.work_email,result.verification);
              if(adapter.baseEmail?.(candidate,person)&&!adapter.email(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return automatic?false:verifyHunter(candidate,person);
              return Boolean(adapter.email(candidate,person));
            }
            if(outcome==='processing'){record(candidate,person,receipts.join(' · ')+' · A lookup is in progress; retry after it completes.');return false;}
            record(candidate,person,receipts.join(' · '));
          }catch(error){
            if(!current())return false;
            receipts.push(`${name} · error: ${error.message}`);record(candidate,person,receipts.join(' · '),{status:'error'});
            // A failed provider is visible and does not impersonate a successful zero-result search.
          }finally{if(current()){adapter.pending(candidate,person,false);adapter.render();}}
        }
        return false;
      }catch(error){if(current()){record(candidate,person,error.message,{status:'error'});adapter.toast?.(error.message);}return false;}
      finally{if(current()){adapter.pending(candidate,person,false);adapter.render();}}
    })();running.set(identity,execute);try{return await execute;}finally{running.delete(identity);}
  }
  async function auto(candidate){
    if(!adapter||loadedWorkspace!==workspace()||!policy?.enabled)return;
    if(!provider?.configured||provider.source!=='customer'||provider.metadata?.email_enrichment_enabled!==true)return;
    const targets=P.targets(candidate,{companyAssessment:adapter.assessment(candidate),maxPerCompany:policy.maxPerCompany,confirmedEmail:p=>adapter.email(candidate,p)});
    for(const person of targets){
      const fingerprint=[key(candidate,person),person.emailResearch?.checkedAt,policy.updatedAt].join('|');
      if(automaticAttempts.has(fingerprint))continue;automaticAttempts.add(fingerprint);
      await run(candidate,person,{automatic:true});
    }
  }
  document.getElementById('additional-contact-preferences')?.addEventListener('submit',async event=>{
    event.preventDefault();if(busyPolicy||loadedWorkspace!==workspace())return;
    const form=event.currentTarget,id=workspace(),input={enabled:form.elements.enabled.checked,dailyLimit:Number(form.elements.dailyLimit.value),monthlyLimit:Number(form.elements.monthlyLimit.value),maxPerCompany:Number(form.elements.maxPerCompany.value)};
    busyPolicy=true;for(const field of form.elements)field.disabled=true;
    try{
      if(input.enabled&&provider?.configured){
        await api('/api/integrations/services/apollo/settings',{method:'PUT',body:JSON.stringify({discovery:provider.metadata?.discovery_enabled!==false,email:true,phone:provider.metadata?.phone_enrichment_enabled===true,daily_limit:input.dailyLimit,monthly_limit:input.monthlyLimit})});
      }
      if(workspace()!==id)throw Error('Workspace changed; research preferences were not saved.');
      const saved=await api('/api/additional-contact-services/policy',{method:'PUT',body:JSON.stringify(input)});
      if(workspace()!==id)return;policy=saved.policy;automaticAttempts.clear();await load();status('Research preferences saved. '+(input.enabled?'Additional email services are approved within your limits.':'Automatic paid email research is off.'));
    }catch(error){if(workspace()===id)status(error.message);}
    finally{busyPolicy=false;if(workspace()===id){renderPolicy();}}
  });
  root.LeadIntelAdditionalContacts={register(value){adapter=value;void load();},load,card,label,confirm,run,auto,readiness};
  root.addEventListener('leadintel:server-ready',()=>void load());
  root.addEventListener('leadintel:service-settings-changed',()=>void load());
  root.addEventListener('leadintel:service-status',()=>void load());
  renderPolicy();
})(window);
