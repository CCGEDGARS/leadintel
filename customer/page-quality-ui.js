(function(root){
  'use strict';
  const Q=root.LeadIntelPageQuality;if(root.__leadIntelPageQualityUI)return;root.__leadIntelPageQualityUI=true;
  const guarded={
    'to-questionnaire':['setup','advance'], 'analyze-company':['profile','research'], 'confirm-market-research':['profile','research'], 'approve-profile':['profile','approve'],
    'run-company-discovery':['companies','research'], 'activate-market-strategy':['strategy','approve'], 'confirm-strategy-handoff':['strategy','advance'],
    'message-generate':['messages','generate'], 'approve-outreach':['messages','approve'],
    'mw-add-flow':['messages','flow'], 'mw-mark-default':['messages','library'], 'message-save-as-template':['messages','library'],
    'open-gmail-draft':['delivery','send'], 'send-with-gmail':['delivery','send'], 'send-with-microsoft':['delivery','send']
  };
  if(!Q){
    const message='Page checks could not load. Reload this page to retry.';
    const show=()=>{const host=root.document.getElementById('journey-stage-guide');if(host&&!host.querySelector('[data-page-quality]')){const panel=root.document.createElement('p');panel.dataset.pageQuality='';panel.className='page-quality';panel.dataset.state='blocked';panel.setAttribute('role','alert');panel.textContent='Page check: Blocked · '+message;host.appendChild(panel);}};
    root.document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled||(!guarded[button.id]&&!button.matches('[data-crm-action]')))return;event.preventDefault();event.stopImmediatePropagation();show();const toast=root.document.getElementById('toast');if(toast){toast.textContent=message;toast.classList.add('show');}},true);
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',show,{once:true});else show();return;
  }
  const MAIN='leadintel_customer_v2_state',q=id=>root.document.getElementById(id);
  const read=()=>{const value=JSON.parse(root.localStorage.getItem(MAIN)||'{}');if(!value||Array.isArray(value)||typeof value!=='object')throw Error('invalid state');return value;};
  const has=value=>Boolean(String(value??'').trim()),active=rows=>(rows||[]).filter(row=>row.active===true);
  const make=Q.check;
  function mainContext(page){
    const main=read(),market=main.market||{},research=page==='profile',confirmed=root.LeadIntelStep2Brief?.confirmationMissing?.(main,research?'message':'research');
    const fields=confirmed?.length||0;
    const checks=[make('company-website','Company website supplied',has(main.website),'Add your company website.',{target:{step:1,id:'company-website'}}),make('target-markets','Target markets selected',Array.isArray(main.targetMarkets)&&main.targetMarkets.some(has),'Choose at least one target market.',{target:{step:1,id:'target-market-selector'}})];
    if(page==='setup')checks.push(make('website-activated','Company website activated',Boolean(root.LeadIntelWebsiteActivation?.isCurrentWebsiteActive?.(main.website)),'Activate your company website before continuing.',{actions:['advance'],target:{step:1,id:'activate-website'}}));
    else{
      checks.push(make('profile-confirmed','Profile answers reviewed',confirmed!==undefined&&!fields,'Review and confirm the required Profile answers.',{actions:page==='profile'?['approve']:['approve','research','advance'],target:{step:2,selector:'[data-question]'}}));
      checks.push(make('targeting-confirmed','Targeting confirmed',root.LeadIntelTargeting?.isConfirmed?.(main)===true,'Confirm your targeting answers in Profile.',{actions:['approve','research','advance'],target:{step:2,id:'confirm-targeting'}}));
    }
    if(page==='profile'){const required=root.LeadIntelStep2Brief?.confirmationMissing?.(main,'research');checks.push(make('profile-research-confirmed','Required research answers reviewed',Array.isArray(required)&&!required.length,'Review the required research answers in Profile.',{actions:['research'],target:{step:2,selector:'[data-question]'}}));}
    if(page==='profile')checks.push(make('profile-built','Company profile generated',Boolean(main.profile),'Generate your company profile before approval.',{actions:['approve'],target:{step:2,id:'analyze-company'}}));
    if(page==='strategy'){
      checks.push(make('profile-approved','Profile approved',Boolean(main.profile&&main.approved),'Review and approve your Profile.',{target:{step:3,id:'approve-profile'}}));
      checks.push(make('active-icp','Customer definition selected',active(market.icps).length>0,'Activate at least one customer definition.',{target:{step:4,selector:'[data-icp-field="active"]'}}));
      checks.push(make('active-signals','Buying signals selected',active(market.signals).length>0,'Activate at least one buying signal.',{target:{step:4,selector:'[data-signal-field="active"]'}}));
      const blockers=root.LeadIntelPageProcedures?.strategyBlockers?.();checks.push(make('strategy-consistent','Strategy matches current company context',Array.isArray(blockers)&&!blockers.length,blockers?.[0]||'Wait for Strategy checks to load.',{actions:['approve','advance','research'],target:{step:4,id:'activate-market-strategy'}}));
    }
    return {loaded:Boolean(q(page==='setup'?'step-1':page==='profile'?'step-2':'step-4')),inputs:{website:main.website,markets:main.targetMarkets,answers:main.answers,statuses:main.answerStatus,approval:main.approved,profile:main.profile,market},checks};
  }
  for(const page of ['setup','profile','strategy'])Q.register(page,{read:()=>mainContext(page)});

  function focus(target){if(!target)return;if(target.step)root.LeadIntelCustomerNavigation?.setStep?.(target.step);const node=target.id?q(target.id):root.document.querySelector(target.selector);node?.scrollIntoView?.({block:'center',behavior:'smooth'});node?.focus?.({preventScroll:true});}
  function denied(page,action){const report=Q.getReport(page);const problem=report?.checks.find(row=>row.status!=='pass'&&(row.actions.includes('*')||row.actions.includes(action)));const toast=q('toast');if(toast){toast.textContent=problem?.message||'Complete the page checks before proceeding.';toast.classList.add('show');clearTimeout(denied.timer);denied.timer=setTimeout(()=>toast.classList.remove('show'),3000);}focus(problem?.target);}
  root.document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;let route=guarded[button.id];
    if(button.matches('[data-crm-action]'))route=['crm','write'];
    if(!route||Q.require(...route))return;event.preventDefault();event.stopImmediatePropagation();denied(...route);
  },true);
  function render(report){
    const host=report.page==='crm'?q('crm-status')?.parentNode:report.page==='messages'&&q('message-studio')?q('step-6'):q('journey-stage-guide');if(!host)return;
    let panel=host.querySelector('[data-page-quality]');if(!panel){panel=root.document.createElement('details');panel.dataset.pageQuality='';panel.className='page-quality';panel.innerHTML='<summary><span data-quality-indicator aria-hidden="true"></span><strong data-quality-label></strong><span data-quality-message></span></summary><ul data-quality-checks></ul><button class="text-btn" type="button" data-quality-resolve>Review required information</button>';if(report.page==='messages'&&q('message-studio'))q('message-studio').before(panel);else host.appendChild(panel);panel.querySelector('[data-quality-resolve]').addEventListener('click',()=>focus(panel._report?.target));}
    const signature=JSON.stringify([report.page,report.state,report.message,report.checks.map(row=>[row.id,row.status])]);if(panel.dataset.signature===signature)return;panel.dataset.signature=signature;panel._report=report;panel.dataset.state=report.state;
    panel.querySelector('[data-quality-label]').textContent='Page check: '+report.label;panel.querySelector('[data-quality-message]').textContent=report.state==='ready'?'':report.message;panel.querySelector('[data-quality-resolve]').hidden=!report.target;
    const list=panel.querySelector('[data-quality-checks]');list.replaceChildren(...report.checks.map(check=>{const li=root.document.createElement('li');li.dataset.status=check.status;li.textContent=(check.status==='pass'?'✓ ':check.status==='pending'?'… ':'• ')+check.label;return li;}));
    panel.setAttribute('aria-busy',String(report.state==='preparing'));
  }
  root.addEventListener('leadintel:page-quality',event=>render(event.detail));
  root.addEventListener('leadintel:server-ready',()=>Q.refresh());
  const css=root.document.createElement('link');css.rel='stylesheet';css.href='page-quality.css?v=20261010-v1';root.document.head.appendChild(css);
  Q.refresh();
})(window);
