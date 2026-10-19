(function(root){
  'use strict';
  const API='https://leadintel-api.edgars-7e7.workers.dev',P=root.LeadIntelAdditionalContactPolicy;
  let adapter=null,loadedWorkspace='',policy=null,provider=null,busyPolicy=false;
  const running=new Map(),automaticAttempts=new Set(),outcomes=new Map();
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
      policy=value.policy;loadedWorkspace=id;provider=services.providers?.find(p=>p.provider==='apollo');renderPolicy();adapter?.render?.();
      if(policy.enabled)for(const candidate of adapter?.rows?.()||[])void auto(candidate);
    }catch(error){if(workspace()===id){loadedWorkspace='';policy=null;provider=null;renderPolicy();status(error.message);}}
  }
  function readiness(candidate,person){return P.readiness(candidate,person,{companyAssessment:adapter?.assessment?.(candidate),confirmedEmail:adapter?.email?.(candidate,person)});}
  function card(candidate,person){
    if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return '<p class="additional-contact-note">Company email found. Complete the enabled Hunter verification before using the flow.</p>';
    if(!adapter||!readiness(candidate,person).eligible)return '';
    const result=outcomes.get(key(candidate,person));
    return `<p class="additional-contact-note" role="status"><strong>Strong match. No confirmed public work email found.</strong>${result?` <span>${esc(result)}</span>`:''}</p>`;
  }
  function label(candidate,person){if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return 'Verify email with Hunter';return adapter&&readiness(candidate,person).eligible?'Find email with additional services':'';}
  function openSettings(){document.getElementById('open-settings')?.click();setTimeout(()=>document.querySelector('[data-integration="apollo"]')?.scrollIntoView?.({behavior:'smooth',block:'center'}),100);}
  async function confirm(candidate,person,{automatic=false,freeConfirm}={}){
    if(adapter?.email?.(candidate,person))return freeConfirm?.()??true;
    if(adapter?.publicSource?.(candidate,person)){
      await freeConfirm?.();
      if(adapter?.email?.(candidate,person))return true;
    }
    if(adapter?.baseEmail?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return automatic?false:verifyHunter(candidate,person);
    return run(candidate,person,{automatic});
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
      const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter?.rows?.()||[]).includes(candidate)&&candidate.domain===domain&&candidate.people?.some(p=>String(p.id)===String(personId))&&readiness(candidate,person).eligible;
      if(!current())return false;
      if(loadedWorkspace!==id||!policy)await load();
      if(!current()||!policy||loadedWorkspace!==id||automatic&&!policy.enabled)return false;
      if(!provider?.configured||provider.source!=='customer'||provider.metadata?.email_enrichment_enabled!==true){
        outcomes.set(identity,'Connect Apollo and enable email enrichment in Settings.');adapter.render();if(!automatic)openSettings();return false;
      }
      if(!automatic){
        const approved=await (root.LeadIntelDialogs?.confirm(`${person.publicName||person.name} at ${candidate.company}: use Apollo email enrichment with your provider credits. Public research is complete. Limits: ${policy.maxPerCompany} buyers per company, ${policy.dailyLimit} lookups per day, ${policy.monthlyLimit} per month. A lookup may return no confirmed email.`,{title:'Find email with additional services',action:'Find work email'})??false);
        if(!approved||!current())return false;
      }
      adapter.pending(candidate,person,true);outcomes.delete(identity);adapter.render();
      try{
        const company=await adapter.prepare(candidate);if(!current())return false;
        const result=await api('/api/additional-contact-services/email',{method:'POST',body:JSON.stringify({company_id:company.id,person_id:personId,automatic,approved:!automatic})});
        if(!current())return false;
        if(result.error)throw Error(result.error);
        if(result.contact){await adapter.accept(candidate,person,result);outcomes.set(identity,adapter.email(candidate,person)?'Company email confirmed.':'Company email found; review your additional verification requirement.');}
        else outcomes.set(identity,result.reason|| (result.request?.status==='processing'?'A lookup is already in progress. Refresh this buyer after it completes.':'Additional services did not return a confirmed work email.'));
        return Boolean(result.contact);
      }catch(error){if(workspace()===id){outcomes.set(identity,error.message);adapter.toast?.(error.message);}return false;}
      finally{if(workspace()===id){adapter.pending(candidate,person,false);adapter.render();}}
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
