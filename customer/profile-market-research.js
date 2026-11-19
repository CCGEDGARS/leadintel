(function(root,factory){
  const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root){root.LeadIntelProfileMarket=api;if(root.document)api.install(root);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RESEARCH_IDS=['run-market-research','run-detailed-research','run-market-intelligence'];
  let environment=null;
  function resultsMessage(main={}){
    const market=main.market||{},count=market.researchResults?.length||0,reports=market.researchReports?.length||0;
    if(market.researchStatus==='running')return count?`Research is running. ${count} sources are retained so far.`:'Research is running. Results will appear as evidence is collected.';
    if(count)return `${count} research source${count===1?'':'s'} available${market.researchStatus==='partial'?' · partial coverage':''}${market.researchContextStale?' · review against your updated profile':''}. Review your profile before choosing the Strategy.`;
    if(reports)return 'Saved reports are available. There is no current market evidence linked to Strategy.';
    if(['error','failed','canceled'].includes(market.researchStatus))return 'The last run did not save usable market evidence. Review the research status before retrying.';
    return main.profile?'Market research is optional and has not been run. You can review your profile and continue to Strategy.':'Review your company profile to enable market research. No market evidence is saved yet.';
  }
  function mount(host,root=environment){
    if(!root?.document||!host)return false;
    const workbench=root.document.getElementById('market-research-workbench');if(!workbench)return false;
    if(workbench.parentNode!==host)host.appendChild(workbench);
    let main={};try{main=JSON.parse(root.localStorage.getItem('leadintel_customer_v2_state')||'{}');}catch{}
    const prerequisite=root.document.getElementById('market-profile-prerequisite');if(prerequisite)prerequisite.hidden=Boolean(main.profile);
    root.dispatchEvent(new root.CustomEvent('leadintel:profile-market-opened'));
    return true;
  }
  async function open(root=environment){
    if(!root)return false;root.LeadIntelCustomerNavigation?.setStep?.(2);
    try{
      if(!root.LeadIntelReferenceCustomerLauncher?.open)await import('./reference-customer-launcher.js?v=20261001-profile-market-v1&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1&profile-audit=20261030-v1&company-lists=20261118-v1');
      return Boolean(await root.LeadIntelReferenceCustomerLauncher?.open?.('market'));
    }catch(error){root.console?.error?.('Market research could not open',error);const toast=root.document?.getElementById('toast');if(toast){toast.textContent='Market research could not open. Reload the workspace and try again.';toast.classList.add('show');}return false;}
  }
  function install(root){
    if(root.document.__profileMarketInstalled)return;root.document.__profileMarketInstalled=true;environment=root;
    root.document.addEventListener('click',event=>{
      if(event.target?.closest?.('[data-open-profile-market]')){void open(root);return;}
      if(event.target?.closest?.('[data-review-market-strategy]')){root.dispatchEvent(new root.CustomEvent('leadintel:review-research-profile'));return;}
      if(event.target?.closest?.('[data-complete-market-profile]')){root.dispatchEvent(new root.CustomEvent('leadintel:review-research-profile'));}
    });
  }
  return {mount,open,install,resultsMessage,RESEARCH_IDS};
});
