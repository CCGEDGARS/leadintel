(function(root){
  'use strict';
  const API='https://leadintel-api.edgars-7e7.workers.dev',P=root.LeadIntelAdditionalContactPolicy;
  let adapter=null,loadedWorkspace='',policy=null,provider=null,hunter=null,treg=null,busyPolicy=false,policyRole='',policyRequest=0;
  const publicChecking=new Map(),running=new Map(),automaticAttempts=new Set(),outcomes=new Map();
  const bridge=()=>root.LeadIntelServerBridge,workspace=()=>bridge()?.workspace?.id||'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=(candidate,person)=>[workspace(),candidate.domain,person.id].join('|');
  async function api(path,options={}){
    const id=workspace();if(!id||!bridge()?.session?.authenticated)throw Error('Sign in to configure additional services.');
    const response=await fetch(`${API}${path}${path.includes('?')?'&':'?'}workspace_id=${encodeURIComponent(id)}`,{credentials:'include',...options,headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(options.body?.includes('\"data_lookup\":true')?240000:60000)});
    const result=await response.json();if(workspace()!==id)throw Error('Workspace changed; retry in the current workspace.');
    if(!response.ok)throw Object.assign(Error(result.error||'Additional services are unavailable.'),{code:result.code});return result;
  }
  function status(message){const node=document.getElementById('additional-contact-status');if(node)node.textContent=message;}
  function mountPaidSearch(card=document.getElementById('delivery-setup')){
    if(!card)return;const footer=card.querySelector('.delivery-settings-footer, [data-paid-settings-controls]');if(!footer)return;
    const valid=loadedWorkspace===workspace()&&policy,isTreg=valid&&policy.provider==='treg';
    for(const channel of ['email','phone']){
      const phone=channel==='phone',selector=phone?'[data-paid-phone-toggle]':'[data-paid-search-toggle]';
      let button=footer.querySelector(selector);if(!button){button=document.createElement('button');button.type='button';button.className='secondary-btn';if(phone)button.dataset.paidPhoneToggle='1';else button.dataset.paidSearchToggle='1';footer.insertBefore(button,footer.querySelector('#delivery-setup-save')||footer.lastElementChild);button.addEventListener('click',()=>togglePaidSearch(channel,{settings:card.hasAttribute('data-paid-contact-settings')}));}
      const active=isTreg&&(phone?policy.phoneEnabled:policy.enabled);
      button.disabled=!valid||busyPolicy||policyRole!=='owner';button.textContent=busyPolicy?'Saving preferences…':active?'Paid '+channel+' search: ON ✓':'Activate paid '+channel+' search';button.setAttribute('aria-pressed',String(Boolean(active)));button.classList.toggle('paid-search-active',Boolean(active));
    }
    let estimate=card.querySelector('[data-paid-search-estimate]');if(!estimate){estimate=document.createElement('p');estimate.className='field-help paid-search-estimate';estimate.dataset.paidSearchEstimate='1';footer.after(estimate);}
    estimate.textContent='Email research: approx. €0.30/contact. Phone lookup: approx. €0.20 extra per number found.'+(isTreg&&policy.enabled&&policy.phoneEnabled?' Estimated combined cost: €0.50/contact.':'')+' Planning estimates for research and AI, not fixed prices; provider, AI and scraping usage vary. Existing subscription charges are separate. Numbers may be unavailable or unconfirmed.';
    let note=card.querySelector('[data-paid-search-status]');if(!note){note=document.createElement('p');note.className='field-help';note.dataset.paidSearchStatus='1';note.setAttribute('role','status');estimate.after(note);}
    note.textContent=!valid?'Sign in or reload paid-search settings.':isTreg&&(policy.enabled||policy.phoneEnabled)?'Treg · Email '+(policy.enabled?'ON':'OFF')+' · Phone '+(policy.phoneEnabled?'ON':'OFF')+' · Automatic: 1 strongest eligible buyer per company · manual: selected buyer · '+policy.dailyLimit+' lookups/day · '+policy.monthlyLimit+'/month. Preferences are saved. ON records permission, not remaining budget or successful research. Lookup limits and provider readiness are checked on each request. Automatic paid research runs after eligible buyer research, including in manual delivery mode. Sending requires separate activation.':treg?.configured?'Treg connected. Paid email and phone research are off. Saving settings does not start paid searches or send messages.':'Connect your Treg team token in Settings before activation.';
  }
  function mountSettings(){const card=document.querySelector('[data-paid-contact-settings]');if(card)mountPaidSearch(card);}
  function renderPaidControls(){mountPaidSearch();mountSettings();}
  async function togglePaidSearch(channel='email',{settings=false}={}){
    if(busyPolicy||loadedWorkspace!==workspace()||policyRole!=='owner')return;
    const id=workspace(),phone=channel==='phone',enabled=!(policy.provider==='treg'&&(phone?policy.phoneEnabled:policy.enabled));
    if(enabled&&!treg?.configured){openSettings('treg');status('Connect your Treg team token in Settings, then activate paid search.');return;}
    const daily=settings?policy.dailyLimit:Math.max(1,Math.min(50,Number(document.getElementById('delivery-setup-custom')?.hidden===false?document.getElementById('delivery-setup-custom').value:document.getElementById('delivery-setup-limit')?.value)||policy.dailyLimit||5));
    const input={enabled:phone?Boolean(policy.provider==='treg'&&policy.enabled):enabled,phoneEnabled:phone?enabled:Boolean(policy.provider==='treg'&&policy.phoneEnabled),provider:'treg',maxPerCompany:1,dailyLimit:daily,monthlyLimit:settings?policy.monthlyLimit:Math.max(daily,Math.min(1000,Math.max(policy.monthlyLimit||0,daily*30)))};
    busyPolicy=true;policyRequest++;renderPaidControls();
    try{
      if(enabled){const approved=await (root.LeadIntelDialogs?.confirm((phone?'Activate paid phone lookup. Budget approximately €0.20 per number found. This does not activate paid email search. A number may be missing or provider-listed without confirmed reachability or ownership. Each phone request is capped at $0.25.':'Activate paid work-email finding and verification. Budget approximately €0.30/contact for research and AI. This does not activate paid phone search. Treg finding and verification are capped at $0.075 combined; public/AI research costs vary.')+' These are estimates, not fixed prices. Up to '+input.dailyLimit+' contact lookups/day and '+input.monthlyLimit+'/month; one buyer per company. Saving this choice does not run a paid lookup or send messages. Automatic sending requires separate activation.',{title:'Activate paid '+channel+' search',action:'Activate paid '+channel+' search'})??false);if(!approved)return;}
      if(id!==workspace())throw Error('Workspace changed. Paid search was not changed.');
      const saved=await api('/api/additional-contact-services/policy',{method:'PUT',body:JSON.stringify(input)});policy=saved.policy;automaticAttempts.clear();renderPolicy();root.dispatchEvent(new CustomEvent('leadintel:paid-search-changed'));
    }catch(error){status(error.message);outcomes.set('policy-error',error.message);}
    finally{busyPolicy=false;if(id===workspace()){renderPaidControls();const note=document.querySelector('[data-paid-search-status]');if(note&&outcomes.has('policy-error')){note.textContent=outcomes.get('policy-error');outcomes.delete('policy-error');}}}
  }
  function renderPolicy(){
    renderPaidControls();
    const form=document.getElementById('additional-contact-preferences');if(!form)return;
    const valid=loadedWorkspace===workspace()&&policy,owner=bridge()?.workspace?.role==='owner';
    for(const field of form.elements)field.disabled=!valid||!owner||busyPolicy;
    if(!valid){form.reset();status('Sign in to save optional research preferences.');return;}
    form.elements.enabled.checked=policy.enabled;
    for(const name of ['dailyLimit','monthlyLimit','maxPerCompany'])form.elements[name].value=String(policy[name]);
    status(policy.enabled?`Approved · up to ${policy.maxPerCompany} buyers per company, ${policy.dailyLimit} lookups per day and ${policy.monthlyLimit} per month.${provider?.configured?'':' Connect Apollo in Settings before use.'}`:'Public research first. Additional services require your approval when needed.');
  }
  async function load(){
    const id=workspace(),serial=++policyRequest;if(!id||!bridge()?.session?.authenticated){loadedWorkspace='';policy=null;provider=null;renderPolicy();return;}
    if(loadedWorkspace!==id){loadedWorkspace='';policy=null;provider=null;renderPolicy();}
    try{
      const [value,services]=await Promise.all([api('/api/additional-contact-services/policy'),api('/api/integrations/services/status')]);
      if(workspace()!==id||serial!==policyRequest||busyPolicy)return;
      policy=value.policy;policyRole=value.role||bridge()?.workspace?.role||'';loadedWorkspace=id;treg=services.providers?.find(p=>p.provider==='treg');provider=services.providers?.find(p=>p.provider==='apollo');hunter=services.providers?.find(p=>p.provider==='hunter');renderPolicy();adapter?.render?.();

    }catch(error){if(workspace()===id){loadedWorkspace='';policy=null;provider=null;renderPolicy();status(error.message);}}
  }
  function readiness(candidate,person,options={}){return P.readiness(candidate,person,{provider:options.dataLookup?'treg':policy?.provider,...options,companyAssessment:adapter?.assessment?.(candidate),confirmedEmail:options.confirmedEmail??adapter?.email?.(candidate,person)});}
  function record(candidate,person,message,{status='not_verified',append=false,lookup=null}={}){
    outcomes.set(key(candidate,person),message);
    person.contactVerification={status,lookup,checkedAt:new Date().toISOString(),issues:[...(append?person.contactVerification?.issues||[]:[]),message].slice(-12)};
    adapter?.saveOutcome?.(candidate,person);adapter?.render?.();
  }
  function card(candidate,person){
    if(person.contactData){
      const latest=person.contactVerification?.status==='error'&&Date.parse(person.contactVerification.checkedAt)>Date.parse(person.contactData.checkedAt||'1970-01-01')?' · Newer saved attempt: '+(person.contactVerification.issues||[]).join(' · '):'';
      const help=/rejected the saved team token/i.test(JSON.stringify(person.contactData))?' Saved token failure: reconnect Treg in Settings, then explicitly retry the saved lookup. This record does not test the new connection.':'';
      const d=person.contactData,p=d.profile||{},phone=d.phone||{},summary=[p.status==='provider_reported'?['Profile · provider reported',p.title,p.company,p.seniority,p.city,p.country,p.linkedinUrl,p.source?'Source: '+p.source:''].filter(Boolean).join(' · '):'Profile · '+String(p.status||'not_requested').replaceAll('_',' '),phone.number?phone.number+' · provider listing · reachability and ownership unconfirmed':'Saved phone check · '+String(phone.status||'not_requested').replaceAll('_',' ')+(phone.reason?' · '+phone.reason:'')];
      return '<p class="additional-contact-note" role="status">'+summary.map(esc).join('<br>')+'<br>'+esc(d.status==='updated'?'Data updated':d.status==='partial'?'Saved checks need review':'No new data')+' · '+esc(d.checkedAt)+esc(help)+esc(latest)+(Number.isFinite(d.costMicro)?' · Treg lookup total $'+(d.costMicro/1000000).toFixed(4):'')+(d.lastAttempt?.status==='partial'?'<br>Latest check needs review; previously found details retained.':'')+'</p>';
    }
    if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return '<p class="additional-contact-note">Company email found. Complete the enabled Hunter verification before using the flow.</p>';
    const result=outcomes.get(key(candidate,person))||person.contactVerification?.issues?.join(' · ');
    const paidHold=/lookup limit reached|approval was revoked/i.test(result||'')?'<small class="additional-contact-paused">That paid lookup was blocked. Review current limits and approval in Setup. '+(bridge()?.conflict?'Resolve workspace sync before using Recheck.':'Recheck remains available for public-source research.')+' No limit or approval was changed.</small>':'';
    if(!adapter||!readiness(candidate,person).eligible)return result?`<p class="additional-contact-note" role="status">Saved lookup attempt: ${esc(result)}${paidHold}</p>`:'';
    return `<p class="additional-contact-note" role="status"><strong>Strong match. No confirmed public work email found.</strong>${result?` <span>Saved lookup attempt: ${esc(result)}</span>`:''}${paidHold}</p>`;
  }
  function label(candidate,person){if(adapter?.baseEmail?.(candidate,person)&&!adapter?.email?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return 'Verify email with Hunter';return adapter&&readiness(candidate,person).eligible?'Find email with additional services':'';}
  function openSettings(service='apollo'){document.getElementById('open-settings')?.click();setTimeout(()=>document.querySelector('[data-integration="'+service+'"]')?.scrollIntoView?.({behavior:'smooth',block:'center'}),100);}
  async function confirm(candidate,person,{automatic=false,freeConfirm,dataLookup=false,channel,phoneOnly=channel==='phone',emailOnly=channel==='email'}={}){
    const identity=key(candidate,person);if(publicChecking.has(identity))return publicChecking.get(identity);
    const id=workspace(),personId=String(person.id),domain=candidate.domain,identitySnapshot=JSON.stringify([person.publicName||person.name,person.title,person.publicLinkedinUrl||person.linkedin_url]);
    const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter?.rows?.()||[]).includes(candidate)&&candidate.domain===domain&&candidate.people?.some(p=>String(p.id)===personId&&JSON.stringify([p.publicName||p.name,p.title,p.publicLinkedinUrl||p.linkedin_url])===identitySnapshot);
    const task=(async()=>{try{
      if(!current())return false;
      if(!dataLookup&&adapter?.email?.(candidate,person))return true;
      // Every Find email action checks saved/public evidence before provider credits,
      // including people with no public address saved by an earlier research run.
      if(!adapter?.email?.(candidate,person)){if(freeConfirm)await freeConfirm();}
      if(!current())return false;
      person=candidate.people.find(p=>String(p.id)===personId);
      if(!dataLookup&&adapter?.email?.(candidate,person))return true;
      if(!dataLookup&&adapter?.baseEmail?.(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return automatic?false:verifyHunter(candidate,person);
      return run(candidate,person,{automatic,dataLookup,phoneOnly,emailOnly});
    }catch(error){if(current()){record(candidate,person,error.message||'Public contact checks need attention.',{status:'error'});adapter?.toast?.(error.message);}return false;}})();
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
  function savedPhone(candidate,person){return Boolean(adapter?.phone?.(candidate,person)||person.contactData?.phone?.status==='provider_listed'&&person.contactData.phone.number);}
  async function run(candidate,person,{automatic=false,dataLookup=false,channel,phoneOnly=channel==='phone',emailOnly=channel==='email'}={}){
    const identity=key(candidate,person);if(running.has(identity))return running.get(identity);
    const execute=(async()=>{
      const id=workspace(),domain=candidate.domain,personId=person.id,identitySnapshot=JSON.stringify([person.publicName||person.name,person.title,person.publicLinkedinUrl||person.linkedin_url]);
      const current=()=>workspace()===id&&!bridge()?.conflict&&(adapter?.rows?.()||[]).includes(candidate)&&candidate.domain===domain&&candidate.people?.some(p=>String(p.id)===String(personId)&&JSON.stringify([p.publicName||p.name,p.title,p.publicLinkedinUrl||p.linkedin_url])===identitySnapshot);
      const check=()=>{if(!current())throw Error('Workspace or buyer changed. Retry in the current workspace.');person=candidate.people.find(p=>String(p.id)===String(personId));const ready=readiness(candidate,person,{automatic,dataLookup,...(dataLookup?{confirmedEmail:''}:{})});if(!ready.eligible)throw Error(ready.reason);};
      const receipts=[];
      try{
        check();
        if(loadedWorkspace!==id||!policy)await load();
        check();if(!policy||loadedWorkspace!==id)throw Error('Research preferences could not load. Retry or check Settings.');
        if((dataLookup||policy.provider==='treg')&&(policy.provider!=='treg'||!policy.enabled&&!policy.phoneEnabled))throw Error('Paid email and phone search are off. Activate the required service in Setup.');
        if(automatic&&!policy.enabled&&!policy.phoneEnabled)throw Error('Automatic paid contact research is off.');
        const tregReady=(dataLookup||policy.provider==='treg')&&treg?.configured&&treg.source==='customer';
        const apolloReady=!dataLookup&&policy.provider!=='treg'&&provider?.configured&&provider.source==='customer'&&provider.metadata?.email_enrichment_enabled===true;
        const hunterReady=!dataLookup&&policy.provider!=='treg'&&!automatic&&hunter?.configured&&hunter.source==='customer'&&hunter.metadata?.additional_verification_enabled===true;
        if(!tregReady&&!apolloReady&&!hunterReady)throw Error('Connect Treg in Settings before paid email research.');
        for(const service of [...(tregReady?['treg']:[]),...(apolloReady?['apollo']:[]),...(hunterReady?['hunter']:[])]){
          check();const name=service==='treg'?'Treg':service==='apollo'?'Apollo':'Hunter';
          if(phoneOnly&&!policy.phoneEnabled)throw Error('Paid phone search is off. Activate it in Setup.');
          if(emailOnly&&!policy.enabled)throw Error('Paid email search is off. Activate it in Step 1 or Settings.');
          const includePhone=!emailOnly&&service==='treg'&&policy.phoneEnabled===true&&(!automatic||!savedPhone(candidate,person)),includeEmail=!phoneOnly&&(service!=='treg'||policy.enabled===true)&&(!automatic||!adapter.email(candidate,person));
          if(!includeEmail&&!includePhone)return true;
          const lookupData=automatic?includePhone:dataLookup||includePhone;
          if(dataLookup&&!automatic){
            if(service!=='treg')throw Error('Data confirmation requires Treg.');
            const choice=await (root.LeadIntelDialogs?.confirm(`${person.publicName||person.name} at ${candidate.company}: ${includeEmail?'research work email and professional profile':'phone only; no paid email or profile lookup'}${includePhone?'; find a phone number':''}. Estimated ${includeEmail&&includePhone?'€0.50/contact':includeEmail?'€0.30/contact':'€0.20 per number found'}. Actual research costs vary. Treg request ceilings: ${includeEmail?'$0.125 for email + profile':''}${includeEmail&&includePhone?' plus ':''}${includePhone?'$0.25 for phone':''}. Saved phases are reused. Phone results remain provider-listed unless separately confirmed. This action does not send messages.`,{title:phoneOnly?'Confirm phone':'Confirm data',action:includeEmail&&includePhone?'Confirm email + phone':includePhone?'Confirm phone':'Confirm email'})??false);
            if(!choice||!current())return false;
          }
          if(!dataLookup&&!automatic&&!(service==='treg'&&policy.enabled)){
            const description=service==='treg'?'Treg work-email finding and delivery verification':service==='apollo'?'Apollo email enrichment':'Hunter email finding and, if needed, one delivery verification';
            const approved=await (root.LeadIntelDialogs?.confirm(`${person.publicName||person.name} at ${candidate.company}: use ${description} with your provider credits. ${receipts.length?'Apollo has not confirmed an email. ':''}Limits: ${policy.maxPerCompany} buyers per company, ${policy.dailyLimit} provider lookups per day, ${policy.monthlyLimit} per month. A lookup can return no confirmed email.`,{title:'Find email with additional services',action:service==='hunter'?'Find with Hunter':'Find work email'})??false);
            if(!current())return false;
            if(!approved){record(candidate,person,[...receipts,`${name} · skipped: not approved`].join(' · '));return false;}
          }
          check();adapter.pending(candidate,person,true);adapter.render();
          try{
            const company=await adapter.prepare(candidate);check();
            const result=await api('/api/additional-contact-services/email',{method:'POST',body:JSON.stringify({company_id:company.id,person_id:personId,provider:service,automatic,approved:!automatic,...(service==='treg'?{data_lookup:lookupData,phone_approved:includePhone,email_lookup:includeEmail}:{}),hunter_approved:service==='hunter'&&!automatic})});
            if(!current())return false;
            if(result.error)throw Error(result.error);
            check();
            if(result.contact?.external_person_id&&String(result.contact.external_person_id)!==String(personId)||result.contactData&&(String(result.contactData.personId)!==String(personId)||result.contactData.domain!==domain))throw Object.assign(Error('Contact result identity does not match the selected buyer; result was not applied.'),{code:'CONTACT_IDENTITY_MISMATCH'});
            if(result.contactData){person.contactData=result.contactData;adapter?.saveOutcome?.(candidate,person);}
            const cost=result.research?.costMicro;
            const outcome=result.research?.status||result.request?.status||(result.contact?'verified':'not_found');
            receipts.push(`${name} · ${outcome}${Number.isFinite(cost)?' · Treg cost $'+(cost/1000000).toFixed(4):''}${result.cached?' (saved result; no new lookup)':''}${result.reason?': '+result.reason:''}`);
            if(result.contact){
              await adapter.accept(candidate,person,result);
              if(!current())return false;person=candidate.people.find(p=>String(p.id)===String(personId));
              record(candidate,person,receipts.join(' · '),{status:adapter.email(candidate,person)?'verified':'not_verified'});
              if(service==='hunter'&&result.verification)await adapter.saveHunter?.(candidate,person,result.contact.work_email,result.verification);
              if(!dataLookup&&adapter.baseEmail?.(candidate,person)&&!adapter.email(candidate,person)&&root.LeadIntelServiceSettings?.hunterEnabled?.())return automatic?false:verifyHunter(candidate,person);
              return Boolean(adapter.email(candidate,person));
            }
            if(outcome==='processing'){record(candidate,person,receipts.join(' · ')+' · A lookup is in progress; retry after it completes.');return false;}
            record(candidate,person,receipts.join(' · '));
          }catch(error){
            if(!current())return false;
            receipts.push(`${/^ADDITIONAL_CONTACT_(?:DAILY|MONTHLY|COMPANY)_LIMIT$/.test(error.code||'')?'LeadIntel · blocked':name+' · error'}: ${error.message}`);record(candidate,person,receipts.join(' · '),{status:'error',lookup:{provider:service,phone:includePhone,email:includeEmail,code:error.code||'PROVIDER_ERROR'}});
            // A failed provider is visible and does not impersonate a successful zero-result search.
          }finally{if(current()){adapter.pending(candidate,person,false);adapter.render();}}
        }
        return false;
      }catch(error){if(current()){record(candidate,person,error.message,{status:'error',lookup:{provider:policy?.provider||'unknown',phone:!emailOnly&&(phoneOnly||dataLookup&&policy?.phoneEnabled===true),email:!phoneOnly&&(emailOnly||policy?.provider!=='treg'||policy?.enabled===true),code:error.code||'CONTACT_CHECK_BLOCKED'}});adapter.toast?.(error.message);}return false;}
      finally{if(current()){adapter.pending(candidate,person,false);adapter.render();}}
    })();running.set(identity,execute);try{return await execute;}finally{running.delete(identity);}
  }
  async function auto(candidate,{trigger}={}){
    // A selected buyer's manual confirmation owns this company until settled.
    const prefix=[workspace(),candidate.domain,''].join('|');
    if([...publicChecking.keys()].some(identity=>identity.startsWith(prefix)))return;
    if(trigger==='research_completed'&&(loadedWorkspace!==workspace()||!policy))await load();
    if(busyPolicy||!adapter||loadedWorkspace!==workspace()||!(policy?.enabled||policy?.phoneEnabled))return;
    if(policy.provider==='treg'){
      if(!treg?.configured||treg.source!=='customer')return;
      if(trigger!=='research_completed')return;
    }else if(!provider?.configured||provider.source!=='customer'||provider.metadata?.email_enrichment_enabled!==true)return;
    const targets=P.targets(candidate,{provider:policy.provider,companyAssessment:adapter.assessment(candidate),maxPerCompany:policy.provider==='treg'?1:policy.maxPerCompany,confirmedEmail:p=>policy.provider==='treg'?(!policy.enabled||adapter.email(candidate,p))&&(!policy.phoneEnabled||savedPhone(candidate,p))?'complete':'':adapter.email(candidate,p)});
    for(const person of targets){
      const fingerprint=[key(candidate,person),person.emailResearch?.checkedAt,policy.updatedAt,Boolean(policy.enabled),Boolean(policy.phoneEnabled)].join('|');
      if(automaticAttempts.has(fingerprint))continue;automaticAttempts.add(fingerprint);
      await run(candidate,person,{automatic:true,dataLookup:policy.provider==='treg'&&policy.phoneEnabled===true});
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
  root.LeadIntelAdditionalContacts={mountPaidSearch,mountSettings,policy:()=>loadedWorkspace===workspace()?{...policy}:null,register(value){adapter=value;void load();},load,card,label,confirm,run,auto,readiness};
  root.addEventListener('leadintel:workspace-reset',()=>{loadedWorkspace='';policy=null;provider=null;treg=null;policyRole='';automaticAttempts.clear();renderPolicy();});
  root.addEventListener('leadintel:server-ready',()=>void load());
  root.addEventListener('leadintel:service-settings-changed',()=>void load());
  root.addEventListener('leadintel:service-status',()=>void load());
  renderPolicy();
})(window);
